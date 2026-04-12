import { useState, useEffect, useRef } from 'react'
import { apiFetch } from './api'

export default function TrackMenu({ item, onClose }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState({})
  const ref = useRef(null)

  useEffect(() => {
    apiFetch('/api/user-playlists').then(r => r.json()).then(d => {
      setPlaylists(d.playlists || [])
      setLoading(false)
    }).catch(() => setLoading(false))

    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const addToPlaylist = async (e, playlistId) => {
    e.stopPropagation()
    try {
      await apiFetch(`/api/user-playlists/${playlistId}/songs`, {
        method: 'POST',
        body: JSON.stringify({ videoId: item.videoId, title: item.title, thumbnail: item.thumbnail, channel: item.channel })
      })
      setAdded(prev => ({ ...prev, [playlistId]: true }))
    } catch {}
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: '100%', right: 0, zIndex: 999,
      background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, padding: '6px 0', minWidth: 200,
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      backdropFilter: 'blur(20px)',
      animation: 'menuIn 0.18s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`@keyframes menuIn { from { opacity:0; transform:scale(0.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
      <div style={{ padding: '6px 14px 8px', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
        Add to Playlist
      </div>
      {loading ? (
        <div style={{ padding: '10px 14px', fontSize: 12, color: '#555' }}>Loading...</div>
      ) : playlists.length === 0 ? (
        <div style={{ padding: '10px 14px', fontSize: 12, color: '#555' }}>No playlists yet</div>
      ) : playlists.map(p => (
        <div key={p.id}
          onClick={e => !added[p.id] && addToPlaylist(e, p.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px', cursor: added[p.id] ? 'default' : 'pointer',
            transition: 'background 0.15s',
            background: 'transparent',
          }}
          onMouseEnter={e => { if (!added[p.id]) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: added[p.id] ? '#4ade80' : '#555' }}>
            {added[p.id] ? 'check_circle' : 'queue_music'}
          </span>
          <span style={{ fontSize: 13, color: added[p.id] ? '#4ade80' : '#e5e5e5', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          {added[p.id] && <span style={{ fontSize: 11, color: '#4ade80' }}>Added</span>}
        </div>
      ))}
    </div>
  )
}
