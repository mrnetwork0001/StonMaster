import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  type = 'info',
  confirmLabel,
  onConfirm,
  isLoading
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-backdrop"
          />
          
          {/* Modal Container */}
          <div className="modal-container">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="glass-modal"
            >
              {/* Header */}
              <div className="modal-header">
                <h3 className="modal-title">{title}</h3>
                <button className="modal-close" onClick={onClose}>&times;</button>
              </div>

              {/* Body */}
              <div className="modal-body">
                {children}
              </div>

              {/* Footer */}
              {(onConfirm || type === 'info') && (
                <div className="modal-footer">
                  {onConfirm && (
                    <button 
                      className={`btn ${type === 'confirm' ? 'btn-accent' : 'btn-primary'} btn-full`}
                      onClick={onConfirm}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="animate-spin">⚡</span>
                      ) : (
                        confirmLabel || 'Confirm'
                      )}
                    </button>
                  )}
                  {!onConfirm && (
                    <button className="btn btn-ghost btn-full" onClick={onClose}>
                      Close
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}

      <style>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(180, 190, 200, 0.5);
          backdrop-filter: blur(4px);
          z-index: 1000;
        }

        .modal-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          z-index: 1001;
          pointer-events: none;
        }

        .glass-modal {
          pointer-events: auto;
          width: 100%;
          max-width: 440px;
          background: var(--color-bg);
          border-radius: var(--radius-xl);
          box-shadow: var(--neu-extruded-hover);
          overflow: hidden;
          position: relative;
          border: none;
        }

        .glass-modal::before {
          display: none;
        }

        .modal-header {
          padding: var(--space-5) var(--space-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
          color: var(--color-fg);
        }

        .modal-close {
          background: var(--color-bg);
          border: none;
          color: var(--color-muted);
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          box-shadow: var(--neu-extruded-sm);
          transition: all 300ms ease-out;
        }

        .modal-close:hover {
          color: var(--color-fg);
          box-shadow: var(--neu-inset-sm);
        }

        .modal-body {
          padding: var(--space-6);
          color: var(--color-muted);
          line-height: 1.7;
        }

        .modal-footer {
          padding: var(--space-4) var(--space-6) var(--space-6);
          display: flex;
          gap: var(--space-3);
        }
      `}</style>
    </AnimatePresence>,
    document.body
  );
};
