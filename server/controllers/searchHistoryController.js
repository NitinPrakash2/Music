const { sql } = require('../db');

const saveSearchHistory = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });
    const userId = req.user.id;

    // Upsert: delete old entry for same query+user, insert fresh
    await sql`DELETE FROM search_history WHERE user_id = ${userId} AND query = ${query.trim()}`;
    await sql`INSERT INTO search_history (user_id, query, searched_at) VALUES (${userId}, ${query.trim()}, NOW())`;

    res.json({ success: true });
  } catch (err) {
    console.error('[SAVE SEARCH HISTORY ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await sql`
      SELECT query FROM search_history
      WHERE user_id = ${userId}
      ORDER BY searched_at DESC
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
    const userId = req.user.id;
    const { query } = req.params;
    await sql`DELETE FROM search_history WHERE user_id = ${userId} AND query = ${query}`;
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE SEARCH HISTORY ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const clearAllSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    await sql`DELETE FROM search_history WHERE user_id = ${userId}`;
    res.json({ success: true });
  } catch (err) {
    console.error('[CLEAR SEARCH HISTORY ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { saveSearchHistory, getSearchHistory, deleteSearchHistory, clearAllSearchHistory };
