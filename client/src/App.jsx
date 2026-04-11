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
  const [showVol, setShowVol] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [cardClosing, setCardClosing] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off')

  const audioRef = useRef(null)
  const barSeekRef = useRef(null)
  const cardSeekRef = useRef(null)
  const volBarVertRef = useRef(null)

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

  // Save playback position periodically
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const save = () => {
      if (activeItem && audio.currentTime > 0)
        sessionStorage.setItem('rpos', audio.currentTime)
    }
    audio.addEventListener('timeupdate', save)
    return () => audio.removeEventListener('timeupdate', save)
  }, [activeItem])

  // Restore audio src from cache on mount
  useEffect(() => {
    if (!activeItem) return
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    const cached = localStorage.getItem(`blob_${activeItem.videoId}`)
    if (cached && !audio.src) {
      audio.src = cached
      audio.load()
      const savedPos = parseFloat(sessionStorage.getItem('rpos') || '0')
      audio.addEventListener('loadedmetadata', () => {
        if (savedPos > 0) audio.currentTime = savedPos
      }, { once: true })
    }
  }, [])

  // keep localStorage blob cache across sessions — server DB is the source of truth

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeCard() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const drag = (barRef, onMove) => (e) => {
    e.preventDefault()
    const bar = barRef.current
    if (!bar) return
    const getPct = (clientX) => {
      const rect = bar.getBoundingClientRect()
      return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    }
    const getX = (ev) => ev.touches ? ev.touches[0].clientX : ev.clientX
    onMove(getPct(getX(e)))
    const move = (ev) => onMove(getPct(getX(ev)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
  }

  const seekFn = (pct) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = pct * audio.duration
    setProgress(pct * 100)
  }

  const handleBarSeek = drag(barSeekRef, seekFn)
  const handleCardSeek = drag(cardSeekRef, seekFn)
  const dragVertical = (barRef, onMove) => (e) => {
    e.preventDefault()
    const bar = barRef.current
    if (!bar) return
    const getPct = (clientY) => {
      const rect = bar.getBoundingClientRect()
      return Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1)
    }
    const getY = (ev) => ev.touches ? ev.touches[0].clientY : ev.clientY
    onMove(getPct(getY(e)))
    const move = (ev) => onMove(getPct(getY(ev)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
  }

  const handleVolume = dragVertical(volBarVertRef, (pct) => {
    const v = 1 - pct  // invert: top = loud, bottom = quiet
    if (audioRef.current) audioRef.current.volume = v
    setVolume(v)
  })

  const search = async (q = query) => {
    q = q.trim()
    if (!q) return
    // if same query and results already loaded, skip fetch
    if (q.toLowerCase() === query.toLowerCase() && results.length > 0) return
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
    sessionStorage.removeItem('rpos')

    const cacheKey = `blob_${item.videoId}`
    const audio = audioRef.current
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      audio.src = cached
      audio.load()
      audio.play().catch(e => { setStreamError(e.message); setIsPlaying(false) })
      setIsPlaying(true)
      return
    }

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
        try { localStorage.setItem(cacheKey, base64) } catch {
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

  const playNext = () => {
    if (!results.length) return
    const idx = results.findIndex(r => r.videoId === activeItem?.videoId)
    let next
    if (shuffle) {
      const others = results.filter(r => r.videoId !== activeItem?.videoId)
      next = others[Math.floor(Math.random() * others.length)]
    } else {
      next = results[(idx + 1) % results.length]
    }
    if (next) play(next)
  }

  const playPrev = () => {
    if (!results.length) return
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return }
    const idx = results.findIndex(r => r.videoId === activeItem?.videoId)
    const prev = results[(idx - 1 + results.length) % results.length]
    if (prev) play(prev)
  }

  const closeCard = () => {
    setCardClosing(true)
    setTimeout(() => { setShowCard(false); setCardClosing(false); setShowVol(false) }, 380)
  }

  const cycleRepeat = () => setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')

  return (
    <div className="layout">
      <div className="main">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <img src="/logo.png" alt="" className="topbar-logo-icon" />
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
        onEnded={() => {
          if (repeat === 'one') { audioRef.current.currentTime = 0; audioRef.current.play() }
          else if (repeat === 'all' || shuffle) playNext()
          else {
            const idx = results.findIndex(r => r.videoId === activeItem?.videoId)
            if (idx < results.length - 1) playNext()
            else setIsPlaying(false)
          }
        }}
      />

      {/* ── Bottom Player Bar ── */}
      <div className={`player-bar${activeItem ? ' visible' : ''}`}>
        {/* thin seek line across the very top of the bar */}
        <div className="bar-progress" ref={barSeekRef} onMouseDown={handleBarSeek} onTouchStart={handleBarSeek}>
          <div className="bar-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* left: thumb + info → click opens card */}
        <div className="bar-left" onClick={() => activeItem && setShowCard(true)}>
          <div className="bar-thumb-wrap">
            {activeItem && <img src={activeItem.thumbnail} alt="" />}
            {isPlaying && (
              <div className="bar-eq">
                {[1,2,3].map(i => <span key={i} className="bar-eq-bar" style={{ animationDelay: `${i * 0.18}s` }} />)}
              </div>
            )}
          </div>
          <div className="bar-info">
            <p className="bar-title">{activeItem?.title}</p>
            <p className="bar-ch">{activeItem?.channel}</p>
          </div>
        </div>

        {/* center: prev + play/pause + next */}
        <div className="bar-center">
          <button className="bar-skip" onClick={playPrev}><span className="material-symbols-outlined">skip_previous</span></button>
          <button className="bar-play" onClick={togglePlay} disabled={downloading}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", animation: downloading ? 'spin 0.8s linear infinite' : 'none' }}>
              {downloading ? 'autorenew' : isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button className="bar-skip" onClick={playNext}><span className="material-symbols-outlined">skip_next</span></button>
        </div>

        {/* right: like + expand */}
        <div className="bar-right">
          <span
            className="material-symbols-outlined bar-like"
            style={{ fontVariationSettings: liked[activeItem?.videoId] ? "'FILL' 1" : "'FILL' 0", color: liked[activeItem?.videoId] ? '#f2ca50' : '#3a3a3a' }}
            onClick={e => activeItem && toggleLike(e, activeItem.videoId)}
          >favorite</span>
          <button className="bar-expand" onClick={() => setShowCard(true)}>
            <span className="material-symbols-outlined">expand_less</span>
          </button>
        </div>

        {streamError && <p className="bar-err">{streamError}</p>}
      </div>

      {/* ── Now Playing Card ── */}
      {showCard && activeItem && (
        <div className={`np-overlay${cardClosing ? ' closing' : ''}`} onClick={closeCard}>
          <div className={`np-card${cardClosing ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>

            {/* blurred album art bg */}
            <div className="np-card-bg" style={{ backgroundImage: `url(${activeItem.thumbnail})` }} />
            <div className="np-card-dim" />

            <div className="np-card-body">
              {/* drag handle */}
              <div className="np-drag-handle" />

              {/* header */}
              <div className="np-header">
                <button className="np-close" onClick={closeCard}>
                  <span className="material-symbols-outlined">keyboard_arrow_down</span>
                </button>
                <span className="np-label">Now Playing</span>
                <div className="np-header-right">
                  <div className="np-vol-wrap">
                    {showVol && (
                      <div className="np-vol-popup">
                        <span className="np-vol-pct">{Math.round(volume * 100)}</span>
                        <div className="np-vol-vert" ref={volBarVertRef} onMouseDown={handleVolume} onTouchStart={handleVolume}>
                          <div className="np-vol-vert-rail" />
                          <div className="np-vol-vert-fill" style={{ height: `${volume * 100}%` }}>
                            <div className="np-vol-vert-thumb" />
                          </div>
                        </div>
                      </div>
                    )}
                    <button className="np-vol-btn" onClick={() => setShowVol(v => !v)}>
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                      </span>
                    </button>
                  </div>
                  <span
                    className="material-symbols-outlined np-like"
                    style={{ fontVariationSettings: liked[activeItem.videoId] ? "'FILL' 1" : "'FILL' 0", color: liked[activeItem.videoId] ? '#f2ca50' : 'rgba(255,255,255,0.35)' }}
                    onClick={e => toggleLike(e, activeItem.videoId)}
                  >favorite</span>
                </div>
              </div>

              {/* vinyl disc */}
              <div className="np-art-wrap">
                <div className={`np-disc${isPlaying ? ' spinning' : ''}`}>
                  <img src={activeItem.thumbnail} alt="" className="np-disc-img" />
                  <div className="np-disc-grooves" />
                  <div className="np-disc-hole" />
                </div>
              </div>

              {/* track info */}
              <div className="np-meta">
                <p className="np-title">{activeItem.title}</p>
                <p className="np-ch">{activeItem.channel}</p>
              </div>

              {/* seek bar */}
              <div className="np-seek-wrap">
                <div className="np-seek" ref={cardSeekRef} onMouseDown={handleCardSeek} onTouchStart={handleCardSeek}>
                  <div className="np-seek-rail" />
                  <div className="np-seek-fill" style={{ width: `${progress}%` }}>
                    <div className="np-seek-thumb" />
                  </div>
                </div>
                <div className="np-times">
                  <span>{currentTime}</span>
                  <span>{duration}</span>
                </div>
              </div>

              {/* controls */}
              <div className="np-controls">
                <button className={`np-btn-sm${shuffle ? ' np-btn-active' : ''}`} onClick={() => setShuffle(v => !v)}>
                  <span className="material-symbols-outlined">shuffle</span>
                </button>
                <button className="np-btn-md" onClick={playPrev}>
                  <span className="material-symbols-outlined">skip_previous</span>
                </button>
                <button className="np-btn-play" onClick={togglePlay} disabled={downloading}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", animation: downloading ? 'spin 0.8s linear infinite' : 'none' }}>
                    {downloading ? 'autorenew' : isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <button className="np-btn-md" onClick={playNext}>
                  <span className="material-symbols-outlined">skip_next</span>
                </button>
                <button className={`np-btn-sm${repeat !== 'off' ? ' np-btn-active' : ''}`} onClick={cycleRepeat}>
                  <span className="material-symbols-outlined">{repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
                </button>
              </div>

              {streamError && <p className="np-err">{streamError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
