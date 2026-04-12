import { useState } from 'react'
import { apiFetch } from './api'

function EyeBtn({ show, onToggle }) {
  return (
    <button type="button" onClick={onToggle} style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: '#555',
      display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, transition: 'color 0.15s'
    }}
      onMouseEnter={e => e.currentTarget.style.color = '#f2ca50'}
      onMouseLeave={e => e.currentTarget.style.color = '#555'}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {show ? 'visibility_off' : 'visibility'}
      </span>
    </button>
  )
}

export default function AccountPage({ user, navigate, onLogout }) {
  const [form, setForm] = useState({ name: user?.name || '', currentPassword: '', newPassword: '', confirmPassword: '' })
  const [show, setShow] = useState({ current: false, new: false, confirm: false })
  const [msg, setMsg] = useState({ text: '', error: false })
  const [loading, setLoading] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [showDeletePass, setShowDeletePass] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState({ text: '', error: false })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleShow = (k) => setShow(s => ({ ...s, [k]: !s[k] }))

  const handleSave = async (e) => {
    e.preventDefault()
    setMsg({ text: '', error: false })
    if (!form.currentPassword) return setMsg({ text: 'Current password is required', error: true })
    if (form.newPassword && form.newPassword.length < 6)
      return setMsg({ text: 'New password must be at least 6 characters', error: true })
    if (form.newPassword && form.newPassword !== form.confirmPassword)
      return setMsg({ text: 'New passwords do not match', error: true })
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/update', {
        method: 'PUT',
        body: JSON.stringify({ name: form.name, currentPassword: form.currentPassword, newPassword: form.newPassword || undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      localStorage.setItem('rx_user', JSON.stringify(data.user))
      setMsg({ text: 'Account updated successfully!', error: false })
      setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } catch (err) {
      setMsg({ text: err.message, error: true })
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    setDeleteMsg({ text: '', error: false })
    if (!deletePassword) return setDeleteMsg({ text: 'Password is required', error: true })
    setDeleteLoading(true)
    try {
      const res = await apiFetch('/api/auth/delete', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onLogout()
    } catch (err) {
      setDeleteMsg({ text: err.message, error: true })
    }
    setDeleteLoading(false)
  }

  const P = {
    page: { width: '100%', maxWidth: 600 },
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40, paddingBottom: 24, borderBottom: '1px solid #1a1a1a' },
    backBtn: { width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer', border: 'none', transition: 'all 0.15s', flexShrink: 0 },
    card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: '28px', marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
    label: { fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
    fieldWrap: { position: 'relative', marginBottom: 16 },
    input: { width: '100%', padding: '11px 40px 11px 14px', borderRadius: 10, background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#e5e5e5', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s' },
    saveBtn: { padding: '12px 28px', borderRadius: 10, border: 'none', background: '#f2ca50', color: '#0a0a0a', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
    msg: (error) => ({ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: error ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)', color: error ? '#f87171' : '#4ade80', border: `1px solid ${error ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`, display: 'flex', alignItems: 'center', gap: 8 }),
    dangerCard: { background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 16, padding: '28px' },
    dangerTitle: { fontSize: 16, fontWeight: 700, color: '#f87171', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
    dangerDesc: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 },
    deleteBtn: { padding: '12px 28px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#f2ca50,#e8920a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#0a0a0a', flexShrink: 0 },
    divider: { height: 1, background: '#1a1a1a', margin: '20px 0' },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 },
  }

  const inputStyle = (borderColor = '#2a2a2a') => ({ ...P.input, borderColor })

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

      {/* Update Profile */}
      <div style={P.card}>
        <div style={P.cardTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#f2ca50' }}>manage_accounts</span>
          Update Profile
        </div>

        {msg.text && (
          <div style={P.msg(msg.error)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{msg.error ? 'error' : 'check_circle'}</span>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Name */}
          <label style={P.label}>Display Name</label>
          <div style={P.fieldWrap}>
            <input style={inputStyle()} value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Your name"
              onFocus={e => e.target.style.borderColor = '#f2ca50'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
          </div>

          <div style={P.divider} />
          <div style={P.sectionLabel}>Change Password</div>

          {/* Current password */}
          <label style={P.label}>Current Password <span style={{ color: '#f87171' }}>*</span></label>
          <div style={P.fieldWrap}>
            <input style={inputStyle()} type={show.current ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={e => set('currentPassword', e.target.value)}
              placeholder="Required to save any changes"
              onFocus={e => e.target.style.borderColor = '#f2ca50'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
            <EyeBtn show={show.current} onToggle={() => toggleShow('current')} />
          </div>

          {/* New password */}
          <label style={P.label}>New Password <span style={{ color: '#555', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <div style={P.fieldWrap}>
            <input style={inputStyle()} type={show.new ? 'text' : 'password'}
              value={form.newPassword}
              onChange={e => set('newPassword', e.target.value)}
              placeholder="Min 6 characters"
              onFocus={e => e.target.style.borderColor = '#f2ca50'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
            <EyeBtn show={show.new} onToggle={() => toggleShow('new')} />
          </div>

          {/* Confirm new password — only show if new password has input */}
          {form.newPassword && (
            <>
              <label style={P.label}>
                Confirm New Password
                {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                  <span style={{ color: '#f87171', marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>✗ doesn't match</span>
                )}
                {form.confirmPassword && form.newPassword === form.confirmPassword && (
                  <span style={{ color: '#4ade80', marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>✓ matches</span>
                )}
              </label>
              <div style={P.fieldWrap}>
                <input style={inputStyle(form.confirmPassword ? (form.newPassword === form.confirmPassword ? '#4ade80' : '#f87171') : '#2a2a2a')}
                  type={show.confirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Re-enter new password"
                  onFocus={e => e.target.style.borderColor = form.newPassword === form.confirmPassword ? '#4ade80' : '#f87171'}
                  onBlur={e => e.target.style.borderColor = form.confirmPassword ? (form.newPassword === form.confirmPassword ? '#4ade80' : '#f87171') : '#2a2a2a'} />
                <EyeBtn show={show.confirm} onToggle={() => toggleShow('confirm')} />
              </div>
            </>
          )}

          <button type="submit" style={P.saveBtn} disabled={loading}
            onMouseEnter={e => !loading && (e.currentTarget.style.background = '#f5d470')}
            onMouseLeave={e => e.currentTarget.style.background = '#f2ca50'}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Delete Account */}
      <div style={P.dangerCard}>
        <div style={P.dangerTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>warning</span>
          Delete Account
        </div>
        <p style={P.dangerDesc}>
          This will permanently delete your account, all playlists, liked songs, and search history. This action <strong style={{ color: '#f87171' }}>cannot be undone</strong>.
        </p>

        {deleteMsg.text && (
          <div style={P.msg(deleteMsg.error)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{deleteMsg.error ? 'error' : 'check_circle'}</span>
            {deleteMsg.text}
          </div>
        )}

        <label style={{ ...P.label, color: '#f87171' }}>Enter your password to confirm</label>
        <div style={{ ...P.fieldWrap, marginBottom: 20 }}>
          <input
            style={{ ...inputStyle('rgba(248,113,113,0.3)'), paddingRight: 40 }}
            type={showDeletePass ? 'text' : 'password'}
            value={deletePassword}
            onChange={e => setDeletePassword(e.target.value)}
            placeholder="Your current password"
            onFocus={e => e.target.style.borderColor = '#f87171'}
            onBlur={e => e.target.style.borderColor = 'rgba(248,113,113,0.3)'}
          />
          <EyeBtn show={showDeletePass} onToggle={() => setShowDeletePass(v => !v)} />
        </div>

        <button style={P.deleteBtn} onClick={handleDelete} disabled={deleteLoading || !deletePassword}
          onMouseEnter={e => { if (!deleteLoading) { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; e.currentTarget.style.borderColor = '#f87171' } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)' }}>
          {deleteLoading ? 'Deleting...' : 'Delete My Account'}
        </button>
      </div>
    </div>
  )
}
