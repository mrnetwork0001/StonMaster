import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { GlassCard } from '../../components/common/GlassCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useJettonBalances } from '../../hooks/useJettonBalances';
import type { JettonWithValue } from '../../hooks/useJettonBalances';
import { formatJettonAmount, formatUSD } from '../../utils/formatters';
import { useOmniston } from '@ston-fi/omniston-sdk-react';
import { Blockchain, SettlementMethod } from '@ston-fi/omniston-sdk';
import { useWallet } from '../../hooks/useWallet';
import { GlassModal } from '../../components/common/GlassModal';
import { TON_NATIVE_ADDRESS, TONAPI_BASE_URL, TONAPI_KEY, DEFAULT_SLIPPAGE_BPS } from '../../utils/constants';

// ─── Constants ────────────────────────────────────────────────────────────────
/** Wallet v3/v4 support max 4 outgoing messages per external tx. Wallet v5 supports up to 255. */
const BATCH_SIZE = 4;
/** How long to wait between polling attempts (ms) */
const POLL_INTERVAL = 2500;
/** Max time to wait for on-chain confirmation before timing out (ms) */
const CONFIRMATION_TIMEOUT = 60_000;

// ─── Types ────────────────────────────────────────────────────────────────────
type StepStatus = 'pending' | 'quoting' | 'building' | 'sending' | 'confirming' | 'done' | 'error';
type SweepStatus = 'idle' | 'quoting' | 'sending' | 'confirming' | 'done';

interface SweepStep {
  jetton: JettonWithValue;
  status: StepStatus;
  error?: string;
}

interface TcMessage {
  address: string;
  amount: string;
  payload: string; // base64 cell
}

interface PreparedMessage {
  idx: number;
  msg: TcMessage;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

// ─── Step status icon map ─────────────────────────────────────────────────────
function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'quoting':    return <span className="animate-spin" style={{ fontSize: '1em' }}>🔍</span>;
    case 'building':   return <span className="animate-spin" style={{ fontSize: '1em' }}>📦</span>;
    case 'sending':    return <span className="animate-spin" style={{ fontSize: '1em' }}>✍️</span>;
    case 'confirming': return <span className="animate-spin" style={{ fontSize: '1em' }}>🔄</span>;
    case 'done':       return <>✅</>;
    case 'error':      return <>❌</>;
    default:           return <>⏳</>;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export const SweepPage: React.FC = () => {
  const { address } = useWallet();
  const [tonConnectUI] = useTonConnectUI();
  const omniston = useOmniston();
  const { jettons, dustJettons, totalDustValue, loading, refresh } = useJettonBalances();

  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [sweepStatus, setSweepStatus]   = useState<SweepStatus>('idle');
  const [sweepSteps, setSweepSteps]     = useState<SweepStep[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  const hasAutoSelected = useRef(false);

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
    type: 'info' | 'success' | 'error';
  }>({ isOpen: false, title: '', content: null, type: 'info' });

  // ─── Auto-select dust ONCE on first load ─────────────────────────────────
  React.useEffect(() => {
    if (dustJettons.length > 0 && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      setSelected(new Set(dustJettons.map(j => j.jetton.address)));
    }
  }, [dustJettons]);

  // ─── Selection helpers ────────────────────────────────────────────────────
  const selectedJettons = useMemo(
    () => jettons.filter(j => selected.has(j.jetton.address)),
    [jettons, selected]
  );
  const selectedTotalValue = useMemo(
    () => selectedJettons.reduce((sum, j) => sum + j.usdValue, 0),
    [selectedJettons]
  );
  const toggleSelect  = (addr: string) => setSelected(prev => { const n = new Set(prev); n.has(addr) ? n.delete(addr) : n.add(addr); return n; });
  const selectAllDust = () => setSelected(new Set(dustJettons.map(j => j.jetton.address)));
  const selectAll     = () => setSelected(new Set(jettons.map(j => j.jetton.address)));
  const clearSelection = () => setSelected(new Set());

  // ─── TonAPI helpers ───────────────────────────────────────────────────────
  const apiHeaders = useCallback((): Record<string, string> => {
    if (TONAPI_KEY && TONAPI_KEY !== 'mock_tonapi_key_replace_me')
      return { Authorization: `Bearer ${TONAPI_KEY}` };
    return {};
  }, []);

  /** Returns the logical time (lt) of the most recent tx for the wallet, used as a sync point for polling. */
  const getLatestTxLt = useCallback(async (): Promise<string | null> => {
    if (!address) return null;
    try {
      const r = await fetch(
        `${TONAPI_BASE_URL}/blockchain/accounts/${address}/transactions?limit=1`,
        { headers: apiHeaders() }
      );
      if (!r.ok) return null;
      const d = await r.json();
      return d.transactions?.[0]?.lt?.toString() ?? null;
    } catch { return null; }
  }, [address, apiHeaders]);

  /** Poll TonAPI until a new tx with a different lt appears, or the timeout is reached. */
  const pollForConfirmation = useCallback(async (prevLt: string | null): Promise<boolean> => {
    const deadline = Date.now() + CONFIRMATION_TIMEOUT;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      const lt = await getLatestTxLt();
      if (lt !== null && lt !== prevLt) return true;
    }
    return false;
  }, [getLatestTxLt]);

