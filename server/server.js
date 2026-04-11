require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initDB } = require('./db');

const searchRoute = require('./routes/search');
const streamRoute = require('./routes/stream');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET'],
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.use('/api/search', searchRoute);
app.use('/api/stream', streamRoute);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.get('/api/cache-stats', async (_, res) => {
  try {
    const [searches, audio] = await Promise.all([
      require('./db').sql`SELECT COUNT(*) FROM search_cache`,
      require('./db').sql`SELECT COUNT(*) FROM audio_cache`
    ])
    res.json({
      cached_searches: parseInt(searches[0].count),
      cached_audio: parseInt(audio[0].count),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
});

app.use((err, req, res, _next) => {
  console.error('[UNHANDLED ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

initDB()
  .then(() => app.listen(PORT, () => console.log(`[SERVER] Running on http://localhost:${PORT}`)))
  .catch((err) => { console.error('[DB INIT FAILED]', err.message); process.exit(1); });
