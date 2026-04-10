const axios = require('axios');
const { sql } = require('../db');

const searchController = async (req, res) => {
  const raw = req.query.q;
  if (!raw?.trim()) return res.status(400).json({ error: 'Query parameter "q" is required' });

  const query = raw.trim().toLowerCase();

  try {
    // Check cache
    const cached = await sql`
      SELECT results FROM search_cache
      WHERE query = ${query} AND created_at > NOW() - INTERVAL '1 day'
    `;

    if (cached.length > 0) {
      console.log(`[CACHE HIT] "${query}"`);
      return res.json({ source: 'cache', results: cached[0].results });
    }

    console.log(`[CACHE MISS] "${query}" — calling YouTube API`);

    const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 10,
        key: process.env.YOUTUBE_API_KEY,
      },
    });

    const results = ytRes.data.items.map((item) => ({
      videoId:   item.id.videoId,
      title:     item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channel:   item.snippet.channelTitle,
    }));

    // Upsert cache
    await sql`
      INSERT INTO search_cache (query, results)
      VALUES (${query}, ${JSON.stringify(results)}::jsonb)
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
