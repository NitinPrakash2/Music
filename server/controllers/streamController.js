const { spawn } = require('child_process');

const streamController = (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Query parameter "url" is required' });
  }

  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!ytPattern.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  console.log(`[STREAM] ${url}`);

  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '-o', '-',
    url,
  ]);

  let headersSent = false;

  ytdlp.stdout.once('data', () => {
    if (!headersSent) {
      headersSent = true;
      res.setHeader('Content-Type', 'audio/mp4');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
    }
  });

  ytdlp.stdout.pipe(res);

  ytdlp.stderr.on('data', (data) => {
    console.error('[YT-DLP]', data.toString().trim());
  });

  ytdlp.on('error', (err) => {
    console.error('[YT-DLP SPAWN ERROR]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'yt-dlp failed to start. Is it installed and in PATH?', detail: err.message });
    }
  });

  ytdlp.on('close', (code) => {
    console.log(`[STREAM] yt-dlp exited with code ${code}`);
    if (!res.writableEnded) res.end();
  });

  req.on('close', () => {
    ytdlp.kill('SIGTERM');
  });
};

module.exports = { streamController };
