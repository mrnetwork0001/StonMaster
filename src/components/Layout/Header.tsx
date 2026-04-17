import React from 'react';
import { useLocation } from 'react-router-dom';
import { UnifiedConnectButton } from '../common/UnifiedConnectButton';

const pageTitles: Record<string, string> = {
  '/app': 'Mission Control',
  '/sweep': 'StonSweep',
  '/earn': 'Yield Maximizer',
  '/share': 'SocialSwap',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'StonMaster';

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          className="mobile-menu-btn"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          ☰
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-actions">
        <UnifiedConnectButton />
      </div>
    </header>
  );
};
