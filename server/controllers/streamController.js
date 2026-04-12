const { spawn } = require('child_process');
const { execSync } = require('child_process');

// Find yt-dlp binary path
const getYtDlpPath = () => {
  try { return execSync('which yt-dlp').toString().trim() } catch {}
  try { return execSync('python3 -m yt_dlp --version && echo python3 -m yt_dlp').toString().trim() } catch {}
  return 'yt-dlp';
};

const YTDLP = getYtDlpPath();
console.log('[YT-DLP PATH]', YTDLP);

const streamController = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Query parameter "url" is required' });

  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });

  const args = [
    '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '-o', '-',
    url,
  ];

  const ytdlp = spawn('python3', ['-m', 'yt_dlp', ...args]);

  const chunks = [];

  ytdlp.stdout.on('data', chunk => chunks.push(chunk));

  ytdlp.stderr.on('data', d => console.error('[YT-DLP]', d.toString().trim()));

  ytdlp.on('error', err => {
    console.error('[YT-DLP SPAWN ERROR]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp not found: ' + err.message });
  });

  ytdlp.on('close', code => {
    if (code !== 0 && !chunks.length) {
      console.error('[YT-DLP] failed with code', code);
      if (!res.headersSent) return res.status(500).json({ error: 'yt-dlp failed with code ' + code });
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
