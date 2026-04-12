import { useState } from 'react'
import { apiFetch } from './api'

export default function AccountPage({ user, navigate, onLogout }) {
  const [form, setForm] = useState({ name: user?.name || '', currentPassword: '', newPassword: '' })
  const [msg, setMsg] = useState({ text: '', error: false })
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState({ text: '', error: false })

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg({ text: '', error: false })
    try {
      const res = await apiFetch('/api/auth/update', { method: 'PUT', body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      sessionStorage.setItem('rx_user', JSON.stringify(data.user))
      setMsg({ text: 'Account updated successfully!', error: false })
      setForm(f => ({ ...f, currentPassword: '', newPassword: '' }))
    } catch (err) { setMsg({ text: err.message, error: true }) }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (deleteConfirm !== user?.email) { setDeleteMsg({ text: 'Email does not match', error: true }); return }
    setDeleteLoading(true); setDeleteMsg({ text: '', error: false })
    try {
      const res = await apiFetch('/api/auth/delete', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onLogout()
    } catch (err) { setDeleteMsg({ text: err.message, error: true }) }
    setDeleteLoading(false)
  }

  const P = {
    page: { width: '100%', maxWidth: 600 },
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40, paddingBottom: 24, borderBottom: '1px solid #1a1a1a' },
    backBtn: { width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer', border: 'none', transition: 'all 0.15s', flexShrink: 0 },
    card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '28px', marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
    label: { fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: { width: '100%', padding: '11px 14px', borderRadius: 10, background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#e5e5e5', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit', transition: 'border-color 0.2s' },
    saveBtn: { padding: '12px 28px', borderRadius: 10, border: 'none', background: '#f2ca50', color: '#0a0a0a', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
    msg: (error) => ({ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: error ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)', color: error ? '#f87171' : '#4ade80', border: `1px solid ${error ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}` }),
    dangerCard: { background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 16, padding: '28px' },
    dangerTitle: { fontSize: 16, fontWeight: 700, color: '#f87171', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
    dangerDesc: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 },
    deleteBtn: { padding: '12px 28px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#f2ca50,#e8920a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#0a0a0a', flexShrink: 0 },
  }

  return (
    <div style={P.page}>
      <div style={P.header}>
        <button style={P.backBtn} onClick={() => navigate('/')}
          onMouseEnter={e => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#888' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
        </button>
        <div style={P.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>My Account</h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{user?.email}</p>
        </div>
      </div>

      {/* Update profile */}
      <div style={P.card}>
        <div style={P.cardTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#f2ca50' }}>manage_accounts</span>
          Update Profile
        </div>
        {msg.text && <div style={P.msg(msg.error)}>{msg.text}</div>}
        <form onSubmit={handleSave}>
          <label style={P.label}>Display Name</label>
          <input style={P.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name"
            onFocus={e => e.target.style.borderColor = '#f2ca50'} onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
          <label style={P.label}>Current Password <span style={{ color: '#f87171' }}>*</span></label>
          <input style={P.input} type="password" value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} placeholder="Required to save changes"
            onFocus={e => e.target.style.borderColor = '#f2ca50'} onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
          <label style={P.label}>New Password <span style={{ color: '#555', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <input style={P.input} type="password" value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="Leave blank to keep current"
            onFocus={e => e.target.style.borderColor = '#f2ca50'} onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
          <button type="submit" style={P.saveBtn} disabled={loading}
            onMouseEnter={e => e.currentTarget.style.background = '#f5d470'}
            onMouseLeave={e => e.currentTarget.style.background = '#f2ca50'}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Delete account */}
      <div style={P.dangerCard}>
        <div style={P.dangerTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>warning</span>
          Delete Account
        </div>
        <p style={P.dangerDesc}>
          This will permanently delete your account, all your playlists, liked songs, and search history. This action <strong style={{ color: '#f87171' }}>cannot be undone</strong>.
        </p>
        {deleteMsg.text && <div style={P.msg(deleteMsg.error)}>{deleteMsg.text}</div>}
        <label style={{ ...P.label, color: '#f87171' }}>Type your email to confirm: <span style={{ color: '#888', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{user?.email}</span></label>
        <input style={{ ...P.input, borderColor: 'rgba(248,113,113,0.2)', marginBottom: 16 }}
          value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
          placeholder={user?.email}
          onFocus={e => e.target.style.borderColor = '#f87171'} onBlur={e => e.target.style.borderColor = 'rgba(248,113,113,0.2)'} />
        <button style={P.deleteBtn} onClick={handleDelete} disabled={deleteLoading}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; e.currentTarget.style.borderColor = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)' }}>
          {deleteLoading ? 'Deleting...' : 'Delete My Account'}
        </button>
      </div>
    </div>
  )
}
