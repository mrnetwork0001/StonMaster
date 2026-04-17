import React, { useState } from 'react';
import { useTonConnectUI, TonConnectButton } from '@tonconnect/ui-react';
import { usePrivy } from '@privy-io/react-auth';
import { GlassModal } from './GlassModal';
import { GlassCard } from './GlassCard';
import { useWallet } from '../../hooks/useWallet';

export const UnifiedConnectButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { address, isConnected, walletType } = useWallet();
  const { login, logout } = usePrivy();
  const [tonConnectUI] = useTonConnectUI();

  if (isConnected && address) {
    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
    const typeLabel = walletType === 'tonconnect' ? 'Wallet' : 'Social';
    
    return (
      <div className="unified-connected-container" style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button 
          className="btn btn-ghost" 
          onClick={() => {
            if (walletType === 'privy') logout();
            if (walletType === 'tonconnect') tonConnectUI.disconnect();
          }}
          style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.85rem' }}
        >
          <span className="badge" style={{ marginRight: '8px', fontSize: '10px' }}>{typeLabel}</span>
          {shortAddress}
          <span style={{ marginLeft: '8px', opacity: 0.5 }}>✕</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button 
        className="glass-btn btn-primary neumorphic-active"
        onClick={() => setShowModal(true)}
        style={{ padding: 'var(--space-2) var(--space-6)' }}
      >
        Connect
      </button>

      {showModal && (
        <GlassModal
          title="Connect to StonMaster"
          onClose={() => setShowModal(false)}
        >
          <div className="unified-auth-options" style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
            <GlassCard variant="flat" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem' }}>Standard TON Wallet</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                Connect using Tonkeeper, MyTonWallet, or Telegram Wallet.
              </p>
              <div onClick={() => setShowModal(false)}>
                <TonConnectButton />
              </div>
            </GlassCard>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--text-secondary)' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>

            <GlassCard variant="flat" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem' }}>Social Login</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                No wallet? No problem. Log in with your email or social account.
              </p>
              <button 
                className="glass-btn btn-secondary" 
                style={{ width: '100%' }}
                onClick={() => {
                  setShowModal(false);
                  login();
                }}
              >
                Sign in with Social / Email
              </button>
            </GlassCard>
          </div>
        </GlassModal>
      )}
    </>
  );
};
