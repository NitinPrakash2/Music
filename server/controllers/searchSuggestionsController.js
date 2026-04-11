const { sql } = require('../db');

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
      LIMIT 3
    `;

    history.forEach(h => suggestions.push(h.query));

    // Always add common music-related suggestions
    const commonSuggestions = [
      `${query} songs`,
      `${query} music`,
      `${query} playlist`,
      `${query} hits`,
      `${query} 2024`
    ];
    
    commonSuggestions.forEach(s => {
      if (suggestions.length < 8 && !suggestions.includes(s)) {
        suggestions.push(s);
      }
    });

    res.json({ suggestions });
  } catch (err) {
    console.error('[SEARCH SUGGESTIONS ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getSearchSuggestions };
