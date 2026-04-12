import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import { usePlaylists } from './PlaylistContext'

export default function UserPlaylistPage({ playlistId, onPlayTrack, onSetQueue, onSetRepeat, activeItem, isPlaying, navigate }) {
  const { playlists, removeSong } = usePlaylists()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loop, setLoop] = useState(false)

  const playlist = playlists.find(p => String(p.id) === String(playlistId)) || null

  useEffect(() => {
    apiFetch(`/api/user-playlists/${playlistId}/songs`)
      .then(r => r.json())
      .then(d => { setSongs(d.songs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [playlistId])

  // sync queue to App whenever songs list changes
  useEffect(() => {
    if (!songs.length) return
    onSetQueue(songs.map(toTrack))
  }, [songs])

  const toTrack = s => ({ videoId: s.video_id, title: s.title, thumbnail: s.thumbnail, channel: s.channel })

  const handlePlay = (song) => {
    onSetQueue(songs.map(toTrack))
    onPlayTrack(toTrack(song))
  }

  const handlePlayAll = () => {
    if (!songs.length) return
    const mapped = songs.map(toTrack)
    onSetQueue(mapped)
    onPlayTrack(mapped[0])
  }

  const handleShuffle = () => {
    if (!songs.length) return
    const shuffled = [...songs].sort(() => Math.random() - 0.5).map(toTrack)
    onSetQueue(shuffled)
    onPlayTrack(shuffled[0])
  }

  const toggleLoop = () => {
    const next = !loop
    setLoop(next)
    onSetRepeat(next ? 'all' : 'off')
  }

  const handleRemove = async (e, videoId) => {
    e.stopPropagation()
    await removeSong(Number(playlistId), videoId)
    setSongs(prev => prev.filter(s => s.video_id !== videoId))
  }

  const activeIdx = songs.findIndex(s => s.video_id === activeItem?.videoId)
  const isThisPlaylistActive = activeIdx !== -1

  const P = {
    page: { width: '100%' },
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #1a1a1a' },
    backBtn: { width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer', border: 'none', transition: 'all 0.15s', flexShrink: 0 },
    icon: { width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#1a1a2e,#16213e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(242,202,80,0.2)' },
    title: { fontSize: 28, fontWeight: 800, color: '#fff' },
    sub: { fontSize: 13, color: '#555', marginTop: 4 },
    controls: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
    playAllBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 100, background: '#f2ca50', border: 'none', color: '#0a0a0a', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' },
    iconBtn: (on) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 100, background: on ? 'rgba(242,202,80,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(242,202,80,0.3)' : 'rgba(255,255,255,0.08)'}`, color: on ? '#f2ca50' : '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }),
    grid: { display: 'flex', flexDirection: 'column', gap: 2 },
    row: (active) => ({ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: active ? '#1a1a1a' : 'transparent', border: active ? '1px solid rgba(242,202,80,0.3)' : '1px solid transparent', transition: 'all 0.15s' }),
    thumb: { width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
    rowTitle: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    rowCh: { fontSize: 12, color: '#555', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 12, color: '#444' },
    delBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#3a3a3a', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, transition: 'color 0.15s', flexShrink: 0 },
  }

  if (loading) return <div style={P.empty}><span className="material-symbols-outlined spin" style={{ fontSize: 40, color: '#f2ca50' }}>autorenew</span></div>
  if (!playlist) return <div style={P.empty}><p>Playlist not found</p></div>

  return (
    <div style={P.page}>
      <div style={P.header}>
        <button style={P.backBtn} onClick={() => navigate('/')}
          onMouseEnter={e => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#888' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
        </button>
        <div style={P.icon}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#f2ca50' }}>queue_music</span>
        </div>
        <div>
          <h1 style={P.title}>{playlist.name}</h1>
          <p style={P.sub}>
            {songs.length} song{songs.length !== 1 ? 's' : ''}
            {isThisPlaylistActive ? ` · Playing ${activeIdx + 1} of ${songs.length}` : ''}
            {loop ? ' · Looping' : ''}
          </p>
        </div>
      </div>

      {songs.length > 0 && (
        <div style={P.controls}>
          <button style={P.playAllBtn} onClick={handlePlayAll}
            onMouseEnter={e => e.currentTarget.style.background = '#f5d470'}
            onMouseLeave={e => e.currentTarget.style.background = '#f2ca50'}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>play_circle</span>
            Play All
          </button>

          <button style={P.iconBtn(false)} onClick={handleShuffle}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shuffle</span>
            Shuffle
          </button>

          <button style={P.iconBtn(loop)} onClick={toggleLoop}
            onMouseEnter={e => e.currentTarget.style.background = loop ? 'rgba(242,202,80,0.18)' : 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = loop ? 'rgba(242,202,80,0.12)' : 'rgba(255,255,255,0.04)'}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>repeat</span>
            {loop ? 'Loop On' : 'Loop'}
          </button>
        </div>
      )}

      {songs.length === 0 ? (
        <div style={P.empty}>
          <span className="material-symbols-outlined" style={{ fontSize: 56, color: '#1e1e1e' }}>queue_music</span>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No songs yet</p>
          <p style={{ fontSize: 13, color: '#333' }}>Add songs from the home page or search</p>
        </div>
      ) : (
        <div style={P.grid}>
          {songs.map((song, idx) => {
            const active = activeItem?.videoId === song.video_id
            const isNext = isThisPlaylistActive && !active && idx === (activeIdx + 1) % songs.length
            return (
              <div key={song.video_id} style={P.row(active)}
                onClick={() => handlePlay(song)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#111' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>

                <span style={{ width: 24, textAlign: 'center', fontSize: 13, color: active ? '#f2ca50' : '#555', flexShrink: 0 }}>
                  {active && isPlaying
                    ? <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f2ca50' }}>graphic_eq</span>
                    : active
                    ? <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f2ca50' }}>pause</span>
                    : idx + 1}
                </span>

                <img src={song.thumbnail} alt="" style={P.thumb} />

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ ...P.rowTitle, color: active ? '#f2ca50' : '#e5e5e5' }}>{song.title}</div>
                  <div style={P.rowCh}>{song.channel}</div>
                </div>

                {isNext && (
                  <span style={{ fontSize: 11, color: '#555', flexShrink: 0, marginRight: 4 }}>Next</span>
                )}

                <button style={P.delBtn} onClick={e => handleRemove(e, song.video_id)}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>remove_circle</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
