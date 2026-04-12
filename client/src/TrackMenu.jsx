import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePlaylists } from './PlaylistContext'

const isMobile = () => window.innerWidth <= 768

export default function TrackMenu({ item, onClose, onToggleLike, liked, anchorRef }) {
  const { playlists, loaded, fetchPlaylists, addSong } = usePlaylists()
  const [added, setAdded] = useState({})
  const [view, setView] = useState('main')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)

  useEffect(() => {
    if (!loaded) fetchPlaylists()

    // Position dropdown relative to anchor button
    if (anchorRef?.current && !isMobile()) {
      const r = anchorRef.current.getBoundingClientRect()
      const menuW = 250
      let left = r.right - menuW
      let top = r.bottom + 6
      if (left < 8) left = 8
      if (top + 300 > window.innerHeight) top = r.top - 310
      setPos({ top, left })
    }

    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const handleAdd = async (e, playlistId) => {
    e.stopPropagation()
    if (added[playlistId]) return
    try {
      await addSong(playlistId, { videoId: item.videoId, title: item.title, thumbnail: item.thumbnail, channel: item.channel })
      setAdded(prev => ({ ...prev, [playlistId]: true }))
    } catch {}
  }

  const isLiked = liked?.[item.videoId]

  // ── MOBILE BOTTOM SHEET ──────────────────────────────────────
  if (isMobile()) {
    return createPortal(
      <>
        <style>{`
          @keyframes rx-bg   { from{opacity:0} to{opacity:1} }
          @keyframes rx-up   { from{transform:translateY(100%)} to{transform:translateY(0)} }
          .rx-row { display:flex;align-items:center;gap:16px;padding:14px 20px;cursor:pointer;transition:background 0.12s;-webkit-tap-highlight-color:transparent; }
          .rx-row:active { background:rgba(255,255,255,0.1) !important; }
        `}</style>

        {/* Backdrop */}
        <div onClick={e => { e.stopPropagation(); onClose() }} style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'rx-bg 0.2s ease',
        }} />

        {/* Sheet */}
        <div ref={menuRef} onClick={e => e.stopPropagation()} style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2001,
          background: 'rgba(28,28,32,0.75)',
          backdropFilter: 'saturate(180%) blur(40px)',
          WebkitBackdropFilter: 'saturate(180%) blur(40px)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -1px 0 rgba(255,255,255,0.1), 0 -24px 80px rgba(0,0,0,0.5)',
          animation: 'rx-up 0.34s cubic-bezier(0.22,1,0.36,1)',
          paddingBottom: 'max(env(safe-area-inset-bottom,0px), 16px)',
        }}>

          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.2)' }} />
          </div>

          {/* Song header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <img src={item.thumbnail} alt="" style={{ width: 50, height: 50, borderRadius: 10, objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.channel}</div>
            </div>
          </div>

          {view === 'main' ? (
            <div style={{ padding: '6px 0 4px' }}>
              {onToggleLike && (
                <div className="rx-row" onClick={e => { onToggleLike(e, item.videoId, item); onClose() }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: isLiked ? 'rgba(242,202,80,0.15)' : 'rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: isLiked ? '#f2ca50' : '#999', fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{isLiked ? 'Remove from Liked' : 'Add to Liked Songs'}</div>
                    {isLiked && <div style={{ fontSize: 11, color: '#f2ca50', marginTop: 1 }}>Saved in Liked Songs</div>}
                  </div>
                </div>
              )}
              <div className="rx-row" onClick={() => setView('playlists')}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#999' }}>playlist_add</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Add to Playlist</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{playlists.length ? `${playlists.length} playlist${playlists.length > 1 ? 's' : ''}` : 'No playlists yet'}</div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>chevron_right</span>
              </div>
            </div>
          ) : (
            <>
              <div className="rx-row" onClick={() => setView('main')} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#888' }}>arrow_back</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Add to Playlist</span>
              </div>
              <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
                {!loaded ? (
                  <div style={{ padding: 24, textAlign: 'center' }}><span className="material-symbols-outlined spin" style={{ fontSize: 28, color: '#f2ca50' }}>autorenew</span></div>
                ) : playlists.length === 0 ? (
                  <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 44, color: '#2a2a2a', display: 'block', marginBottom: 10 }}>queue_music</span>
                    <div style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>No playlists yet</div>
                    <div style={{ fontSize: 12, color: '#3a3a3a', marginTop: 4 }}>Create one from the sidebar first</div>
                  </div>
                ) : playlists.map(p => {
                  const done = added[p.id]
                  return (
                    <div key={p.id} className="rx-row" onClick={e => handleAdd(e, p.id)} style={{ cursor: done ? 'default' : 'pointer' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: done ? 'rgba(74,222,128,0.12)' : 'linear-gradient(135deg,#1e1e2e,#16213e)', border: `1px solid ${done ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: done ? '#4ade80' : '#f2ca50' }}>{done ? 'check' : 'queue_music'}</span>
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: done ? '#4ade80' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: done ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.3)', marginTop: 2 }}>{done ? 'Added ✓' : `${p.song_count || 0} songs`}</div>
                      </div>
                      {done && <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#4ade80', fontVariationSettings: "'FILL' 1", flexShrink: 0 }}>check_circle</span>}
                    </div>
                  )
                })}
              </div>
              <div style={{ height: 8 }} />
            </>
          )}
        </div>
      </>,
      document.body
    )
  }

  // ── DESKTOP DROPDOWN (portal, positioned by JS) ───────────────
  return createPortal(
    <>
      <style>{`
        @keyframes rx-drop { from{opacity:0;transform:scale(0.95) translateY(-6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .rx-drow { display:flex;align-items:center;gap:11px;padding:9px 14px;cursor:pointer;transition:background 0.1s; }
        .rx-drow:hover { background:rgba(255,255,255,0.06); }
        .rx-dprow { display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background 0.1s; }
        .rx-dprow:hover { background:rgba(255,255,255,0.05); }
      `}</style>
      <div ref={menuRef} onClick={e => e.stopPropagation()} style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 2000,
        width: 250,
        background: 'rgba(30,30,34,0.72)',
        backdropFilter: 'saturate(180%) blur(40px)',
        WebkitBackdropFilter: 'saturate(180%) blur(40px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.4), 0 32px 80px rgba(0,0,0,0.6)',
        animation: 'rx-drop 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Song info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px 11px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <img src={item.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.channel}</div>
          </div>
        </div>

        {view === 'main' ? (
          <div style={{ padding: '4px 0' }}>
            {onToggleLike && (
              <div className="rx-drow" onClick={e => { onToggleLike(e, item.videoId, item); onClose() }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: isLiked ? '#f2ca50' : '#777', flexShrink: 0, fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{isLiked ? 'Remove from Liked' : 'Add to Liked Songs'}</span>
              </div>
            )}
            <div className="rx-drow" onClick={() => setView('playlists')}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#777', flexShrink: 0 }}>playlist_add</span>
              <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500, flex: 1 }}>Add to Playlist</span>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }}>chevron_right</span>
            </div>
          </div>
        ) : (
          <>
            <div className="rx-drow" onClick={() => setView('main')} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '9px 14px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#666' }}>arrow_back</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Playlists</span>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
              {!loaded ? (
                <div style={{ padding: 14, textAlign: 'center' }}><span className="material-symbols-outlined spin" style={{ fontSize: 18, color: '#f2ca50' }}>autorenew</span></div>
              ) : playlists.length === 0 ? (
                <div style={{ padding: '14px', fontSize: 12, color: '#555', textAlign: 'center' }}>No playlists yet</div>
              ) : playlists.map(p => {
                const done = added[p.id]
                return (
                  <div key={p.id} className="rx-dprow" onClick={e => handleAdd(e, p.id)} style={{ cursor: done ? 'default' : 'pointer' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: done ? 'rgba(74,222,128,0.1)' : 'rgba(242,202,80,0.08)', border: `1px solid ${done ? 'rgba(74,222,128,0.2)' : 'rgba(242,202,80,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: done ? '#4ade80' : '#f2ca50' }}>{done ? 'check' : 'queue_music'}</span>
                    </div>
                    <span style={{ fontSize: 13, color: done ? '#4ade80' : '#ddd', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: done ? '#4ade80' : '#333', flexShrink: 0 }}>{done ? '✓' : p.song_count}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  )
}
