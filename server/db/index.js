const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const initDB = async () => {
  await sql`CREATE TABLE IF NOT EXISTS search_cache (id SERIAL PRIMARY KEY, query TEXT UNIQUE NOT NULL, results JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS audio_cache (video_id TEXT PRIMARY KEY, audio_b64 TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS playlist_cache (playlist_type TEXT PRIMARY KEY, results JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS search_history (id SERIAL PRIMARY KEY, query TEXT NOT NULL, searched_at TIMESTAMP DEFAULT NOW())`;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('[DB] Tables ready');
};

module.exports = { sql, initDB };
