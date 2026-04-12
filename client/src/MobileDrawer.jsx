import { useState } from 'react'
import { usePlaylists } from './PlaylistContext'

export default function MobileDrawer({ open, onClose, user, liked, navigate, onLogout, currentRoute }) {
  const { playlists, loaded, fetchPlaylists, createPlaylist, deletePlaylist } = usePlaylists()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showInput, setShowInput] = useState(false)

  const go = (path) => { navigate(path); onClose() }

  const isActive = (path) => currentRoute === path || currentRoute.startsWith(path + '/')
  const likedCount = Object.values(liked).filter(Boolean).length

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try { await createPlaylist(newName.trim()); setNewName(''); setShowInput(false) } catch {}
    setCreating(false)
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await deletePlaylist(id)
    if (currentRoute === `/my-playlist/${id}`) go('/')
  }

  const navItem = (active) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    color: active ? '#f2ca50' : '#a1a1aa',
    background: active ? 'rgba(242,202,80,0.08)' : 'transparent',
    borderLeft: active ? '3px solid #f2ca50' : '3px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, zIndex: 149,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }} />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 300, maxWidth: '85vw',
        background: '#0a0a0a',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        zIndex: 150,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
        scrollbarWidth: 'none',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1)',
        fontFamily: "'Plus Jakarta Sans','Inter',sans-serif",
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Relax<span style={{ color: '#f2ca50' }}>ify</span></span>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* User card */}
        <div style={{ margin: '12px 16px', borderRadius: 12, padding: '12px 14px', background: 'rgba(242,202,80,0.05)', border: '1px solid rgba(242,202,80,0.1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#f2ca50,#e8920a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#0a0a0a', flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#3a3a3a', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 20px 4px' }}>Menu</div>

        <div style={navItem(isActive('/'))} onClick={() => go('/')}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: isActive('/') ? '#f2ca50' : '#555', fontVariationSettings: isActive('/') ? "'FILL' 1" : "'FILL' 0" }}>home</span>
          Home
        </div>

        <div style={navItem(isActive('/liked'))} onClick={() => go('/liked')}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: isActive('/liked') ? '#f2ca50' : '#555', fontVariationSettings: isActive('/liked') ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
          Liked Songs
          {likedCount > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(242,202,80,0.15)', color: '#f2ca50', borderRadius: 100, padding: '2px 7px', fontWeight: 700 }}>{likedCount}</span>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 16px' }} />

        {/* My Playlists */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px 4px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#3a3a3a', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>My Playlists</span>
          <button onClick={() => setShowInput(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = '#f2ca50'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
          </button>
        </div>

        {showInput && (
          <div style={{ display: 'flex', gap: 6, padding: '6px 16px', alignItems: 'center' }}>
            <input autoFocus
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              placeholder="Playlist name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowInput(false); setNewName('') } }}
            />
            <button onClick={handleCreate} disabled={creating || !newName.trim()}
              style={{ background: '#f2ca50', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0a0a0a', flexShrink: 0 }}>
              {creating ? '...' : 'Add'}
            </button>
          </div>
        )}

        {playlists.length === 0 && !showInput && (
          <div style={{ padding: '8px 20px', fontSize: 12, color: '#3a3a3a' }}>No playlists yet. Tap + to create.</div>
        )}

        {playlists.map(p => {
          const active = isActive(`/my-playlist/${p.id}`)
          return (
            <div key={p.id} onClick={() => go(`/my-playlist/${p.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px 11px 20px', cursor: 'pointer', background: active ? 'rgba(242,202,80,0.06)' : 'transparent', borderLeft: active ? '3px solid #f2ca50' : '3px solid transparent', transition: 'all 0.15s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? '#f2ca50' : '#555', flexShrink: 0 }}>queue_music</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#f2ca50' : '#a1a1aa', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <span style={{ fontSize: 11, color: '#3a3a3a', flexShrink: 0 }}>{p.song_count}</span>
              <button onClick={e => handleDelete(e, p.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3a3a', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
              </button>
            </div>
          )
        })}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 16px' }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: '#3a3a3a', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 20px 4px' }}>Account</div>

        <div style={navItem(isActive('/account'))} onClick={() => go('/account')}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: isActive('/account') ? '#f2ca50' : '#555' }}>manage_accounts</span>
          Manage Account
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 16px' }} />

        <button onClick={() => { onLogout(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#f87171', background: 'transparent', border: 'none', width: '100%', fontFamily: 'inherit', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
          Sign Out
        </button>
        <div style={{ height: 20 }} />
      </div>
    </>
  )
}
