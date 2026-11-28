const { sql } = require('../db');
const { youtubeSearch } = require('../utils/youtubeSearch');

const MEM_TTL_MS = 30 * 60 * 1000;
const memCache = new Map();
const inFlight = new Map();

const setMemCache = (key, results) => {
  if (!Array.isArray(results) || results.length === 0) return;
  if (memCache.size >= 200) {
    const oldest = memCache.keys().next().value;
    memCache.delete(oldest);
  }
  memCache.set(key, { results, expiresAt: Date.now() + MEM_TTL_MS });
};

const searchController = async (req, res) => {
  const raw = req.query.q;
  if (!raw?.trim()) return res.status(400).json({ error: 'Query parameter "q" is required' });

  const query = raw.trim().toLowerCase();
  const forceFresh = req.query.fresh === '1';
  const cacheKey = `music_v4:${query}`;

  // 1. Instant in-memory hit (< 1ms) unless user explicitly pulled to refresh
  const mem = !forceFresh && memCache.get(cacheKey);
  if (mem && mem.expiresAt > Date.now()) {
    return res.json({ source: 'memory', results: mem.results });
  }

  try {
    // 2. Deduplicate concurrent identical searches
    if (!inFlight.has(cacheKey)) {
      const work = (async () => {
        if (!forceFresh) {
          try {
            const cached = await sql`
              SELECT results FROM search_cache
              WHERE query = ${cacheKey}
              LIMIT 1
            `;
            if (cached.length > 0 && Array.isArray(cached[0].results) && cached[0].results.length > 0) {
              setMemCache(cacheKey, cached[0].results);
              return { source: 'cache', results: cached[0].results };
            }
          } catch {}
        }

        const results = await youtubeSearch(query, { maxResults: 10, videoCategoryId: '10' });
        if (results.length > 0) {
          setMemCache(cacheKey, results);
          // Persist to DB asynchronously without blocking the search response
          sql`
            INSERT INTO search_cache (query, results)
            VALUES (${cacheKey}, ${JSON.stringify(results)}::jsonb)
            ON CONFLICT (query)
            DO UPDATE SET results = EXCLUDED.results, created_at = NOW()
          `.catch(() => {});
        }
        return { source: 'api', results };
      })().finally(() => {
        inFlight.delete(cacheKey);
      });

      inFlight.set(cacheKey, work);
    }

    const data = await inFlight.get(cacheKey);
    return res.json(data);
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message);
    if (err.response?.data) console.error('[YT API]', JSON.stringify(err.response.data));
    return res.status(500).json({ error: 'Search failed', detail: err.message });
  }
};

module.exports = { searchController };
