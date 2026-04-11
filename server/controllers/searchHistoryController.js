const { sql } = require('../db');

const saveSearchHistory = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    await sql`
      INSERT INTO search_history (query, searched_at)
      VALUES (${query.trim()}, NOW())
    `;

    res.json({ success: true });
  } catch (err) {
    console.error('[SAVE SEARCH HISTORY ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getSearchHistory = async (req, res) => {
  try {
    const history = await sql`
      SELECT DISTINCT ON (query) query, searched_at
      FROM search_history
      ORDER BY query, searched_at DESC
      LIMIT 10
    `;

    res.json({ history: history.map(h => h.query) });
  } catch (err) {
    console.error('[GET SEARCH HISTORY ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const deleteSearchHistory = async (req, res) => {
  try {
    const { query } = req.params;
    
    await sql`
      DELETE FROM search_history
      WHERE query = ${query}
    `;

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE SEARCH HISTORY ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const clearAllSearchHistory = async (req, res) => {
  try {
    await sql`DELETE FROM search_history`;
    res.json({ success: true });
  } catch (err) {
    console.error('[CLEAR SEARCH HISTORY ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { saveSearchHistory, getSearchHistory, deleteSearchHistory, clearAllSearchHistory };
