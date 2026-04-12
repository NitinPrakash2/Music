import { useState, useEffect, useRef } from 'react';
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
              ? <span className="material-symbols-outlined spin" style={{ color: '#1a1000', fontSize: 22 }}>autorenew</span>
              : <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{isActive && isPlaying ? 'pause' : 'play_arrow'}</span>}
          </div>
          <span className="material-symbols-outlined like-btn"
            style={{ fontVariationSettings: liked[item.videoId] ? "'FILL' 1" : "'FILL' 0", color: liked[item.videoId] ? '#f2ca50' : '#fff' }}
            onClick={e => onToggleLike(e, item.videoId, item)}>favorite</span>
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
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_vert</span>
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

export default function Search({ searchQuery, onPlayTrack, activeItem, isPlaying, downloading, liked, onToggleLike }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => { if (searchQuery) search(searchQuery); }, [searchQuery]);

  const search = async (q) => {
    q = q.trim(); if (!q) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results || []);
      if (!data.results?.length) setError('No results found.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="search-loading"><span className="material-symbols-outlined spin">autorenew</span><p>Searching...</p></div>;

  return (
    <div className="search-page">
      {error && <p className="search-error">{error}</p>}
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
          <span className="material-symbols-outlined">music_note</span>
          <h2>Play what you love</h2>
          <p>Search for songs, artists, and more using the search bar above.</p>
        </div>
      )}
    </div>
  );
}
