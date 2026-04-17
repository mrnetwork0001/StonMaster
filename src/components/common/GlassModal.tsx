import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'success' | 'error' | 'confirm';
  confirmLabel?: string;
  onConfirm?: () => void;
  isLoading?: boolean;
}

export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  isLoading,
}) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(180, 190, 200, 0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal Box */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '460px',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--neu-extruded-hover)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--color-fg)',
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'var(--color-bg)',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: '18px',
              cursor: 'pointer',
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--neu-extruded-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-6)', color: 'var(--color-muted)', lineHeight: 1.7 }}>
          {children}
        </div>

        {/* Footer */}
        {onConfirm && (
          <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', display: 'flex', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-accent btn-full"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? '⚡ Processing...' : (confirmLabel || 'Confirm')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
