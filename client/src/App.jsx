import { useState, useRef, useEffect } from 'react'
import {
  Search as SearchIcon, X, History, LogOut, UserCog,
  SkipBack, SkipForward, Play, Pause, Loader2,
  Heart, ChevronUp, ChevronDown, VolumeX, Volume1, Volume2,
  Shuffle, Repeat, Repeat1, Download, WifiOff, RefreshCw, ListPlus, Mic2
} from 'lucide-react'
import TrackMenu from './TrackMenu'
import { resolveStreamUrl, triggerTrackDownload } from './nativeAudio'
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [npMenuOpen, setNpMenuOpen] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyricsData, setLyricsData] = useState({ synced: [], plain: '' })
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [rawTime, setRawTime] = useState(0)
  const [heroAmbientThumb, setHeroAmbientThumb] = useState('')
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const accountWrapRef = useRef(null)
  const npMenuBtnRef = useRef(null)
  const activeLyricRef = useRef(null)

  useEffect(() => {
    const onOutside = (e) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(e.target)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  const searchInputRef = useRef(null)
  const audioRef = useRef(null)
  const barSeekRef = useRef(null)
  const cardSeekRef = useRef(null)
  const volBarVertRef = useRef(null)

  const queueRef = useRef([])
  const activeItemRef = useRef(null)
  const repeatRef = useRef('off')
  const shuffleRef = useRef(false)
  const pendingResumeTimeRef = useRef(0)
  const lastSavedTimeRef = useRef(0)
  const playedHistoryRef = useRef(new Set())
  const streamRetryRef = useRef({ videoId: null, count: 0 })
  const lyricsAttemptRef = useRef({ videoId: null, ok: false, tries: 0 })

  const savePlaybackState = (item, time, dur, q) => {
    if (!item?.videoId) return
    try {
      localStorage.setItem('rx_playback_state', JSON.stringify({
        item,
        time: Number.isFinite(time) ? time : 0,
        duration: Number.isFinite(dur) ? dur : 0,
        queue: (q || []).slice(0, 50),
      }))
    } catch {}
  }

  // Fetch synced lyrics whenever activeItem changes, or retry on card/lyrics open if earlier fetch failed
  useEffect(() => {
    const vid = activeItem?.videoId
    const title = activeItem?.title
    if (!vid || !title) {
      lyricsAttemptRef.current = { videoId: null, ok: false, tries: 0 }
      setLyricsData({ synced: [], plain: '', disabled: false })
      return
    }
    const isNewTrack = lyricsAttemptRef.current.videoId !== vid
    if (!isNewTrack && lyricsAttemptRef.current.ok) return

    let cancelled = false
    let retryTimer = null
    if (isNewTrack) {
      lyricsAttemptRef.current = { videoId: vid, ok: false, tries: 0 }
      setLyricsData({ synced: [], plain: '', disabled: false })
    }

    const fetchLyrics = () => {
      if (cancelled) return
      setLyricsLoading(true)
      const dur = Math.round(audioRef.current?.duration || 0)
      fetch(`${API}/api/lyrics?videoId=${encodeURIComponent(vid)}&title=${encodeURIComponent(title)}&channel=${encodeURIComponent(activeItem.channel || '')}${dur > 0 ? `&duration=${dur}` : ''}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then(d => {
          if (cancelled) return
          lyricsAttemptRef.current = { videoId: vid, ok: true, tries: 0 }
          setLyricsData({ synced: d.synced || [], plain: d.plain || '', disabled: Boolean(d.disabled) })
        })
        .catch(() => {
          if (cancelled) return
          const nextTries = (lyricsAttemptRef.current.tries || 0) + 1
          lyricsAttemptRef.current = { videoId: vid, ok: false, tries: nextTries }
          if (nextTries <= 2) {
            retryTimer = setTimeout(fetchLyrics, 2500)
          }
        })
        .finally(() => {
          if (!cancelled) setLyricsLoading(false)
        })
    }

    fetchLyrics()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [activeItem?.videoId, showLyrics, showCard])

  const activeLyricIdx = (() => {
    const lines = lyricsData.synced
    if (!lines.length) return -1
    let idx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= rawTime + 0.25) idx = i
      else break
    }
    return idx
  })()

  useEffect(() => {
    if (showLyrics && showCard && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLyricIdx, showLyrics, showCard])

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
        if (r.status === 401) handleLogout()
        else if (r.ok) {
          fetchSearchHistory()
          fetchLiked()
          fetchPlaylists()
        }
      }).catch(() => {})
    }
  }, [])

  // Restore last played song and timestamp on startup
  useEffect(() => {
    if (!user) return
    try {
      const raw = localStorage.getItem('rx_playback_state')
      if (!raw) return
      const saved = JSON.parse(raw)
      if (!saved?.item?.videoId) return
      setActiveItem(saved.item)
      if (Array.isArray(saved.queue) && saved.queue.length) setQueue(saved.queue)
      const t = saved.time || 0
      const d = saved.duration || 0
      setCurrentTime(fmt(t))
      if (d > 0) {
        setDuration(fmt(d))
        setProgress((t / d) * 100)
      }
      pendingResumeTimeRef.current = t
      setTimeout(async () => {
        const audio = audioRef.current
        if (!audio || audio.src) return
        try {
          const url = await resolveStreamUrl(saved.item.videoId, API)
          if (audio && !audio.src) {
            audio.src = url
            audio.preload = 'metadata'
          }
        } catch {}
      }, 0)
    } catch {}
  }, [user?.id])

  // Save current playback timestamp right before closing window
  useEffect(() => {
    const onBeforeUnload = () => {
      const audio = audioRef.current
      if (activeItemRef.current && audio) {
        savePlaybackState(activeItemRef.current, audio.currentTime, audio.duration, queueRef.current)
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
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

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    setRawTime(audio.currentTime || 0)
    setCurrentTime(fmt(audio.currentTime))
    const dur = audio.duration
    if (dur && isFinite(dur)) {
      setDuration(fmt(dur))
      setProgress((audio.currentTime / dur) * 100)
    }
    const now = Date.now()
    if (now - lastSavedTimeRef.current >= 1000 && activeItemRef.current) {
      lastSavedTimeRef.current = now
      savePlaybackState(activeItemRef.current, audio.currentTime, dur, queueRef.current)
    }
  }

  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.duration && isFinite(audio.duration)) {
      setDuration(fmt(audio.duration))
    }
    if (pendingResumeTimeRef.current > 0) {
      const target = Math.min(pendingResumeTimeRef.current, audio.duration || pendingResumeTimeRef.current)
      audio.currentTime = target
      setCurrentTime(fmt(target))
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((target / audio.duration) * 100)
      }
      pendingResumeTimeRef.current = 0
    }
  }

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
    if (item?.videoId) playedHistoryRef.current.add(item.videoId)
    streamRetryRef.current = { videoId: item?.videoId || null, count: 0 }
    pendingResumeTimeRef.current = 0
    setStreamError('')
    setActiveItem(item)
    setProgress(0)
    setCurrentTime('0:00')
    setDuration('0:00')
    savePlaybackState(item, 0, 0, queueRef.current)

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
      audio.preload = 'auto'
      audio.load()
      try {
        await audio.play()
        setIsPlaying(true)
      } catch (e) {
        if (e.name === 'AbortError') return
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
        const url = await resolveStreamUrl(item.videoId, API)
        await startPlayback(url)
      } catch (e) {
        setStreamError(e.message || 'Failed to load audio')
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

  const recoverStream = async (cur, resumeAt = 0) => {
    const audio = audioRef.current
    if (!cur?.videoId || !audio) return false
    try {
      setStreamError('')
      setBuffering(true)
      pendingResumeTimeRef.current = resumeAt
      const freshUrl = await resolveStreamUrl(cur.videoId, API)
      audio.src = freshUrl
      audio.preload = 'auto'
      audio.load()
      await audio.play()
      setIsPlaying(true)
      setBuffering(false)
      return true
    } catch {
      setBuffering(false)
      setIsPlaying(false)
      return false
    }
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.error || (audio.readyState === 0 && activeItemRef.current)) {
      await recoverStream(activeItemRef.current, audio.currentTime || 0)
      return
    }
    if (audio.paused) {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch {
        if (activeItemRef.current) await recoverStream(activeItemRef.current, audio.currentTime || 0)
      }
    } else {
      audio.pause()
      setIsPlaying(false)
    }
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

  const playRelatedAutoplay = async (cur) => {
    if (!cur?.videoId) { setIsPlaying(false); return }
    try {
      const cleanChannel = (cur.channel || '').replace(/\s*-\s*Topic$/i, '').replace(/\b(Official|VEVO)\b/gi, '').trim()
      const isLabel = /^(t-series|zee music|saregama|sony music|speed records|tips official|yrf|eros now)/i.test(cleanChannel)
      const titleHint = (cur.title || '').split(/[|\-(]/)[0].trim()
      const qStr = isLabel || !cleanChannel ? `${titleHint} ${cleanChannel} songs`.trim() : `${cleanChannel} hit songs`
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(qStr)}`)
      const data = await res.json()
      const list = (data.results || []).filter(r => r.videoId && r.videoId !== cur.videoId)
      const fresh = list.filter(r => !playedHistoryRef.current.has(r.videoId))
      const pool = fresh.length ? fresh : list
      if (!pool.length) { setIsPlaying(false); return }
      const pick = pool[Math.floor(Math.random() * pool.length)]
      play(pick)
    } catch {
      setIsPlaying(false)
    }
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
    localStorage.removeItem('rx_playback_state')
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
    content = <Home onPlayTrack={play} activeItem={activeItem} isPlaying={isPlaying} downloading={downloading} liked={liked} onToggleLike={toggleLike} onAmbientChange={setHeroAmbientThumb} />
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
    content = <Home onPlayTrack={play} activeItem={activeItem} isPlaying={isPlaying} downloading={downloading} liked={liked} onToggleLike={toggleLike} onAmbientChange={setHeroAmbientThumb} />
  }

  if (!isOnline) {
    return (
      <div style={{
        minHeight: '100vh', background: '#08080a', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif"
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, marginBottom: 20,
          background: 'rgba(242,202,80,0.1)', border: '1px solid rgba(242,202,80,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f2ca50'
        }}>
          <WifiOff size={34} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>No Internet Connection</h1>
        <p style={{ fontSize: 14, color: '#a1a1aa', maxWidth: 360, lineHeight: 1.6, marginBottom: 24 }}>
          Relaxify requires an active internet connection to search, stream, and download songs.
        </p>
        <button
          type="button"
          onClick={() => { if (navigator.onLine) setIsOnline(true); else window.location.reload() }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 100, border: 'none',
            background: 'linear-gradient(135deg,#f2ca50,#d4a12a)', color: '#1a1000',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          <RefreshCw size={15} />
          Retry Connection
        </button>
      </div>
    )
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
        {((isPlaying && activeItem?.thumbnail) || heroAmbientThumb) && (route === '/' || route === '') ? (
          <div
            className="app-ambient-backdrop"
            style={{ backgroundImage: `url(${(isPlaying && activeItem?.thumbnail) ? activeItem.thumbnail : heroAmbientThumb})` }}
          />
        ) : null}
        <div className={`sidebar-wrap${sidebarOpen ? '' : ' closed'}`} style={{ position: 'relative', zIndex: 2 }}>
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
            {/* Left: hamburgers + logo (logo shown when sidebar is closed or on mobile) */}
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
              <div className={`topbar-left${sidebarOpen ? ' desktop-hidden' : ''}`} onClick={() => navigate('/')}>
                <img src="/logo.svg" alt="Relaxify" className="topbar-logo-icon" style={{ borderRadius: 8 }} />
                <span className="topbar-logo-text">Relax<span>ify</span></span>
              </div>
            </div>

            {/* Right: iOS fluid expandable search + Account hover menu */}
            <div className="topbar-right">
              <div className={`topbar-search-ios${searchOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="topbar-icon-btn topbar-search-trigger"
                  title="Search"
                  onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 80) }}
                >
                  <SearchIcon size={18} />
                </button>

                <div className={`topbar-search-pill${searchFocused ? ' focused' : ''}`}>
                  <SearchIcon size={17} style={{ flexShrink: 0, color: searchFocused ? '#f2ca50' : '#888', transition: 'color 0.2s' }} />
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
                      <X size={15} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="topbar-search-close"
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchSuggestions([]); setShowRecentSearches(false); setShowSuggestions(false) }}
                >
                  Cancel
                </button>

                {/* Dropdowns */}
                {searchOpen && showRecentSearches && recentSearches.length > 0 && !searchQuery.trim() && (
                  <div className="topbar-recent-searches">
                    <div className="topbar-recent-header">
                      <span>Recent</span>
                      <button onClick={clearAllRecentSearches}>Clear all</button>
                    </div>
                    {recentSearches.map((item, idx) => (
                      <div key={idx} className="topbar-recent-item"
                        onMouseDown={e => { e.preventDefault(); setSearchQuery(item); handleSearch(item) }}>
                        <History size={16} style={{ color: '#777', flexShrink: 0 }} />
                        <span className="topbar-recent-text">{item}</span>
                        <button className="topbar-recent-remove"
                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeRecentSearch(item) }}>
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {searchOpen && showSuggestions && searchSuggestions.length > 0 && searchQuery.trim() && (
                  <div className="topbar-recent-searches">
                    {searchSuggestions.map((item, idx) => (
                      <div key={idx} className="topbar-recent-item"
                        onMouseDown={e => { e.preventDefault(); setSearchQuery(item); handleSearch(item) }}>
                        <SearchIcon size={16} style={{ color: '#777', flexShrink: 0 }} />
                        <span className="topbar-recent-text">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Account pill with hover (desktop) + tap/click (mobile & desktop) dropdown */}
              <div ref={accountWrapRef} className={`topbar-account-wrap${accountMenuOpen ? ' open' : ''}`}>
                <div
                  className="topbar-account-pill"
                  onClick={() => setAccountMenuOpen(v => !v)}
                >
                  <div className="topbar-account-avatar">{user?.name?.[0]?.toUpperCase()}</div>
                  <span className="topbar-user-name">Hi, {user?.name?.split(' ')[0]}</span>
                  <ChevronDown size={14} className="topbar-account-chevron" />
                </div>

                <div className="topbar-account-menu">
                  <div className="topbar-account-card">
                    <div className="topbar-account-info">
                      <div className="topbar-account-avatar lg">{user?.name?.[0]?.toUpperCase()}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="topbar-account-fullname">{user?.name}</div>
                        <div className="topbar-account-email">{user?.email}</div>
                      </div>
                    </div>
                    <div className="topbar-account-divider" />
                    <button type="button" className="topbar-account-item" onClick={() => { setAccountMenuOpen(false); navigate('/account') }}>
                      <UserCog size={16} />
                      <span>Manage Account</span>
                    </button>
                    <button type="button" className="topbar-account-item danger" onClick={() => { setAccountMenuOpen(false); handleLogout() }}>
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        <div className="content">
          {content}
        </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => setBuffering(false)}
        onError={async e => {
          const cur = activeItemRef.current
          const resumeAt = audioRef.current?.currentTime || 0
          if (cur?.videoId) {
            const tracker = streamRetryRef.current
            const nextCount = tracker.videoId === cur.videoId ? tracker.count + 1 : 1
            if (nextCount <= 2) {
              streamRetryRef.current = { videoId: cur.videoId, count: nextCount }
              const ok = await recoverStream(cur, resumeAt)
              if (ok) return
            }
          }
          const m = { 1: 'Aborted', 2: 'Network error', 3: 'Decode error', 4: 'Unsupported format' }
          setStreamError(m[e.target.error?.code] || 'Stream error — tap Play to retry')
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
            else playRelatedAutoplay(cur)
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
          <button className="bar-skip" onClick={playPrev}><SkipBack size={20} /></button>
          <button className="bar-play" onClick={togglePlay} disabled={downloading || buffering}>
            {downloading || buffering
              ? <Loader2 size={20} className="spin" />
              : isPlaying
                ? <Pause size={20} fill="currentColor" />
                : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button className="bar-skip" onClick={playNext}><SkipForward size={20} /></button>
        </div>

        <div className="bar-right">
          {activeItem && (
            <button
              type="button"
              onClick={() => triggerTrackDownload(activeItem, API)}
              title="Download Audio"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, color: '#a1a1aa', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f2ca50'}
              onMouseLeave={e => e.currentTarget.style.color = '#a1a1aa'}
            >
              <Download size={18} />
            </button>
          )}
          <button
            type="button"
            className="bar-like"
            style={{ background: 'none', border: 'none', padding: 4, display: 'flex', alignItems: 'center', color: liked[activeItem?.videoId] ? '#f2ca50' : '#3a3a3a' }}
            onClick={e => activeItem && toggleLike(e, activeItem.videoId, activeItem)}
          >
            <Heart size={19} fill={liked[activeItem?.videoId] ? '#f2ca50' : 'none'} />
          </button>
          <button className="bar-expand" onClick={() => setShowCard(true)}>
            <ChevronUp size={20} />
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
                  <ChevronDown size={22} />
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
                    <button className="np-vol-btn np-icon-btn" onClick={() => setShowVol(v => !v)} title="Volume">
                      {volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="np-like np-icon-btn"
                    title={liked[activeItem.videoId] ? 'Unlike' : 'Like'}
                    style={{ color: liked[activeItem.videoId] ? '#f2ca50' : 'rgba(255,255,255,0.5)' }}
                    onClick={e => toggleLike(e, activeItem.videoId, activeItem)}
                  >
                    <Heart size={18} fill={liked[activeItem.videoId] ? '#f2ca50' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className={`np-icon-btn${showLyrics ? ' active' : ''}`}
                    title={showLyrics ? 'Show Album Art' : 'Show Live Lyrics'}
                    onClick={() => setShowLyrics(v => !v)}
                  >
                    <Mic2 size={17} />
                  </button>
                  <button
                    ref={npMenuBtnRef}
                    type="button"
                    className={`np-icon-btn${npMenuOpen ? ' active' : ''}`}
                    title="Add to Playlist / Download"
                    onClick={e => { e.stopPropagation(); setNpMenuOpen(v => !v) }}
                  >
                    <ListPlus size={18} />
                  </button>
                  {npMenuOpen && (
                    <TrackMenu
                      item={activeItem}
                      anchorRef={npMenuBtnRef}
                      onClose={() => setNpMenuOpen(false)}
                      liked={liked}
                      onToggleLike={toggleLike}
                    />
                  )}
                </div>
              </div>

              {showLyrics ? (
                <div className="np-lyrics-wrap">
                  {lyricsLoading ? (
                    <div className="np-lyrics-empty">
                      <Loader2 size={26} className="spin" style={{ color: '#f2ca50' }} />
                      <span>Finding synced lyrics...</span>
                    </div>
                  ) : lyricsData.synced.length > 0 ? (
                    <div className="np-lyrics-scroll">
                      {lyricsData.synced.map((line, i) => {
                        const isCur = i === activeLyricIdx
                        const isPast = i < activeLyricIdx
                        return (
                          <p
                            key={`${line.time}-${i}`}
                            ref={isCur ? activeLyricRef : null}
                            className={`np-lyric-line${isCur ? ' active' : ''}${isPast ? ' past' : ''}`}
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = line.time
                                setRawTime(line.time)
                              }
                            }}
                          >
                            {line.text}
                          </p>
                        )
                      })}
                    </div>
                  ) : lyricsData.plain ? (
                    <div className="np-lyrics-scroll">
                      <p className="np-lyrics-plain">{lyricsData.plain}</p>
                    </div>
                  ) : (
                    <div className="np-lyrics-empty">
                      <Mic2 size={28} style={{ color: '#52525b' }} />
                      <span>{lyricsData.disabled ? 'Lyrics not available for mashups & long mixes' : 'Lyrics not available for this track'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="np-art-wrap">
                  <div className={`np-disc${isPlaying ? ' spinning' : ''}`}>
                    <img src={activeItem.thumbnail} alt="" className="np-disc-img" />
                    <div className="np-disc-grooves" />
                    <div className="np-disc-hole" />
                  </div>
                </div>
              )}

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
                  <Shuffle size={19} />
                </button>
                <button className="np-btn-md" onClick={playPrev}>
                  <SkipBack size={22} />
                </button>
                <button className="np-btn-play" onClick={togglePlay} disabled={downloading || buffering}>
                  {downloading || buffering
                    ? <Loader2 size={26} className="spin" />
                    : isPlaying
                      ? <Pause size={26} fill="currentColor" />
                      : <Play size={26} fill="currentColor" style={{ marginLeft: 3 }} />}
                </button>
                <button className="np-btn-md" onClick={playNext}>
                  <SkipForward size={22} />
                </button>
                <button className={`np-btn-sm${repeat !== 'off' ? ' np-btn-active' : ''}`} onClick={cycleRepeat}>
                  {repeat === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
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
