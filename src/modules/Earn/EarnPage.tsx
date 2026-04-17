import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '../../hooks/useWallet';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassModal } from '../../components/common/GlassModal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useTonstakers } from '../../hooks/useTonstakers';
import { formatTON, formatPercent, formatNumber, formatUSD, nanoToTon, tonToNano } from '../../utils/formatters';

type Tab = 'stake' | 'unstake';
type UnstakeMode = 'standard' | 'instant' | 'bestRate';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export const EarnPage: React.FC = () => {
  const { address } = useWallet();
  const tonstakers = useTonstakers();
  const [activeTab, setActiveTab] = useState<Tab>('stake');
  const [unstakeMode, setUnstakeMode] = useState<UnstakeMode>('standard');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showTvlInUsd, setShowTvlInUsd] = useState(false);
  
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

  // Extremely defensive calculations
  const safeNum = (val: any) => {
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
      await tonstakers.stake(tonToNano(amountNum));
      setAmount('');
      setModal({
        isOpen: true,
        title: 'Stake Successful! 💎',
        type: 'success',
        content: `You have successfully staked ${amountNum} TON. Your tsTON balance will update shortly.`,
      });
    } catch (err: any) {
      console.error('Stake error:', err);
      setModal({
        isOpen: true,
        title: 'Stake Failed',
        type: 'error',
        content: err.message || 'The staking transaction was cancelled or failed.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUnstake = async () => {
    if (amountNum <= 0) return;
    setProcessing(true);
    try {
      if (unstakeMode === 'instant') {
        await tonstakers.unstakeInstant(tonToNano(amountNum));
      } else {
        await tonstakers.unstake(tonToNano(amountNum));
      }
      setAmount('');
      setModal({
        isOpen: true,
        title: 'Unstake Initiated! 🔓',
        type: 'success',
        content: `Your unstaking request for ${amountNum} tsTON has been sent. ${unstakeMode === 'standard' ? 'Funds will be available after the round ends.' : 'TON will arrive in your wallet shortly.'}`,
      });
    } catch (err: any) {
      console.error('Unstake error:', err);
      setModal({
        isOpen: true,
        title: 'Unstake Failed',
        type: 'error',
        content: err.message || 'The unstaking transaction was cancelled or failed.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const setMaxAmount = () => {
    if (activeTab === 'stake') {
      setAmount(Math.max(0, availableTon - 1.1).toFixed(4)); // Reserve 1.1 TON for fees
    } else {
      setAmount(stakedTsTon.toFixed(4));
    }
  };

  if (!address) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard>
          <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>💎</div>
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
    { 
      label: 'TVL', 
      value: showTvlInUsd 
        ? formatUSD(tvlUsd || 0) 
        : `${formatNumber(tvlTon || 0, 1)} TON`,
      color: 'var(--color-primary)',
      isToggle: true,
      toggleLabel: showTvlInUsd ? 'TON' : 'USD'
    },
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
                  {stat.isToggle && (
                    <button 
                      onClick={() => setShowTvlInUsd(!showTvlInUsd)}
                      style={{
                        padding: '2px 8px',
                        background: 'var(--color-primary-soft)',
                        border: '1px solid var(--color-primary)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}
                    >
                      {stat.toggleLabel}
                    </button>
                  )}
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
            {/* Tab Switcher */}
            <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
              <button
                className={`tab ${activeTab === 'stake' ? 'active' : ''}`}
                onClick={() => { setActiveTab('stake'); setAmount(''); }}
              >
                💎 Stake
              </button>
              <button
                className={`tab ${activeTab === 'unstake' ? 'active' : ''}`}
                onClick={() => { setActiveTab('unstake'); setAmount(''); }}
              >
                🔓 Unstake
              </button>
            </div>

            {/* Amount Input */}
            <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="input-label">
                  {activeTab === 'stake' ? 'Amount to Stake (TON)' : 'Amount to Unstake (tsTON)'}
                </span>
                <button
                  onClick={setMaxAmount}
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                  }}
                >
                  MAX
                </button>
              </div>
              <input
                type="number"
                className="input input-lg"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.1"
              />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                Available: {activeTab === 'stake'
                  ? `${formatTON(tonstakers.availableBalance)} TON`
                  : `${formatTON(tonstakers.stakedBalance)} tsTON`}
              </div>
            </div>

            {/* Unstake Mode */}
            {activeTab === 'unstake' && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <span className="input-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                  Unstake Mode
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[
                    { mode: 'standard' as const, label: 'Standard', desc: 'Wait for round end' },
                    { mode: 'instant' as const, label: 'Instant', desc: 'Immediate (if liquidity)' },
                    { mode: 'bestRate' as const, label: 'Best Rate', desc: 'Max exchange rate' },
                  ].map((opt) => (
                    <button
                      key={opt.mode}
                      onClick={() => setUnstakeMode(opt.mode)}
                      style={{
                        flex: 1,
                        padding: 'var(--space-3)',
                        background: unstakeMode === opt.mode ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                        border: `1px solid ${unstakeMode === opt.mode ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {amountNum > 0 && (
              <div style={{
                padding: 'var(--space-4)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>You {activeTab}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {amount} {activeTab === 'stake' ? 'TON' : 'tsTON'}
                  </span>
                </div>
                {activeTab === 'stake' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>You receive (est.)</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                        ~{(amountNum / (tonstakers.rates?.tsTONTON || 1.067)).toFixed(4)} tsTON
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Network fee</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>~1 TON</span>
                    </div>
                  </>
                )}
                {activeTab === 'unstake' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>You receive (est.)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                      ~{(amountNum * (tonstakers.rates?.tsTONTON || 1.067)).toFixed(4)} TON
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            <button
              className={`btn ${activeTab === 'stake' ? 'btn-accent' : 'btn-primary'} btn-lg btn-full`}
              onClick={activeTab === 'stake' ? handleStake : handleUnstake}
              disabled={amountNum <= 0 || processing}
            >
              {processing ? (
                <><span className="animate-spin">⚡</span> Processing...</>
              ) : activeTab === 'stake' ? (
                '💎 Stake TON → tsTON'
              ) : (
                '🔓 Unstake tsTON → TON'
              )}
            </button>
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
                    {tonstakers.rates?.tsTONTON?.toFixed(4) || '—'} TON
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>1 TON</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    ${tonstakers.rates?.TONUSD?.toFixed(2) || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span>Projected 1 tsTON</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-success)' }}>
                    {tonstakers.rates?.tsTONTONProjected?.toFixed(4) || '—'} TON
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
                <div>1️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Stake TON</strong> — Your TON is delegated to validators</div>
                <div>2️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Receive tsTON</strong> — A liquid token that grows in value</div>
                <div>3️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Earn Yield</strong> — tsTON/TON rate increases over time</div>
                <div>4️⃣ <strong style={{ color: 'var(--color-text-primary)' }}>Unstake Anytime</strong> — Redeem tsTON for TON + rewards</div>
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
    </motion.div>
  );
};
