import React, { useState, useMemo } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../../components/common/GlassCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useJettonBalances } from '../../hooks/useJettonBalances';
import type { JettonWithValue } from '../../hooks/useJettonBalances';
import { formatJettonAmount, formatUSD } from '../../utils/formatters';
import { useOmniston } from '@ston-fi/omniston-sdk-react';
import { GlassModal } from '../../components/common/GlassModal';
import { TON_NATIVE_ADDRESS } from '../../utils/constants';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

type SweepStatus = 'idle' | 'scanning' | 'ready' | 'sweeping' | 'done';

interface SweepStep {
  jetton: JettonWithValue;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export const SweepPage: React.FC = () => {
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const omniston = useOmniston();
  const { jettons, dustJettons, totalDustValue, loading, refresh } = useJettonBalances();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sweepStatus, setSweepStatus] = useState<SweepStatus>('idle');
  const [sweepSteps, setSweepSteps] = useState<SweepStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
    type: 'info' | 'success' | 'error';
  }>({
    isOpen: false,
    title: '',
    content: null,
    type: 'info'
  });

  // Auto-select dust on load
  React.useEffect(() => {
    if (dustJettons.length > 0 && selected.size === 0) {
      setSelected(new Set(dustJettons.map(j => j.jetton.address)));
    }
  }, [dustJettons]);

  const selectedJettons = useMemo(
    () => jettons.filter(j => selected.has(j.jetton.address)),
    [jettons, selected]
  );

  const selectedTotalValue = useMemo(
    () => selectedJettons.reduce((sum, j) => sum + j.usdValue, 0),
    [selectedJettons]
  );

  const toggleSelect = (address: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  };

  const selectAllDust = () => {
    setSelected(new Set(dustJettons.map(j => j.jetton.address)));
  };

  const selectAll = () => {
    setSelected(new Set(jettons.map(j => j.jetton.address)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const startSweep = async () => {
    if (selectedJettons.length === 0 || !address) return;

    const steps: SweepStep[] = selectedJettons.map(j => ({
      jetton: j,
      status: 'pending' as const,
    }));

    setSweepSteps(steps);
    setSweepStatus('sweeping');

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setCurrentStep(i);
      setSweepSteps(prev => prev.map((s, idx) =>
        idx === i ? { ...s, status: 'processing' } : s
      ));

      try {
        // 1. Get Quote (using direct instance for loop)
        const quotePromise = new Promise((resolve, reject) => {
          // @ts-ignore - SDK type mismatch
          const subscription = omniston.requestForQuote({
            sourceTokenAddress: step.jetton.jetton.address,
            destinationTokenAddress: TON_NATIVE_ADDRESS,
            offerAmount: step.jetton.balance,
          } as any).subscribe({
            next: (event: any) => {
              if (event.type === 'quoteUpdated') {
                subscription.unsubscribe();
                resolve(event);
              }
            },
            error: (err) => reject(err),
          });
          // Timeout after 10s
          setTimeout(() => {
            subscription.unsubscribe();
            reject(new Error('Quote timeout'));
          }, 10000);
        });

        const quote: any = await quotePromise;
        
        // 2. Build Transaction
        // @ts-ignore - SDK type mismatch
        const params: any = await omniston.buildTransfer({
          quote: quote.quote,
          maxSlippagePps: "300",
        } as any);

        // 3. Send Transaction
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [
            {
              address: params.address?.address || params.to || "",
              amount: params.amount || params.value || "0",
              payload: params.payload,
            },
          ],
        });

        setSweepSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'done' } : s
        ));
      } catch (err: any) {
        console.error(`Sweep failed for ${step.jetton.jetton.symbol}:`, err);
        setSweepSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'error', error: err.message || 'Transaction failed' } : s
        ));
        // Pause briefly before next step to avoid spamming if user cancelled
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setSweepStatus('done');
    
    const successes = steps.filter(s => s.status === 'done').length;
    const fails = steps.filter(s => s.status === 'error').length;

    setModal({
      isOpen: true,
      title: 'Sweep Complete! 🧹',
      type: successes > 0 ? 'success' : 'error',
      content: (
        <div>
          <p>The sweeping process has finished.</p>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Successfully swept:</span>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{successes} tokens</span>
            </div>
            {fails > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Failed/Skipped:</span>
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{fails} tokens</span>
              </div>
            )}
          </div>
        </div>
      )
    });
  };

  if (!address) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard>
          <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🧹</div>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              StonSweep
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Connect your wallet to scan for dust tokens and sweep them into TON.
            </p>
            <span className="badge badge--warning">Connect wallet above ☝️</span>
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Header Stats */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" style={{ marginBottom: 'var(--space-6)' }}>
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                🧹 Wallet Scanner
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                {jettons.length} tokens found · {dustJettons.length} dust tokens worth {formatUSD(totalDustValue)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
                {loading ? '⏳' : '🔄'} Refresh
              </button>
              <button className="btn btn-ghost btn-sm" onClick={selectAllDust}>
                Select Dust
              </button>
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                Select All
              </button>
              {selected.size > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Jetton List */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <GlassCard style={{ padding: 'var(--space-4)' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <LoadingSkeleton key={i} height="60px" />
                ))}
              </div>
            ) : (
              <div className="jetton-list">
                <AnimatePresence>
                  {jettons.map((jetton, index) => (
                    <motion.div
                      key={jetton.jetton.address}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className={`jetton-item ${selected.has(jetton.jetton.address) ? 'selected' : ''}`}
                      onClick={() => sweepStatus === 'idle' || sweepStatus === 'ready' ? toggleSelect(jetton.jetton.address) : null}
                      style={{ cursor: sweepStatus === 'sweeping' ? 'default' : 'pointer' }}
                    >
                      <div
                        className={`jetton-checkbox ${selected.has(jetton.jetton.address) ? 'checked' : ''}`}
                      >
                        {selected.has(jetton.jetton.address) && '✓'}
                      </div>
                      <div className="jetton-icon">
                        {jetton.jetton.symbol?.slice(0, 2) || '??'}
                      </div>
                      <div className="jetton-info">
                        <div className="jetton-name">{jetton.jetton.name}</div>
                        <div className="jetton-symbol">{jetton.jetton.symbol}</div>
                      </div>
                      {jetton.isDust && (
                        <span className="jetton-dust-badge">DUST</span>
                      )}
                      <div className="jetton-balance">
                        <div className="jetton-amount">
                          {formatJettonAmount(jetton.balance, jetton.jetton.decimals)}
                        </div>
                        <div className="jetton-usd">{formatUSD(jetton.usdValue)}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Sweep Panel */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <GlassCard glow={selected.size > 0 ? 'blue' : null}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Sweep Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Selected tokens</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selected.size}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Estimated value</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                  {formatUSD(selectedTotalValue)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Slippage tolerance</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>3%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Route optimizer</span>
                <span className="badge badge--accent" style={{ fontSize: '10px' }}>Omniston</span>
              </div>
            </div>

            {sweepStatus !== 'sweeping' && sweepStatus !== 'done' && (
              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={startSweep}
                disabled={selected.size === 0}
              >
                🧹 Sweep {selected.size} Token{selected.size !== 1 ? 's' : ''} → TON
              </button>
            )}

            {/* Sweep Progress */}
            {(sweepStatus === 'sweeping' || sweepStatus === 'done') && (
              <div className="sweep-progress">
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${((sweepSteps.filter(s => s.status === 'done' || s.status === 'error').length) / sweepSteps.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-tertiary)',
                    marginTop: 'var(--space-2)',
                    textAlign: 'center',
                  }}>
                    {sweepStatus === 'done'
                      ? '✅ Sweep complete!'
                      : `Processing ${currentStep + 1} of ${sweepSteps.length}...`}
                  </div>
                </div>

                {sweepSteps.map((step) => (
                  <div key={step.jetton.jetton.address} className={`sweep-step sweep-step--${step.status}`}>
                    <div className="sweep-step-icon">
                      {step.status === 'pending' && '⏳'}
                      {step.status === 'processing' && <span className="animate-spin">⚡</span>}
                      {step.status === 'done' && '✅'}
                      {step.status === 'error' && '❌'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{step.jetton.jetton.symbol}</div>
                      {step.error && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>{step.error}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      {formatUSD(step.jetton.usdValue)}
                    </div>
                  </div>
                ))}

                {sweepStatus === 'done' && (
                  <button
                    className="btn btn-accent btn-full"
                    onClick={() => {
                      setSweepStatus('idle');
                      setSweepSteps([]);
                      setSelected(new Set());
                      refresh();
                    }}
                    style={{ marginTop: 'var(--space-4)' }}
                  >
                    🔄 Scan Again
                  </button>
                )}
              </div>
            )}

            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3)',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              lineHeight: 1.6,
            }}>
              💡 StonSweep uses Omniston to find the best swap routes across all TON DEXs, minimizing slippage on small token balances.
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <GlassModal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        type={modal.type}
      >
        {modal.content}
      </GlassModal>
    </motion.div>
  );
};
