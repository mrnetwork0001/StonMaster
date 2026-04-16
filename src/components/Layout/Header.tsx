import React from 'react';
import { TonConnectButton } from '@tonconnect/ui-react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'Mission Control',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <button
          className="mobile-menu-btn btn btn-ghost btn-sm"
          onClick={onMenuClick}
          style={{ display: 'none' }}
        >
          ☰
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-actions">
        <TonConnectButton />
      </div>
    </header>
  );
};
