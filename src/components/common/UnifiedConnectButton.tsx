import React, { useState, useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { GlassModal } from './GlassModal';
import { useWallet } from '../../hooks/useWallet';
import { AppIcon } from './AppIcon';


export const UnifiedConnectButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { address, isConnected } = useWallet();
  const [tonConnectUI] = useTonConnectUI();

  // Auto-close the connect modal once the wallet successfully connects
  useEffect(() => {
    if (isConnected && showModal) {
      setShowModal(false);
    }
  }, [isConnected, showModal]);

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
              <AppIcon name="x" size={13} style={{ marginRight: 4 }} /> Disconnect
            </button>
          </div>
        </GlassModal>
      </div>
    );
  }

  return (
    <>
      {/* Connect Button - opens TonConnect Native Modal directly */}
      <button
        className="btn btn-primary"
        onClick={() => tonConnectUI.openModal()}
        style={{ padding: 'var(--space-2) var(--space-6)' }}
      >
        Connect
      </button>
    </>
  );
};
