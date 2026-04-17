import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassModal } from '../../components/common/GlassModal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useParams, useNavigate } from 'react-router-dom';
import { Address, Cell } from '@ton/core';
import { createShortLink, getShortLink } from '../../services/supabase';
import { useRfq, useOmniston } from '@ston-fi/omniston-sdk-react';
import { useWallet } from '../../hooks/useWallet';
import { formatJettonAmount } from '../../utils/formatters';
import { DEFAULT_TOKENS, TON_NATIVE_ADDRESS } from '../../utils/constants';
import type { Token } from '../../utils/constants';
import { fetchJettonMetadata } from '../../services/tonapi';
import { tonToNano, nanoToTon } from '../../utils/formatters';

// Populated from DEFAULT_TOKENS constant

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export const SharePage: React.FC = () => {
  const { address, sender } = useWallet();
  const { id } = useParams();
  const navigate = useNavigate();
  const omniston = useOmniston();

  const [isLoadingDb, setIsLoadingDb] = useState(!!id);
  const [dbError, setDbError] = useState<string | null>(null);

  const [fromToken, setFromToken] = useState<Token>(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(DEFAULT_TOKENS[1]);
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
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [toDropdownOpen, setToDropdownOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState<'from' | 'to' | null>(null);

  // Combined token list
  const allFromTokens = useMemo(() => {
    const base = [...DEFAULT_TOKENS, ...customTokens];
    return base.filter(t => t.address !== toToken.address);
  }, [toToken, customTokens]);

  const allToTokens = useMemo(() => {
    const base = [...DEFAULT_TOKENS, ...customTokens];
    return base.filter(t => t.address !== fromToken.address);
  }, [fromToken, customTokens]);
  // Pending token for confirmation
  const [pendingToken, setPendingToken] = useState<(typeof DEFAULT_TOKENS)[0] | null>(null);

  // Discovery logic
  useEffect(() => {
    const search = async () => {
      if (searchAddress.length < 40) return;
      
      const exists = [...DEFAULT_TOKENS, ...customTokens].find(t => t.address === searchAddress);
      if (exists) {
        // Token already in list — auto-select it
        if (showCustomInput === 'from') setFromToken(exists);
        if (showCustomInput === 'to') setToToken(exists);
        setSearchAddress('');
        setShowCustomInput(null);
        return;
      }

      setIsSearching(true);
      try {
        const meta = await fetchJettonMetadata(searchAddress);
        if (meta) {
          const tokenWithIcon = { ...meta, icon: '🔵' } as (typeof DEFAULT_TOKENS)[0];
          setPendingToken(tokenWithIcon);
          setModal({
            isOpen: true,
            title: 'Token Found 🔍',
            type: 'confirm',
            content: (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--neu-inset-sm)' }}>
                  <span style={{ fontSize: '2rem' }}>🔵</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{meta.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{meta.symbol}</div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
                  <strong>Verification:</strong>{' '}
                  <span style={{ color: meta.verification === 'whitelist' ? 'var(--color-accent-secondary)' : 'var(--color-warning)' }}>
                    {meta.verification === 'whitelist' ? '✅ Verified' : '⚠️ Unverified'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginBottom: 'var(--space-3)' }}>
                  {searchAddress}
                </div>
                {meta.verification !== 'whitelist' && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-warning-soft)', borderRadius: 'var(--radius-sm)' }}>
                    ⚠️ This token is not verified. Trade at your own risk.
                  </div>
                )}
              </div>
            ),
            onConfirm: () => {
              setCustomTokens(prev => [...prev, tokenWithIcon]);
              if (showCustomInput === 'from') setFromToken(tokenWithIcon);
              if (showCustomInput === 'to') setToToken(tokenWithIcon);
              setSearchAddress('');
              setShowCustomInput(null);
              setPendingToken(null);
              setModal({
                isOpen: true,
                title: 'Token Added ✅',
                type: 'success',
                content: `${meta.name} (${meta.symbol}) has been added to your token list.`,
              });
            },
          });
        } else {
          setModal({
            isOpen: true,
            title: 'Token Not Found',
            type: 'error',
            content: 'Could not find a valid jetton at this address. Please check and try again.',
          });
        }
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [searchAddress, customTokens, showCustomInput]);

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
  
  const { data: quote, isLoading: isQuoting } = useRfq({
    bidAssetAddress: fromToken.address,
    askAssetAddress: toToken.address,
    amount: { unit: nanoAmount },
  } as any, {
    enabled: parseFloat(amount) > 0,
  });

  const estimatedOutput = useMemo(() => {
    const q = quote as any;
    if (q) console.log('[SocialSwap] Raw quote:', JSON.stringify(q, null, 2));
    if (!q) return null;
    // Handle both possible event types
    if (q.type === 'quoteUpdated' || q.type === 'quote_updated') {
      const askUnits = q.quote?.askUnits || q.quote?.ask_units;
      if (askUnits) return formatJettonAmount(askUnits, toToken.decimals);
    }
    // If the quote itself is a Quote object (no wrapping event)
    if (q.askUnits || q.ask_units) {
      return formatJettonAmount(q.askUnits || q.ask_units, toToken.decimals);
    }
    return null;
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
          const tx = await omniston.buildTransfer({
            sourceAddress: { blockchain: 607, address: address! },
            destinationAddress: { blockchain: 607, address: address! },
            quote: (quote as any).quote,
            useRecommendedSlippage: true,
          });

          if (!tx.ton || !tx.ton.messages.length) {
            throw new Error('No TON messages generated for this swap');
          }

          const message = tx.ton.messages[0];

          await sender.send({
            to: Address.parse(message.targetAddress),
            value: BigInt(message.sendAmount),
            body: Cell.fromBoc(Buffer.from(message.payload, 'base64'))[0],
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
      <div className={id ? 'page-single-col' : 'page-two-col'}>
        
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
                {/* From Token Dropdown */}
                <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <span className="input-label">From Token</span>
                  <div className="token-dropdown-wrapper">
                    <button
                      className="token-dropdown-trigger"
                      onClick={() => { setFromDropdownOpen(!fromDropdownOpen); setToDropdownOpen(false); }}
                    >
                      <span className="token-dropdown-selected">
                        <span style={{ fontSize: '1.2rem' }}>{fromToken.icon || '💎'}</span>
                        <span className="token-dropdown-name">{fromToken.symbol}</span>
                        {fromToken.verification === 'whitelist' && <span className="token-verified-badge">✓</span>}
                        {fromToken.verification === 'none' && fromToken.address !== TON_NATIVE_ADDRESS && <span className="token-unverified-badge">⚠️</span>}
                      </span>
                      <span className={`token-dropdown-arrow ${fromDropdownOpen ? 'open' : ''}`}>▾</span>
                    </button>

                    {fromDropdownOpen && (
                      <div className="token-dropdown-menu">
                        {allFromTokens.map(token => (
                          <button
                            key={token.address}
                            className={`token-dropdown-item ${fromToken.address === token.address ? 'active' : ''}`}
                            onClick={() => { setFromToken(token); setFromDropdownOpen(false); }}
                          >
                            <span style={{ fontSize: '1.1rem' }}>{token.icon || '💎'}</span>
                            <span className="token-dropdown-item-name">{token.name}</span>
                            <span className="token-dropdown-item-symbol">{token.symbol}</span>
                            {token.verification === 'whitelist' && <span className="token-verified-badge">✓</span>}
                            {token.verification === 'none' && token.address !== TON_NATIVE_ADDRESS && <span className="token-unverified-badge">⚠️</span>}
                          </button>
                        ))}
                        <button
                          className="token-dropdown-item token-dropdown-custom"
                          onClick={() => { setShowCustomInput('from'); setFromDropdownOpen(false); }}
                        >
                          <span style={{ fontSize: '1.1rem' }}>📋</span>
                          <span className="token-dropdown-item-name">Paste contract address</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {showCustomInput === 'from' && (
                    <div className="token-custom-input-row">
                      <input
                        className="input"
                        placeholder="EQ... or 0:... contract address"
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                        autoFocus
                      />
                      {isSearching && <span style={{ fontSize: '12px' }}>⏳</span>}
                      <button className="btn btn-sm btn-ghost" onClick={() => { setShowCustomInput(null); setSearchAddress(''); }}>✕</button>
                    </div>
                  )}
                </div>

                {/* To Token Dropdown */}
                <div className="input-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <span className="input-label">To Token</span>
                  <div className="token-dropdown-wrapper">
                    <button
                      className="token-dropdown-trigger"
                      onClick={() => { setToDropdownOpen(!toDropdownOpen); setFromDropdownOpen(false); }}
                    >
                      <span className="token-dropdown-selected">
                        <span style={{ fontSize: '1.2rem' }}>{toToken.icon || '💰'}</span>
                        <span className="token-dropdown-name">{toToken.symbol}</span>
                        {toToken.verification === 'whitelist' && <span className="token-verified-badge">✓</span>}
                        {toToken.verification === 'none' && toToken.address !== TON_NATIVE_ADDRESS && <span className="token-unverified-badge">⚠️</span>}
                      </span>
                      <span className={`token-dropdown-arrow ${toDropdownOpen ? 'open' : ''}`}>▾</span>
                    </button>

                    {toDropdownOpen && (
                      <div className="token-dropdown-menu">
                        {allToTokens.map(token => (
                          <button
                            key={token.address}
                            className={`token-dropdown-item ${toToken.address === token.address ? 'active' : ''}`}
                            onClick={() => { setToToken(token); setToDropdownOpen(false); }}
                          >
                            <span style={{ fontSize: '1.1rem' }}>{token.icon || '💰'}</span>
                            <span className="token-dropdown-item-name">{token.name}</span>
                            <span className="token-dropdown-item-symbol">{token.symbol}</span>
                            {token.verification === 'whitelist' && <span className="token-verified-badge">✓</span>}
                            {token.verification === 'none' && token.address !== TON_NATIVE_ADDRESS && <span className="token-unverified-badge">⚠️</span>}
                          </button>
                        ))}
                        <button
                          className="token-dropdown-item token-dropdown-custom"
                          onClick={() => { setShowCustomInput('to'); setToDropdownOpen(false); }}
                        >
                          <span style={{ fontSize: '1.1rem' }}>📋</span>
                          <span className="token-dropdown-item-name">Paste contract address</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {showCustomInput === 'to' && (
                    <div className="token-custom-input-row">
                      <input
                        className="input"
                        placeholder="EQ... or 0:... contract address"
                        value={searchAddress}
                        onChange={(e) => setSearchAddress(e.target.value)}
                        autoFocus
                      />
                      {isSearching && <span style={{ fontSize: '12px' }}>⏳</span>}
                      <button className="btn btn-sm btn-ghost" onClick={() => { setShowCustomInput(null); setSearchAddress(''); }}>✕</button>
                    </div>
                  )}
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
              <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', boxShadow: 'var(--neu-inset-sm)' }}>
                <div className="strategy-tokens" style={{ margin: 'var(--space-2) 0' }}>
                  <div className="strategy-token">
                    <span style={{ fontSize: '1.5rem' }}>{fromToken.icon}</span>
                    <strong>{amount} {fromToken.symbol}</strong>
                  </div>
                  <div className="strategy-arrow">→</div>
                  <div className="strategy-token">
                    <span style={{ fontSize: '1.5rem' }}>{toToken.icon}</span>
                    <strong style={{ color: estimatedOutput ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                      {isQuoting
                        ? '⏳ Fetching quote...'
                        : estimatedOutput
                          ? `~${estimatedOutput} ${toToken.symbol}`
                          : '⚠️ Quote unavailable'}
                    </strong>
                  </div>
                </div>
                {!isQuoting && !estimatedOutput && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
                    Omniston API may be temporarily down. You can still generate a strategy link — the recipient will get a live quote when they open it.
                  </p>
                )}
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
        confirmLabel={modal.type === 'confirm' ? (pendingToken ? '✅ Add to My List' : 'Confirm Trade') : 'Got it'}
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

        /* Token Dropdown */
        .token-dropdown-wrapper {
          position: relative;
        }

        .token-dropdown-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg);
          border-radius: var(--radius-md);
          box-shadow: var(--neu-inset);
          border: none;
          cursor: pointer;
          transition: all 300ms ease-out;
          font-family: var(--font-sans);
          font-size: var(--text-base);
          color: var(--color-fg);
          min-height: 48px;
        }

        .token-dropdown-trigger:hover {
          box-shadow: var(--neu-inset-deep);
        }

        .token-dropdown-selected {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .token-dropdown-name {
          font-weight: 600;
          font-size: var(--text-base);
        }

        .token-dropdown-arrow {
          font-size: var(--text-sm);
          color: var(--color-muted);
          transition: transform 300ms ease-out;
        }

        .token-dropdown-arrow.open {
          transform: rotate(180deg);
        }

        .token-dropdown-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: var(--color-bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--neu-extruded-hover);
          z-index: 50;
          max-height: 280px;
          overflow-y: auto;
          padding: var(--space-2);
        }

        .token-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 200ms ease-out;
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          color: var(--color-fg);
          text-align: left;
        }

        .token-dropdown-item:hover {
          background: var(--color-bg);
          box-shadow: var(--neu-inset-sm);
        }

        .token-dropdown-item.active {
          box-shadow: var(--neu-inset);
          color: var(--color-accent);
          font-weight: 600;
        }

        .token-dropdown-item-name {
          flex: 1;
          font-weight: 500;
        }

        .token-dropdown-item-symbol {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--color-muted);
        }

        .token-dropdown-custom {
          border-top: 1px solid rgba(163, 177, 198, 0.2);
          margin-top: var(--space-1);
          padding-top: var(--space-3);
          color: var(--color-accent);
        }

        .token-dropdown-custom:hover {
          color: var(--color-accent-light);
        }

        .token-verified-badge {
          color: var(--color-accent-secondary);
          font-size: 11px;
          font-weight: 700;
        }

        .token-unverified-badge {
          opacity: 0.5;
          font-size: 11px;
        }

        .token-custom-input-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-top: var(--space-3);
        }

        .token-custom-input-row .input {
          flex: 1;
          font-size: var(--text-sm);
          padding: var(--space-2) var(--space-3);
        }

        /* Share Links */
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
