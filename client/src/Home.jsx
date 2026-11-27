import { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Heart, MoreVertical, Loader2, AlertCircle,
  CheckCircle2, RefreshCw, TrendingUp, Music, Disc3,
  ListMusic, Sparkles, Flame, ChevronLeft, ChevronRight, History
} from 'lucide-react';
import TrackMenu from './TrackMenu';

const API = import.meta.env.VITE_API_URL || '';

// Per-card wrapper that holds its own anchorRef
function TrackCard({ item, activeItem, isPlaying, downloading, liked, onPlayTrack, onToggleLike, playlistKey, menuOpen, setMenuOpen }) {
  const btnRef = useRef(null)
  const isActive = activeItem?.videoId === item.videoId
  const isOpen = menuOpen === item.videoId

  return (
    <div style={{ position: 'relative' }}
      className={`track-card${isActive ? ' active' : ''}${isActive && downloading ? ' loading' : ''}`}>

      {/* Thumbnail */}
      <div className="track-thumb" onClick={() => onPlayTrack(item)}>
        <img src={item.thumbnail} alt={item.title} />
        <div className="track-overlay">
          <div className="play-icon">
            {isActive && downloading
              ? <Loader2 size={20} className="spin" style={{ color: '#1a1000' }} />
              : isActive && isPlaying
                ? <Pause size={20} fill="#1a1000" stroke="#1a1000" />
                : <Play size={20} fill="#1a1000" stroke="#1a1000" style={{ marginLeft: 2 }} />}
          </div>
          <button
            type="button"
            className="like-btn"
            style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', color: liked[item.videoId] ? '#f2ca50' : '#fff' }}
            onClick={e => onToggleLike(e, item.videoId, item)}>
            <Heart size={18} fill={liked[item.videoId] ? '#f2ca50' : 'none'} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div
        className="track-info"
        style={{ cursor: 'pointer' }}
        onClick={() => playlistKey ? (window.location.hash = `/playlist/${playlistKey}`) : onPlayTrack(item)}
      >
        <p className="track-title">{item.title}</p>
        <p className="track-channel">{item.channel}</p>
      </div>

      {/* ⋮ button — outside thumb, uses ref for portal positioning */}
      <button ref={btnRef}
        onClick={e => { e.stopPropagation(); setMenuOpen(isOpen ? null : item.videoId) }}
        className="track-more-btn"
        style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 4, padding: 0 }}>
        <MoreVertical size={16} />
      </button>

      {/* Menu portal */}
      {isOpen && (
        <TrackMenu
          item={item}
          anchorRef={btnRef}
          onClose={() => setMenuOpen(null)}
          liked={liked}
          onToggleLike={onToggleLike}
        />
      )}
    </div>
  )
}

