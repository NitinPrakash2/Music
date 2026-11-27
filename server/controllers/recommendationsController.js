const crypto = require('crypto');
const { sql } = require('../db');
const { youtubeSearch } = require('../utils/youtubeSearch');

const extractArtistFallback = (recentTracks = [], searchQueries = [], likedTracks = []) => {
  const counts = new Map();
  const add = (raw, weight) => {
    if (!raw) return;
    const cleaned = raw
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\b(official|music|records|company|t-series|saregama|zee music|tips|sony music)\b/gi, '')
      .trim();
    if (cleaned.length >= 3) {
      counts.set(cleaned, (counts.get(cleaned) || 0) + weight);
    }
  };

  searchQueries.slice(0, 8).forEach((q) => add(q, 3));
  recentTracks.slice(0, 10).forEach((t) => add(t.channel, 2));
  likedTracks.slice(0, 8).forEach((t) => add(t.channel, 1.5));

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  if (!top.length) {
    return { queries: [], reason: '' };
  }
  return {
    queries: top.map((name) => `${name} popular song`),
    reason: `Based on ${top.slice(0, 2).join(' & ')}`,
  };
};

const getAiTasteQueries = async ({ recentTracks, searchQueries, likedTracks }) => {
  const recentList = recentTracks.slice(0, 10).map((t) => `- ${t.title} (${t.channel || 'Unknown'})`).join('\n');
  const searchList = searchQueries.slice(0, 8).join(', ');
  const likedList = likedTracks.slice(0, 6).map((t) => `- ${t.title} (${t.channel || 'Unknown'})`).join('\n');

  const prompt = `You are a dynamic music recommender. Analyze this user's recent listening & search history and suggest 3 YouTube Music search queries for popular individual songs matching the exact singers, artists, language, and mood they listen to most.

Recently Played:
${recentList || '(none)'}

Recent Searches: ${searchList || '(none)'}

Liked Songs:
${likedList || '(none)'}

Rules:
- Dynamically infer the user's favorite artists, language, and vibe strictly from the history above.
- Suggest 3 specific popular individual song queries ("<Artist> <Song Title>") — NEVER "best of", "collection", "mashup", or "jukebox".
- Do NOT repeat songs already listed in Recently Played.
- Reply ONLY with valid JSON: {"queries": ["q1", "q2", "q3"], "reason": "Based on <top inferred artists or vibe>"}`;

  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
          console.log('[REC:GROQ]', parsed.reason);
          return {
            queries: parsed.queries.slice(0, 3).map(String),
            reason: String(parsed.reason || 'Picked for you'),
            aiPowered: 'groq',
          };
        }
      } else {
        console.warn('[REC:GROQ] HTTP', res.status);
      }
    } catch (e) {
      console.warn('[REC:GROQ]', e.message);
    }
  }

  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
          console.log('[REC:GEMINI]', parsed.reason);
          return {
            queries: parsed.queries.slice(0, 3).map(String),
            reason: String(parsed.reason || 'Picked for you'),
            aiPowered: 'gemini',
          };
        }
      } else {
        console.warn('[REC:GEMINI] HTTP', res.status);
      }
    } catch (e) {
      console.warn('[REC:GEMINI]', e.message);
    }
  }

  return { ...extractArtistFallback(recentTracks, searchQueries, likedTracks), aiPowered: false };
};

const recommendationsController = async (req, res) => {
  try {
    const recentTracks = Array.isArray(req.body?.recentTracks) ? req.body.recentTracks : [];
    const searchQueries = Array.isArray(req.body?.searchQueries) ? req.body.searchQueries : [];
    const likedTracks = Array.isArray(req.body?.likedTracks) ? req.body.likedTracks : [];

    if (!recentTracks.length && !searchQueries.length && !likedTracks.length) {
      return res.json({ tracks: [], reason: '', aiPowered: false });
    }

    const sigInput = JSON.stringify({
      r: recentTracks.slice(0, 6).map((t) => t.videoId),
      s: searchQueries.slice(0, 5),
      l: likedTracks.slice(0, 4).map((t) => t.videoId),
    });
    const hash = crypto.createHash('sha1').update(sigInput).digest('hex').slice(0, 16);
    const cacheKey = `rec_v2:${hash}`;

    const cached = await sql`SELECT results FROM search_cache WHERE query = ${cacheKey} LIMIT 1`;
    if (cached.length > 0 && cached[0].results?.tracks?.length) {
      return res.json(cached[0].results);
    }

    const { queries, reason, aiPowered } = await getAiTasteQueries({ recentTracks, searchQueries, likedTracks });
    const excludeIds = new Set([
      ...recentTracks.map((t) => t.videoId),
    ]);
    const MIX_RE = /\b(mashup|jukebox|collection|best\s*of|nonstop|non-stop|megamix|full\s*album|back\s*to\s*back|1\s*hour|2\s*hour)\b/i;

    const searchSets = await Promise.all(
      queries.slice(0, 3).map((q) => youtubeSearch(q, { maxResults: 5, videoCategoryId: '10' }).catch(() => []))
    );

    const tracks = [];
    const seen = new Set(excludeIds);
    // Interleave results across the 3 queries for variety, skipping compilations/mixes
    const maxLen = Math.max(...searchSets.map((s) => s.length), 0);
    for (let i = 0; i < maxLen && tracks.length < 6; i++) {
      for (const set of searchSets) {
        const item = set[i];
        if (item && item.videoId && !seen.has(item.videoId) && !MIX_RE.test(item.title || '') && (!item.duration || item.duration <= 480)) {
          seen.add(item.videoId);
          tracks.push(item);
          if (tracks.length >= 6) break;
        }
      }
    }

    const payload = { tracks, reason, aiPowered };
    if (tracks.length > 0) {
      await sql`
        INSERT INTO search_cache (query, results)
        VALUES (${cacheKey}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (query)
        DO UPDATE SET results = EXCLUDED.results, created_at = NOW()
      `;
    }

    res.json(payload);
  } catch (err) {
    console.error('[RECOMMENDATIONS ERROR]', err.message);
    res.json({ tracks: [], reason: '', aiPowered: false });
  }
};

module.exports = { recommendationsController };
