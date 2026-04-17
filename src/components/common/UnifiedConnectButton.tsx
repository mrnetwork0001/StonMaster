import React, { useState } from 'react';
import { useTonConnectUI, TonConnectButton } from '@tonconnect/ui-react';
import { usePrivy } from '@privy-io/react-auth';
import { GlassModal } from './GlassModal';
import { useWallet } from '../../hooks/useWallet';

export const UnifiedConnectButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { address, isConnected, walletType } = useWallet();
  const { login, logout } = usePrivy();
  const [tonConnectUI] = useTonConnectUI();

  // When connected — show address + disconnect button
  if (isConnected && address) {
    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
    const typeLabel = walletType === 'tonconnect' ? 'Wallet' : 'Social';

    return (
      <button
        className="btn btn-ghost"
        onClick={() => {
          if (walletType === 'privy') logout();
          else tonConnectUI.disconnect();
        }}
        style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.85rem' }}
      >
        <span
          style={{
            display: 'inline-block',
            marginRight: '8px',
            fontSize: '10px',
            background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          {typeLabel}
        </span>
        {shortAddress}
        <span style={{ marginLeft: '8px', opacity: 0.5 }}>✕</span>
      </button>
    );
  }

  return (
    <>
      {/* ──── Connect Button ──── */}
      <button
        className="btn btn-primary"
        onClick={() => setShowModal(true)}
        style={{ padding: 'var(--space-2) var(--space-6)' }}
      >
        Connect
      </button>

      {/* ──── Modal — always mounted so Portal is alive ──── */}
      <GlassModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Connect to StonMaster"
      >
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>

          {/* Standard TON Wallet */}
          <div
            style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--neu-extruded-sm)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-fg)' }}>
              Standard TON Wallet
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Connect with Tonkeeper, MyTonWallet, or Telegram Wallet.
            </p>
            {/* Clicking TonConnectButton closes modal afterwards via state update */}
            <div onClick={() => setTimeout(() => setShowModal(false), 300)}>
              <TonConnectButton />
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* Social / Email Login */}
          <div
            style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--neu-extruded-sm)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-fg)' }}>
              Social Login
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              No wallet? Log in with your email or social account via Privy.
            </p>
            <button
              className="btn btn-primary btn-full"
              onClick={() => {
                setShowModal(false);
                login();
              }}
            >
              Sign in with Social / Email
            </button>
          </div>

        </div>
      </GlassModal>
    </>
  );
};
