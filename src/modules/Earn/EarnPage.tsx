import React, { useState } from 'react';
import { AppIcon } from '../../components/common/AppIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../../hooks/useWallet';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassModal } from '../../components/common/GlassModal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useTonstakers } from '../../hooks/useTonstakers';
import { formatTON, formatPercent, formatNumber, formatUSD, nanoToTon, tonToNano } from '../../utils/formatters';
import { tonviewerUrl } from '../../utils/tonExplorer';

type Tab = 'stake' | 'unstake';
type UnstakeMode = 'standard' | 'instant' | 'bestRate';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export const EarnPage: React.FC = () => {
  const { address } = useWallet();
  const tonstakers = useTonstakers();
  const { sdkInitFailed, retryInit } = tonstakers;
  const [activeTab, setActiveTab] = useState<Tab>('stake');
  const [unstakeMode, setUnstakeMode] = useState<UnstakeMode>('standard');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

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

  const safeNum = (val: unknown) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  const amountNum = parseFloat(amount) || 0;
  const availableTon = nanoToTon(safeNum(tonstakers.availableBalance));
  const stakedTsTon = nanoToTon(safeNum(tonstakers.stakedBalance));

  const rawTvl = safeNum(tonstakers.tvl);
  const tvlTon = nanoToTon(rawTvl);
  const tonPrice = safeNum(tonstakers.rates?.TONUSD);
  const tvlUsd = tvlTon * tonPrice;

  const handleStake = async () => {
    if (amountNum <= 0) return;
    setProcessing(true);
    try {
      const txHash = await tonstakers.stake(tonToNano(amountNum));
      setAmount('');
      setModal({
        isOpen: true,
        title: 'Stake Successful',
        type: 'success',
        content: (
          <div>
            <p>You have successfully staked <strong>{amountNum} TON</strong>. Your tsTON balance will update shortly.</p>
            {txHash && (
              <a
                href={tonviewerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-accent)', fontWeight: 600 }}
              >
                🔍 View in Explorer ↗
              </a>
            )}
          </div>
        ),
      });
    } catch (err) {
      console.error('Stake error:', err);
      setModal({
        isOpen: true,
        title: 'Stake Failed',
        type: 'error',
        content: err instanceof Error ? err.message : 'The staking transaction was cancelled or failed.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUnstake = async () => {
    if (amountNum <= 0) return;
    setProcessing(true);
    try {
      const txHash = unstakeMode === 'instant'
        ? await tonstakers.unstakeInstant(tonToNano(amountNum))
        : await tonstakers.unstake(tonToNano(amountNum));
      setAmount('');
      setModal({
        isOpen: true,
        title: 'Unstake Initiated',
        type: 'success',
        content: (
          <div>
            <p>
              Your unstaking request for <strong>{amountNum} tsTON</strong> has been sent.{' '}
              {unstakeMode === 'standard' ? 'Funds will be available after the round ends.' : 'TON will arrive in your wallet shortly.'}
            </p>
            {txHash && (
              <a
                href={tonviewerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-accent)', fontWeight: 600 }}
              >
                🔍 View in Explorer ↗
              </a>
            )}
          </div>
        ),
      });
    } catch (err) {
      console.error('Unstake error:', err);
      setModal({
        isOpen: true,
        title: 'Unstake Failed',
        type: 'error',
        content: err instanceof Error ? err.message : 'The unstaking transaction was cancelled or failed.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // MAX shows the full balance - the SDK handles gas internally
  const setMaxAmount = () => {
    if (activeTab === 'stake') {
      setAmount(availableTon.toFixed(4));
    } else {
      setAmount(stakedTsTon.toFixed(4));
    }
  };

  if (!address) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard>
          <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>
              <AppIcon name="gem" size={52} color="var(--color-accent)" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              Yield Maximizer
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Stake TON to earn yield through Tonstakers liquid staking protocol. Receive tsTON that grows in value over time.
            </p>
            <span className="badge badge--warning">Connect wallet above ☝️</span>
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  const statItems = [
    { label: 'Current APY', value: formatPercent(tonstakers.apy), color: 'var(--color-success)' },
    { label: 'Your tsTON', value: `${formatTON(tonstakers.stakedBalance)} tsTON`, color: 'var(--color-accent)' },
    { label: 'TVL', value: formatUSD(tvlUsd || 0), color: 'var(--color-primary)' },
    { label: 'Active Stakers', value: formatNumber(tonstakers.stakersCount || 0, 0), color: 'var(--color-text-primary)' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Stats Cards */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stats-grid earn-stats-grid">
          {statItems.map((stat) => (
            <GlassCard key={stat.label}>
              <div className="stat-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span className="stat-label">{stat.label}</span>
                </div>
                {tonstakers.loading && !stat.value ? (
                  <LoadingSkeleton width="100px" height="28px" />
                ) : (
                  <span className="stat-value" style={{ color: stat.color, fontSize: 'var(--text-xl)' }}>
                    {stat.value}
                  </span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      <div className="page-two-col">
        {/* Staking Panel */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <GlassCard glow="green">

            {/* ── Premium Pill Toggle ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
              <div className="earn-tab-toggle">
                <button
                  className={`earn-tab-btn ${activeTab === 'stake' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('stake'); setAmount(''); }}
                >
                  Stake
                </button>
                <button
                  className={`earn-tab-btn ${activeTab === 'unstake' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('unstake'); setAmount(''); }}
                >
                  Unstake
                </button>
              </div>

              {/* APY badge */}
              <div className="earn-apy-badge">
                <span style={{ fontSize: '10px', opacity: 0.7, marginRight: '4px' }}>APY</span>
                {formatPercent(tonstakers.apy)}
              </div>
            </div>

            {/* ── Unstake Mode Selector (only visible on Unstake tab) ── */}
            <AnimatePresence>
              {activeTab === 'unstake' && (
                <motion.div
                  key="unstake-modes"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden', marginBottom: 'var(--space-4)' }}
                >
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {[
                      { mode: 'standard' as const, icon: '', label: 'Standard', desc: 'Next round' },
                      { mode: 'instant' as const, icon: 'zap' as const, label: 'Instant', desc: 'Immediate' },
                      { mode: 'bestRate' as const, icon: '📈', label: 'Best Rate', desc: 'Optimised' },
                    ].map((opt) => (
                      <button
                        key={opt.mode}
                        onClick={() => setUnstakeMode(opt.mode)}
                        className={`earn-mode-btn ${unstakeMode === opt.mode ? 'active' : ''}`}
                      >
                        {opt.icon && <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}><AppIcon name={opt.icon} size={13} /></span>}
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{opt.label}</div>
                        <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Amount Input ── */}
            <div className="earn-input-card" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Amount ({activeTab === 'stake' ? 'TON' : 'tsTON'})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {/* Token badge */}
                <div className="earn-token-badge">
                  <div className="earn-token-icon">
                    {activeTab === 'stake' ? (
                      <AppIcon name="gem" size={20} color="var(--color-accent)" />
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#e8a014' }}>ts</span>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                    {activeTab === 'stake' ? 'TON' : 'tsTON'}
                  </span>
                </div>

                <input
                  type="number"
                  className="earn-amount-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>

              {/* Balance row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                  {activeTab === 'stake' ? (
                    <>1 tsTON = {(tonstakers.rates?.tsTONTON || 1).toFixed(4)} TON</>
                  ) : (
                    <>1 tsTON = {(tonstakers.rates?.tsTONTON || 1).toFixed(4)} TON</>
                  )}
                </span>
                <button
                  onClick={setMaxAmount}
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-accent)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {activeTab === 'stake' ? `${availableTon.toFixed(2)} TON` : `${stakedTsTon.toFixed(4)} tsTON`} · MAX
                </button>
              </div>
            </div>

            {/* ── Summary ── */}
            {amountNum > 0 && (
              <div style={{
                padding: 'var(--space-4)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>You {activeTab}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {amount} {activeTab === 'stake' ? 'TON' : 'tsTON'}
                  </span>
                </div>
                {activeTab === 'stake' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>You receive (est.)</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                        ~{(amountNum / (tonstakers.rates?.tsTONTON || 1.067)).toFixed(4)} tsTON
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Network fee</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>~1 TON</span>
                    </div>
                  </>
                )}
                {activeTab === 'unstake' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>You receive (est.)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                      ~{(amountNum * (tonstakers.rates?.tsTONTON || 1.067)).toFixed(4)} TON
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Action Button ── */}
            {sdkInitFailed ? (
              <button className="btn btn-primary btn-lg btn-full" onClick={retryInit}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="refresh" size={16} /> Retry Connection to Tonstakers
                </span>
              </button>
            ) : !tonstakers.sdkReady && !processing ? (
              // SDK still initializing — show a non-blocking status indicator
              <button className="btn btn-primary btn-lg btn-full" disabled>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="loader" size={16} className="animate-spin" /> Connecting to Tonstakers...
                </span>
              </button>
            ) : (
              <button
                className={`btn ${activeTab === 'stake' ? 'btn-accent' : 'btn-primary'} btn-lg btn-full`}
                onClick={activeTab === 'stake' ? handleStake : handleUnstake}
                disabled={amountNum <= 0 || processing}
              >
                {processing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <AppIcon name="loader" size={16} className="animate-spin" /> Processing...
                  </span>
                ) : activeTab === 'stake' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <AppIcon name="gem" size={16} /> Stake TON → tsTON
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <AppIcon name="arrow-right" size={16} /> Unstake tsTON → TON
                  </span>
                )}
              </button>
            )}
          </GlassCard>
        </motion.div>

        {/* Info Panel */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Exchange Rate */}
            <GlassCard>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                Exchange Rates
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>1 tsTON</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {tonstakers.rates?.tsTONTON?.toFixed(4) || '-'} TON
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>1 TON</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    ${tonstakers.rates?.TONUSD?.toFixed(2) || '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>Projected 1 tsTON</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-success)' }}>
                    {tonstakers.rates?.tsTONTONProjected?.toFixed(4) || '-'} TON
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Liquidity Info */}
            <GlassCard>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                Pool Information
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>Instant Liquidity</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {formatNumber(nanoToTon(Number(tonstakers.instantLiquidity)) / 1000, 0)}K TON
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>Protocol</span>
                  <span className="badge badge--accent" style={{ fontSize: '10px' }}>Tonstakers</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>Token</span>
                  <span className="badge badge--primary" style={{ fontSize: '10px' }}>tsTON</span>
                </div>
              </div>
            </GlassCard>

            {/* How it works */}
            <GlassCard>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                How It Works
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                <div>1️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Stake TON</strong> - Your TON is delegated to validators</div>
                <div>2️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Receive tsTON</strong> - A liquid token that grows in value</div>
                <div>3️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Earn Yield</strong> - tsTON/TON rate increases over time</div>
                <div>4️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Unstake Anytime</strong> - Redeem tsTON for TON + rewards</div>
              </div>
            </GlassCard>
          </div>
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

      <style>{`
        /* ── Pill Toggle ── */
        .earn-tab-toggle {
          display: flex;
          background: var(--color-surface);
          border-radius: var(--radius-full);
          box-shadow: var(--neu-inset);
          padding: 3px;
          gap: 2px;
        }

        .earn-tab-btn {
          padding: 6px 20px;
          border-radius: var(--radius-full);
          border: none;
          cursor: pointer;
          font-size: var(--text-sm);
          font-weight: 600;
          font-family: var(--font-sans);
          background: transparent;
          color: var(--color-text-secondary);
          transition: all 250ms ease-out;
          white-space: nowrap;
        }

        .earn-tab-btn.active {
          background: var(--color-fg);
          color: var(--color-bg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }

        /* ── APY badge ── */
        .earn-apy-badge {
          display: flex;
          align-items: center;
          padding: 6px 14px;
          background: linear-gradient(135deg, hsl(145, 60%, 22%), hsl(145, 60%, 30%));
          color: hsl(145, 80%, 65%);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          font-weight: 800;
          font-family: var(--font-mono);
          border: 1px solid hsl(145, 50%, 35%);
          letter-spacing: 0.02em;
        }

        /* ── Unstake mode buttons ── */
        .earn-mode-btn {
          flex: 1;
          padding: var(--space-3);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: center;
          font-family: var(--font-sans);
          color: var(--color-fg);
          transition: all 200ms ease-out;
          box-shadow: var(--neu-inset-sm);
        }

        .earn-mode-btn.active {
          background: var(--color-bg);
          border-color: var(--color-accent);
          box-shadow: var(--neu-extruded-sm), 0 0 0 1px var(--color-accent);
          color: var(--color-accent);
        }

        .earn-mode-btn:hover:not(.active) {
          background: var(--color-bg);
          border-color: var(--color-text-tertiary);
        }

        /* ── Amount input card ── */
        .earn-input-card {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          box-shadow: var(--neu-inset);
        }

        /* ── Token badge (TON / tsTON) ── */
        .earn-token-badge {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: var(--color-bg);
          border-radius: var(--radius-full);
          padding: var(--space-2) var(--space-3);
          box-shadow: var(--neu-extruded-sm);
          white-space: nowrap;
          min-width: 90px;
        }

        .earn-token-icon {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, hsl(210, 80%, 55%), hsl(210, 80%, 70%));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        /* ── Amount input ── */
        .earn-amount-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: var(--text-2xl);
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--color-fg);
          text-align: right;
          width: 100%;
          min-width: 0;
        }

        .earn-amount-input::placeholder {
          color: var(--color-text-tertiary);
        }

        .earn-amount-input::-webkit-outer-spin-button,
        .earn-amount-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </motion.div>
  );
};
