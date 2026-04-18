import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '../../hooks/useWallet';
import { GlassCard } from '../common/GlassCard';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { WalletHealthGauge } from './WalletHealthGauge';
import { ModuleCard } from './ModuleCard';
import { useJettonBalances } from '../../hooks/useJettonBalances';
import { useTonstakers } from '../../hooks/useTonstakers';
import { formatTON, formatUSD, formatPercent, nanoToTon } from '../../utils/formatters';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export const Dashboard: React.FC = () => {
  const { address } = useWallet();
  const { tonBalance, totalDustValue, totalValue, clutterScore, dustJettons, loading } = useJettonBalances();
  const tonstakers = useTonstakers();

  const tonUsd = useMemo(() => {
    const balance = Number(tonBalance) || 0;
    const rate = tonstakers?.rates?.TONUSD || 3.2;
    return nanoToTon(balance) * rate;
  }, [tonBalance, tonstakers?.rates?.TONUSD]);

  const totalPortfolioUsd = tonUsd + (totalValue || 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome / Connect Section */}
      {!address && (
        <motion.div variants={itemVariants} style={{ marginBottom: 'var(--space-8)' }}>
          <GlassCard>
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⚡</div>
              <h2 style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 800,
                marginBottom: 'var(--space-3)',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Welcome to StonMaster
              </h2>
              <p style={{
                fontSize: 'var(--text-base)',
                color: 'var(--color-text-secondary)',
                maxWidth: '500px',
                margin: '0 auto var(--space-6)',
                lineHeight: 1.7,
              }}>
                Your all-in-one TON DeFi command center. Sweep dust tokens, maximize staking yields, and share trading strategies — all from one interface.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-warning-soft)',
                color: 'var(--color-warning)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
              }}>
                ☝️ Connect your wallet to get started
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Stats Bar */}
      {address && (
        <motion.div variants={itemVariants} style={{ marginBottom: 'var(--space-6)' }}>
          <GlassCard>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">TON Balance</span>
                {loading ? (
                  <LoadingSkeleton width="120px" height="28px" />
                ) : (
                  <span className="stat-value">
                    <AnimatedNumber
                      value={nanoToTon(Number(tonBalance))}
                      format={(v) => formatTON((v * 1e9).toString())}
                    />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                      TON
                    </span>
                  </span>
                )}
              </div>
              <div className="stat-item">
                <span className="stat-label">Portfolio Value</span>
                {loading ? (
                  <LoadingSkeleton width="120px" height="28px" />
                ) : (
                  <span className="stat-value">
                    <AnimatedNumber
                      value={totalPortfolioUsd}
                      format={(v) => formatUSD(v)}
                    />
                  </span>
                )}
              </div>
              <div className="stat-item">
                <span className="stat-label">Staked (tsTON)</span>
                {tonstakers.loading ? (
                  <LoadingSkeleton width="120px" height="28px" />
                ) : (
                  <span className="stat-value">
                    <AnimatedNumber
                      value={nanoToTon(Number(tonstakers.stakedBalance))}
                      format={(v) => formatTON((v * 1e9).toString())}
                    />
                  </span>
                )}
              </div>
              <div className="stat-item">
                <span className="stat-label">Current APY</span>
                {tonstakers.loading ? (
                  <LoadingSkeleton width="80px" height="28px" />
                ) : (
                  <span className="stat-value" style={{ color: 'var(--color-success)' }}>
                    <AnimatedNumber
                      value={tonstakers.apy}
                      format={(v) => formatPercent(v)}
                    />
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Health Gauge + Quick Actions */}
      <div className={`dashboard-grid ${address ? 'dashboard-grid--with-gauge' : ''}`}>
        {address && (
          <motion.div variants={itemVariants}>
            <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <WalletHealthGauge score={clutterScore} />
              {dustJettons.length > 0 && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  textAlign: 'center',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  {dustJettons.length} dust token{dustJettons.length !== 1 ? 's' : ''} worth {formatUSD(totalDustValue)}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <div className="module-cards-grid">
            <ModuleCard
              to="/sweep"
              variant="sweep"
              icon="🧹"
              title="StonSweep"
              description="Clean up your wallet by sweeping dust tokens into TON using the best rates from Omniston."
              cta="Start Sweeping"
              stat={dustJettons.length > 0 ? `${dustJettons.length}` : undefined}
              statLabel={dustJettons.length > 0 ? 'dust tokens' : undefined}
            />
            <ModuleCard
              to="/earn"
              variant="earn"
              icon="💎"
              title="Yield Maximizer"
              description="One-click liquid staking through Tonstakers. Earn yield while keeping your TON liquid."
              cta="Start Earning"
              stat={tonstakers.apy > 0 ? `${tonstakers.apy.toFixed(1)}%` : undefined}
              statLabel={tonstakers.apy > 0 ? 'APY' : undefined}
            />
            <ModuleCard
              to="/share"
              variant="share"
              icon="🔗"
              title="SocialSwap"
              description="Create and share trade strategy links. Let others follow your strategies with one click."
              cta="Create Strategy"
            />
          </div>
        </motion.div>
      </div>

      {/* Powered By Section */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-8)',
            flexWrap: 'wrap',
            padding: 'var(--space-2) 0',
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Powered by
            </span>
            {['STON.fi SDK', 'Omniston', 'Tonstakers', 'TonConnect'].map((sdk) => (
              <span
                key={sdk}
                className="badge badge--primary"
                style={{ fontSize: 'var(--text-xs)' }}
              >
                {sdk}
              </span>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};
