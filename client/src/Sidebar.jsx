import { useState, useEffect } from 'react'
import { usePlaylists } from './PlaylistContext'

export default function Sidebar({ user, liked, onPlayTrack, activeItem, isPlaying, onLogout, navigate, currentRoute }) {
  const { playlists, loaded, fetchPlaylists, createPlaylist, deletePlaylist } = usePlaylists()
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateInput, setShowCreateInput] = useState(false)

  useEffect(() => { if (!loaded) fetchPlaylists() }, [loaded])

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) return
    setCreating(true)
    try {
      await createPlaylist(newPlaylistName.trim())
      setNewPlaylistName('')
      setShowCreateInput(false)
    } catch {}
    setCreating(false)
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await deletePlaylist(id)
    if (currentRoute === `/my-playlist/${id}`) navigate('/')
  }

  const isActive = (path) => currentRoute === path || currentRoute.startsWith(path + '/')
  const likedCount = Object.values(liked).filter(Boolean).length

  const S = {
    sidebar: { width: 240, flexShrink: 0, background: 'rgba(8,8,8,0.95)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', paddingTop: 72, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" },
    section: { padding: '12px 16px 4px', fontSize: 10, fontWeight: 700, color: '#3a3a3a', letterSpacing: '0.1em', textTransform: 'uppercase' },
    navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, margin: '1px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: active ? '#f2ca50' : '#a1a1aa', background: active ? 'rgba(242,202,80,0.08)' : 'transparent', border: active ? '1px solid rgba(242,202,80,0.15)' : '1px solid transparent', transition: 'all 0.2s' }),
    navIcon: (active) => ({ fontSize: 18, color: active ? '#f2ca50' : '#555', flexShrink: 0 }),
    divider: { height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 16px' },
    playlistRow: (active) => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 9px 16px', borderRadius: 8, margin: '1px 8px', cursor: 'pointer', background: active ? 'rgba(242,202,80,0.06)' : 'transparent', border: active ? '1px solid rgba(242,202,80,0.12)' : '1px solid transparent', transition: 'all 0.15s' }),
    iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', color: '#555', transition: 'color 0.15s', flexShrink: 0 },
    createInput: { display: 'flex', gap: 6, padding: '6px 8px 6px 16px', alignItems: 'center' },
    userCard: { margin: '8px', borderRadius: 12, padding: '12px 14px', background: 'rgba(242,202,80,0.05)', border: '1px solid rgba(242,202,80,0.1)', display: 'flex', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#f2ca50,#e8920a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#0a0a0a' },
    logoutBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, margin: '1px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#f87171', background: 'transparent', border: '1px solid transparent', transition: 'all 0.2s', width: 'calc(100% - 16px)' },
    badge: { marginLeft: 'auto', fontSize: 10, background: 'rgba(242,202,80,0.15)', color: '#f2ca50', borderRadius: 100, padding: '1px 6px', fontWeight: 700, flexShrink: 0 },
  }

  return (
    <div style={S.sidebar}>

      <div style={S.userCard}>
        <div style={S.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
        </div>
      </div>

      <div style={S.divider} />
      <div style={S.section}>Menu</div>

      <div style={S.navItem(isActive('/'))} onClick={() => navigate('/')}>
        <span className="material-symbols-outlined" style={S.navIcon(isActive('/'))}>home</span>
        Home
      </div>

      <div style={S.navItem(isActive('/liked'))} onClick={() => navigate('/liked')}>
        <span className="material-symbols-outlined" style={{ ...S.navIcon(isActive('/liked')), fontVariationSettings: isActive('/liked') ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
        Liked Songs
        {likedCount > 0 && <span style={S.badge}>{likedCount}</span>}
      </div>

      <div style={S.divider} />

      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 4px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#3a3a3a', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>My Playlists</span>
        <button style={{ ...S.iconBtn, color: '#555' }} title="New playlist"
          onClick={() => setShowCreateInput(v => !v)}
          onMouseEnter={e => e.currentTarget.style.color = '#f2ca50'}
          onMouseLeave={e => e.currentTarget.style.color = '#555'}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
        </button>
      </div>

      {showCreateInput && (
        <div style={S.createInput}>
          <input autoFocus
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            placeholder="Playlist name..."
            value={newPlaylistName}
            onChange={e => setNewPlaylistName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreateInput(false); setNewPlaylistName('') } }}
          />
          <button onClick={handleCreate} disabled={creating || !newPlaylistName.trim()}
            style={{ background: '#f2ca50', border: 'none', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0a0a0a', flexShrink: 0 }}>
            {creating ? '...' : 'Add'}
          </button>
        </div>
      )}

      {playlists.length === 0 && !showCreateInput && (
        <div style={{ padding: '8px 20px', fontSize: 12, color: '#3a3a3a' }}>No playlists yet. Click + to create.</div>
      )}

      {playlists.map(p => (
        <div key={p.id} style={S.playlistRow(isActive(`/my-playlist/${p.id}`))} onClick={() => navigate(`/my-playlist/${p.id}`)}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: isActive(`/my-playlist/${p.id}`) ? '#f2ca50' : '#555', flexShrink: 0 }}>queue_music</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: isActive(`/my-playlist/${p.id}`) ? '#f2ca50' : '#a1a1aa', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          <span style={{ fontSize: 11, color: '#3a3a3a', flexShrink: 0 }}>{p.song_count}</span>
          <button style={S.iconBtn} onClick={e => handleDelete(e, p.id)}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
          </button>
        </div>
      ))}

      <div style={S.divider} />
      <div style={S.section}>Account</div>

      <div style={S.navItem(isActive('/account'))} onClick={() => navigate('/account')}>
        <span className="material-symbols-outlined" style={S.navIcon(isActive('/account'))}>manage_accounts</span>
        Manage Account
      </div>

      <div style={{ flex: 1 }} />
      <div style={S.divider} />

      <button style={S.logoutBtn} onClick={onLogout}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
        Sign Out
      </button>
      <div style={{ height: 16 }} />
    </div>
  )
}
