const axios = require('axios');
const { sql } = require('../db');

const MASHUP_OR_MIX_RE = /\b(mashup|jukebox|nonstop|non-stop|medley|megamix|mega\s*mix|all\s*songs|best\s*of|compilation|back\s*to\s*back|lofi\s*mix|dj\s*mix|1\s*hour|2\s*hour|3\s*hour|audio\s*jukebox|full\s*album)\b/i;

const GENERIC_TITLE_WORDS = new Set([
  'official', 'lyrical', 'lyric', 'lyrics', 'video', 'audio', 'song', 'songs',
  'full', 'hd', '4k', '8k', 'status', 'whatsapp', 'reel', 'reels', 'shorts',
  'lofi', 'slowed', 'reverb', 'unplugged', 'cover', 'remix', 'version', 'from',
  'music', 'feat', 'ft',
]);

const cleanTitle = (raw = '') => {
  let s = raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('|')[0];

  s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  s = s.replace(/\s+-\s+(official|lyrical|lyric|lyrics|full|video|audio|song|hd|4k|8k|status|whatsapp|reel|shorts|lofi|slowed|reverb|unplugged|cover|remix|dj).*$/i, '');
  s = s.replace(/\b(full\s*(video\s*)?song|official\s*(music\s*)?(video|audio)|lyrical\s*(video)?|lyrics\s*(video)?|video\s*song|audio\s*song|4k|8k|hd|slowed\s*\+?\s*reverb|lofi)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s.replace(/^[\-\s]+|[\-\s]+$/g, '').trim();
};

const parseLrc = (lrc = '') => {
  const lines = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/;
  for (const rawLine of lrc.split(/\r?\n/)) {
    const m = rawLine.match(regex);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const msStr = (m[3] || '0').padEnd(3, '0').slice(0, 3);
    const ms = parseInt(msStr, 10);
    const time = min * 60 + sec + ms / 1000;
    const text = m[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
};

const isMostlyLatin = (text = '') => {
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  const nonLatin = (text.match(/[^\x00-\x7F]/g) || []).length;
  return latin >= nonLatin;
};

const normalizeWords = (s = '') =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !GENERIC_TITLE_WORDS.has(w));

const scoreHit = (hit, cleanQ, rawTitle, channel, targetDuration) => {
  let score = 0;
  if (hit.syncedLyrics) score += 50;
  else if (hit.plainLyrics) score += 10;
  else return -100;

  // Title word overlap — require meaningful match with song title
  const qWords = normalizeWords(cleanQ);
  const tWords = new Set(normalizeWords(hit.trackName || ''));
  let overlap = 0;
  for (const w of qWords) if (tWords.has(w)) overlap++;
  if (qWords.length > 0 && overlap === 0) return -100;
  if (qWords.length > 1 && overlap / qWords.length < 0.5) return -100;

  score += (overlap / Math.max(1, qWords.length)) * 60;
  score -= Math.max(0, tWords.size - overlap) * 6;

  // Artist / channel / rawTitle credit match bonus
  const contextText = `${rawTitle} ${channel}`.toLowerCase();
  const artistWords = normalizeWords(hit.artistName || '');
  for (const aw of artistWords) {
    if (aw.length >= 4 && contextText.includes(aw)) {
      score += 12;
      break;
    }
  }

  const textSample = hit.syncedLyrics || hit.plainLyrics || '';
  // Prefer Roman/Latin script when song title is in English/Hinglish
  if (isMostlyLatin(cleanQ)) {
    if (isMostlyLatin(textSample)) score += 40;
    else score -= 25;
  }

  // Duration closeness bonus if known
  if (targetDuration > 0 && hit.duration > 0) {
    const diff = Math.abs(hit.duration - targetDuration);
    if (diff <= 5) score += 25;
    else if (diff <= 15) score += 12;
    else if (diff > 60) score -= 20;
  }

  return score;
};

const searchLrcLib = async (q) => {
  if (!q) return [];
  const res = await axios.get('https://lrclib.net/api/search', {
    params: { q },
    timeout: 8000,
    headers: { 'User-Agent': 'Relaxify/1.0.0' },
  });
  return Array.isArray(res.data) ? res.data : [];
};

const getLyrics = async (req, res) => {
  const { videoId, title, channel, duration } = req.query;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const durNum = Number(duration) || 0;
  // Do not fetch/show lyrics for mashups, jukeboxes, or long mixes (> 8 minutes)
  if (MASHUP_OR_MIX_RE.test(title) || durNum > 480) {
    return res.json({ synced: [], plain: '', disabled: true });
  }

  const cacheKey = videoId ? `v3:${videoId}` : null;

  try {
    if (cacheKey) {
      const cached = await sql`SELECT data FROM lyrics_cache WHERE video_id = ${cacheKey} LIMIT 1`;
      if (cached.length > 0) {
        return res.json(cached[0].data);
      }
    }

    const cleaned = cleanTitle(title);
    const parts = cleaned.split(/\s+-\s+/).filter((p) => normalizeWords(p).length > 0);
    const candidatesQueries = [
      cleaned,
      parts.length > 1 ? parts[1] : null,
      parts.length > 1 ? parts[0] : null,
    ].filter(Boolean);

    let allHits = [];
    for (const q of [...new Set(candidatesQueries)]) {
      const hits = await searchLrcLib(q);
      allHits = allHits.concat(hits);
      // If we already found a strong Latin synced match for the title, stop early
      const strong = hits.find((h) => scoreHit(h, cleaned, title, channel, durNum) >= 100);
      if (strong) break;
    }

    let bestMatch = null;
    let bestScore = -Infinity;
    for (const hit of allHits) {
      const s = scoreHit(hit, cleaned, title, channel, durNum);
      if (s > bestScore) {
        bestScore = s;
        bestMatch = hit;
      }
    }

    const payload = bestMatch && bestScore > 0
      ? {
          synced: bestMatch.syncedLyrics ? parseLrc(bestMatch.syncedLyrics) : [],
          plain: bestMatch.plainLyrics || '',
          trackName: bestMatch.trackName || cleaned,
          artistName: bestMatch.artistName || channel || '',
        }
      : { synced: [], plain: '', trackName: cleaned, artistName: channel || '' };

    if (cacheKey) {
      await sql`
        INSERT INTO lyrics_cache (video_id, data)
        VALUES (${cacheKey}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (video_id)
        DO UPDATE SET data = EXCLUDED.data, created_at = NOW()
      `;
    }

    res.json(payload);
  } catch (err) {
    console.error('[LYRICS ERROR]', err.message);
    res.json({ synced: [], plain: '' });
  }
};

module.exports = { getLyrics };
