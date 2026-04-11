const { spawn } = require('child_process');
const { sql } = require('../db');

const streamController = async (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Query parameter "url" is required' });

  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });

  // Extract videoId from URL
  const videoId = new URL(url).searchParams.get('v');
  if (!videoId) return res.status(400).json({ error: 'Could not parse videoId' });

  // ── Check DB cache ──
  try {
    const cached = await sql`SELECT audio_b64 FROM audio_cache WHERE video_id = ${videoId}`;
    if (cached.length > 0) {
      console.log(`[STREAM CACHE HIT] ${videoId}`);
      const buf = Buffer.from(cached[0].audio_b64, 'base64');
      res.setHeader('Content-Type', 'audio/mp4');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.end(buf);
    }
  } catch (err) {
    console.error('[STREAM CACHE READ ERROR]', err.message);
  }

  console.log(`[STREAM DOWNLOAD] ${videoId}`);

  // ── Download via yt-dlp, buffer it, cache it, then send ──
  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '-o', '-',
    url,
  ]);

  const chunks = [];

  ytdlp.stdout.on('data', (chunk) => chunks.push(chunk));

  ytdlp.stderr.on('data', (data) => {
    console.error('[YT-DLP]', data.toString().trim());
  });

  ytdlp.on('error', (err) => {
    console.error('[YT-DLP SPAWN ERROR]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp failed', detail: err.message });
  });

  ytdlp.on('close', async (code) => {
    if (code !== 0 && chunks.length === 0) {
      if (!res.headersSent) res.status(500).json({ error: 'yt-dlp exited with error' });
      return;
    }

    const buf = Buffer.concat(chunks);
    const b64 = buf.toString('base64');

    // Save to DB cache (non-blocking)
    sql`
      INSERT INTO audio_cache (video_id, audio_b64)
      VALUES (${videoId}, ${b64})
      ON CONFLICT (video_id) DO NOTHING
    `.catch(err => console.error('[STREAM CACHE WRITE ERROR]', err.message));

    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.end(buf);
    console.log(`[STREAM CACHED] ${videoId} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  });

  req.on('close', () => ytdlp.kill('SIGTERM'));
};

module.exports = { streamController };
