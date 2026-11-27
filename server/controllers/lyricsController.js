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

const BREAK_LINE_RE = /^(\.{2,}|…+|♪+|♫+|\(?\s*(instrumental|music|interlude|intro|outro)\s*\)?)$/i;

const parseLrc = (lrc = '') => {
  const rawLines = [];
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
    const isBreak = !text || BREAK_LINE_RE.test(text);
    rawLines.push({ time, text: isBreak ? '•••' : text, isBreak });
  }
  rawLines.sort((a, b) => a.time - b.time);

  // Deduplicate consecutive breaks and drop trailing breaks
  const lines = [];
  for (const line of rawLines) {
    if (line.isBreak && (lines.length === 0 || lines[lines.length - 1].isBreak)) continue;
    lines.push(line);
  }
  while (lines.length > 0 && lines[lines.length - 1].isBreak) lines.pop();
  return lines;
};

const isMostlyLatin = (text = '') => {
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  const nonLatin = (text.match(/[^\x00-\x7F]/g) || []).length;
  return latin >= nonLatin;
};

const normalizeWords = (s = '') =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !GENERIC_TITLE_WORDS.has(w));

const NON_SONG_HIT_RE = /\b(episode|podcast|diary|audiobook|story|speech|chapter)\b/i;

const scoreHit = (hit, cleanQ, rawTitle, channel, targetDuration) => {
  let score = 0;
  if (hit.syncedLyrics) score += 50;
  else if (hit.plainLyrics) score += 10;
  else return -100;

  const trackRaw = hit.trackName || '';
  if (NON_SONG_HIT_RE.test(trackRaw) || NON_SONG_HIT_RE.test(hit.albumName || '')) {
    if (!NON_SONG_HIT_RE.test(rawTitle)) return -100;
  }

  // Strip parentheticals like (From "Movie") before comparing title words
  const trackClean = trackRaw.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  const qWords = normalizeWords(cleanQ);
  const tWords = new Set(normalizeWords(trackClean));
  let overlap = 0;
  for (const w of qWords) if (tWords.has(w)) overlap++;
  if (qWords.length > 0 && overlap === 0) return -100;
  if (qWords.length > 1 && overlap / qWords.length < 0.5) return -100;

  score += (overlap / Math.max(1, qWords.length)) * 60;
  score -= Math.max(0, tWords.size - overlap) * 6;

  // Artist / album / channel / rawTitle credit match bonus & mismatch penalty
  const contextText = `${rawTitle} ${channel}`.toLowerCase();
  const artistWords = normalizeWords(hit.artistName || '').filter((w) => w.length >= 3);
  const artistHits = artistWords.filter((aw) => contextText.includes(aw)).length;
  if (artistHits > 0) {
    score += Math.min(2, artistHits) * 35;
  } else if (rawTitle.includes('|') && artistWords.length > 0) {
    // Title explicitly lists artist/movie credits, and this hit's artist doesn't match any of them
    score -= 90;
  }

  const albumWords = normalizeWords(hit.albumName || '').filter((w) => w.length >= 4);
  if (albumWords.some((alw) => contextText.includes(alw))) {
    score += 25;
  }

  const textSample = hit.syncedLyrics || hit.plainLyrics || '';
  // Prefer Roman/Latin script when song title is in English/Hinglish
  if (isMostlyLatin(cleanQ)) {
    if (isMostlyLatin(textSample)) score += 40;
    else score -= 25;
  }

  // Duration closeness bonus/penalty — crucial so edited YouTube intros don't mismatch extended versions
  if (targetDuration > 0 && hit.duration > 0) {
    const diff = Math.abs(hit.duration - targetDuration);
    if (diff <= 3) score += 60;
    else if (diff <= 8) score += 35;
    else if (diff <= 18) score += 10;
    else if (diff > 90) score -= 80;
    else if (diff > 30) score -= 40;
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

const searchKuGouLrc = async (query, targetDuration = 0) => {
  try {
    const sr = await axios.get('https://mobileservice.kugou.com/api/v3/search/song', {
      params: { format: 'json', keyword: query, page: 1, pagesize: 3 },
      timeout: 5000,
    });
    const songs = sr.data?.data?.info || [];
    const pick = targetDuration > 0
      ? songs.find((s) => Math.abs((s.duration || 0) - targetDuration) <= 10) || songs[0]
      : songs[0];
    if (!pick?.hash) return '';

    const cr = await axios.get('https://lyrics.kugou.com/search', {
      params: { ver: 1, man: 'yes', client: 'pc', keyword: pick.songname || query, duration: (pick.duration || 0) * 1000, hash: pick.hash },
      timeout: 5000,
    });
    const cand = cr.data?.candidates?.[0];
    if (!cand?.id || !cand?.accesskey) return '';

    const dl = await axios.get('https://lyrics.kugou.com/download', {
      params: { ver: 1, client: 'pc', id: cand.id, accesskey: cand.accesskey, fmt: 'lrc', charset: 'utf8' },
      timeout: 5000,
    });
    return dl.data?.content ? Buffer.from(dl.data.content, 'base64').toString('utf8') : '';
  } catch {
    return '';
  }
};

const getLyrics = async (req, res) => {
  const { videoId, title, channel, duration } = req.query;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const durNum = Number(duration) || 0;
  // Do not fetch/show lyrics for mashups, jukeboxes, or long mixes (> 8 minutes)
  if (MASHUP_OR_MIX_RE.test(title) || durNum > 480) {
    return res.json({ synced: [], plain: '', disabled: true });
  }

  res.set('Cache-Control', 'no-store');
  const cacheKey = videoId ? `v20:${videoId}:${durNum > 0 ? Math.round(durNum / 5) * 5 : 0}` : null;

  try {
    if (cacheKey) {
      const cached = durNum > 0
        ? await sql`SELECT data FROM lyrics_cache WHERE video_id = ${cacheKey} LIMIT 1`
        : await sql`SELECT data FROM lyrics_cache WHERE video_id LIKE ${`v20:${videoId}:%`} ORDER BY created_at DESC LIMIT 1`;
      if (cached.length > 0) {
        return res.json(cached[0].data);
      }
    }

    const cleaned = cleanTitle(title);
    const parts = cleaned.split(/\s+-\s+/).filter((p) => normalizeWords(p).length > 0);
    const pipeCredits = title.split('|').slice(1).map((s) => s.split(',')[0].trim()).filter((s) => normalizeWords(s).length > 0);
    const firstCredit = pipeCredits[0] || '';
    const lastCredit = pipeCredits.length > 1 ? pipeCredits[pipeCredits.length - 1] : '';

    const candidatesQueries = [
      firstCredit ? `${cleaned} ${firstCredit}`.trim() : null,
      lastCredit ? `${cleaned} ${lastCredit}`.trim() : null,
      cleaned,
      parts.length > 1 ? parts[1] : null,
      parts.length > 1 ? parts[0] : null,
    ].filter(Boolean);

    let allHits = [];
    for (const q of [...new Set(candidatesQueries)]) {
      const hits = await searchLrcLib(q);
      allHits = allHits.concat(hits);
      // Only stop early if we found a strong match that also matches artist/album credits
      const strong = hits.find((h) => scoreHit(h, cleaned, title, channel, durNum) >= 155);
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

    let syncedLines = bestMatch && bestScore > 0 && bestMatch.syncedLyrics ? parseLrc(bestMatch.syncedLyrics) : [];

    // Fallback to KuGou human-synced LRC if LRCLIB only had plain lyrics
    if (syncedLines.length === 0 && cleaned) {
      const kugouQuery = firstCredit ? `${cleaned} ${firstCredit}`.trim() : cleaned;
      const kugouLrc = await searchKuGouLrc(kugouQuery, durNum);
      if (kugouLrc) {
        const parsedKg = parseLrc(kugouLrc);
        if (parsedKg.length >= 4) syncedLines = parsedKg;
      }
    }

    const payload = (bestMatch && bestScore > 0) || syncedLines.length > 0
      ? {
          synced: syncedLines,
          plain: bestMatch?.plainLyrics || '',
          trackName: bestMatch?.trackName || cleaned,
          artistName: bestMatch?.artistName || channel || '',
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
