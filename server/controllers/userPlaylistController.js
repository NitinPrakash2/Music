const { sql } = require('../db');

// Get all playlists for user
const getPlaylists = async (req, res) => {
  try {
    const playlists = await sql`
      SELECT p.id, p.name, p.created_at,
        COUNT(s.id)::int AS song_count
      FROM user_playlists p
      LEFT JOIN user_playlist_songs s ON s.playlist_id = p.id
      WHERE p.user_id = ${req.user.id}
      GROUP BY p.id ORDER BY p.created_at DESC
    `;
    res.json({ playlists });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Create playlist
const createPlaylist = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const [p] = await sql`INSERT INTO user_playlists (user_id, name) VALUES (${req.user.id}, ${name.trim()}) RETURNING *`;
    res.status(201).json({ playlist: p });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Delete playlist
const deletePlaylist = async (req, res) => {
  try {
    await sql`DELETE FROM user_playlists WHERE id = ${req.params.id} AND user_id = ${req.user.id}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get songs in playlist
const getPlaylistSongs = async (req, res) => {
  try {
    const songs = await sql`
      SELECT s.* FROM user_playlist_songs s
      JOIN user_playlists p ON p.id = s.playlist_id
      WHERE s.playlist_id = ${req.params.id} AND p.user_id = ${req.user.id}
      ORDER BY s.added_at ASC
    `;
    res.json({ songs });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Add song to playlist
const addSong = async (req, res) => {
  const { videoId, title, thumbnail, channel } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });
  try {
    // verify ownership
    const [p] = await sql`SELECT id FROM user_playlists WHERE id = ${req.params.id} AND user_id = ${req.user.id}`;
    if (!p) return res.status(403).json({ error: 'Not your playlist' });
    await sql`INSERT INTO user_playlist_songs (playlist_id, video_id, title, thumbnail, channel) VALUES (${req.params.id}, ${videoId}, ${title||''}, ${thumbnail||''}, ${channel||''}) ON CONFLICT DO NOTHING`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Remove song from playlist
const removeSong = async (req, res) => {
  try {
    const [p] = await sql`SELECT id FROM user_playlists WHERE id = ${req.params.id} AND user_id = ${req.user.id}`;
    if (!p) return res.status(403).json({ error: 'Not your playlist' });
    await sql`DELETE FROM user_playlist_songs WHERE playlist_id = ${req.params.id} AND video_id = ${req.params.videoId}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getPlaylists, createPlaylist, deletePlaylist, getPlaylistSongs, addSong, removeSong };
