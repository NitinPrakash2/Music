import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function Playlist({ type, onPlayTrack, activeItem, isPlaying, downloading, liked, onToggleLike }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const titles = {
    trending: '🔥 Trending Now',
    hindiTop: '🎵 Top Hindi Songs',
    englishTop: '🎸 Top English Songs',
    punjabi: '🥁 Punjabi Hits',
    romantic: '💕 Romantic Songs',
    party: '🎉 Party Anthems',
  };

  useEffect(() => {
    fetchPlaylist();
  }, [type]);

  const fetchPlaylist = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/playlists/${type}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load playlist');
      setSongs(data.results || []);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="playlist-loading">
        <span className="material-symbols-outlined spin">autorenew</span>
        <p>Loading playlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="playlist-error">
        <span className="material-symbols-outlined">error</span>
        <p>{error}</p>
        <button onClick={fetchPlaylist}>Retry</button>
      </div>
    );
  }

  return (
    <div className="playlist-page">
      <div className="playlist-page-header">
        <a href="#/" className="back-btn">
          <span className="material-symbols-outlined">arrow_back</span>
        </a>
        <h1>{titles[type] || 'Playlist'}</h1>
        <p>{songs.length} songs</p>
      </div>

      <div className="playlist-page-grid">
        {songs.map((item, idx) => (
          <div
            key={item.videoId}
            className={`playlist-track${activeItem?.videoId === item.videoId ? ' active' : ''}`}
            onClick={() => onPlayTrack(item)}
          >
            <div className="playlist-track-num">{idx + 1}</div>
            <div className="playlist-track-thumb">
              <img src={item.thumbnail} alt={item.title} />
              <div className="playlist-track-overlay">
                {activeItem?.videoId === item.videoId && downloading
                  ? <span className="material-symbols-outlined spin">autorenew</span>
                  : <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {activeItem?.videoId === item.videoId && isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                }
              </div>
            </div>
            <div className="playlist-track-info">
              <p className="playlist-track-title">{item.title}</p>
              <p className="playlist-track-channel">{item.channel}</p>
            </div>
            <span
              className="material-symbols-outlined playlist-track-like"
              style={{ fontVariationSettings: liked[item.videoId] ? "'FILL' 1" : "'FILL' 0", color: liked[item.videoId] ? '#f2ca50' : '#3a3a3a' }}
              onClick={e => onToggleLike(e, item.videoId)}
            >favorite</span>
          </div>
        ))}
      </div>
    </div>
  );
}
