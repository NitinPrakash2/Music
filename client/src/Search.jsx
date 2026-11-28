import { useState, useEffect, useRef } from 'react';
import { Loader2, Play, Pause, Heart, MoreVertical, Music } from 'lucide-react';
import TrackMenu from './TrackMenu';

const API = import.meta.env.VITE_API_URL || '';

function SearchCard({ item, activeItem, isPlaying, downloading, liked, onPlayTrack, onToggleLike, menuOpen, setMenuOpen }) {
  const btnRef = useRef(null)
  const isActive = activeItem?.videoId === item.videoId
  const isOpen = menuOpen === item.videoId

  return (
    <div style={{ position: 'relative' }}
      className={`track-card${isActive ? ' active' : ''}${isActive && downloading ? ' loading' : ''}`}
      onClick={() => onPlayTrack(item)}>
      <div className="track-thumb">
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
      <div className="track-info">
        <p className="track-title">{item.title}</p>
        <p className="track-channel">{item.channel}</p>
      </div>

      <button ref={btnRef}
        onClick={e => { e.stopPropagation(); setMenuOpen(isOpen ? null : item.videoId) }}
        className="track-more-btn"
        style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 4, padding: 0 }}>
        <MoreVertical size={16} />
      </button>

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

export default function Search({ searchQuery, onPlayTrack, activeItem, isPlaying, downloading, liked, onToggleLike, refreshNonce = 0 }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    if (searchQuery) search(searchQuery, refreshNonce > 0);
  }, [searchQuery, refreshNonce]);

  const search = async (q, forceRefresh = false) => {
    q = q.trim(); if (!q) return;
    const cacheKey = `rx_search_v4_${q.toLowerCase()}`;
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setResults(parsed);
            setError('');
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    setLoading(true); setError('');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}${forceRefresh ? '&fresh=1' : ''}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        const list = data.results || [];
        setResults(list);
        if (list.length > 0) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
        } else {
          setError('No results found.');
        }
        setLoading(false);
        return;
      } catch (err) {
        if (attempt === 0) continue;
        setError(err.message || 'Search failed');
      }
    }
    setLoading(false);
  };

  if (loading) return <div className="search-loading"><Loader2 size={28} className="spin" /><p>Searching...</p></div>;

  return (
    <div className="search-page">
      {error && (
        <div className="search-error" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => search(searchQuery, true)}
            style={{
              padding: '8px 20px', borderRadius: 999, border: 'none',
              background: 'linear-gradient(135deg,#f2ca50,#d4a12a)', color: '#1a1000',
              fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}
      {results.length > 0 && (
        <>
          <div className="results-header">
            <h2>Results for "{searchQuery}"</h2>
            <span>{results.length} tracks</span>
          </div>
          <div className="grid">
            {results.map(item => (
              <SearchCard
                key={item.videoId}
                item={item}
                activeItem={activeItem}
                isPlaying={isPlaying}
                downloading={downloading}
                liked={liked}
                onPlayTrack={onPlayTrack}
                onToggleLike={onToggleLike}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
              />
            ))}
          </div>
        </>
      )}
      {results.length === 0 && !loading && !error && (
        <div className="empty">
          <Music size={40} style={{ color: '#f2ca50', marginBottom: 12 }} />
          <h2>Play what you love</h2>
          <p>Search for songs, artists, and more using the search bar above.</p>
        </div>
      )}
    </div>
  );
}
