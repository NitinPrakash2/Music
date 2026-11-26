const path = require('path');
const fs = require('fs');
require('dotenv').config({
  path: process.env.ENV_PATH || path.join(__dirname, '.env'),
});
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db');

const searchRoute = require('./routes/search');
const streamRoute = require('./routes/stream');
const playlistRoute = require('./routes/playlist');
const searchHistoryRoute = require('./routes/searchHistory');
const searchSuggestionsRoute = require('./routes/searchSuggestions');
const authRoute = require('./routes/auth');
const likedRoute = require('./routes/liked');
const userPlaylistsRoute = require('./routes/userPlaylists');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_ORIGIN,
      'http://localhost:5173',
    ].filter(Boolean)
    if (
      !origin ||
      allowed.includes(origin) ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('http://localhost:')
    ) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

// Rate limit auth endpoints — 20 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

app.use('/api/search', searchRoute);
app.use('/api/stream', streamRoute);
app.use('/api/playlists', playlistRoute);
app.use('/api/search-history', searchHistoryRoute);
app.use('/api/search-suggestions', searchSuggestionsRoute);
app.use('/api/auth', authRoute);
app.use('/api/liked', likedRoute);
app.use('/api/user-playlists', userPlaylistsRoute);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const startServer = ({ port = PORT, staticDir } = {}) => {
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((err, req, res, _next) => {
    console.error('[UNHANDLED ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return new Promise((resolve) => {
    const listenOn = (tryPort) => {
      const server = app.listen(tryPort, '127.0.0.1', () => {
        const addr = server.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : tryPort;
        console.log(`[SERVER] Running on http://127.0.0.1:${actualPort}`);
        initDB().catch((err) => console.error('[DB INIT WARNING]', err.message));
        resolve({ server, port: actualPort });
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && tryPort !== 0) {
          listenOn(0);
        } else {
          throw err;
        }
      });
    };
    listenOn(port);
  });
};

if (require.main === module) {
  initDB()
    .then(() => {
      app.use((err, req, res, _next) => {
        console.error('[UNHANDLED ERROR]', err.message);
        res.status(500).json({ error: 'Internal server error' });
      });
      app.listen(PORT, () => console.log(`[SERVER] Running on http://localhost:${PORT}`));
    })
    .catch((err) => { console.error('[DB INIT FAILED]', err.message); process.exit(1); });
}

module.exports = { app, startServer };
