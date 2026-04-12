import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function Auth({ onAuth, onBack }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };
      const res = await fetch(`${API}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      localStorage.setItem('rx_user', JSON.stringify(data.user));
      sessionStorage.setItem('rx_token', data.token);
      sessionStorage.setItem('rx_user', JSON.stringify(data.user));
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

          .auth-wrapper {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #050505;
            background-image: radial-gradient(circle at 50% -20%, rgba(242, 202, 80, 0.15) 0%, transparent 60%);
            font-family: 'Plus Jakarta Sans', sans-serif;
            padding: 20px;
            color: #ffffff;
            position: relative;
            overflow: hidden;
          }

          /* Ambient Background Glow */
          .auth-wrapper::before {
            content: '';
            position: absolute;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(242, 202, 80, 0.03) 0%, transparent 70%);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 0;
          }

          .auth-card {
            width: 100%;
            max-width: 440px;
            background: rgba(25, 25, 25, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 32px;
            padding: 48px 40px;
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.02) inset;
            z-index: 1;
            animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(20px);
          }

          .back-btn {
            position: fixed;
            top: 24px;
            left: 24px;
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 50%;
            color: #a1a1aa;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
            z-index: 100;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          }

          .back-btn:hover {
            background: #f2ca50;
            border-color: #f2ca50;
            color: #0a0a0a;
            transform: scale(1.12);
            box-shadow: 0 6px 24px rgba(242,202,80,0.35);
          }

          .back-btn:active {
            transform: scale(0.95);
          }

          .auth-header {
            text-align: center;
            margin-bottom: 32px;
          }

          .auth-logo {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            background: rgba(242, 202, 80, 0.1);
            border-radius: 18px;
            color: #f2ca50;
            margin-bottom: 16px;
          }

          .auth-title {
            font-size: 1.75rem;
            font-weight: 800;
            color: #ffffff;
            margin: 0 0 8px;
            letter-spacing: -0.02em;
          }

          .auth-subtitle {
            font-size: 0.95rem;
            color: #a1a1aa;
            margin: 0;
          }

          /* Segmented Control */
          .toggle-container {
            display: flex;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 16px;
            padding: 6px;
            margin-bottom: 32px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            position: relative;
          }

          .toggle-btn {
            flex: 1;
            padding: 10px 0;
            border-radius: 12px;
            font-size: 0.875rem;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            background: transparent;
            color: #a1a1aa;
            position: relative;
            z-index: 2;
            font-family: inherit;
          }

          .toggle-btn.active {
            color: #0a0a0a;
          }

          .toggle-slider {
            position: absolute;
            top: 6px;
            bottom: 6px;
            width: calc(50% - 6px);
            background: #f2ca50;
            border-radius: 12px;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 1;
            box-shadow: 0 4px 12px rgba(242, 202, 80, 0.2);
          }

          /* Form Styles */
          .form-group {
            margin-bottom: 20px;
            position: relative;
          }

          .form-label {
            font-size: 0.8rem;
            font-weight: 600;
            color: #a1a1aa;
            display: block;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
          }

          .input-icon {
            position: absolute;
            left: 16px;
            color: #71717a;
            font-size: 20px;
            transition: color 0.3s ease;
            pointer-events: none;
          }

          .auth-input {
            width: 100%;
            padding: 16px 16px 16px 48px;
            border-radius: 16px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 0.95rem;
            font-family: inherit;
            outline: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .auth-input::placeholder {
            color: #52525b;
          }

          .auth-input:hover {
            border-color: rgba(255, 255, 255, 0.2);
            background: rgba(0, 0, 0, 0.6);
          }

          .auth-input:focus {
            border-color: #f2ca50;
            background: rgba(0, 0, 0, 0.8);
            box-shadow: 0 0 0 4px rgba(242, 202, 80, 0.1);
          }

          .auth-input:focus + .input-icon,
          .auth-input:not(:placeholder-shown) + .input-icon {
            color: #f2ca50;
          }

          .error-msg {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 12px;
            padding: 12px 16px;
            font-size: 0.875rem;
            color: #fca5a5;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
            animation: slideDown 0.3s ease;
          }

          .submit-btn {
            width: 100%;
            margin-top: 8px;
            padding: 18px;
            border-radius: 100px;
            border: none;
            background: #f2ca50;
            color: #0a0a0a;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-family: inherit;
            box-shadow: 0 8px 24px -6px rgba(242, 202, 80, 0.3);
          }

          .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            background: #f5d470;
            box-shadow: 0 12px 32px -8px rgba(242, 202, 80, 0.5);
          }

          .submit-btn:disabled {
            background: #a18629;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }

          .loading-spinner {
            animation: spin 1s linear infinite;
            font-size: 20px;
          }

          .auth-footer {
            text-align: center;
            font-size: 0.875rem;
            color: #71717a;
            margin-top: 32px;
          }

          .auth-footer span {
            color: #ffffff;
            cursor: pointer;
            font-weight: 600;
            transition: color 0.2s ease;
          }

          .auth-footer span:hover {
            color: #f2ca50;
          }

          .eye-btn {
            position: absolute;
            right: 14px;
            background: none;
            border: none;
            cursor: pointer;
            color: #52525b;
            display: flex;
            align-items: center;
            padding: 4px;
            border-radius: 8px;
            transition: color 0.2s ease, background 0.2s ease;
          }

          .eye-btn:hover {
            color: #f2ca50;
            background: rgba(242,202,80,0.08);
          }

          /* Animations */
          @keyframes cardEntrance {
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      <div className="auth-wrapper">
        <button onClick={onBack} className="back-btn" title="Back">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
        </button>

        <div className="auth-card">

          <div className="auth-header">
            <div className="auth-logo">
              <img src="/logo.png" alt="Relaxify" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            </div>
            <h1 className="auth-title">
              Relax<span style={{ color: '#f2ca50' }}>ify</span>
            </h1>
            <p className="auth-subtitle">
              {isLogin ? 'Welcome back to your music.' : 'Start your ad-free journey.'}
            </p>
          </div>

          <div className="toggle-container">
            <div 
              className="toggle-slider" 
              style={{ transform: isLogin ? 'translateX(0)' : 'translateX(100%)' }} 
            />
            <button 
              className={`toggle-btn ${isLogin ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
              type="button"
            >
              Sign In
            </button>
            <button 
              className={`toggle-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); }}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={submit}>
            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-wrapper">
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="John Doe"
                    value={form.name}
                    required
                    onChange={e => set('name', e.target.value)}
                  />
                  <span className="material-symbols-outlined input-icon">person</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <input
                  className="auth-input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  required
                  onChange={e => set('email', e.target.value)}
                />
                <span className="material-symbols-outlined input-icon">mail</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <input
                  className="auth-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder={isLogin ? '••••••••' : 'Minimum 6 characters'}
                  value={form.password}
                  required
                  onChange={e => set('password', e.target.value)}
                  style={{ paddingRight: 48 }}
                />
                <span className="material-symbols-outlined input-icon">lock</span>
                <button type="button" className="eye-btn" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="error-msg">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                {error}
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="material-symbols-outlined loading-spinner">autorenew</span>
                  {isLogin ? 'Authenticating...' : 'Setting up...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In to Relaxify' : 'Create Account'}
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <p className="auth-footer">
            {isLogin ? "New to the platform? " : 'Already have an account? '}
            <span onClick={() => { setMode(isLogin ? 'signup' : 'login'); setError(''); }}>
              {isLogin ? 'Create an account' : 'Sign in instead'}
            </span>
          </p>
          
        </div>
      </div>
    </>
  );
}