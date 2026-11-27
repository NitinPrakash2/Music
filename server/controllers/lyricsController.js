const axios = require('axios');
const { sql } = require('../db');

const MASHUP_OR_MIX_RE = /\b(mashup|jukebox|nonstop|non-stop|medley|megamix|mega\s*mix|all\s*songs|best\s*of|compilation|back\s*to\s*back|lofi\s*mix|dj\s*mix|1\s*hour|2\s*hour|3\s*hour|audio\s*jukebox|full\s*album)\b/i;

const cleanTitle = (raw = '') => {
  let s = raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('|')[0];

  s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  s = s.replace(/\b(full\s*(video\s*)?song|official\s*(music\s*)?(video|audio)|lyrical\s*video|lyrics\s*video|video\s*song|audio\s*song|4k|8k|hd|slowed\s*\+?\s*reverb|lofi)\b/gi, ' ');
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
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);

const scoreHit = (hit, cleanQ, targetDuration) => {
  let score = 0;
  if (hit.syncedLyrics) score += 50;
  else if (hit.plainLyrics) score += 10;
  else return -100;

  const textSample = hit.syncedLyrics || hit.plainLyrics || '';
  // Prefer Roman/Latin script when song title is in English/Hinglish
  if (isMostlyLatin(cleanQ)) {
    if (isMostlyLatin(textSample)) score += 40;
    else score -= 25;
  }

  // Title word overlap
  const qWords = normalizeWords(cleanQ);
  const tWords = new Set(normalizeWords(hit.trackName || ''));
  let overlap = 0;
  for (const w of qWords) if (tWords.has(w)) overlap++;
  score += overlap * 15;

  // Duration closeness bonus if known
  if (targetDuration > 0 && hit.duration > 0) {
    const diff = Math.abs(hit.duration - targetDuration);
    if (diff <= 5) score += 25;
    else if (diff <= 15) score += 10;
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

  const cacheKey = videoId ? `v2:${videoId}` : null;

  try {
    if (cacheKey) {
      const cached = await sql`SELECT data FROM lyrics_cache WHERE video_id = ${cacheKey} LIMIT 1`;
      if (cached.length > 0) {
        return res.json(cached[0].data);
      }
    }

    const cleaned = cleanTitle(title);
    const parts = cleaned.split(/\s+-\s+/);
    const candidatesQueries = [
      cleaned,
      parts.length > 1 ? parts[1] : null,
      channel ? `${parts[0]} ${channel.replace(/\s*-\s*Topic$/i, '')}`.trim() : null,
    ].filter(Boolean);

    let allHits = [];
    for (const q of candidatesQueries) {
      const hits = await searchLrcLib(q);
      allHits = allHits.concat(hits);
      // If we already found a strong Latin synced match, stop early
      const strong = hits.find((h) => h.syncedLyrics && (!isMostlyLatin(cleaned) || isMostlyLatin(h.syncedLyrics)));
      if (strong && normalizeWords(cleaned).some((w) => normalizeWords(strong.trackName).includes(w))) {
        break;
      }
    }

    let bestMatch = null;
    let bestScore = -Infinity;
    for (const hit of allHits) {
      const s = scoreHit(hit, cleaned, durNum);
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
