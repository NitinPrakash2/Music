# Music Streaming App

Full-stack music streaming using MERN (Neon PostgreSQL), YouTube Data API v3, and yt-dlp.

## Prerequisites

- Node.js 18+
- Python 3 + pip (for yt-dlp)
- A [Neon](https://neon.tech) PostgreSQL database
- A [YouTube Data API v3](https://console.cloud.google.com/) key

---

## 1. Install yt-dlp

**Windows:**
```bash
pip install yt-dlp
# or download the binary: https://github.com/yt-dlp/yt-dlp/releases
# and add it to your PATH
```

Verify:
```bash
yt-dlp --version
```

---

## 2. Configure Environment

```bash
cd server
copy .env.example .env
```

Edit `server/.env`:
```
YOUTUBE_API_KEY=your_youtube_api_key_here
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=your_strong_random_secret_here
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## 3. Run Backend

```bash
cd server
npm install
npm start
# or for development with auto-reload:
npm install -g nodemon
npm run dev
```

Server runs at: http://localhost:5000

---

## 4. Run Frontend

```bash
cd client
npm install
npm run dev
```

Client runs at: http://localhost:5173

---

## Deployment

### Backend → Render

1. Push your repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo
3. Render auto-detects `render.yaml` — it will:
   - Set root dir to `server/`
   - Run `npm install && pip install -U yt-dlp`
   - Start with `node server.js`
4. In Render dashboard → **Environment**, add these secrets:
   | Key | Value |
   |-----|-------|
   | `YOUTUBE_API_KEY` | your YouTube API key |
   | `DATABASE_URL` | your Neon connection string |
   | `JWT_SECRET` | a long random string |
   | `CLIENT_ORIGIN` | your Vercel frontend URL (add after deploying frontend) |
5. Deploy — note your Render URL (e.g. `https://relaxify-server.onrender.com`)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
2. Set **Root Directory** to `client`
3. Add environment variable:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | your Render backend URL (e.g. `https://relaxify-server.onrender.com`) |
4. Deploy — Vercel auto-runs `npm run build`
5. Copy your Vercel URL and set it as `CLIENT_ORIGIN` in Render env vars, then redeploy Render

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=keyword` | Search YouTube (cached in PostgreSQL) |
| GET | `/api/stream?url=youtubeUrl` | Stream audio via yt-dlp |
| GET | `/api/playlists/all` | Get all playlists (6 songs each) |
| GET | `/api/playlists/:type` | Get full playlist by type |
| GET | `/health` | Health check |

**Playlist Types:** `trending`, `hindiTop`, `englishTop`, `punjabi`, `romantic`, `party`

---

## Project Structure

```
Music/
├── client/               # React + Vite frontend
│   ├── src/
│   │   └── App.jsx
│   └── vercel.json       # SPA routing for Vercel
├── server/               # Express backend
│   ├── controllers/
│   ├── db/
│   ├── routes/
│   └── server.js
├── render.yaml           # Render deployment config
└── README.md
```

---

## How It Works

1. **Home Page** → Displays trending songs, top Hindi/English/Punjabi songs, romantic & party playlists
2. **Real-time Updates** → Playlists refresh every hour automatically
3. **Click Playlist** → View all songs in that category
4. **Select Song** → `/api/stream` spawns `yt-dlp` → full audio fetched and cached in localStorage for seekable playback
5. **Auto-advance** → Song ends → cache cleared → next song fetched and cached automatically
6. **Search** → Custom search with YouTube Data API v3 caching