  // ─── Omniston helpers ─────────────────────────────────────────────────────
  /** Fetch a swap quote from Omniston using the correct SDK field names.
   *
   * Verified against actual SDK source:
   *   - bidAssetAddress = token being sold   (NOT offerAssetAddress)
   *   - askAssetAddress = token being bought
   *   - blockchain: Blockchain.TON = 607    (NOT the string 'TON')
   *   - amount.bidUnits                     (NOT offerUnits)
   *   - settlementMethods: [SettlementMethod.SETTLEMENT_METHOD_SWAP]
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getQuote = useCallback((jetton: JettonWithValue): Promise<any> =>
    new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = (omniston as any).requestForQuote({
        settlementMethods: [SettlementMethod.SETTLEMENT_METHOD_SWAP],
        bidAssetAddress: { blockchain: Blockchain.TON, address: jetton.jetton.address },
        askAssetAddress: { blockchain: Blockchain.TON, address: TON_NATIVE_ADDRESS },
        amount: { bidUnits: jetton.balance }, // bidUnits = amount of token being sold
        settlementParams: { maxPriceSlippageBps: DEFAULT_SLIPPAGE_BPS },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }).subscribe({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        next: (event: any) => {
          if (event.type === 'quoteUpdated') {
            sub.unsubscribe();
            resolve(event.quote); // event = { type, quote } — pass the quote object directly
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: (e: any) => reject(e),
      });
      setTimeout(() => {
        sub.unsubscribe();
        reject(new Error('No route found (quote timeout). Token may lack sufficient liquidity.'));
      }, 12_000);
    }), [omniston]);

  /** Build a TonConnect message from an Omniston quote. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildTonMessage = useCallback(async (quote: any, addr: string): Promise<TcMessage> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (omniston as any).buildTransfer({
      quote,
      sourceAddress:        { blockchain: Blockchain.TON, address: addr },
      destinationAddress:   { blockchain: Blockchain.TON, address: addr },
      refundAddress:        { blockchain: Blockchain.TON, address: addr },
      excessAddress:        { blockchain: Blockchain.TON, address: addr },
      useRecommendedSlippage: true, // required by Omniston SDK
    });
    if (!tx?.ton?.messages?.length) throw new Error('No messages returned — token may not be swappable');
    const msg = tx.ton.messages[0];
    return { address: msg.targetAddress, amount: msg.sendAmount, payload: msg.payload };
  }, [omniston]);

  // ─── Main sweep handler ───────────────────────────────────────────────────
  const startSweep = async () => {
    if (selectedJettons.length === 0 || !address || !tonConnectUI) return;

    const initialSteps: SweepStep[] = selectedJettons.map(j => ({ jetton: j, status: 'pending' }));
    setSweepSteps(initialSteps);
    setSweepStatus('quoting');
    setStatusMessage(`Getting best routes for ${selectedJettons.length} token${selectedJettons.length > 1 ? 's' : ''}…`);

    // ── Phase 1: Fetch all quotes in parallel ──────────────────────────────
    const updateStep = (i: number, patch: Partial<SweepStep>) =>
      setSweepSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

    selectedJettons.forEach((_, i) => updateStep(i, { status: 'quoting' }));

    const quoteResults = await Promise.allSettled(
      selectedJettons.map(async (jetton, i) => {
        try {
          const quote = await getQuote(jetton);
          updateStep(i, { status: 'building' });
          return { quote, idx: i };
        } catch (e) {
          updateStep(i, { status: 'error', error: e instanceof Error ? e.message : 'Quote failed' });
          throw e;
        }
      })
    );

    // ── Phase 2: Build TonConnect messages for successful quotes ───────────
    setSweepStatus('sending');
    setStatusMessage('Building swap transactions…');

    const msgResults = await Promise.allSettled(
      quoteResults.map(async (r, i) => {
        if (r.status === 'rejected') throw r.reason; // already error-marked above
        try {
          const msg = await buildTonMessage(r.value.quote, address);
          return { msg, idx: i } as PreparedMessage;
        } catch (e) {
          updateStep(i, { status: 'error', error: e instanceof Error ? e.message : 'Build failed' });
          throw e;
        }
      })
    );

    const readyMessages: PreparedMessage[] = msgResults
      .filter((r): r is PromiseFulfilledResult<PreparedMessage> => r.status === 'fulfilled')
      .map(r => r.value);

    if (readyMessages.length === 0) {
      setSweepStatus('done');
      setModal({ isOpen: true, title: '❌ No Routes Found', type: 'error',
        content: <p>None of the selected tokens could be routed through Omniston. They may have insufficient liquidity on TON DEXes.</p>
      });
      return;
    }

    // ── Phase 3: Chunk into groups of BATCH_SIZE and send each as one tx ───
    const batches: PreparedMessage[][] = [];
    for (let i = 0; i < readyMessages.length; i += BATCH_SIZE) {
      batches.push(readyMessages.slice(i, i + BATCH_SIZE));
    }

    const successIdxs: number[] = [];
    const batchCount = batches.length;

    for (let b = 0; b < batchCount; b++) {
      const batch = batches[b];
      const batchLabel = batchCount > 1 ? ` (batch ${b + 1}/${batchCount})` : '';

      // Capture current lt BEFORE sending so we can detect the new tx
      const preSendLt = await getLatestTxLt();

      setStatusMessage(`Sign the transaction in your wallet${batchLabel}…`);
      batch.forEach(({ idx }) => updateStep(idx, { status: 'sending' }));

      try {
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: batch.map(({ msg }) => ({
            address: msg.address,
            amount:  msg.amount,
            payload: msg.payload,
          })),
        });

        // ── Phase 4: Poll for on-chain confirmation ────────────────────────
        setSweepStatus('confirming');
        setStatusMessage(`Confirming on TON blockchain${batchLabel}…`);
        batch.forEach(({ idx }) => updateStep(idx, { status: 'confirming' }));

        const confirmed = await pollForConfirmation(preSendLt);

        batch.forEach(({ idx }) => {
          if (confirmed) {
            updateStep(idx, { status: 'done' });
          } else {
            // tx was submitted but we timed out waiting — mark done with note
            updateStep(idx, { status: 'done', error: 'Submitted (confirmation timed out — check wallet)' });
          }
          successIdxs.push(idx);
        });

      } catch {
        // User cancelled wallet popup or sendTransaction threw
        batch.forEach(({ idx }) => updateStep(idx, { status: 'error', error: 'Transaction rejected or cancelled' }));
      }
    }

    // ── Phase 5: Show final summary ────────────────────────────────────────
    setSweepStatus('done');
    setStatusMessage('');

    const totalSelected = selectedJettons.length;
    const successCount  = successIdxs.length;
    const failCount     = totalSelected - successCount;

    setModal({
      isOpen: true,
      title: successCount > 0 ? '🧹 Sweep Complete!' : '❌ Sweep Failed',
      type: successCount > 0 ? 'success' : 'error',
      content: (
        <div>
          <p>Sweeping process has finished.</p>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Successfully swept:</span>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{successCount} token{successCount !== 1 ? 's' : ''}</span>
            </div>
            {failCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Failed / No route:</span>
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{failCount} token{failCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {batchCount > 1 && (
              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                Sent in {batchCount} batches (wallet limit: {BATCH_SIZE} tokens per transaction)
              </div>
            )}
          </div>
        </div>
      ),
    });
  };

  // ─── Layout guards ────────────────────────────────────────────────────────
  if (!address) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard>
          <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🧹</div>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>StonSweep</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Connect your wallet to scan for dust tokens and sweep them into TON.
            </p>
            <span className="badge badge--warning">Connect wallet above ☝️</span>
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  const isBusy = sweepStatus === 'quoting' || sweepStatus === 'sending' || sweepStatus === 'confirming';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Header */}
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
              <button className="btn btn-ghost btn-sm" onClick={() => { hasAutoSelected.current = false; refresh(); }} disabled={loading || isBusy}>
                {loading ? '⏳' : '🔄'} Refresh
              </button>
              <button className="btn btn-ghost btn-sm" onClick={selectAllDust} disabled={isBusy}>Select Dust</button>
              <button className="btn btn-ghost btn-sm" onClick={selectAll} disabled={isBusy}>Select All</button>
              {selected.size > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={isBusy}>Clear</button>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <div className="page-two-col page-two-col--narrow">
        {/* Token list */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <GlassCard style={{ padding: 'var(--space-4)' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                {Array.from({ length: 5 }).map((_, i) => <LoadingSkeleton key={i} height="60px" />)}
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
                      onClick={() => !isBusy && toggleSelect(jetton.jetton.address)}
                      style={{ cursor: isBusy ? 'default' : 'pointer' }}
                    >
                      <div className={`jetton-checkbox ${selected.has(jetton.jetton.address) ? 'checked' : ''}`}>
                        {selected.has(jetton.jetton.address) && '✓'}
                      </div>
                      <div className="jetton-icon">{jetton.jetton.symbol?.slice(0, 2) || '??'}</div>
                      <div className="jetton-info">
                        <div className="jetton-name">{jetton.jetton.name}</div>
                        <div className="jetton-symbol">{jetton.jetton.symbol}</div>
                      </div>
                      {jetton.isDust && <span className="jetton-dust-badge">DUST</span>}
                      <div className="jetton-balance">
                        <div className="jetton-amount">{formatJettonAmount(jetton.balance, jetton.jetton.decimals)}</div>
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

            {/* Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              {[
                { label: 'Selected tokens', value: selected.size.toString() },
                { label: 'Estimated value', value: formatUSD(selectedTotalValue), accent: true },
                { label: 'Slippage tolerance', value: '3%' },
                { label: 'Route optimizer', badge: 'Omniston' },
                { label: 'Confirmations', value: `${Math.ceil(selectedJettons.length / BATCH_SIZE)} wallet signature${Math.ceil(selectedJettons.length / BATCH_SIZE) !== 1 ? 's' : ''}` },
              ].map(({ label, value, badge, accent }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                  {badge
                    ? <span className="badge badge--accent" style={{ fontSize: '10px' }}>{badge}</span>
                    : <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: accent ? 'var(--color-accent)' : undefined }}>{value}</span>
                  }
                </div>
              ))}
            </div>

            {/* Idle → show Sweep button */}
            {sweepStatus === 'idle' && (
              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={startSweep}
                disabled={selected.size === 0}
              >
                🧹 Sweep {selected.size} Token{selected.size !== 1 ? 's' : ''} → TON
              </button>
            )}

            {/* Active sweep → show progress */}
            {(isBusy || sweepStatus === 'done') && (
              <div className="sweep-progress">
                {/* Phase banner */}
                {statusMessage && (
                  <div style={{
                    marginBottom: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-primary-soft)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-primary)',
                    textAlign: 'center',
                    fontWeight: 500,
                  }}>
                    {sweepStatus === 'confirming' && <span className="animate-spin" style={{ marginRight: 4 }}>🔄</span>}
                    {statusMessage}
                  </div>
                )}

                {/* Progress bar */}
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(sweepSteps.filter(s => s.status === 'done' || s.status === 'error').length / Math.max(sweepSteps.length, 1)) * 100}%`,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
                    {sweepStatus === 'done'
                      ? `✅ ${sweepSteps.filter(s => s.status === 'done').length} of ${sweepSteps.length} swept`
                      : `${sweepSteps.filter(s => s.status === 'done' || s.status === 'error').length} / ${sweepSteps.length} processed`
                    }
                  </div>
                </div>

                {/* Per-token step list */}
                {sweepSteps.map(step => (
                  <div key={step.jetton.jetton.address} className={`sweep-step sweep-step--${step.status}`}>
                    <div className="sweep-step-icon">
                      <StepIcon status={step.status} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{step.jetton.jetton.symbol}</div>
                      {step.error && (
                        <div style={{ fontSize: 'var(--text-xs)', color: step.status === 'done' ? 'var(--color-text-tertiary)' : 'var(--color-danger)' }}>
                          {step.error}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      {formatUSD(step.jetton.usdValue)}
                    </div>
                  </div>
                ))}

                {/* Done → Scan Again */}
                {sweepStatus === 'done' && (
                  <button
                    className="btn btn-accent btn-full"
                    onClick={() => {
                      setSweepStatus('idle');
                      setSweepSteps([]);
                      setSelected(new Set());
                      hasAutoSelected.current = false;
                      refresh();
                    }}
                    style={{ marginTop: 'var(--space-4)' }}
                  >
                    🔄 Scan Again
                  </button>
                )}
              </div>
            )}

            {/* Info footer */}
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3)',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              lineHeight: 1.6,
            }}>
              💡 StonSweep uses Omniston to find the best swap routes across all TON DEXs,
              minimizing slippage on small token balances.
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
