import { useState, useRef, useEffect } from 'react'
import Home from './Home'
import Search from './Search'
import Playlist from './Playlist'
import LikedPage from './LikedPage'
import UserPlaylistPage from './UserPlaylistPage'
import AccountPage from './AccountPage'
import Landing from './Landing'
import Auth from './Auth'
import Sidebar from './Sidebar'
import { apiFetch } from './api'
import { PlaylistProvider, usePlaylists } from './PlaylistContext'
import MobileDrawer from './MobileDrawer'

const API = import.meta.env.VITE_API_URL || ''

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function AppInner() {
  const { fetchPlaylists, reset: resetPlaylists } = usePlaylists()
  const [landed, setLanded] = useState(() => !!localStorage.getItem('rx_token'))
  const [showAuth, setShowAuth] = useState(false)
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('rx_user') || 'null'))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/')
  const [activeItem, setActiveItem] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [liked, setLiked] = useState({})
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [volume, setVolume] = useState(0.7)
  const [downloading, setDownloading] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [showVol, setShowVol] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [cardClosing, setCardClosing] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off')
  const [queue, setQueue] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState([])
  const [showRecentSearches, setShowRecentSearches] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  const audioRef = useRef(null)
  const barSeekRef = useRef(null)
  const cardSeekRef = useRef(null)
  const volBarVertRef = useRef(null)

  const queueRef = useRef([])
  const activeItemRef = useRef(null)
  const repeatRef = useRef('off')
  const shuffleRef = useRef(false)

  // Keep refs in sync with state so closures always read current values
  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { activeItemRef.current = activeItem }, [activeItem])
  useEffect(() => { repeatRef.current = repeat }, [repeat])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (user) {
      apiFetch('/api/auth/me').then(r => {
        if (!r.ok) handleLogout()
        else {
          fetchSearchHistory()
          fetchLiked()
          fetchPlaylists()
        }
      }).catch(() => handleLogout())
    }
  }, [])

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const timer = setTimeout(() => {
        fetchSuggestions(searchQuery)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSearchSuggestions([])
      setShowSuggestions(false)
    }
  }, [searchQuery])

  const fetchLiked = async () => {
    try {
      const res = await apiFetch('/api/liked')
      const data = await res.json()
      if (res.ok) setLiked(data.liked || {})
    } catch {}
  }

  const fetchSearchHistory = async () => {
    try {
      setRecentSearches([])
      const res = await apiFetch('/api/search-history')
      const data = await res.json()
      if (res.ok) setRecentSearches(data.history || [])
    } catch (err) {
      console.error('Failed to fetch search history:', err)
    }
  }

  const fetchSuggestions = async (query) => {
    try {
      const res = await apiFetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (res.ok && data.suggestions) {
        setSearchSuggestions(data.suggestions)
        setShowSuggestions(true)
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err)
    }
  }

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

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') { closeCard(); setSearchOpen(false); setSearchQuery('') }
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowRight') { const a = audioRef.current; if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 10) }
      if (e.key === 'ArrowLeft') { const a = audioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - 10) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSearch = async (q = searchQuery) => {
    q = q.trim()
    if (!q) return
    try {
      await apiFetch('/api/search-history', {
        method: 'POST',
        body: JSON.stringify({ query: q })
      })
      await fetchSearchHistory()
    } catch (err) {
      console.error('Failed to save search history:', err)
    }
    setShowRecentSearches(false)
    setShowSuggestions(false)
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  const removeRecentSearch = async (q) => {
    try {
      await apiFetch(`/api/search-history/${encodeURIComponent(q)}`, { method: 'DELETE' })
      await fetchSearchHistory()
    } catch (err) {
      console.error('Failed to delete search history:', err)
    }
  }

  const clearAllRecentSearches = async () => {
    try {
      await apiFetch('/api/search-history', { method: 'DELETE' })
      await fetchSearchHistory()
    } catch (err) {
      console.error('Failed to clear search history:', err)
    }
  }

  // Attach non-passive touch listeners directly to seek/volume bars
  useEffect(() => {
    const barSeek = barSeekRef.current
    const cardSeek = cardSeekRef.current
    const volVert = volBarVertRef.current
    if (barSeek) barSeek.addEventListener('touchstart', handleBarSeek, { passive: false })
    if (cardSeek) cardSeek.addEventListener('touchstart', handleCardSeek, { passive: false })
    if (volVert) volVert.addEventListener('touchstart', handleVolume, { passive: false })
    return () => {
      if (barSeek) barSeek.removeEventListener('touchstart', handleBarSeek)
      if (cardSeek) cardSeek.removeEventListener('touchstart', handleCardSeek)
      if (volVert) volVert.removeEventListener('touchstart', handleVolume)
    }
  }, [showCard, showVol])

  const drag = (barRef, onMove) => (e) => {
    if (e.cancelable) e.preventDefault()
    const bar = barRef.current
    if (!bar) return
    const getPct = (clientX) => {
      const rect = bar.getBoundingClientRect()
      return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    }
    const getX = (ev) => ev.touches ? ev.touches[0].clientX : ev.clientX
    onMove(getPct(getX(e)))
    const move = (ev) => { if (ev.cancelable) ev.preventDefault(); onMove(getPct(getX(ev))) }
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
    if (e.cancelable) e.preventDefault()
    const bar = barRef.current
    if (!bar) return
    const getPct = (clientY) => {
      const rect = bar.getBoundingClientRect()
      return Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1)
    }
    const getY = (ev) => ev.touches ? ev.touches[0].clientY : ev.clientY
    onMove(getPct(getY(e)))
    const move = (ev) => { if (ev.cancelable) ev.preventDefault(); onMove(getPct(getY(ev))) }
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
    const v = 1 - pct
    if (audioRef.current) audioRef.current.volume = v
    setVolume(v)
  })

  const play = async (item) => {
    setStreamError('')
    setActiveItem(item)
    setProgress(0)
    setCurrentTime('0:00')
    setDuration('0:00')

    const audio = audioRef.current
    setDownloading(true)
    setBuffering(true)
    setIsPlaying(false)

    // Revoke previous blob URL to free memory
    const prevUrl = localStorage.getItem('rx_playing_key')
    if (prevUrl && prevUrl !== `rx_blob_${item.videoId}`) {
      if (prevUrl.startsWith('blob:')) URL.revokeObjectURL(prevUrl)
      localStorage.removeItem('rx_playing_key')
    }

    const cacheKey = `rx_blob_${item.videoId}`
    const cachedUrl = sessionStorage.getItem(cacheKey)

    const startPlayback = async (src) => {
      audio.src = src
      audio.load()
      try {
        await audio.play()
        setIsPlaying(true)
      } catch (e) {
        setStreamError('Tap play to start')
        setIsPlaying(false)
      } finally {
        setDownloading(false)
        setBuffering(false)
      }
    }

    if (cachedUrl) {
      await startPlayback(cachedUrl)
    } else {
      try {
        const url = `${API}/api/stream?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${item.videoId}`)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Stream failed')
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        try {
          sessionStorage.setItem(cacheKey, blobUrl)
          localStorage.setItem('rx_playing_key', blobUrl)
        } catch {
          // storage full — clear and retry
          sessionStorage.clear()
          try { sessionStorage.setItem(cacheKey, blobUrl) } catch {}
        }
        await startPlayback(blobUrl)
      } catch (e) {
        setStreamError(e.message)
        setIsPlaying(false)
        setDownloading(false)
        setBuffering(false)
      }
    }

    // Media Session API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title,
        artist: item.channel,
        artwork: [{ src: item.thumbnail, sizes: '480x360', type: 'image/jpeg' }]
      })
      navigator.mediaSession.setActionHandler('play', () => { audioRef.current?.play(); setIsPlaying(true) })
      navigator.mediaSession.setActionHandler('pause', () => { audioRef.current?.pause(); setIsPlaying(false) })
      navigator.mediaSession.setActionHandler('nexttrack', playNext)
      navigator.mediaSession.setActionHandler('previoustrack', playPrev)
    }
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play(); setIsPlaying(true) }
    else { audio.pause(); setIsPlaying(false) }
  }

  const toggleLike = async (e, videoId, item) => {
    e.stopPropagation()
    const newVal = !liked[videoId]
    setLiked(prev => ({ ...prev, [videoId]: newVal }))
    try {
      await apiFetch('/api/liked/toggle', {
        method: 'POST',
        body: JSON.stringify({ videoId, title: item?.title || '', thumbnail: item?.thumbnail || '', channel: item?.channel || '' })
      })
    } catch {}
  }

  const playNext = () => {
    const q = queueRef.current
    const cur = activeItemRef.current
    if (!q.length) return
    const idx = q.findIndex(r => r.videoId === cur?.videoId)
    let next
    if (shuffleRef.current) {
      const others = q.filter(r => r.videoId !== cur?.videoId)
      next = others[Math.floor(Math.random() * others.length)]
    } else {
      next = q[(idx + 1) % q.length]
    }
    if (next) play(next)
  }

  const playPrev = () => {
    const q = queueRef.current
    const cur = activeItemRef.current
    if (!q.length) return
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return }
    const idx = q.findIndex(r => r.videoId === cur?.videoId)
    const prev = q[(idx - 1 + q.length) % q.length]
    if (prev) play(prev)
  }

  const closeCard = () => {
    setCardClosing(true)
    setTimeout(() => { setShowCard(false); setCardClosing(false); setShowVol(false) }, 380)
  }

  const cycleRepeat = () => setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')

  const handleEnter = () => { setLanded(true) }

  const handleAuth = (u) => {
    // clear any previous user's blob cache
    setUser(u)
    setLanded(true)
    setShowAuth(false)
    setRecentSearches([])
    setLiked({})
    setSearchQuery('')
    setSearchSuggestions([])
    setActiveItem(null)
    setTimeout(() => { fetchLiked(); fetchSearchHistory(); fetchPlaylists() }, 100)
  }

  const handleLogout = () => {
    const prevUrl = localStorage.getItem('rx_playing_key')
    if (prevUrl?.startsWith('blob:')) URL.revokeObjectURL(prevUrl)
    localStorage.removeItem('rx_playing_key')
    sessionStorage.clear()
    localStorage.removeItem('rx_token')
    localStorage.removeItem('rx_user')
    localStorage.removeItem('ra')
    resetPlaylists()
    setUser(null)
    setLiked({})
    setRecentSearches([])
    setSearchQuery('')
    setSearchSuggestions([])
    setActiveItem(null)
    setIsPlaying(false)
    setLanded(false)
    setShowAuth(false)
  }

  const navigate = (path) => {
    if (path === '/') {
      setSearchQuery('')
    }
    window.location.hash = path
  }

  let content
  if (route === '/' || route === '') {
    content = <Home onPlayTrack={play} activeItem={activeItem} isPlaying={isPlaying} downloading={downloading} liked={liked} onToggleLike={toggleLike} />
  } else if (route.startsWith('/search')) {
    const params = new URLSearchParams(route.split('?')[1])
    const q = params.get('q') || ''
    content = <Search searchQuery={q} onPlayTrack={play} activeItem={activeItem} isPlaying={isPlaying} downloading={downloading} liked={liked} onToggleLike={toggleLike} />
  } else if (route.startsWith('/playlist/')) {
    const type = route.split('/')[2]
    content = <Playlist type={type} onPlayTrack={play} activeItem={activeItem} isPlaying={isPlaying} downloading={downloading} liked={liked} onToggleLike={toggleLike} />
  } else if (route === '/liked') {
    content = <LikedPage onPlayTrack={play} activeItem={activeItem} isPlaying={isPlaying} downloading={downloading} liked={liked} onToggleLike={toggleLike} navigate={navigate} />
  } else if (route.startsWith('/my-playlist/')) {
    const id = route.split('/')[2]
    content = <UserPlaylistPage playlistId={id} onPlayTrack={play} onSetQueue={setQueue} onSetRepeat={setRepeat} activeItem={activeItem} isPlaying={isPlaying} navigate={navigate} />
  } else if (route === '/account') {
    content = <AccountPage user={user} navigate={navigate} onLogout={handleLogout} />
  } else {
    content = <Home onPlayTrack={play} activeItem={activeItem} isPlaying={isPlaying} downloading={downloading} liked={liked} onToggleLike={toggleLike} />
  }

  if (!user && (landed || showAuth)) return <Auth onAuth={handleAuth} onBack={() => { setLanded(false); setShowAuth(false) }} />
  if (!landed) return <Landing onEnter={handleEnter} onSignIn={() => { setShowAuth(true); setLanded(true) }} />

  return (
    <div className="layout">
      <style>{`
        .sidebar-wrap {
          width: 240px; flex-shrink: 0;
          transform: translateX(0);
          transition: width 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease;
          opacity: 1; overflow: hidden;
        }
        .sidebar-wrap.closed {
          width: 0; transform: translateX(-20px); opacity: 0;
        }
        .hamburger-btn {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); flex-shrink: 0;
        }
        .hamburger-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); transform: scale(1.08); }
        .hamburger-line {
          width: 16px; height: 2px; background: #a1a1aa; border-radius: 2px;
          transition: all 0.3s cubic-bezier(0.16,1,0.3,1); transform-origin: center;
        }
        .hamburger-btn.open .hamburger-line:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .hamburger-btn.open .hamburger-line:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .hamburger-btn.open .hamburger-line:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
        .track-card:hover .track-more-btn { opacity: 1 !important; }
      `}</style>
      <div className="main">
        <div className={`sidebar-wrap${sidebarOpen ? '' : ' closed'}`}>
          <Sidebar
            user={user}
            liked={liked}
            onPlayTrack={play}
            activeItem={activeItem}
            isPlaying={isPlaying}
            onLogout={handleLogout}
            navigate={navigate}
            currentRoute={route}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minWidth: 0 }}>
          <div className={`topbar${searchOpen ? ' search-open' : ''}`}>
            {/* Left: hamburgers + logo — hidden when search is open on mobile */}
            <div className="topbar-left-group">
              <button className={`hamburger-btn${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(v => !v)}>
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
              <button className="mobile-hamburger" onClick={() => setDrawerOpen(true)}>
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
              <div className="topbar-left" onClick={() => navigate('/')}>
                <img src="/logo.png" alt="" className="topbar-logo-icon" />
                <span className="topbar-logo-text">Relax<span>ify</span></span>
              </div>
            </div>

            {/* Expandable search */}
            <div className={`topbar-search-expand${searchOpen ? ' open' : ''}`}>
              <div className={`topbar-search-container${searchFocused ? ' focused' : ''}`}>
                <span className="material-symbols-outlined" style={{ flexShrink: 0 }}>search</span>
                <input
                  ref={searchInputRef}
                  placeholder="Songs, artists, albums..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearch()
                    if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); setSearchSuggestions([]) }
                  }}
                  onFocus={() => { setSearchFocused(true); if (!searchQuery.trim()) setShowRecentSearches(true) }}
                  onBlur={() => setTimeout(() => {
                    setSearchFocused(false); setShowRecentSearches(false); setShowSuggestions(false)
                  }, 200)}
                />
                {searchQuery && (
                  <button className="topbar-clear-btn" onClick={() => { setSearchQuery(''); setSearchSuggestions([]); searchInputRef.current?.focus() }}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>

              {/* Close button — only shown when expanded */}
              <button className="topbar-search-close" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchSuggestions([]) }}>
                Cancel
              </button>

              {/* Dropdowns */}
              {showRecentSearches && recentSearches.length > 0 && !searchQuery.trim() && (
                <div className="topbar-recent-searches">
                  <div className="topbar-recent-header">
                    <span>Recent</span>
                    <button onClick={clearAllRecentSearches}>Clear all</button>
                  </div>
                  {recentSearches.map((item, idx) => (
                    <div key={idx} className="topbar-recent-item"
                      onMouseDown={e => { e.preventDefault(); setSearchQuery(item); handleSearch(item) }}>
                      <span className="material-symbols-outlined">history</span>
                      <span className="topbar-recent-text">{item}</span>
                      <button className="topbar-recent-remove"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeRecentSearch(item) }}>
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showSuggestions && searchSuggestions.length > 0 && searchQuery.trim() && (
                <div className="topbar-recent-searches">
                  {searchSuggestions.map((item, idx) => (
                    <div key={idx} className="topbar-recent-item"
                      onMouseDown={e => { e.preventDefault(); setSearchQuery(item); handleSearch(item) }}>
                      <span className="material-symbols-outlined">search</span>
                      <span className="topbar-recent-text">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: user + search icon + logout */}
            <div className="topbar-right">
              <span className="topbar-user-name">Hi, {user?.name?.split(' ')[0]}</span>
              {/* Search icon — triggers expand */}
              <button className="topbar-icon-btn topbar-search-trigger" title="Search"
                onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}>
                <span className="material-symbols-outlined">search</span>
              </button>
              <button className="topbar-icon-btn" title="Logout" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </div>

        <div className="content">
          {content}
        </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => setBuffering(false)}
        onError={e => {
          const m = { 1: 'Aborted', 2: 'Network error', 3: 'Decode error', 4: 'Unsupported format' }
          setStreamError(m[e.target.error?.code] || 'Stream error')
          setIsPlaying(false)
          setBuffering(false)
        }}
        style={{ display: 'none' }}
        onEnded={() => {
          const rep = repeatRef.current
          const q = queueRef.current
          const cur = activeItemRef.current
          if (rep === 'one') {
            audioRef.current.currentTime = 0
            audioRef.current.play()
            return
          }
          // Revoke blob URL of finished song
          const prevUrl = localStorage.getItem('rx_playing_key')
          if (prevUrl) {
            if (prevUrl.startsWith('blob:')) URL.revokeObjectURL(prevUrl)
            localStorage.removeItem('rx_playing_key')
            const cacheKey = `rx_blob_${cur?.videoId}`
            sessionStorage.removeItem(cacheKey)
          }
          if (rep === 'all' || shuffleRef.current) {
            playNext()
          } else {
            const idx = q.findIndex(r => r.videoId === cur?.videoId)
            if (idx !== -1 && idx < q.length - 1) playNext()
            else setIsPlaying(false)
          }
        }}
      />

      <div className={`player-bar${activeItem ? ' visible' : ''}`}>
        <div className="bar-progress" ref={barSeekRef} onMouseDown={handleBarSeek}>
          <div className="bar-progress-fill" style={{ width: `${progress}%` }} />
        </div>

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

        <div className="bar-center">
          <button className="bar-skip" onClick={playPrev}><span className="material-symbols-outlined">skip_previous</span></button>
          <button className="bar-play" onClick={togglePlay} disabled={downloading || buffering}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", animation: (downloading || buffering) ? 'spin 0.8s linear infinite' : 'none' }}>
              {downloading || buffering ? 'autorenew' : isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button className="bar-skip" onClick={playNext}><span className="material-symbols-outlined">skip_next</span></button>
        </div>

        <div className="bar-right">
          <span
            className="material-symbols-outlined bar-like"
            style={{ fontVariationSettings: liked[activeItem?.videoId] ? "'FILL' 1" : "'FILL' 0", color: liked[activeItem?.videoId] ? '#f2ca50' : '#3a3a3a' }}
            onClick={e => activeItem && toggleLike(e, activeItem.videoId, activeItem)}
          >favorite</span>
          <button className="bar-expand" onClick={() => setShowCard(true)}>
            <span className="material-symbols-outlined">expand_less</span>
          </button>
        </div>

        {streamError && <p className="bar-err">{streamError}</p>}
      </div>

{showCard && activeItem && (
        <div className={`np-overlay${cardClosing ? ' closing' : ''}`} onClick={closeCard}>
          <div className={`np-card${cardClosing ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="np-card-bg" style={{ backgroundImage: `url(${activeItem.thumbnail})` }} />
            <div className="np-card-dim" />

            <div className="np-card-body">
              <div className="np-drag-handle" />

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
                        <div className="np-vol-vert" ref={volBarVertRef} onMouseDown={handleVolume}>
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
                    onClick={e => toggleLike(e, activeItem.videoId, activeItem)}
                  >favorite</span>
                </div>
              </div>

              <div className="np-art-wrap">
                <div className={`np-disc${isPlaying ? ' spinning' : ''}`}>
                  <img src={activeItem.thumbnail} alt="" className="np-disc-img" />
                  <div className="np-disc-grooves" />
                  <div className="np-disc-hole" />
                </div>
              </div>

              <div className="np-meta">
                <p className="np-title">{activeItem.title}</p>
                <p className="np-ch">{activeItem.channel}</p>
              </div>

              <div className="np-seek-wrap">
                <div className="np-seek" ref={cardSeekRef} onMouseDown={handleCardSeek}>
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

              <div className="np-controls">
                <button className={`np-btn-sm${shuffle ? ' np-btn-active' : ''}`} onClick={() => setShuffle(v => !v)}>
                  <span className="material-symbols-outlined">shuffle</span>
                </button>
                <button className="np-btn-md" onClick={playPrev}>
                  <span className="material-symbols-outlined">skip_previous</span>
                </button>
                <button className="np-btn-play" onClick={togglePlay} disabled={downloading || buffering}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", animation: (downloading || buffering) ? 'spin 0.8s linear infinite' : 'none' }}>
                    {downloading || buffering ? 'autorenew' : isPlaying ? 'pause' : 'play_arrow'}
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
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        liked={liked}
        navigate={navigate}
        onLogout={handleLogout}
        currentRoute={route}
      />

    </div>
  )
}

export default function App() {
  return (
    <PlaylistProvider>
      <AppInner />
    </PlaylistProvider>
  )
}
