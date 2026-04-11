import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function Home({ onPlayTrack, activeItem, isPlaying, downloading, liked, onToggleLike }) {
  const [playlists, setPlaylists] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    fetchPlaylists();
    const interval = setInterval(fetchPlaylists, 1800000); // Refresh every 30 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchPlaylists = async () => {
    try {
      setSyncing(true);
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
    { key: 'trending', title: '🔥 Trending Now', icon: 'trending_up' },
    { key: 'hindiTop', title: '🎵 Top Hindi Songs', icon: 'music_note' },
    { key: 'englishTop', title: '🎸 Top English Songs', icon: 'album' },
    { key: 'punjabi', title: '🥁 Punjabi Hits', icon: 'library_music' },
    { key: 'romantic', title: '💕 Romantic', icon: 'favorite' },
    { key: 'party', title: '🎉 Party Anthems', icon: 'celebration' },
  ];

  if (loading) {
    return (
      <div className="home-loading">
        <span className="material-symbols-outlined spin">autorenew</span>
        <p>Loading playlists...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-error">
        <span className="material-symbols-outlined">error</span>
        <p>{error}</p>
        <button onClick={fetchPlaylists}>Retry</button>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="home-hero">
        <h1>Welcome to Relaxify</h1>
        <p>Discover trending music and your favorite playlists</p>
        <div className="sync-controls">
          {lastSync && (
            <div className="sync-status">
              {syncing ? (
                <>
                  <span className="material-symbols-outlined spin">sync</span>
                  <span>Syncing latest songs...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Last synced: {lastSync.toLocaleTimeString()}</span>
                </>
              )}
            </div>
          )}
          <button className="refresh-btn" onClick={fetchPlaylists} disabled={syncing}>
            <span className="material-symbols-outlined">{syncing ? 'sync' : 'refresh'}</span>
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {categories.map(({ key, title, icon }) => (
        playlists[key]?.length > 0 && (
          <div key={key} className="playlist-section">
            <div className="playlist-header">
              <h2>
                <span className="material-symbols-outlined">{icon}</span>
                {title}
              </h2>
              <a href={`#/playlist/${key}`} className="view-all">View All →</a>
            </div>
            <div className="playlist-grid">
              {playlists[key].map(item => (
                <div
                  key={item.videoId}
                  className={`track-card${activeItem?.videoId === item.videoId ? ' active' : ''}${activeItem?.videoId === item.videoId && downloading ? ' loading' : ''}`}
                >
                  <div className="track-thumb" onClick={() => onPlayTrack(item)}>
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
                  <div className="track-info" onClick={() => window.location.hash = `/playlist/${key}`} style={{ cursor: 'pointer' }}>
                    <p className="track-title">{item.title}</p>
                    <p className="track-channel">{item.channel}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
