import React from 'react';
import { NavLink, Link } from 'react-router-dom';

const navItems = [
  { path: '/app', label: 'Dashboard', icon: '🏠', exact: true },
  { path: '/sweep', label: 'StonSweep', icon: '🧹', exact: false },
  { path: '/earn', label: 'Yield Maximizer', icon: '💎', exact: false },
  { path: '/share', label: 'SocialSwap', icon: '🔗', exact: false },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
        />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <Link to="/" className="sidebar-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="sidebar-brand-icon">⚡</div>
          <div>
            <div className="sidebar-brand-text">StonMaster</div>
            <div className="sidebar-brand-badge">Mission Control</div>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span className="network-dot" />
              TON Mainnet
            </div>
            <div style={{ opacity: 0.5 }}>v1.0.0 · Built with STON.fi</div>
          </div>
        </div>
      </aside>
    </>
  );
};
