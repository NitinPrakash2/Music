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

  const chunks = [];

  ytdlp.stdout.on('data', chunk => chunks.push(chunk));

  ytdlp.stderr.on('data', d => console.error('[YT-DLP]', d.toString().trim()));

  ytdlp.on('error', err => {
    console.error('[YT-DLP SPAWN ERROR]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp not found or failed' });
  });

  ytdlp.on('close', code => {
    if (code !== 0 && !chunks.length) {
      if (!res.headersSent) return res.status(500).json({ error: 'yt-dlp failed' });
      return;
    }
    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  });

  req.on('close', () => ytdlp.kill('SIGTERM'));
};

module.exports = { streamController };
