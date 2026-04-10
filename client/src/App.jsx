import { useState, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState('')
  const [streamError, setStreamError] = useState('')
  const [nowPlaying, setNowPlaying] = useState('')
  const audioRef = useRef(null)

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setResults([])
    setStreamError('')

    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results || [])
      if (!data.results?.length) setError('No results found.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const play = (item) => {
    setStreamError('')
    setActiveId(item.videoId)
    setNowPlaying(item.title)

    const src = `${API}/api/stream?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${item.videoId}`)}`
    const audio = audioRef.current
    audio.src = src
    audio.load()
    audio.play().catch((e) => setStreamError(e.message))
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h1>Relaxify</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: '8px 12px', fontSize: 16 }}
          type="text"
          placeholder="Search for a song..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button
          style={{ padding: '8px 20px', fontSize: 16, cursor: 'pointer' }}
          onClick={search}
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Sticky audio player */}
      <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ccc', display: activeId ? 'block' : 'none' }}>
        {nowPlaying && <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: 14 }}>▶ {nowPlaying}</p>}
        {streamError && <p style={{ color: 'red', margin: '0 0 6px', fontSize: 13 }}>{streamError}</p>}
        <audio
          ref={audioRef}
          controls
          autoPlay
          style={{ width: '100%' }}
          onError={(e) => {
            const code = e.target.error?.code
            const msgs = { 1: 'Aborted', 2: 'Network error', 3: 'Decode error', 4: 'Format not supported' }
            setStreamError(`Stream error: ${msgs[code] || 'Unknown'}. Try another track.`)
          }}
        />
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {results.map((item) => (
          <li
            key={item.videoId}
            onClick={() => play(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 8px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              background: activeId === item.videoId ? '#f0f0f0' : 'transparent',
            }}
          >
            <img src={item.thumbnail} alt={item.title} width={80} height={60} style={{ objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: activeId === item.videoId ? 'bold' : 'normal' }}>{item.title}</div>
              <div style={{ fontSize: 13, color: '#666' }}>{item.channel}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
