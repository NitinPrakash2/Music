import { createContext, useContext, useState, useCallback } from 'react'
import { apiFetch } from './api'

const Ctx = createContext(null)

export function PlaylistProvider({ children }) {
  const [playlists, setPlaylists] = useState([])
  const [loaded, setLoaded] = useState(false)

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await apiFetch('/api/user-playlists')
      const data = await res.json()
      if (res.ok) { setPlaylists(data.playlists || []); setLoaded(true) }
    } catch {}
  }, [])

  const createPlaylist = async (name) => {
    const res = await apiFetch('/api/user-playlists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setPlaylists(prev => [data.playlist, ...prev])
    return data.playlist
  }

  const deletePlaylist = async (id) => {
    await apiFetch(`/api/user-playlists/${id}`, { method: 'DELETE' })
    setPlaylists(prev => prev.filter(p => p.id !== id))
  }

  const addSong = async (playlistId, song) => {
    const res = await apiFetch(`/api/user-playlists/${playlistId}/songs`, {
      method: 'POST',
      body: JSON.stringify(song),
    })
    if (res.ok) {
      setPlaylists(prev =>
        prev.map(p => p.id === playlistId ? { ...p, song_count: (p.song_count || 0) + 1 } : p)
      )
    }
    return res
  }

  const removeSong = async (playlistId, videoId) => {
    await apiFetch(`/api/user-playlists/${playlistId}/songs/${videoId}`, { method: 'DELETE' })
    setPlaylists(prev =>
      prev.map(p => p.id === playlistId ? { ...p, song_count: Math.max(0, (p.song_count || 1) - 1) } : p)
    )
  }

  const reset = () => { setPlaylists([]); setLoaded(false) }

  return (
    <Ctx.Provider value={{ playlists, loaded, fetchPlaylists, createPlaylist, deletePlaylist, addSong, removeSong, reset }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePlaylists = () => useContext(Ctx)
