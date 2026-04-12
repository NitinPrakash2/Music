const { sql } = require('../db');
const axios = require('axios');

const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json({ suggestions: [] });

    const query = q.trim();
    const userId = req.user.id;
    const suggestions = [];

    // User-scoped history suggestions first
    const history = await sql`
      SELECT query FROM search_history
      WHERE user_id = ${userId} AND LOWER(query) LIKE ${query.toLowerCase() + '%'}
      ORDER BY searched_at DESC
      LIMIT 5
    `;
    history.forEach(h => suggestions.push(h.query));

    // YouTube autocomplete
    try {
      const ytRes = await axios.get('http://suggestqueries.google.com/complete/search', {
        params: { client: 'firefox', ds: 'yt', q: query },
        timeout: 2000,
      });
      if (ytRes.data && Array.isArray(ytRes.data[1])) {
        ytRes.data[1].forEach(s => {
          if (suggestions.length < 8 && !suggestions.includes(s)) suggestions.push(s);
        });
      }
    } catch {}

    if (suggestions.length < 5) {
      [`${query} songs`, `${query} music`].forEach(s => {
        if (!suggestions.includes(s)) suggestions.push(s);
      });
    }

    res.json({ suggestions: suggestions.slice(0, 8) });
  } catch (err) {
    console.error('[SEARCH SUGGESTIONS ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getSearchSuggestions };
