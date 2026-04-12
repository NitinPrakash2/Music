require('dotenv').config();
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
    if (!origin || allowed.includes(origin)) return callback(null, true)
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

app.use((err, req, res, _next) => {
  console.error('[UNHANDLED ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

initDB()
  .then(() => app.listen(PORT, () => console.log(`[SERVER] Running on http://localhost:${PORT}`)))
  .catch((err) => { console.error('[DB INIT FAILED]', err.message); process.exit(1); });