export default function Home({ onPlayTrack, activeItem, isPlaying, downloading, liked, onToggleLike, onAmbientChange, recentlyPlayed = [], recentSearches = [] }) {
  const [playlists, setPlaylists] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [recommended, setRecommended] = useState([]);
  const [recReason, setRecReason] = useState('');
  const [recAi, setRecAi] = useState(false);
  const homeRef = useRef(null);

  const heroSlides = playlists.trending || [];

  useEffect(() => {
    if (heroSlides.length <= 1 || heroPaused) return;
    const t = setInterval(() => {
      setHeroIdx(i => (i + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(t);
  }, [heroSlides.length, heroPaused]);

  useEffect(() => {
    if (heroIdx >= heroSlides.length && heroSlides.length > 0) {
      setHeroIdx(0);
    }
  }, [heroSlides.length, heroIdx]);

  useEffect(() => {
    const slideThumb = heroSlides[heroIdx]?.thumbnail || '';
    onAmbientChange?.(slideThumb);
  }, [heroIdx, heroSlides, onAmbientChange]);

  useEffect(() => {
    fetchPlaylists();
    const interval = setInterval(fetchPlaylists, 1800000);
    const onOnline = () => {
      setError(prev => {
        if (prev) fetchPlaylists();
        return prev;
      });
    };
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    const content = document.querySelector('.content');
    if (!content) return;
    let rafId = 0;
    const updateScroll = () => {
      rafId = 0;
      const topbar = document.querySelector('.topbar');
      if (topbar) topbar.classList.toggle('scrolled', content.scrollTop > 10);
      const ambient = document.querySelector('.app-ambient-backdrop');
      if (ambient) {
        ambient.style.transform = `translate3d(0, ${-content.scrollTop}px, 0) scale(1.04)`;
      }
    };
    const onScroll = () => {
      if (!rafId) rafId = requestAnimationFrame(updateScroll);
    };
    updateScroll();
    content.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      content.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 60);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.playlist-section').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, recentlyPlayed.length, recommended.length]);

  // Fetch AI-powered personalized recommendations from listening & search history
  const recentSig = recentlyPlayed.slice(0, 6).map(t => t.videoId).join(',');
  const searchSig = (recentSearches || []).slice(0, 5).map(s => typeof s === 'string' ? s : s.query).join(',');
  const likedSig = Object.keys(liked || {}).slice(0, 4).join(',');

  useEffect(() => {
    const likedTracks = Object.values(liked || {}).filter(v => v && v.videoId);
    const searchQueries = (recentSearches || []).map(s => typeof s === 'string' ? s : s.query).filter(Boolean);
    if (!recentlyPlayed.length && !searchQueries.length && !likedTracks.length) {
      setRecommended([]);
      setRecReason('');
      return;
    }

    const cacheKey = `rx_rec_${recentSig}_${searchSig}_${likedSig}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.tracks?.length) {
          setRecommended(parsed.tracks);
          setRecReason(parsed.reason || '');
          setRecAi(Boolean(parsed.aiPowered));
          return;
        }
      }
    } catch {}

    let cancelled = false;
    fetch(`${API}/api/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recentTracks: recentlyPlayed.slice(0, 10).map(({ videoId, title, channel }) => ({ videoId, title, channel })),
        searchQueries: searchQueries.slice(0, 8),
        likedTracks: likedTracks.slice(0, 8).map(({ videoId, title, channel }) => ({ videoId, title, channel })),
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const tracks = Array.isArray(d.tracks) ? d.tracks.slice(0, 6) : [];
        setRecommended(tracks);
        setRecReason(d.reason || '');
        setRecAi(Boolean(d.aiPowered));
        if (tracks.length > 0) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ tracks, reason: d.reason || '', aiPowered: Boolean(d.aiPowered) })); } catch {}
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [recentSig, searchSig, likedSig]);

  useEffect(() => {
    if (loading) return;
    const onMove = (e) => {
      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };
    const cards = document.querySelectorAll('.track-card');
    cards.forEach(c => c.addEventListener('mousemove', onMove));
    return () => cards.forEach(c => c.removeEventListener('mousemove', onMove));
  }, [loading, playlists]);

  const fetchPlaylists = async () => {
    try {
      setSyncing(true);
      setError('');
      const res = await fetch(`${API}/api/playlists/all`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load playlists');
      setPlaylists(data);
      setLoading(false);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
      setLoading(false);
    } finally {
      setSyncing(false);
    }
  };

  const categories = [
    { key: 'trending', title: 'Trending Now', Icon: TrendingUp },
    { key: 'hindiTop', title: 'Top Hindi Songs', Icon: Music },
    { key: 'englishTop', title: 'Top English Songs', Icon: Disc3 },
    { key: 'punjabi', title: 'Punjabi Hits', Icon: ListMusic },
    { key: 'romantic', title: 'Romantic', Icon: Heart },
    { key: 'party', title: 'Party Anthems', Icon: Sparkles },
  ];

  if (loading) return <div className="home-loading"><Loader2 size={32} className="spin" /><p>Loading playlists...</p></div>;
  if (error) return <div className="home-error"><AlertCircle size={32} /><p>{error}</p><button onClick={() => { setLoading(true); setError(''); fetchPlaylists(); }}>Retry</button></div>;

  const currentSlide = heroSlides[heroIdx];
  const isSlideActive = currentSlide && activeItem?.videoId === currentSlide.videoId;

  return (
    <div className="home" ref={homeRef}>
      {currentSlide ? (
        <div className="hero-ambient-wrap">
          <div
            className="hero-slideshow"
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
            onClick={() => onPlayTrack(currentSlide, heroSlides)}
          >
          <div
            className="hero-slide-bg"
            style={{ backgroundImage: `url(${currentSlide.thumbnail})` }}
          />
          <div className="hero-slide-scrim" />

          {/* Top-right subtle sync & refresh */}
          <div className="hero-top-actions" onClick={e => e.stopPropagation()}>
            {lastSync && (
              <div className="hero-sync-pill">
                {syncing
                  ? <><RefreshCw size={12} className="spin" /><span>Syncing...</span></>
                  : <><CheckCircle2 size={12} /><span>{lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>}
              </div>
            )}
            <button className="hero-refresh-pill" onClick={fetchPlaylists} disabled={syncing} title="Refresh trending">
              <RefreshCw size={13} className={syncing ? 'spin' : ''} />
              <span>{syncing ? 'Syncing' : 'Refresh'}</span>
            </button>
          </div>

          <div className="hero-slide-content">
            <div className="hero-slide-thumb-wrap">
              <img src={currentSlide.thumbnail} alt={currentSlide.title} className="hero-slide-thumb" />
              <div className="hero-slide-thumb-play">
                {isSlideActive && downloading
                  ? <Loader2 size={24} className="spin" />
                  : isSlideActive && isPlaying
                    ? <Pause size={24} fill="#1a1000" stroke="#1a1000" />
                    : <Play size={24} fill="#1a1000" stroke="#1a1000" style={{ marginLeft: 2 }} />}
              </div>
            </div>

            <div className="hero-slide-meta">
              <div className="hero-trending-badge">
                <Flame size={13} />
                <span>TRENDING #{heroIdx + 1} · VIRAL NOW</span>
              </div>
              <h1 className="hero-slide-title">{currentSlide.title}</h1>
              <p className="hero-slide-channel">{currentSlide.channel}</p>

              <div className="hero-slide-actions" onClick={e => e.stopPropagation()}>
                <button
                  className="hero-play-btn"
                  onClick={() => onPlayTrack(currentSlide, heroSlides)}
                >
                  {isSlideActive && downloading
                    ? <><Loader2 size={16} className="spin" /><span>Loading...</span></>
                    : isSlideActive && isPlaying
                      ? <><Pause size={16} fill="#1a1000" stroke="#1a1000" /><span>Playing</span></>
                      : <><Play size={16} fill="#1a1000" stroke="#1a1000" /><span>Play Now</span></>}
                </button>
                <button
                  className={`hero-like-btn${liked[currentSlide.videoId] ? ' liked' : ''}`}
                  onClick={e => onToggleLike(e, currentSlide.videoId, currentSlide)}
                  title={liked[currentSlide.videoId] ? 'Unlike' : 'Like'}
                >
                  <Heart size={18} fill={liked[currentSlide.videoId] ? '#f2ca50' : 'none'} />
                </button>
              </div>
            </div>
          </div>

          {heroSlides.length > 1 && (
            <>
              <button
                className="hero-nav-btn prev"
                onClick={e => { e.stopPropagation(); setHeroIdx(i => (i - 1 + heroSlides.length) % heroSlides.length); }}
                aria-label="Previous trending song"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="hero-nav-btn next"
                onClick={e => { e.stopPropagation(); setHeroIdx(i => (i + 1) % heroSlides.length); }}
                aria-label="Next trending song"
              >
                <ChevronRight size={20} />
              </button>
              <div className="hero-dots" onClick={e => e.stopPropagation()}>
                {heroSlides.map((s, i) => (
                  <button
                    key={s.videoId || i}
                    className={`hero-dot${i === heroIdx ? ' active' : ''}`}
                    onClick={() => setHeroIdx(i)}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      ) : null}

      {recentlyPlayed.length > 0 && (
        <div className="playlist-section visible">
          <div className="playlist-header">
            <h2><History size={20} style={{ color: '#f2ca50' }} />Recently Played</h2>
          </div>
          <div className="playlist-grid">
            {recentlyPlayed.slice(0, 6).map((item) => (
              <TrackCard
                key={`recent-${item.videoId}`}
                item={item}
                activeItem={activeItem}
                isPlaying={isPlaying}
                downloading={downloading}
                liked={liked}
                onPlayTrack={(t) => onPlayTrack(t, recentlyPlayed)}
                onToggleLike={onToggleLike}
                playlistKey=""
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
              />
            ))}
          </div>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="playlist-section visible">
          <div className="playlist-header">
            <h2><Sparkles size={20} style={{ color: '#f2ca50' }} />Recommended for You</h2>
          </div>
          <div className="playlist-grid">
            {recommended.slice(0, 6).map((item) => (
              <TrackCard
                key={`rec-${item.videoId}`}
                item={item}
                activeItem={activeItem}
                isPlaying={isPlaying}
                downloading={downloading}
                liked={liked}
                onPlayTrack={(t) => onPlayTrack(t, recommended)}
                onToggleLike={onToggleLike}
                playlistKey=""
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
              />
            ))}
          </div>
        </div>
      )}

      {categories.map(({ key, title, Icon }) => (
        playlists[key]?.length > 0 && (
          <div key={key} className="playlist-section">
            <div className="playlist-header">
              <h2><Icon size={20} style={{ color: '#f2ca50' }} />{title}</h2>
              <a href={`#/playlist/${key}`} className="view-all">View All →</a>
            </div>
            <div className="playlist-grid">
              {playlists[key].map((item, idx) => (
                <TrackCard
                  key={item.videoId}
                  item={item}
                  activeItem={activeItem}
                  isPlaying={isPlaying}
                  downloading={downloading}
                  liked={liked}
                  onPlayTrack={onPlayTrack}
                  onToggleLike={onToggleLike}
                  playlistKey={key}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
