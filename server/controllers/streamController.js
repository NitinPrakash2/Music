const { spawn } = require('child_process');

const streamController = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Query parameter "url" is required' });

  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });

  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '-o', '-',
    url,
  ]);

  res.setHeader('Content-Type', 'audio/webm');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN || 'http://localhost:5173');

  ytdlp.stdout.pipe(res);

  ytdlp.stderr.on('data', d => console.error('[YT-DLP]', d.toString().trim()));

  ytdlp.on('error', err => {
    console.error('[YT-DLP SPAWN ERROR]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp not found or failed' });
  });

  ytdlp.on('close', code => {
    if (code !== 0) console.error(`[YT-DLP] exited with code ${code}`);
    if (!res.writableEnded) res.end();
  });

  req.on('close', () => ytdlp.kill('SIGTERM'));
};

module.exports = { streamController };
