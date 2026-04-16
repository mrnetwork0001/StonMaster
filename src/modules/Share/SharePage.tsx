import React, { useState, useEffect, useMemo } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassModal } from '../../components/common/GlassModal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useParams, useNavigate } from 'react-router-dom';
import { createShortLink, getShortLink } from '../../services/supabase';
import { useRfq } from '@ston-fi/omniston-sdk-react';
import { formatJettonAmount } from '../../utils/formatters';
import { DEFAULT_TOKENS, TON_NATIVE_ADDRESS } from '../../utils/constants';
import { fetchJettonMetadata } from '../../services/tonapi';
import { tonToNano, nanoToTon } from '../../utils/formatters';

// Populated from DEFAULT_TOKENS constant

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export const SharePage: React.FC = () => {
  const address = useTonAddress();
  const { id } = useParams();
  const navigate = useNavigate();
  const [tonConnectUI] = useTonConnectUI();

  const [isLoadingDb, setIsLoadingDb] = useState(!!id);
  const [dbError, setDbError] = useState<string | null>(null);

  const [fromToken, setFromToken] = useState<any>(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState<any>(DEFAULT_TOKENS[1]);
  const [amount, setAmount] = useState('');
  const [referrer, setReferrer] = useState<string | null>(null);
  
  // Modal states
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
    type: 'info' | 'confirm' | 'success' | 'error';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    content: null,
    type: 'info'
  });

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Custom Token Support
  const [customTokens, setCustomTokens] = useState<typeof DEFAULT_TOKENS>([]);
  const [searchAddress, setSearchAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Combined token list
  const allFromTokens = useMemo(() => {
    const base = [...DEFAULT_TOKENS, ...customTokens];
    return base.filter(t => t.address !== toToken.address);
  }, [toToken, customTokens]);

  const allToTokens = useMemo(() => {
    const base = [...DEFAULT_TOKENS, ...customTokens];
    return base.filter(t => t.address !== fromToken.address);
  }, [fromToken, customTokens]);

  // Discovery logic
  useEffect(() => {
    const search = async () => {
      if (searchAddress.length < 40) return;
      
      const exists = [...DEFAULT_TOKENS, ...customTokens].find(t => t.address === searchAddress);
      if (exists) return;

      setIsSearching(true);
      try {
        const meta = await fetchJettonMetadata(searchAddress);
        if (meta) {
          setCustomTokens(prev => [...prev, { ...meta, icon: '🔵' }]);
          setSearchAddress('');
          setModal({
            isOpen: true,
            title: 'New Token Found! ✨',
            type: 'success',
            content: `Discovered ${meta.name} (${meta.symbol}). Verification: ${meta.verification}. You can now use it in your strategy.`
          });
        }
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [searchAddress, customTokens]);

  // 1. Fetch from Supabase if ID exists
  useEffect(() => {
    if (id) {
      const fetchStrategy = async () => {
        setIsLoadingDb(true);
        try {
          const strategy = await getShortLink(id);
          if (strategy) {
            const from = DEFAULT_TOKENS.find(t => t.address === strategy.from_token) || 
                         { ...DEFAULT_TOKENS[0], address: strategy.from_token, name: 'Custom Token', symbol: 'TOKEN', icon: '💎', decimals: 9 };
            const to = DEFAULT_TOKENS.find(t => t.address === strategy.to_token) || 
                       { ...DEFAULT_TOKENS[1], address: strategy.to_token, name: 'Custom Token', symbol: 'TOKEN', icon: '💰', decimals: 9 };
            
            setFromToken(from);
            setToToken(to);
            setAmount(nanoToTon(strategy.amount).toString());
            setReferrer(strategy.referrer);
          } else {
            setDbError('Strategy not found or expired.');
          }
        } catch (err) {
          setDbError('Failed to load shared strategy.');
        } finally {
          setIsLoadingDb(false);
        }
      };
      fetchStrategy();
    }
  }, [id]);

  // 2. Real-time Quote from Omniston
  const nanoAmount = fromToken.decimals === 9 ? tonToNano(parseFloat(amount) || 0) : (parseFloat(amount) * Math.pow(10, fromToken.decimals)).toString();
  
  // @ts-ignore - SDK type mismatch with parameter names
  const { data: quote, isLoading: isQuoting } = useRfq({
    sourceTokenAddress: fromToken.address,
    destinationTokenAddress: toToken.address,
    offerAmount: nanoAmount,
  } as any, {
    enabled: parseFloat(amount) > 0,
    refetchInterval: 10000,
  });

  const estimatedOutput = useMemo(() => {
    const q = quote as any;
    if (!q || (q.type !== 'quoteUpdated' && q.type !== 'quote_updated')) return '0';
    return formatJettonAmount(q.quote?.askUnits || '0', toToken.decimals);
  }, [quote, toToken]);

  const generateLink = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    setCreatingLink(true);
    try {
      const shortId = await createShortLink({
        from_token: fromToken.address,
        to_token: toToken.address,
        amount: nanoAmount,
        referrer: address || 'EQ_STONMASTER_COMMUNITY',
      });
      
      const url = `${window.location.origin}/s/${shortId}`;
      setGeneratedLink(url);
      setCopied(false);
    } catch (err) {
      console.error('Link creation failed:', err);
      alert('Failed to generate short link. Check your Supabase connection.');
    } finally {
      setCreatingLink(false);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToTelegram = () => {
    if (!generatedLink) return;
    const text = `Check out this trade strategy on StonMaster! Swap ${amount} ${fromToken.symbol} → ${toToken.symbol}`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(generatedLink)}&text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank');
  };

  const handleFollowTrade = async () => {
    if (!quote || quote.type !== 'quoteUpdated' || !address) return;
    
    setModal({
      isOpen: true,
      title: 'Confirm Swap',
      type: 'confirm',
      content: (
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 'var(--space-4)' }}>
            Are you sure you want to follow this trade strategy?
          </p>
          <div className="strategy-tokens" style={{ margin: 'var(--space-4) 0' }}>
            <div className="strategy-token">
              <strong>{amount} {fromToken.symbol}</strong>
            </div>
            <div className="strategy-arrow">→</div>
            <div className="strategy-token">
              <strong style={{ color: 'var(--color-accent)' }}>~{estimatedOutput} {toToken.symbol}</strong>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
            Route optimized by Omniston. Slippage: 3%.
          </p>
        </div>
      ),
      onConfirm: async () => {
        setCreatingLink(true);
        try {
          // @ts-ignore
          const params = await omniston.buildTransfer({
            quote: quote.quote,
            maxSlippagePps: "300", 
            referrerAddress: referrer || undefined,
            useRecommendedSlippage: false,
          });

          // @ts-ignore
          await tonConnectUI.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 120,
            messages: [{
              address: params.address?.address || "",
              amount: params.amount,
              payload: params.payload,
            }],
          });

          setModal({
            isOpen: true,
            title: 'Swap Sent! 🚀',
            type: 'success',
            content: `Your trade strategy has been broadcast to the TON network. Check your wallet for confirmation.`,
          });
        } catch (err: any) {
          console.error('Follow trade failed:', err);
          setModal({
            isOpen: true,
            title: 'Trade Failed',
            type: 'error',
            content: err.message || 'The transaction was cancelled or failed to broadcast.',
          });
        } finally {
          setCreatingLink(false);
        }
      }
    });
  };

  if (isLoadingDb) {
    return (
      <div style={{ padding: 'var(--space-20) 0', textAlign: 'center' }}>
        <LoadingSkeleton width="200px" height="40px" style={{ margin: '0 auto var(--space-4)' }} />
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading trade strategy from Supabase...</p>
      </div>
    );
  }

  if (dbError) {
    return (
      <GlassCard>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⚠️</div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Strategy Error</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>{dbError}</p>
          <button className="btn btn-primary" onClick={() => navigate('/share')}>Build Custom Strategy</button>
        </div>
      </GlassCard>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: id ? '1fr' : '1fr 400px', gap: 'var(--space-6)', alignItems: 'start', maxWidth: id ? '600px' : 'none', margin: id ? '0 auto' : '0' }}>
        
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <GlassCard glow={id ? 'accent' : null}>
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <span className={`badge ${id ? 'badge--accent' : 'badge--primary'}`}>
                {id ? 'Shared Strategy' : 'SocialSwap Builder'}
              </span>
            </div>
            
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              {id ? 'Follow This Trade' : 'Create Strategy Link'}
            </h2>
            
            {referrer && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
                Shared by {referrer.slice(0, 8)}...{referrer.slice(-4)}
              </p>
            )}

            {!id && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                Build a trade strategy and share it. They'll see real-time quotes and can execute with one click.
              </p>
            )}

            {!id ? (
              <>
                {/* From Token Section */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <div className="section-header">
                    <span className="input-label" style={{ marginBottom: 0 }}>From Token</span>
                    <div className="search-pill">
                      <input 
                        placeholder="Paste contract address..." 
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                      />
                      {isSearching && <span className="animate-spin" style={{ fontSize: '10px' }}>⏳</span>}
                    </div>
                  </div>
                  <div className="token-grid">
                    {allFromTokens.map(token => (
                      <button
                        key={token.address}
                        className={`token-btn ${fromToken.address === token.address ? 'active' : ''}`}
                        onClick={() => setFromToken(token)}
                      >
                        <span style={{ fontSize: '1.2rem' }}>{token.icon || '💎'}</span>
                        <span>{token.symbol}</span>
                        {token.verification === 'whitelist' && <span style={{ color: 'var(--color-success)', fontSize: '10px' }}>✓</span>}
                        {token.verification === 'none' && token.address !== TON_NATIVE_ADDRESS && <span style={{ opacity: 0.5, fontSize: '10px' }}>⚠️</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* To Token Section */}
                <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <span className="input-label">To Token</span>
                  <div className="token-grid">
                    {allToTokens.map(token => (
                      <button
                        key={token.address}
                        className={`token-btn token-btn--accent ${toToken.address === token.address ? 'active' : ''}`}
                        onClick={() => setToToken(token)}
                      >
                        <span style={{ fontSize: '1.2rem' }}>{token.icon || '💰'}</span>
                        <span>{token.symbol}</span>
                        {token.verification === 'whitelist' && <span style={{ color: 'var(--color-success)', fontSize: '10px' }}>✓</span>}
                        {token.verification === 'none' && token.address !== TON_NATIVE_ADDRESS && <span style={{ opacity: 0.5, fontSize: '10px' }}>⚠️</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <span className="input-label">Amount ({fromToken.symbol})</span>
                  <input
                    type="number"
                    className="input input-lg"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setGeneratedLink(null);
                    }}
                  />
                </div>
              </>
            ) : (
              /* Simple Summary for Shared View */
              <div className="strategy-display">
                <div className="strategy-tokens">
                  <div className="strategy-token">
                    <div style={{ fontSize: '2.5rem' }}>{fromToken.icon || '💎'}</div>
                    <div style={{ fontWeight: 600 }}>{amount}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{fromToken.symbol}</div>
                  </div>
                  <div className="strategy-arrow">→</div>
                  <div className="strategy-token">
                    <div style={{ fontSize: '2.5rem' }}>{toToken.icon || '💰'}</div>
                    <div style={{ fontWeight: 600, color: 'var(--color-accent)' }}>~{estimatedOutput}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{toToken.symbol}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Swap Preview / Quote */}
            {parseFloat(amount) > 0 && !id && (
              <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)' }}>
                <div className="strategy-tokens" style={{ margin: 'var(--space-2) 0' }}>
                  <div className="strategy-token">
                    <span style={{ fontSize: '1.5rem' }}>{fromToken.icon}</span>
                    <strong>{amount} {fromToken.symbol}</strong>
                  </div>
                  <div className="strategy-arrow">→</div>
                  <div className="strategy-token">
                    <span style={{ fontSize: '1.5rem' }}>{toToken.icon}</span>
                    <strong style={{ color: 'var(--color-accent)' }}>
                      {isQuoting ? '⏳ quoting...' : `~${estimatedOutput} ${toToken.symbol}`}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {id ? (
              <button
                className="btn btn-accent btn-lg btn-full"
                onClick={handleFollowTrade}
                disabled={isQuoting || creatingLink}
              >
                {isQuoting ? '⏳ Live Quote...' : '⚡ Follow Strategy'}
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={generateLink}
                disabled={!amount || parseFloat(amount) <= 0 || creatingLink}
              >
                {creatingLink ? '⏳ Creating ID...' : '🔗 Generate Strategy Link'}
              </button>
            )}
            
            {id && (
              <button 
                className="btn btn-ghost btn-full" 
                onClick={() => navigate('/share')}
                style={{ marginTop: 'var(--space-4)' }}
              >
                Create My Own Link
              </button>
            )}
          </GlassCard>
        </motion.div>

        {/* Share Panel (Only for builder) */}
        {!id && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <GlassCard glow={generatedLink ? 'blue' : null}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                  Share Your Strategy
                </h3>

                <AnimatePresence>
                  {generatedLink ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="share-link-box" onClick={copyLink}>
                        <span className="share-link-text">{generatedLink}</span>
                        <button className="btn btn-ghost btn-sm">{copied ? '✅' : '📋'}</button>
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                        <button className="btn btn-primary btn-full" onClick={copyLink}>
                          {copied ? '✅ Copied!' : '📋 Copy Link'}
                        </button>
                        <button className="btn btn-accent btn-full" onClick={shareToTelegram}>
                          📱 Telegram
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                      Configure your strategy and generate a short link to share with your referral ID.
                    </div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Stats Card */}
              <GlassCard>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                  Referral System (via Supabase)
                </h4>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
                  By using short links, your wallet address is permanently mapped to the code. 
                  Incoming traders will use your address as the <code>referrerAddress</code> in Omniston swaps.
                </p>
              </GlassCard>
            </div>
          </motion.div>
        )}
      </div>

      {/* Shared Custom Modal */}
      <GlassModal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        type={modal.type}
        onConfirm={modal.onConfirm}
        isLoading={creatingLink}
        confirmLabel={modal.type === 'confirm' ? 'Confirm Trade' : 'Got it'}
      >
        {modal.content}
      </GlassModal>

      <style>{`
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }

        .search-pill {
          display: flex;
          align-items: center;
          background: var(--color-bg);
          box-shadow: var(--neu-inset-sm);
          border-radius: var(--radius-full);
          padding: 4px 16px;
          transition: all 300ms ease-out;
        }

        .search-pill:focus-within {
          box-shadow: var(--neu-inset);
        }

        .search-pill input {
          background: none;
          border: none;
          color: var(--color-fg);
          font-family: var(--font-mono);
          font-size: 11px;
          outline: none;
          width: 140px;
          padding: 4px 0;
        }

        .search-pill input::placeholder {
          color: var(--color-placeholder);
          font-style: italic;
          font-family: var(--font-sans);
        }

        .share-link-box {
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          cursor: pointer;
          background: var(--color-bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--neu-inset-sm);
          transition: all 300ms ease-out;
          border: none;
        }

        .share-link-box:hover {
          box-shadow: var(--neu-inset);
        }

        .share-link-text {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-accent);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </motion.div>
  );
};
