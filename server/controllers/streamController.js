const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const streamController = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Query parameter "url" is required' });

  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });

  // Write cookies to temp file if available
  let cookiesFile = null;
  if (process.env.YOUTUBE_COOKIES) {
    cookiesFile = path.join(os.tmpdir(), 'yt_cookies.txt');
    fs.writeFileSync(cookiesFile, process.env.YOUTUBE_COOKIES);
  }

  const args = [
    '-m', 'yt_dlp',
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
  ];

  if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  }

  args.push('-o', '-', url);

  const ytdlp = spawn('python3', args);

  const chunks = [];

  ytdlp.stdout.on('data', chunk => chunks.push(chunk));

  ytdlp.stderr.on('data', d => console.error('[YT-DLP]', d.toString().trim()));

  ytdlp.on('error', err => {
    console.error('[YT-DLP SPAWN ERROR]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp not found: ' + err.message });
  });

  ytdlp.on('close', code => {
    if (cookiesFile) try { fs.unlinkSync(cookiesFile) } catch {}
    if (code !== 0 && !chunks.length) {
      console.error('[YT-DLP] failed with code', code);
      if (!res.headersSent) return res.status(500).json({ error: 'yt-dlp failed with code ' + code });
      return;
    }
    const buffer = Buffer.concat(chunks);
    // Detect format from first bytes
    const isWebm = buffer[0] === 0x1a && buffer[1] === 0x45;
    const isM4a = buffer[4] === 0x66 && buffer[5] === 0x74;
    const contentType = isWebm ? 'audio/webm' : isM4a ? 'audio/mp4' : 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  });

  req.on('close', () => ytdlp.kill('SIGTERM'));
};

module.exports = { streamController };
