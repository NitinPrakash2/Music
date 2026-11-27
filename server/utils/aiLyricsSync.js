const { spawn } = require('child_process');
const rawFfmpegPath = require('ffmpeg-static');
const ffmpegPath = rawFfmpegPath ? rawFfmpegPath.replace('app.asar', 'app.asar.unpacked') : null;

const NON_VOCAL_SEG_RE = /^\s*(\[.*\]|\(.*\)|♪+|music|applause|laughter|silence|\.+)?\s*$/i;

const extractAudioSnippet = (audioUrl, seconds = 55) =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath || !audioUrl) return reject(new Error('ffmpeg or audioUrl missing'));
    const chunks = [];
    const ff = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', audioUrl,
      '-t', String(seconds),
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '48k',
      '-f', 'mp3',
      'pipe:1',
    ]);

    const timer = setTimeout(() => {
      try { ff.kill('SIGKILL'); } catch {}
      reject(new Error('ffmpeg snippet timeout'));
    }, 15000);

    ff.stdout.on('data', (d) => chunks.push(d));
    ff.on('error', (err) => { clearTimeout(timer); reject(err); });
    ff.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg exited ${code}`));
    });
  });

const wordTokens = (s = '') =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);

const tokenOverlap = (a = '', b = '') => {
  const ta = wordTokens(a);
  const tb = new Set(wordTokens(b));
  if (!ta.length || !tb.size) return 0;
  let hits = 0;
  for (const w of ta) if (tb.has(w)) hits++;
  return hits / Math.max(ta.length, tb.size);
};

const shiftLines = (lines, offsetSec) => {
  if (!Number.isFinite(offsetSec) || Math.abs(offsetSec) < 0.4 || Math.abs(offsetSec) > 45) {
    return null;
  }
  const rounded = Number(offsetSec.toFixed(2));
  return {
    lines: lines.map((l) => ({
      ...l,
      time: Math.max(0, Number((l.time + rounded).toFixed(2))),
    })),
    aiSynced: true,
    offsetSec: rounded,
  };
};

const alignWithGroq = async (mp3Buf, lines, vocalLines) => {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) return null;

  const form = new FormData();
  form.append('file', new Blob([mp3Buf], { type: 'audio/mpeg' }), 'snippet.mp3');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    console.warn('[AI SYNC] Groq API error:', res.status);
    return null;
  }

  const data = await res.json();
  const segments = (data.segments || []).filter(
    (s) => s.text && !NON_VOCAL_SEG_RE.test(s.text) && Number.isFinite(s.start)
  );
  if (!segments.length) return null;

  let bestOffset = null;
  let bestOverlap = 0;
  for (const seg of segments.slice(0, 6)) {
    for (const lrc of vocalLines.slice(0, 6)) {
      const sim = tokenOverlap(seg.text, lrc.text);
      if (sim > bestOverlap && sim >= 0.25) {
        bestOverlap = sim;
        bestOffset = seg.start - lrc.time;
      }
    }
  }

  if (bestOffset === null) {
    bestOffset = segments[0].start - vocalLines[0].time;
  }

  const result = shiftLines(lines, bestOffset);
  if (result) {
    console.log(`[AI SYNC:GROQ] Shifted lyrics by ${result.offsetSec > 0 ? '+' : ''}${result.offsetSec}s (sim=${bestOverlap.toFixed(2)})`);
  }
  return result;
};

const alignWithGemini = async (mp3Buf, lines, vocalLines) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const sampleLines = vocalLines.slice(0, 6).map((l, idx) => `${idx}: [${l.time.toFixed(2)}s] ${l.text}`).join('\n');
  const prompt = `Listen to this 55-second audio clip of a song. Find the exact timestamp in seconds (e.g. 12.4) when the singer begins singing one of these first lyric lines:\n${sampleLines}\n\nReply ONLY with valid JSON: {"lineIndex": <number>, "actualStartSec": <number>}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'audio/mp3', data: mp3Buf.toString('base64') } },
          { text: prompt },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    console.warn('[AI SYNC] Gemini API error:', res.status);
    return null;
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(text);
  const idx = Number(parsed.lineIndex);
  const actualSec = Number(parsed.actualStartSec);
  if (!Number.isFinite(idx) || !Number.isFinite(actualSec) || !vocalLines[idx]) return null;

  const offset = actualSec - vocalLines[idx].time;
  const result = shiftLines(lines, offset);
  if (result) {
    console.log(`[AI SYNC:GEMINI] Shifted lyrics by ${result.offsetSec > 0 ? '+' : ''}${result.offsetSec}s (line ${idx})`);
  }
  return result;
};

/**
 * Aligns LRCLIB lyrics to the actual YouTube audio using Groq Whisper (primary)
 * with Gemini 2.5 Flash as automatic fallback.
 */
const alignLyricsWithAI = async ({ lines, audioStreamUrl }) => {
  const hasGroq = Boolean((process.env.GROQ_API_KEY || '').trim());
  const hasGemini = Boolean((process.env.GEMINI_API_KEY || '').trim());
  if ((!hasGroq && !hasGemini) || !audioStreamUrl || !Array.isArray(lines) || !lines.length) {
    return null;
  }

  const vocalLines = lines.filter((l) => !l.isBreak && l.text);
  if (!vocalLines.length) return null;

  try {
    const mp3Buf = await extractAudioSnippet(audioStreamUrl, 55);
    if (hasGroq) {
      const groqRes = await alignWithGroq(mp3Buf, lines, vocalLines).catch(() => null);
      if (groqRes) return groqRes;
    }
    if (hasGemini) {
      const gemRes = await alignWithGemini(mp3Buf, lines, vocalLines).catch(() => null);
      if (gemRes) return gemRes;
    }
    return null;
  } catch (err) {
    console.warn('[AI SYNC] Skipped:', err.message);
    return null;
  }
};

module.exports = { alignLyricsWithAI };
