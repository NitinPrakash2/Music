const { sql } = require('../db');
const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CACHE_TTL = 3600000; // 1 hour

const PLAYLISTS = {
  trending: { query: 'trending music 2024 latest hits', maxResults: 20 },
  hindiTop: { query: 'latest hindi songs 2024 bollywood hits', maxResults: 20 },
  englishTop: { query: 'top english songs 2024 billboard hot 100', maxResults: 20 },
  punjabi: { query: 'latest punjabi songs 2024 trending', maxResults: 20 },
  romantic: { query: 'romantic love songs 2024 latest', maxResults: 20 },
  party: { query: 'party songs 2024 dance hits', maxResults: 20 },
};

const fetchFromYouTube = async (query, maxResults = 20) => {
  const url = 'https://www.googleapis.com/youtube/v3/search';
  const res = await axios.get(url, {
    params: {
      part: 'snippet',
      q: query,
      type: 'video',
      videoCategoryId: '10',
      maxResults,
      key: YOUTUBE_API_KEY,
    },
  });

  return res.data.items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
  }));
};

const getPlaylist = async (req, res) => {
  try {
    const { type } = req.params;
    const playlist = PLAYLISTS[type];
    
    if (!playlist) {
      return res.status(400).json({ error: 'Invalid playlist type' });
    }

    // Check cache
    const cached = await sql`
      SELECT results, created_at 
      FROM playlist_cache 
      WHERE playlist_type = ${type}
      AND created_at > NOW() - INTERVAL '30 minutes'
      LIMIT 1
    `;

    if (cached.length > 0) {
      return res.json({ 
        results: cached[0].results,
        cached: true,
        type 
      });
    }

    // Fetch from YouTube
    const results = await fetchFromYouTube(playlist.query, playlist.maxResults);

    // Save to cache
    await sql`
      INSERT INTO playlist_cache (playlist_type, results, created_at)
      VALUES (${type}, ${JSON.stringify(results)}, NOW())
      ON CONFLICT (playlist_type) 
      DO UPDATE SET results = ${JSON.stringify(results)}, created_at = NOW()
    `;

    res.json({ results, cached: false, type });
  } catch (err) {
    console.error('[PLAYLIST ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getAllPlaylists = async (req, res) => {
  try {
    const types = Object.keys(PLAYLISTS);
    const results = {};

    for (const type of types) {
      const cached = await sql`
        SELECT results 
        FROM playlist_cache 
        WHERE playlist_type = ${type}
        AND created_at > NOW() - INTERVAL '30 minutes'
        LIMIT 1
      `;

      if (cached.length > 0) {
        results[type] = cached[0].results.slice(0, 6);
      } else {
        const data = await fetchFromYouTube(PLAYLISTS[type].query, 6);
        await sql`
          INSERT INTO playlist_cache (playlist_type, results, created_at)
          VALUES (${type}, ${JSON.stringify(data)}, NOW())
          ON CONFLICT (playlist_type) 
          DO UPDATE SET results = ${JSON.stringify(data)}, created_at = NOW()
        `;
        results[type] = data;
      }
    }

    res.json(results);
  } catch (err) {
    console.error('[ALL PLAYLISTS ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getPlaylist, getAllPlaylists };
