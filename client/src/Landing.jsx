import React, { useEffect } from 'react';

export default function Landing({ onEnter, onSignIn }) {
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'reveal-styles'
    style.textContent = `
      .reveal { opacity: 0; transform: translateY(48px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
      .reveal.visible { opacity: 1 !important; transform: translateY(0) !important; }
      .reveal-left { opacity: 0; transform: translateX(-48px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
      .reveal-left.visible { opacity: 1 !important; transform: translateX(0) !important; }
      .reveal-scale { opacity: 0; transform: scale(0.88); transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1); }
      .reveal-scale.visible { opacity: 1 !important; transform: scale(1) !important; }
    `
    document.head.appendChild(style)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target
          setTimeout(() => el.classList.add('visible'), Number(el.dataset.delay || 0))
          observer.unobserve(el)
        }
      })
    }, { threshold: 0.12 })
    document.querySelectorAll('.reveal, .reveal-left, .reveal-scale').forEach(el => observer.observe(el))
    return () => { observer.disconnect(); document.getElementById('reveal-styles')?.remove() }
  }, [])

  useEffect(() => {
    // Feature card spotlight + 3D tilt
    const cards = document.querySelectorAll('.feature-card')
    const handleMove = (e) => {
      const card = e.currentTarget
      const rect = card.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      const rotX = ((e.clientY - rect.top) / rect.height - 0.5) * -10
      const rotY = ((e.clientX - rect.left) / rect.width - 0.5) * 10
      card.style.setProperty('--mx', `${x}%`)
      card.style.setProperty('--my', `${y}%`)
      card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-8px)`
    }
    const handleLeave = (e) => {
      e.currentTarget.style.transform = ''
    }
    cards.forEach(c => { c.addEventListener('mousemove', handleMove); c.addEventListener('mouseleave', handleLeave) })

    // CTA ripple mouse tracking
    const btns = document.querySelectorAll('.cta-btn')
    const handleBtnMove = (e) => {
      const btn = e.currentTarget
      const rect = btn.getBoundingClientRect()
      btn.style.setProperty('--rx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
      btn.style.setProperty('--ry', `${((e.clientY - rect.top) / rect.height) * 100}%`)
    }
    btns.forEach(b => b.addEventListener('mousemove', handleBtnMove))

    return () => {
      cards.forEach(c => { c.removeEventListener('mousemove', handleMove); c.removeEventListener('mouseleave', handleLeave) })
      btns.forEach(b => b.removeEventListener('mousemove', handleBtnMove))
    }
  }, [])
  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body, html {
            background-color: #050505;
            color: #ffffff;
            font-family: 'Plus Jakarta Sans', sans-serif;
            scroll-behavior: smooth;
            overflow-x: hidden;
          }

          /* --- REUSABLE UTILITIES --- */
          .section-padding {
            padding: 6rem 5%;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .section-title {
            font-size: clamp(2rem, 4vw, 3rem);
            font-weight: 800;
            margin-bottom: 1rem;
            text-align: center;
            letter-spacing: -0.02em;
          }

          .section-subtitle {
            font-size: 1.125rem;
            color: #a1a1aa;
            text-align: center;
            max-width: 600px;
            margin-bottom: 4rem;
            line-height: 1.6;
          }

          /* --- FIXED HEADER --- */
          .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 72px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 5%;
            background: rgba(5, 5, 5, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            z-index: 1000;
            transition: all 0.3s ease;
          }

          .logo {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          }

          .logo span {
            color: #f2ca50;
          }

          .nav-links {
            display: flex;
            gap: 32px;
          }

          .nav-links a {
            color: #a1a1aa;
            text-decoration: none;
            font-size: 0.95rem;
            font-weight: 500;
            transition: color 0.2s ease;
          }

          .nav-links a:hover {
            color: #ffffff;
          }

          .header-btn {
            background: transparent;
            color: #f2ca50;
            border: 1px solid #f2ca50;
            border-radius: 100px;
            padding: 8px 20px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
          }

          .header-btn:hover {
            background: rgba(242, 202, 80, 0.1);
            transform: translateY(-1px);
          }

          /* --- HERO SECTION --- */
          .hero-section {
            min-height: 100vh;
            padding-top: 72px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            position: relative;
            background-image: radial-gradient(ellipse at 50% 10%, rgba(242, 202, 80, 0.15) 0%, transparent 70%);
          }

          .badge {
            background: rgba(242, 202, 80, 0.1);
            border: 1px solid rgba(242, 202, 80, 0.2);
            color: #f2ca50;
            padding: 6px 16px;
            border-radius: 100px;
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 2rem;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            animation: slideDown 0.6s ease-out;
          }

          .hero-title {
            font-size: clamp(3.5rem, 7vw, 5.5rem);
            font-weight: 800;
            line-height: 1.05;
            margin: 0 0 1.5rem;
            letter-spacing: -0.03em;
            animation: fadeUp 0.8s ease-out;
          }

          .hero-title span {
            background: linear-gradient(135deg, #f2ca50 0%, #ff9500 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .hero-subtitle {
            font-size: clamp(1.125rem, 2vw, 1.25rem);
            color: #a1a1aa;
            max-width: 600px;
            margin: 0 0 3rem;
            line-height: 1.6;
            animation: fadeUp 1s ease-out;
          }

          .cta-group {
            display: flex;
            gap: 16px;
            animation: fadeUp 1.2s ease-out;
          }

          .cta-btn {
            background: #f2ca50;
            color: #0a0a0a;
            border: none;
            border-radius: 100px;
            padding: 18px 40px;
            font-size: 1.125rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 20px rgba(242, 202, 80, 0.2);
            font-family: inherit;
          }

          .cta-btn:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 12px 28px -6px rgba(242, 202, 80, 0.5);
            background: #f5d470;
          }

          .secondary-btn {
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 100px;
            padding: 18px 40px;
            font-size: 1.125rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: flex;
            align-items: center;
            font-family: inherit;
          }

          .secondary-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-3px);
          }

          /* --- STATS SECTION --- */
          .stats-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
            width: 100%;
            max-width: 1000px;
            padding: 3rem;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 32px;
            margin-top: -5rem;
            position: relative;
            z-index: 10;
            backdrop-filter: blur(20px);
          }

          .stat-item {
            text-align: center;
          }

          .stat-number {
            font-size: 2.5rem;
            font-weight: 800;
            color: #f2ca50;
            margin-bottom: 0.5rem;
          }

          .stat-label {
            font-size: 0.95rem;
            color: #a1a1aa;
            font-weight: 500;
          }

          /* --- FEATURES SECTION --- */
          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 2rem;
            width: 100%;
            max-width: 1200px;
          }

          .feature-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            padding: 2.5rem;
            transition: all 0.4s ease;
          }

          .feature-card:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(242, 202, 80, 0.3);
            transform: translateY(-8px);
          }

          .feature-icon-wrapper {
            background: rgba(242, 202, 80, 0.1);
            width: 64px;
            height: 64px;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.5rem;
            color: #f2ca50;
          }

          .feature-title {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
          }

          .feature-desc {
            color: #a1a1aa;
            line-height: 1.6;
          }

          /* --- FAQ SECTION --- */
          .faq-grid {
            width: 100%;
            max-width: 800px;
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .faq-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1.5rem 2rem;
          }

          .faq-question {
            font-size: 1.125rem;
            font-weight: 600;
            color: #fff;
            margin-bottom: 0.5rem;
          }

          .faq-answer {
            color: #a1a1aa;
            line-height: 1.6;
          }

          /* --- BOTTOM CTA --- */
          .bottom-cta {
            margin: 4rem 5%;
            padding: 5rem 2rem;
            background: linear-gradient(135deg, rgba(242, 202, 80, 0.1) 0%, rgba(255, 149, 0, 0.05) 100%);
            border: 1px solid rgba(242, 202, 80, 0.2);
            border-radius: 40px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          /* --- FOOTER --- */
          .footer {
            background: #030303;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding: 5rem 5% 2rem;
          }

          .footer-grid {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 3rem;
            margin-bottom: 4rem;
          }

          .footer-brand p {
            color: #a1a1aa;
            line-height: 1.6;
            margin-top: 1rem;
            max-width: 300px;
          }

          .footer-col h4 {
            font-size: 1rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
          }

          .footer-col ul {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .footer-col a {
            color: #a1a1aa;
            text-decoration: none;
            transition: color 0.2s;
          }

          .footer-col a:hover {
            color: #f2ca50;
          }

          .footer-bottom {
            max-width: 1200px;
            margin: 0 auto;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 2rem;
            display: flex;
            justify-content: space-between;
            color: #52525b;
            font-size: 0.875rem;
          }

          /* Responsive */
          @media (max-width: 768px) {
            .nav-links { display: none; }
            .cta-group { flex-direction: column; width: 100%; max-width: 300px; }
            .stats-container { grid-template-columns: 1fr; margin-top: 2rem; padding: 2rem; }
            .footer-grid { grid-template-columns: 1fr; gap: 2rem; }
            .footer-bottom { flex-direction: column; gap: 1rem; text-align: center; }
          }

          /* Animations */
          @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse-glow { 0%,100% { box-shadow: 0 4px 20px rgba(242,202,80,0.25); } 50% { box-shadow: 0 4px 48px rgba(242,202,80,0.6); } }
          @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }

          /* CTA ripple */
          .cta-btn { position: relative; overflow: hidden; animation: pulse-glow 3s ease-in-out infinite; }
          .cta-btn:hover { animation: none; }
          .cta-btn::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at var(--rx,50%) var(--ry,50%), rgba(255,255,255,0.22) 0%, transparent 65%); opacity: 0; transition: opacity 0.3s; border-radius: inherit; pointer-events: none; }
          .cta-btn:hover::after { opacity: 1; }

          /* Secondary btn glow border */
          .secondary-btn { position: relative; overflow: hidden; }
          .secondary-btn::before { content: ''; position: absolute; inset: -1px; border-radius: 100px; background: linear-gradient(135deg, rgba(242,202,80,0.4), transparent 60%); opacity: 0; transition: opacity 0.3s; pointer-events: none; }
          .secondary-btn:hover::before { opacity: 1; }

          /* Header btn fill sweep */
          .header-btn { position: relative; overflow: hidden; z-index: 0; }
          .header-btn::before { content: ''; position: absolute; inset: 0; background: #f2ca50; transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease; border-radius: 100px; z-index: -1; }
          .header-btn:hover::before { transform: scaleX(1); }
          .header-btn:hover { color: #0a0a0a; }

          /* Nav underline slide */
          .nav-links a { position: relative; }
          .nav-links a::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 2px; background: #f2ca50; border-radius: 2px; transition: width 0.3s ease; }
          .nav-links a:hover::after { width: 100%; }

          /* Logo bounce */
          .logo { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
          .logo:hover { transform: scale(1.06); }

          /* Feature card spotlight + icon spring */
          .feature-card { position: relative; overflow: hidden; transform-style: preserve-3d; will-change: transform; }
          .feature-card::before { content: ''; position: absolute; inset: 0; border-radius: 24px; background: radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(242,202,80,0.08) 0%, transparent 55%); opacity: 0; transition: opacity 0.3s; pointer-events: none; }
          .feature-card:hover::before { opacity: 1; }
          .feature-icon-wrapper { transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease; }
          .feature-card:hover .feature-icon-wrapper { transform: scale(1.18) rotate(8deg); box-shadow: 0 8px 28px rgba(242,202,80,0.3); }

          /* Badge shimmer on hover */
          .badge { transition: background 0.3s; }
          .badge:hover { background: linear-gradient(90deg, rgba(242,202,80,0.18), rgba(255,149,0,0.18), rgba(242,202,80,0.18)); background-size: 200% auto; animation: shimmer 1.5s linear infinite; border-color: rgba(242,202,80,0.4); }

          /* Stat item lift */
          .stat-item { transition: transform 0.3s ease; cursor: default; }
          .stat-item:hover { transform: translateY(-6px); }
          .stat-item:hover .stat-number { text-shadow: 0 0 24px rgba(242,202,80,0.6); }
          .stat-number { transition: text-shadow 0.3s; }

          /* FAQ item hover */
          .faq-item { transition: all 0.3s ease; cursor: default; }
          .faq-item:hover { border-color: rgba(242,202,80,0.25); background: rgba(242,202,80,0.03); transform: translateX(6px); }

          /* Bottom CTA glow */
          .bottom-cta { transition: box-shadow 0.4s ease; }
          .bottom-cta:hover { box-shadow: 0 0 80px rgba(242,202,80,0.08); }

          /* Footer links */
          .footer-col a { position: relative; display: inline-block; }
          .footer-col a::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0; height: 1px; background: #f2ca50; transition: width 0.25s ease; }
          .footer-col a:hover::after { width: 100%; }
        `}
      </style>

      {/* HEADER */}
      <header className="header">
        <div className="logo">
          <img src="/logo.png" alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          Relax<span>ify</span>
        </div>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button className="header-btn" onClick={onSignIn || onEnter}>Sign In</button>
      </header>

      {/* HERO */}
      <section className="hero-section section-padding">
        <div className="badge">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>music_note</span>
          100% Free. No strings attached.
        </div>
        <h1 className="hero-title">
          All your music. <br />
          Zero <span>interruptions.</span>
        </h1>
        <p className="hero-subtitle">
          Experience a massive library of tracks, real-time charts, and intelligent playlists without ever hearing a single audio ad. Built purely for the love of music.
        </p>
        <div className="cta-group">
          <button className="cta-btn" onClick={onEnter}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
            Start Listening Now
          </button>
          <a className="secondary-btn" href="#features">See How It Works</a>
        </div>
      </section>

      {/* STATS (Genuine Social Proof based on YouTube API) */}
      <div className="section-padding" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="stats-container reveal-scale">
          <div className="stat-item reveal" data-delay="0">
            <div className="stat-number">100M+</div>
            <div className="stat-label">Tracks Available</div>
          </div>
          <div className="stat-item reveal" data-delay="100">
            <div className="stat-number">0</div>
            <div className="stat-label">Audio Ads Played</div>
          </div>
          <div className="stat-item reveal" data-delay="200">
            <div className="stat-number">$0</div>
            <div className="stat-label">Subscription Cost</div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="section-padding">
        <h2 className="section-title reveal">Everything you need to vibe.</h2>
        <p className="section-subtitle reveal" data-delay="100">We stripped away the clutter and the paywalls to give you exactly what you want: a pure, uninterrupted music interface.</p>
        
        <div className="features-grid">
          {[
            { icon: 'local_fire_department', title: 'Trending Real-Time', desc: 'Stay ahead of the curve with constantly updating charts and viral hits from around the globe.' },
            { icon: 'bolt', title: 'Lightning Search', desc: 'Find any track, album, or artist instantly with our highly optimized search engine.' },
            { icon: 'queue_music', title: 'Smart Playlists', desc: 'Discover perfectly curated playlists and continuous mixes for whatever mood you are in.' },
            { icon: 'graphic_eq', title: 'Clean Audio Interface', desc: 'A beautiful, dark-mode focused player designed to get out of the way of your listening.' },
            { icon: 'devices', title: 'Works Everywhere', desc: 'No installations required. Access your music directly from any modern web browser.' },
            { icon: 'block', title: 'Zero Ads Forever', desc: 'Enjoy a pure listening experience. No audio ads between songs, no annoying popups.' },
          ].map((feature, idx) => (
            <div className="feature-card reveal" key={idx} data-delay={idx * 80}>
              <div className="feature-icon-wrapper">
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>{feature.icon}</span>
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ SECTION (Updated for authenticity) */}
      <section id="faq" className="section-padding" style={{ background: '#080808' }}>
        <h2 className="section-title reveal">Frequently Asked Questions</h2>
        <p className="section-subtitle reveal" data-delay="100">How does it work? Why is it free?</p>

        <div className="faq-grid">
          <div className="faq-item reveal-left" data-delay="0">
            <div className="faq-question">Is Relaxify actually free without ads?</div>
            <div className="faq-answer">Yes! Relaxify is a completely free wrapper interface. By utilizing public APIs, we provide a clean, ad-free environment to stream music without injecting our own audio interruptions or paywalls.</div>
          </div>
          <div className="faq-item reveal-left" data-delay="120">
            <div className="faq-question">Do I need to create an account?</div>
            <div className="faq-answer">Absolutely not. We believe in getting you straight to the music. Just click "Start Listening" and jump right in with zero signup friction.</div>
          </div>
          <div className="faq-item reveal-left" data-delay="240">
            <div className="faq-question">Where does the music library come from?</div>
            <div className="faq-answer">Relaxify is powered by YouTube's massive content ecosystem. This ensures you have access to official tracks, live performances, covers, and remixes that you won't find anywhere else.</div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <div className="bottom-cta reveal-scale">
        <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Ready to change how you listen?</h2>
        <p className="section-subtitle" style={{ color: '#fff', marginBottom: '2rem' }}>Experience the internet's largest music catalog without the hassle.</p>
        <button className="cta-btn" onClick={onEnter}>
          Open Web Player Now
        </button>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo" style={{ fontSize: '1.25rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>graphic_eq</span>
              Relax<span>ify</span>
            </div>
            <p>A pure, ad-free music streaming interface. Built for true music lovers who demand a better experience without the paywalls.</p>
          </div>

          <div className="footer-col">
            <h4>App</h4>
            <ul>
              <li><a href="#" onClick={onEnter}>Web Player</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Project</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Source Code</a></li>
              <li><a href="#">Report an Issue</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Terms of Use</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">DMCA Disclaimer</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Relaxify. A free, independent project.</span>
          <span>Made By Nitin ❤️ for music.</span>
        </div>
      </footer>
    </>
  );
}