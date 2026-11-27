const axios = require('axios');
const { sql } = require('../db');

const cleanTitle = (raw = '') => {
  // Decode common HTML entities
  let s = raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('|')[0];

  // Remove bracketed tags like (Official Video), [4K], (From "Stree 2"), etc.
  s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  // Remove common YouTube noise phrases
  s = s.replace(/\b(full\s*(video\s*)?song|official\s*(music\s*)?(video|audio)|lyrical\s*video|lyrics\s*video|video\s*song|audio\s*song|4k|8k|hd|slowed\s*\+?\s*reverb|lofi)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // If "Artist - Song", keep clean spacing
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
  const { videoId, title, channel } = req.query;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  try {
    if (videoId) {
      const cached = await sql`SELECT data FROM lyrics_cache WHERE video_id = ${videoId} LIMIT 1`;
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

    let bestMatch = null;
    for (const q of candidatesQueries) {
      const hits = await searchLrcLib(q);
      const syncedHit = hits.find((h) => h.syncedLyrics);
      if (syncedHit) {
        bestMatch = syncedHit;
        break;
      }
      if (!bestMatch && hits.length > 0) {
        bestMatch = hits.find((h) => h.plainLyrics) || hits[0];
      }
    }

    const payload = bestMatch
      ? {
          synced: bestMatch.syncedLyrics ? parseLrc(bestMatch.syncedLyrics) : [],
          plain: bestMatch.plainLyrics || '',
          trackName: bestMatch.trackName || cleaned,
          artistName: bestMatch.artistName || channel || '',
        }
      : { synced: [], plain: '', trackName: cleaned, artistName: channel || '' };

    if (videoId) {
      await sql`
        INSERT INTO lyrics_cache (video_id, data)
        VALUES (${videoId}, ${JSON.stringify(payload)}::jsonb)
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
