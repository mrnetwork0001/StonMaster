import React, { useState } from 'react';
import { useTonConnectUI, TonConnectButton } from '@tonconnect/ui-react';
import { usePrivy } from '@privy-io/react-auth';
import { GlassModal } from './GlassModal';
import { useWallet } from '../../hooks/useWallet';

export const UnifiedConnectButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const { address, isConnected, walletType, ready } = useWallet();
  const { login, logout, authenticated } = usePrivy();
  const [tonConnectUI] = useTonConnectUI();

  // Privy SDK still initialising on page load
  if (!ready) {
    return (
      <button className="btn btn-ghost" disabled style={{ padding: 'var(--space-2) var(--space-6)', opacity: 0.6 }}>
        ⚡ Loading...
      </button>
    );
  }

  // When connected — show dropdown with copy + disconnect
  if (isConnected && address) {
    const shortAddress = (() => {
      if (address.includes('@')) {
        // Email: mrnetwork0001@gmail.com → mr...com
        const tld = address.split('.').pop() || '';
        return `${address.slice(0, 2)}...${tld}`;
      }
      // TON/EVM address
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    })();
    const typeLabel = walletType === 'tonconnect' ? 'Wallet' : 'Social';

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
            {typeLabel}
          </span>
          {shortAddress}
          <span style={{ marginLeft: '8px', opacity: 0.5 }}>▾</span>
        </button>

        {/* Dropdown portal */}
        <GlassModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Wallet Options"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Address display — show email label or TON address */}
            <div
              style={{
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                boxShadow: 'var(--neu-inset-sm)',
                fontFamily: address.includes('@') ? 'var(--font-sans)' : 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--color-fg)',
                wordBreak: 'break-all',
              }}
            >
              {address.includes('@') ? `📧 ${address}` : address}
            </div>

            {/* Copy Address — only for real wallet addresses */}
            {!address.includes('@') && (
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
            )}

            {/* Social login note */}
            {address.includes('@') && (
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--color-muted)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-warning-soft)',
                borderRadius: 'var(--radius-md)',
                lineHeight: 1.5,
              }}>
                ⚠️ Social login provides identity only. Connect a <strong>TON wallet</strong> (Tonkeeper) to execute swaps and transactions.
              </div>
            )}

            {/* Disconnect */}
            <button
              className="btn btn-full"
              onClick={() => {
                setShowModal(false);
                if (walletType === 'privy') logout();
                else tonConnectUI.disconnect();
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

          {/* Social Login — Coming Soon */}
          <div
            style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--neu-inset-sm)',
              opacity: 0.75,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Coming Soon badge */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              textTransform: 'uppercase',
            }}>
              Coming Soon
            </div>

            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-fg)' }}>
              Social Login
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Sign in with email, Google, or Twitter — no wallet needed. A full TON embedded wallet will be provisioned automatically.
            </p>
            <button
              disabled
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                boxShadow: 'var(--neu-inset-sm)',
                color: 'var(--color-muted)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                border: 'none',
              }}
            >
              🔒 Sign in with Social / Email
            </button>
          </div>

        </div>
      </GlassModal>
    </>
  );
};
