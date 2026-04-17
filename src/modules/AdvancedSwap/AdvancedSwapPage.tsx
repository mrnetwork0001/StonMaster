import React, { useEffect, useRef } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import omnistonWidgetLoader, { type OmnistonWidget } from '@ston-fi/omniston-widget-loader';
import { motion } from 'framer-motion';
import { GlassCard } from '../../components/common/GlassCard';

export const AdvancedSwapPage: React.FC = () => {
  const [tonConnectUI] = useTonConnectUI();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<OmnistonWidget | null>(null);

  useEffect(() => {
    let isMounted = true;

    omnistonWidgetLoader.load().then((OmnistonWidgetConstructor) => {
      if (!isMounted || !containerRef.current || !tonConnectUI) return;

      widgetRef.current = new OmnistonWidgetConstructor({
        tonconnect: {
          type: 'integrated',
          instance: tonConnectUI,
        },
        widget: {
          defaultBidAsset: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', // TON
          defaultAskAsset: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // USDT
        },
      });

      widgetRef.current.mount(containerRef.current);
    });

    return () => {
      isMounted = false;
      widgetRef.current?.unmount();
      widgetRef.current = null;
    };
  }, [tonConnectUI]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
    >
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          Advanced Swap
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Direct integration with STON.fi swap interface for maximum liquidity and complex routes.
        </p>
      </div>

      <GlassCard style={{ padding: '0', overflow: 'hidden', minHeight: '600px', display: 'flex', justifyContent: 'center' }}>
        <div 
          ref={containerRef} 
          style={{ width: '100%', maxWidth: '480px', margin: 'var(--space-8) auto' }} 
        />
      </GlassCard>

      <style>{`
        /* Custom overrides if needed for the widget to match glassmorphism */
        #omniston-widget-container {
          border-radius: var(--radius-lg);
        }
      `}</style>
    </motion.div>
  );
};
