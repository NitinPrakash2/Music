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
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
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
│   └── src/
│       └── App.jsx
├── server/               # Express backend
│   ├── controllers/
│   │   ├── searchController.js
│   │   └── streamController.js
│   ├── db/
│   │   └── index.js
│   ├── routes/
│   │   ├── search.js
│   │   └── stream.js
│   ├── index.js
│   └── .env.example
└── README.md
```

---

## How It Works

1. **Home Page** → Displays trending songs, top Hindi/English/Punjabi songs, romantic & party playlists
2. **Real-time Updates** → Playlists refresh every hour automatically
3. **Click Playlist** → View all songs in that category
4. **Select Song** → `/api/stream` spawns `yt-dlp` → audio piped to browser
5. **HTML `<audio>`** → Plays the stream in real-time with full player controls
6. **Search** → Custom search with YouTube Data API v3 caching
