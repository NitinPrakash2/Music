import { useState, useEffect } from 'react'
import { apiFetch } from './api'

export default function LikedPage({ onPlayTrack, activeItem, isPlaying, downloading, liked, onToggleLike, navigate }) {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/liked/songs').then(r => r.json()).then(d => { setSongs(d.songs || []); setLoading(false) }).catch(() => setLoading(false))
  }, [liked])

  const P = {
    page: { width: '100%' },
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #1a1a1a' },
    backBtn: { width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer', border: 'none', transition: 'all 0.15s', flexShrink: 0 },
    icon: { width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#f2ca50,#e8920a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title: { fontSize: 28, fontWeight: 800, color: '#fff' },
    sub: { fontSize: 13, color: '#555', marginTop: 4 },
    grid: { display: 'flex', flexDirection: 'column', gap: 4 },
    row: (active) => ({ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: active ? '#1a1a1a' : 'transparent', border: active ? '1px solid #f2ca50' : '1px solid transparent', transition: 'all 0.15s' }),
    thumb: { width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
    rowTitle: { fontSize: 14, fontWeight: 600, color: '#e5e5e5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    rowCh: { fontSize: 12, color: '#555', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 12, color: '#444' },
  }

  if (loading) return <div style={P.empty}><span className="material-symbols-outlined spin" style={{ fontSize: 40, color: '#f2ca50' }}>autorenew</span></div>

  return (
    <div style={P.page}>
      <div style={P.header}>
        <button style={P.backBtn} onClick={() => navigate('/')}
          onMouseEnter={e => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#888' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
        </button>
        <div style={P.icon}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#0a0a0a', fontVariationSettings: "'FILL' 1" }}>favorite</span>
        </div>
        <div>
          <h1 style={P.title}>Liked Songs</h1>
          <p style={P.sub}>{songs.length} songs</p>
        </div>
      </div>

      {songs.length === 0 ? (
        <div style={P.empty}>
          <span className="material-symbols-outlined" style={{ fontSize: 56, color: '#1e1e1e' }}>favorite</span>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No liked songs yet</p>
          <p style={{ fontSize: 13, color: '#333' }}>Like songs to see them here</p>
        </div>
      ) : (
        <div style={P.grid}>
          {songs.map((song, idx) => (
            <div key={song.video_id} style={P.row(activeItem?.videoId === song.video_id)}
              onClick={() => onPlayTrack({ videoId: song.video_id, title: song.title, thumbnail: song.thumbnail, channel: song.channel })}
              onMouseEnter={e => { if (activeItem?.videoId !== song.video_id) e.currentTarget.style.background = '#111' }}
              onMouseLeave={e => { if (activeItem?.videoId !== song.video_id) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ width: 24, textAlign: 'center', fontSize: 13, color: activeItem?.videoId === song.video_id ? '#f2ca50' : '#555', flexShrink: 0 }}>
                {activeItem?.videoId === song.video_id && isPlaying
                  ? <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f2ca50' }}>graphic_eq</span>
                  : idx + 1}
              </span>
              <img src={song.thumbnail} alt="" style={P.thumb} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={P.rowTitle}>{song.title}</div>
                <div style={P.rowCh}>{song.channel}</div>
              </div>
              <span className="material-symbols-outlined"
                style={{ fontSize: 20, cursor: 'pointer', color: '#f2ca50', fontVariationSettings: "'FILL' 1", flexShrink: 0 }}
                onClick={e => onToggleLike(e, song.video_id, { videoId: song.video_id, title: song.title, thumbnail: song.thumbnail, channel: song.channel })}>
                favorite
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
