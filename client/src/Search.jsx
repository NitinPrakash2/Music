import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function Search({ searchQuery, onPlayTrack, activeItem, isPlaying, downloading, liked, onToggleLike }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchQuery) {
      search(searchQuery);
    }
  }, [searchQuery]);

  const search = async (q) => {
    q = q.trim();
    if (!q) return;
    
    setLoading(true);
    setError('');
    setResults([]);
    
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results || []);
      if (!data.results?.length) setError('No results found.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="search-loading">
        <span className="material-symbols-outlined spin">autorenew</span>
        <p>Searching...</p>
      </div>
    );
  }

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
              <div
                key={item.videoId}
                className={`track-card${activeItem?.videoId === item.videoId ? ' active' : ''}${activeItem?.videoId === item.videoId && downloading ? ' loading' : ''}`}
                onClick={() => onPlayTrack(item)}
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
                      onClick={e => onToggleLike(e, item.videoId)}
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
