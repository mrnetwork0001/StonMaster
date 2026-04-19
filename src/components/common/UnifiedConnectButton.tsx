import React, { useState } from 'react';
import { useTonConnectUI, TonConnectButton } from '@tonconnect/ui-react';
import { GlassModal } from './GlassModal';
import { useWallet } from '../../hooks/useWallet';

export const UnifiedConnectButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { address, isConnected } = useWallet();
  const [tonConnectUI] = useTonConnectUI();

  // When connected - show address chip with disconnect dropdown
  if (isConnected && address) {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
      <div style={{ position: 'relative' }}>
        <button
          className="btn btn-ghost"
          onClick={() => setShowModal(true)}
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
            Wallet
          </span>
          {shortAddress}
          <span style={{ marginLeft: '8px', opacity: 0.5 }}>▾</span>
        </button>

        <GlassModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Wallet Options"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Address display */}
            <div
              style={{
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                boxShadow: 'var(--neu-inset-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--color-fg)',
                wordBreak: 'break-all',
              }}
            >
              {address}
            </div>

            {/* Copy Address */}
            <button
              className="btn btn-ghost btn-full"
              onClick={async () => {
                await navigator.clipboard.writeText(address);
                setShowModal(false);
              }}
              style={{ justifyContent: 'flex-start', gap: 'var(--space-3)' }}
            >
              <span>📋</span> Copy Address
            </button>

            {/* Disconnect */}
            <button
              className="btn btn-full"
              onClick={() => {
                setShowModal(false);
                tonConnectUI.disconnect();
              }}
              style={{
                justifyContent: 'flex-start',
                gap: 'var(--space-3)',
                color: 'var(--color-danger)',
                background: 'var(--color-danger-soft)',
                boxShadow: 'none',
              }}
            >
              <span>🔌</span> Disconnect
            </button>
          </div>
        </GlassModal>
      </div>
    );
  }

  return (
    <>
      {/* Connect Button - opens modal */}
      <button
        className="btn btn-primary"
        onClick={() => setShowModal(true)}
        style={{ padding: 'var(--space-2) var(--space-6)' }}
      >
        Connect
      </button>

      <GlassModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Connect to StonMaster"
      >
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <div
            style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--neu-extruded-sm)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-fg)' }}>
              Connect TON Wallet
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Connect with Tonkeeper, MyTonWallet, or any TON-compatible wallet.
            </p>
            <div onClick={() => setTimeout(() => setShowModal(false), 300)}>
              <TonConnectButton />
            </div>
          </div>
        </div>
      </GlassModal>
    </>
  );
};
