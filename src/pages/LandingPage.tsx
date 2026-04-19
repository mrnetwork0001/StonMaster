import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppIcon } from '../components/common/AppIcon';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const features = [
  {
    icon: 'sweep' as const,
    title: 'StonSweep',
    desc: 'Scan your wallet for dust tokens and batch-swap them into TON with one click via Omniston.',
  },
  {
    icon: 'gem' as const,
    title: 'Yield Maximizer',
    desc: 'Stake TON with Tonstakers for liquid staking yields. Live APY, TVL tracking, and instant actions.',
  },
  {
    icon: 'link' as const,
    title: 'SocialSwap',
    desc: 'Build shareable trade strategies with referral links. Followers execute real swaps - you earn fees.',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="/logo.png" alt="StonMaster" className="landing-logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
          <span className="landing-logo-text">StonMaster</span>
        </div>
        <button className="landing-nav-btn" onClick={() => navigate('/app')}>
          Launch App
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <motion.div className="landing-hero-content" initial="hidden" animate="visible">

            <motion.h1 className="landing-h1" custom={1} variants={fadeUp}>
              Your All-in-One
              <br />
              <span className="landing-h1-accent">TON DeFi Hub</span>
            </motion.h1>

            <motion.p className="landing-subtitle" custom={2} variants={fadeUp}>
              Sweep wallet dust, maximize staking yields, and share viral trade
              strategies - all from one premium dashboard.
            </motion.p>

            <motion.div className="landing-cta-row" custom={3} variants={fadeUp}>
              <button className="landing-cta-primary" onClick={() => navigate('/app')}>
                Enter Dashboard
              </button>
              <a
                href="https://docs.ston.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-cta-ghost"
              >
                Read Docs
              </a>
            </motion.div>
          </motion.div>

          {/* Decorative orb */}
          <motion.div
            className="landing-hero-visual"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <div className="landing-orb">
              <div className="landing-orb-inner">
                <div className="landing-orb-core">
                  <img src="https://static.ston.fi/logo/ton_symbol.png" alt="TON Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '15%' }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features">
        <p className="landing-section-label">Modules</p>
        <h2 className="landing-section-title">Three Tools. One Hub.</h2>

        <div className="landing-features-grid">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="landing-feature-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
            >
              <div className="landing-feature-icon">
                <AppIcon name={f.icon} size={26} color="var(--color-accent)" strokeWidth={1.7} />
              </div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="landing-stats">
        <div className="landing-stats-grid">
          {[
            { label: 'Powered By', value: 'STON.fi' },
            { label: 'Network', value: 'TON' },
            { label: 'Settlement', value: 'Omniston' },
          ].map(s => (
            <div key={s.label} className="landing-stat-card">
              <span className="landing-stat-val">{s.value}</span>
              <span className="landing-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="landing-bottom">
        <motion.div
          className="landing-bottom-card"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="landing-bottom-title">Ready to Master TON DeFi?</h2>
          <p className="landing-bottom-desc">
            Connect your wallet and start sweeping, staking, and sharing.
          </p>
          <button className="landing-cta-primary" onClick={() => navigate('/app')}>
            Enter StonMaster
          </button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>Built by <a href="https://x.com/encrypt_wizard" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>MrNetwork</a>, for the STON.fi Hackathon</span>
        <div className="landing-footer-links">
          <a href="https://ston.fi" target="_blank" rel="noopener noreferrer">STON.fi</a>
          <a href="https://ton.org" target="_blank" rel="noopener noreferrer">TON</a>
          <a href="https://docs.ston.fi" target="_blank" rel="noopener noreferrer">Docs</a>
        </div>
      </footer>

      <style>{`
        .landing {
          min-height: 100vh;
          background: var(--color-bg);
          color: var(--color-fg);
        }

        /* Nav */
        .landing-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-8);
          background: rgba(224, 229, 236, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .landing-brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .landing-logo {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--color-accent), var(--color-accent-light));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          color: white;
          box-shadow: var(--neu-extruded-sm);
        }

        .landing-logo-text {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .landing-nav-btn {
          padding: var(--space-3) var(--space-6);
          background: linear-gradient(135deg, var(--color-accent), var(--color-accent-light));
          color: white;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: 600;
          cursor: pointer;
          box-shadow: var(--neu-extruded-sm);
          transition: all 300ms ease-out;
          border: none;
        }

        .landing-nav-btn:hover {
          transform: translateY(-1px);
          box-shadow: var(--neu-extruded);
        }

        /* Hero */
        .landing-hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 120px var(--space-8) 80px;
          max-width: 1280px;
          margin: 0 auto;
        }

        .landing-hero-inner {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-12);
          align-items: center;
          width: 100%;
        }

        .landing-hero-content {
          max-width: 560px;
        }

        .landing-tag {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--color-bg);
          border-radius: var(--radius-full);
          box-shadow: var(--neu-extruded-sm);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-muted);
          margin-bottom: var(--space-8);
        }

        .landing-tag-dot {
          width: 8px;
          height: 8px;
          border-radius: var(--radius-full);
          background: var(--color-accent-secondary);
          box-shadow: 0 0 8px rgba(56, 178, 172, 0.5);
        }

        .landing-h1 {
          font-family: var(--font-display);
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.04em;
          margin-bottom: var(--space-6);
          color: var(--color-fg);
        }

        .landing-h1-accent {
          background: linear-gradient(135deg, var(--color-accent), var(--color-accent-light), var(--color-accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .landing-subtitle {
          font-size: var(--text-lg);
          color: var(--color-muted);
          line-height: 1.7;
          margin-bottom: var(--space-8);
        }

        .landing-cta-row {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .landing-cta-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          padding: var(--space-4) var(--space-8);
          background: linear-gradient(135deg, var(--color-accent), var(--color-accent-light));
          color: white;
          font-size: var(--text-base);
          font-weight: 700;
          border-radius: var(--radius-lg);
          cursor: pointer;
          box-shadow: var(--neu-extruded);
          transition: all 300ms ease-out;
          border: none;
          min-height: 48px;
        }

        .landing-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: var(--neu-extruded-hover);
        }

        .landing-cta-primary:active {
          transform: translateY(0.5px);
          box-shadow: var(--neu-inset-sm);
        }

        .landing-cta-ghost {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4) var(--space-6);
          background: var(--color-bg);
          color: var(--color-fg);
          font-size: var(--text-base);
          font-weight: 600;
          border-radius: var(--radius-lg);
          box-shadow: var(--neu-extruded-sm);
          text-decoration: none;
          transition: all 300ms ease-out;
          min-height: 48px;
        }

        .landing-cta-ghost:hover {
          transform: translateY(-1px);
          box-shadow: var(--neu-extruded);
          color: var(--color-accent);
          text-decoration: none;
        }

        /* Decorative Neumorphic Orb */
        .landing-hero-visual {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .landing-orb {
          width: 280px;
          height: 280px;
          border-radius: var(--radius-full);
          background: var(--color-bg);
          box-shadow: var(--neu-extruded-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: float 4s ease-in-out infinite;
        }

        .landing-orb-inner {
          width: 200px;
          height: 200px;
          border-radius: var(--radius-full);
          background: var(--color-bg);
          box-shadow: var(--neu-inset-deep);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .landing-orb-core {
          width: 100px;
          height: 100px;
          border-radius: var(--radius-full);
          background: var(--color-bg);
          box-shadow: var(--neu-extruded-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }

        /* Features */
        .landing-features {
          max-width: 1280px;
          margin: 0 auto;
          padding: 80px var(--space-8) 100px;
        }

        .landing-section-label {
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-accent);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: var(--space-3);
        }

        .landing-section-title {
          font-family: var(--font-display);
          font-size: var(--text-4xl);
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: var(--space-12);
          color: var(--color-fg);
        }

        .landing-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-8);
        }

        .landing-feature-card {
          padding: var(--space-8);
          background: var(--color-bg);
          border-radius: var(--radius-xl);
          box-shadow: var(--neu-extruded);
          transition: all 300ms ease-out;
          cursor: default;
        }

        .landing-feature-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--neu-extruded-hover);
        }

        .landing-feature-icon {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-md);
          background: var(--color-bg);
          box-shadow: var(--neu-inset-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin-bottom: var(--space-5);
        }

        .landing-feature-title {
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: var(--space-3);
          color: var(--color-fg);
        }

        .landing-feature-desc {
          font-size: var(--text-sm);
          line-height: 1.7;
          color: var(--color-muted);
        }

        /* Stats */
        .landing-stats {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 var(--space-8) 100px;
        }

        .landing-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-8);
        }

        .landing-stat-card {
          text-align: center;
          padding: var(--space-8);
          background: var(--color-bg);
          border-radius: var(--radius-xl);
          box-shadow: var(--neu-inset);
        }

        .landing-stat-val {
          display: block;
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--color-accent);
          margin-bottom: var(--space-2);
        }

        .landing-stat-lbl {
          font-size: var(--text-sm);
          color: var(--color-muted);
          font-weight: 500;
        }

        /* Bottom CTA */
        .landing-bottom {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 var(--space-8) 100px;
        }

        .landing-bottom-card {
          text-align: center;
          padding: var(--space-16) var(--space-8);
          background: var(--color-bg);
          border-radius: var(--radius-xl);
          box-shadow: var(--neu-extruded);
        }

        .landing-bottom-title {
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: var(--space-4);
          color: var(--color-fg);
        }

        .landing-bottom-desc {
          color: var(--color-muted);
          font-size: var(--text-lg);
          margin-bottom: var(--space-8);
        }

        /* Footer */
        .landing-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-6) var(--space-8);
          font-size: var(--text-xs);
          color: var(--color-muted);
        }

        .landing-footer-links {
          display: flex;
          gap: var(--space-6);
        }

        .landing-footer-links a {
          color: var(--color-muted);
          text-decoration: none;
          transition: color 300ms;
        }

        .landing-footer-links a:hover {
          color: var(--color-accent);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .landing-hero-inner {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .landing-hero-content {
            max-width: none;
          }
          .landing-hero-visual {
            order: -1;
          }
          .landing-orb {
            width: 200px;
            height: 200px;
          }
          .landing-orb-inner {
            width: 140px;
            height: 140px;
          }
          .landing-orb-core {
            width: 70px;
            height: 70px;
            font-size: 1.8rem;
          }
          .landing-cta-row {
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .landing-features-grid,
          .landing-stats-grid {
            grid-template-columns: 1fr;
          }
          .landing-footer {
            flex-direction: column;
            gap: var(--space-4);
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};
