const { sql } = require('../db');
const { youtubeSearch } = require('../utils/youtubeSearch');

const searchController = async (req, res) => {
  const raw = req.query.q;
  if (!raw?.trim()) return res.status(400).json({ error: 'Query parameter "q" is required' });

  const query = raw.trim().toLowerCase();
  const cacheKey = `music_v3:${query}`;

  try {
    // Check cache
    const cached = await sql`
      SELECT results FROM search_cache
      WHERE query = ${cacheKey}
    `;

    if (cached.length > 0) {
      console.log(`[CACHE HIT] "${query}"`);
      return res.json({ source: 'cache', results: cached[0].results });
    }

    console.log(`[CACHE MISS] "${query}" — searching YouTube Music`);
    const results = await youtubeSearch(query, { maxResults: 10, videoCategoryId: '10' });

    // Upsert cache
    await sql`
      INSERT INTO search_cache (query, results)
      VALUES (${cacheKey}, ${JSON.stringify(results)}::jsonb)
      ON CONFLICT (query)
      DO UPDATE SET results = EXCLUDED.results, created_at = NOW()
    `;

    return res.json({ source: 'api', results });
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message);
    if (err.response?.data) console.error('[YT API]', JSON.stringify(err.response.data));
    return res.status(500).json({ error: 'Search failed', detail: err.message });
  }
};

module.exports = { searchController };
