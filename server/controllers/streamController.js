const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const rawFfmpegPath = require('ffmpeg-static');
const ffmpegPath = rawFfmpegPath ? rawFfmpegPath.replace('app.asar', 'app.asar.unpacked') : null;

const spawnYtDlp = (ytdlpArgs) => {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    return spawn(process.env.YTDLP_PATH, ytdlpArgs);
  }
  const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  return spawn(pythonBin, ['-m', 'yt_dlp', ...ytdlpArgs]);
};

const URL_CACHE_TTL_MS = 30 * 60 * 1000;
const urlCache = new Map();
const inFlight = new Map();

const EXT_TO_MIME = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  webm: 'audio/webm',
  opus: 'audio/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
};

const resolveAudioUrl = (url) => {
  const cached = urlCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached);
  }
  if (inFlight.has(url)) {
    return inFlight.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    let cookiesFile = null;
    if (process.env.YOUTUBE_COOKIES) {
      cookiesFile = path.join(os.tmpdir(), 'yt_cookies.txt');
      fs.writeFileSync(cookiesFile, process.env.YOUTUBE_COOKIES);
    }

    const args = [
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--extractor-retries', '3',
      '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
      '--print', '%(ext)s',
      '--print', '%(url)s',
    ];

    if (cookiesFile) {
      args.push('--cookies', cookiesFile);
    }

    args.push(url);

    const ytdlp = spawnYtDlp(args);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    ytdlp.stderr.on('data', (d) => { stderr += d.toString(); });

    ytdlp.on('error', (err) => {
      if (cookiesFile) try { fs.unlinkSync(cookiesFile); } catch {}
      reject(new Error('yt-dlp not found: ' + err.message));
    });

    ytdlp.on('close', (code) => {
      if (cookiesFile) try { fs.unlinkSync(cookiesFile); } catch {}
      if (code !== 0) {
        console.error('[YT-DLP]', stderr.trim());
        return reject(new Error('yt-dlp failed with code ' + code));
      }
      const lines = stdout.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const ext = lines[0] || 'm4a';
      const streamUrl = lines[1];
      if (!streamUrl || !streamUrl.startsWith('http')) {
        return reject(new Error('Failed to resolve audio stream URL'));
      }
      const entry = {
        streamUrl,
        contentType: EXT_TO_MIME[ext] || 'audio/mp4',
        expiresAt: Date.now() + URL_CACHE_TTL_MS,
      };
      urlCache.set(url, entry);
      resolve(entry);
    });
  }).finally(() => {
    inFlight.delete(url);
  });

  inFlight.set(url, promise);
  return promise;
};

const proxyStream = async (req, res, entry) => {
  const headers = {};
  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  const upstream = await axios.get(entry.streamUrl, {
    responseType: 'stream',
    headers,
    timeout: 0,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers['content-type'] || entry.contentType);
  if (upstream.headers['content-length']) {
    res.setHeader('Content-Length', upstream.headers['content-length']);
  }
  if (upstream.headers['content-range']) {
    res.setHeader('Content-Range', upstream.headers['content-range']);
  }
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');

  upstream.data.pipe(res);
  req.on('close', () => {
    if (!upstream.data.destroyed) upstream.data.destroy();
  });
  upstream.data.on('error', (err) => {
    console.error('[STREAM PIPE ERROR]', err.message);
    if (!res.headersSent) res.status(502).end();
    else res.end();
  });
};

const streamController = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Query parameter "url" is required' });

  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    let entry = await resolveAudioUrl(url);
    try {
      await proxyStream(req, res, entry);
    } catch (err) {
      const status = err.response?.status;
      if ((status === 403 || status === 410) && !res.headersSent) {
        urlCache.delete(url);
        entry = await resolveAudioUrl(url);
        await proxyStream(req, res, entry);
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('[STREAM ERROR]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Stream failed' });
    }
  }
};

const downloadController = (req, res) => {
  const { url, title } = req.query;
  if (!url) return res.status(400).json({ error: 'Query parameter "url" is required' });

  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' });

  const safeTitle = (title || 'relaxify-track')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'relaxify-track';

  const id = `rx_dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const outTemplate = path.join(os.tmpdir(), `${id}.%(ext)s`);
  const mp3Path = path.join(os.tmpdir(), `${id}.mp3`);

  let cookiesFile = null;
  if (process.env.YOUTUBE_COOKIES) {
    cookiesFile = path.join(os.tmpdir(), `${id}_cookies.txt`);
    fs.writeFileSync(cookiesFile, process.env.YOUTUBE_COOKIES);
  }

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
    '-o', outTemplate,
  ];

  if (cookiesFile) args.push('--cookies', cookiesFile);
  args.push(url);

  const ytdlp = spawnYtDlp(args);

  let stderr = '';
  ytdlp.stderr.on('data', (d) => { stderr += d.toString(); });

  const cleanup = () => {
    if (cookiesFile) try { fs.unlinkSync(cookiesFile); } catch {}
    try { if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path); } catch {}
  };

  req.on('close', () => {
    if (!res.writableEnded) {
      ytdlp.kill('SIGTERM');
      cleanup();
    }
  });

  ytdlp.on('error', (err) => {
    cleanup();
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp error: ' + err.message });
  });

  ytdlp.on('close', (code) => {
    if (cookiesFile) try { fs.unlinkSync(cookiesFile); } catch {}
    if (code !== 0 || !fs.existsSync(mp3Path)) {
      console.error('[YT-DLP DOWNLOAD ERROR]', stderr.trim());
      cleanup();
      if (!res.headersSent) return res.status(500).json({ error: 'Failed to download MP3' });
      return;
    }

    const stat = fs.statSync(mp3Path);
    const encodedName = encodeURIComponent(`${safeTitle}.mp3`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle.replace(/"/g, '')}.mp3"; filename*=UTF-8''${encodedName}`);

    const stream = fs.createReadStream(mp3Path);
    stream.pipe(res);
    stream.on('close', cleanup);
    stream.on('error', () => {
      cleanup();
      if (!res.headersSent) res.status(500).end();
    });
  });
};

module.exports = { streamController, downloadController };
