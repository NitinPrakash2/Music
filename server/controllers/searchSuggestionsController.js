const { sql } = require('../db');
const axios = require('axios');

const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ suggestions: [] });
    }

    const query = q.trim();
    const suggestions = [];
    
    // Get suggestions from search history
    const history = await sql`
      SELECT DISTINCT ON (query) query
      FROM search_history
      WHERE LOWER(query) LIKE ${query.toLowerCase() + '%'}
      ORDER BY query, searched_at DESC
      LIMIT 5
    `;

    history.forEach(h => suggestions.push(h.query));

    // Get YouTube autocomplete suggestions
    try {
      const ytRes = await axios.get('http://suggestqueries.google.com/complete/search', {
        params: {
          client: 'firefox',
          ds: 'yt',
          q: query
        },
        timeout: 2000
      });
      
      if (ytRes.data && Array.isArray(ytRes.data[1])) {
        ytRes.data[1].forEach(suggestion => {
          if (suggestions.length < 8 && !suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        });
      }
    } catch (ytErr) {
      console.error('[YT AUTOCOMPLETE ERROR]', ytErr.message);
    }

    // Fallback: add common music-related suggestions if not enough
    if (suggestions.length < 5) {
      const commonSuggestions = [
        `${query} songs`,
        `${query} music`
      ];
      
      commonSuggestions.forEach(s => {
        if (suggestions.length < 8 && !suggestions.includes(s)) {
          suggestions.push(s);
        }
      });
    }

    res.json({ suggestions: suggestions.slice(0, 8) });
  } catch (err) {
    console.error('[SEARCH SUGGESTIONS ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getSearchSuggestions };
