import { useState, useRef, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export default function App() {
  const [query, setQuery] = useState(() => sessionStorage.getItem('rq') || '')
  const [results, setResults] = useState(() => JSON.parse(sessionStorage.getItem('rr') || '[]'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeItem, setActiveItem] = useState(() => JSON.parse(sessionStorage.getItem('ra') || 'null'))
  const [isPlaying, setIsPlaying] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [liked, setLiked] = useState(() => JSON.parse(sessionStorage.getItem('rl') || '{}'))
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [volume, setVolume] = useState(0.7)
  const [downloading, setDownloading] = useState(false)

  const audioRef = useRef(null)
  const progressBarRef = useRef(null)
  const volumeBarRef = useRef(null)

  useEffect(() => { sessionStorage.setItem('rq', query) }, [query])
  useEffect(() => { sessionStorage.setItem('rr', JSON.stringify(results)) }, [results])
  useEffect(() => { sessionStorage.setItem('ra', JSON.stringify(activeItem)) }, [activeItem])
  useEffect(() => { sessionStorage.setItem('rl', JSON.stringify(liked)) }, [liked])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      setCurrentTime(fmt(audio.currentTime))
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
    }
    const onMeta = () => setDuration(fmt(audio.duration))
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
    }
  }, [])

  // Clear cached blobs on tab close
  useEffect(() => {
    const clear = () => {
      Object.keys(localStorage).filter(k => k.startsWith('blob_')).forEach(k => localStorage.removeItem(k))
    }
    window.addEventListener('beforeunload', clear)
    return () => window.removeEventListener('beforeunload', clear)
  }, [])

  const drag = (barRef, onMove) => (e) => {
    e.preventDefault()
    const bar = barRef.current
    if (!bar) return

    const getPct = (clientX) => {
      const rect = bar.getBoundingClientRect()
      return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    }

    onMove(getPct(e.clientX))

    const handleMove = (ev) => onMove(getPct(ev.clientX))
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const handleSeek = drag(progressBarRef, (pct) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = pct * audio.duration
    setProgress(pct * 100)
  })

  const handleVolume = drag(volumeBarRef, (pct) => {
    if (audioRef.current) audioRef.current.volume = pct
    setVolume(pct)
  })

  const search = async (q = query) => {
    q = q.trim()
    if (!q) return
    setQuery(q)
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

  const play = async (item) => {
    setStreamError('')
    setActiveItem(item)
    setProgress(0)
    setCurrentTime('0:00')
    setDuration('0:00')

    const cacheKey = `blob_${item.videoId}`
    const audio = audioRef.current

    // Check localStorage cache first
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      audio.src = cached
      audio.load()
      audio.play().catch(e => { setStreamError(e.message); setIsPlaying(false) })
      setIsPlaying(true)
      return
    }

    // Download as blob
    setDownloading(true)
    setIsPlaying(false)
    try {
      const url = `${API}/api/stream?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${item.videoId}`)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Stream failed')
      const blob = await res.blob()
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result
        try { localStorage.setItem(cacheKey, base64) } catch (e) {
          // localStorage full — clear old blobs and retry
          Object.keys(localStorage).filter(k => k.startsWith('blob_') && k !== cacheKey).forEach(k => localStorage.removeItem(k))
          try { localStorage.setItem(cacheKey, base64) } catch (_) {}
        }
        audio.src = base64
        audio.load()
        audio.play().catch(e => { setStreamError(e.message); setIsPlaying(false) })
        setIsPlaying(true)
        setDownloading(false)
      }
      reader.readAsDataURL(blob)
    } catch (e) {
      setStreamError(e.message)
      setDownloading(false)
    }
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play(); setIsPlaying(true) }
    else { audio.pause(); setIsPlaying(false) }
  }

  const toggleLike = (e, videoId) => {
    e.stopPropagation()
    setLiked(prev => ({ ...prev, [videoId]: !prev[videoId] }))
  }

  return (
    <div className="layout">
      <div className="main">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-logo-icon">
              <span className="material-symbols-outlined">music_note</span>
            </div>
            <span className="topbar-logo-text">Relaxify</span>
          </div>

          <div className="topbar-right">
            <div className="search-wrap">
              <span className="material-symbols-outlined">search</span>
              <input
                placeholder="Search songs, artists..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
              />
              {loading && <span className="material-symbols-outlined spin" style={{ color: '#f2ca50', fontSize: 15 }}>autorenew</span>}
            </div>
            <button className="search-btn" onClick={() => search()} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
            <div className="topbar-divider" />
            <button className="topbar-icon-btn"><span className="material-symbols-outlined">notifications</span></button>
            <button className="topbar-icon-btn"><span className="material-symbols-outlined">settings</span></button>
          </div>
        </div>

        {/* Content */}
        <div className="content">
          {error && <p className="error">{error}</p>}

          {results.length > 0 && (
            <>
              <div className="results-header">
                <h2>Results</h2>
                <span>{results.length} tracks</span>
              </div>
              <div className="grid">
                {results.map(item => (
                  <div
                    key={item.videoId}
                    className={`track-card${activeItem?.videoId === item.videoId ? ' active' : ''}${activeItem?.videoId === item.videoId && downloading ? ' loading' : ''}`}
                    onClick={() => play(item)}
                  >
                    <div className="track-thumb">
                      <img src={item.thumbnail} alt={item.title} />
                      <div className="track-overlay">
                        <div className="play-icon">
                          {activeItem?.videoId === item.videoId && downloading
                            ? <span className="material-symbols-outlined spin" style={{ color: '#1a1000', fontSize: 22 }}>autorenew</span>
                            : <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {activeItem?.videoId === item.videoId && isPlaying ? 'pause' : 'play_arrow'}
                              </span>
                          }
                        </div>
                        <span
                          className="material-symbols-outlined like-btn"
                          style={{ fontVariationSettings: liked[item.videoId] ? "'FILL' 1" : "'FILL' 0", color: liked[item.videoId] ? '#f2ca50' : '#fff' }}
                          onClick={e => toggleLike(e, item.videoId)}
                        >favorite</span>
                      </div>
                    </div>
                    <div className="track-info">
                      <p className="track-title">{item.title}</p>
                      <p className="track-channel">{item.channel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {results.length === 0 && !loading && (
            <div className="empty">
              <span className="material-symbols-outlined">music_note</span>
              <h2>Search for music</h2>
              <p>Type a song or artist name above and hit Search to start streaming.</p>
            </div>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={e => {
          const m = { 1: 'Aborted', 2: 'Network error', 3: 'Decode error', 4: 'Unsupported format' }
          setStreamError(m[e.target.error?.code] || 'Stream error')
          setIsPlaying(false)
        }}
        style={{ display: 'none' }}
      />

      {/* Player */}
      <div className={`player${activeItem ? '' : ' hidden'}`}>

        {/* Track info */}
        <div className="player-track">
          {activeItem && <img src={activeItem.thumbnail} alt="" />}
          <div className="player-track-info">
            <p className="player-track-title">{activeItem?.title}</p>
            <p className="player-track-ch">{activeItem?.channel}</p>
          </div>
          <span
            className="material-symbols-outlined like-btn"
            style={{ fontVariationSettings: liked[activeItem?.videoId] ? "'FILL' 1" : "'FILL' 0", color: liked[activeItem?.videoId] ? '#f2ca50' : '#555', marginLeft: 8 }}
            onClick={e => activeItem && toggleLike(e, activeItem.videoId)}
          >favorite</span>
        </div>

        {/* Controls + progress */}
        <div className="player-center">
          {streamError && <p className="stream-err">{streamError}</p>}
          <div className="player-btns">
            <button className="ctrl-btn"><span className="material-symbols-outlined">shuffle</span></button>
            <button className="ctrl-btn"><span className="material-symbols-outlined">skip_previous</span></button>
            <button className="play-btn" onClick={togglePlay} disabled={downloading}>
              <span className="material-symbols-outlined spin" style={{ fontVariationSettings: "'FILL' 1", animationDuration: downloading ? '0.8s' : '0s', animation: downloading ? 'spin 0.8s linear infinite' : 'none' }}>
                {downloading ? 'autorenew' : isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button className="ctrl-btn"><span className="material-symbols-outlined">skip_next</span></button>
            <button className="ctrl-btn"><span className="material-symbols-outlined">repeat</span></button>
          </div>
          <div className="player-progress">
            <span className="prog-time">{currentTime}</span>
            <div className="prog-bar" ref={progressBarRef} onMouseDown={handleSeek}>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="prog-dot" style={{ left: `${progress}%` }} />
            </div>
            <span className="prog-time">{duration}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="player-right">
          <button className="ctrl-btn">
            <span className="material-symbols-outlined">
              {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
            </span>
          </button>
          <div className="vol-bar" ref={volumeBarRef} onMouseDown={handleVolume}>
            <div className="vol-track">
              <div className="vol-fill" style={{ width: `${volume * 100}%` }} />
            </div>
            <div className="vol-dot" style={{ left: `${volume * 100}%` }} />
          </div>
        </div>

      </div>
    </div>
  )
}
