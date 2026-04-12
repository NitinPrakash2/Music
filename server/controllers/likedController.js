const { sql } = require('../db');

const getLiked = async (req, res) => {
  try {
    const rows = await sql`SELECT video_id FROM liked_songs WHERE user_id = ${req.user.id}`;
    const liked = {};
    rows.forEach(r => liked[r.video_id] = true);
    res.json({ liked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getLikedSongs = async (req, res) => {
  try {
    const songs = await sql`SELECT video_id, title, thumbnail, channel FROM liked_songs WHERE user_id = ${req.user.id} ORDER BY liked_at DESC`;
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const toggleLike = async (req, res) => {
  const { videoId, title, thumbnail, channel } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });
  try {
    const existing = await sql`SELECT id FROM liked_songs WHERE user_id = ${req.user.id} AND video_id = ${videoId}`;
    if (existing.length) {
      await sql`DELETE FROM liked_songs WHERE user_id = ${req.user.id} AND video_id = ${videoId}`;
      res.json({ liked: false });
    } else {
      await sql`INSERT INTO liked_songs (user_id, video_id, title, thumbnail, channel) VALUES (${req.user.id}, ${videoId}, ${title || ''}, ${thumbnail || ''}, ${channel || ''})`;
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getLiked, getLikedSongs, toggleLike };
