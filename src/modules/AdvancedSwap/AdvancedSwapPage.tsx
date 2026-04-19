import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRfq, useOmniston } from '@ston-fi/omniston-sdk-react';
import { Blockchain, SettlementMethod } from '@ston-fi/omniston-sdk';
import { Address, Cell } from '@ton/core';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassModal } from '../../components/common/GlassModal';
import { TokenIcon } from '../../components/common/TokenIcon';
import { AppIcon } from '../../components/common/AppIcon';
import { useWallet } from '../../hooks/useWallet';
import { useJettonBalances } from '../../hooks/useJettonBalances';
import { useTonBalance } from '../../hooks/useTonBalance';
import { DEFAULT_TOKENS, TON_NATIVE_ADDRESS } from '../../utils/constants';
import { formatJettonAmount, tonToNano, nanoToTon } from '../../utils/formatters';
import { fetchJettonMetadata } from '../../services/tonapi';
import { getLatestTxInfo, pollForNewTx, tonviewerUrl } from '../../utils/tonExplorer';
import type { Token } from '../../utils/constants';

const SLIPPAGE_OPTIONS = [
  { label: '0.5%', bps: 50 },
  { label: '1%', bps: 100 },
  { label: '3%', bps: 300 },
];

// ─── STON.fi public token list ────────────────────────────────────────────────
interface StonFiAsset {
  contract_address: string;
  symbol: string;
  display_name: string;
  decimals: number;
  image_url: string | null;
  tags: string[];
}

async function fetchStonFiTokens(): Promise<Token[]> {
  try {
    const res = await fetch('https://api.ston.fi/v1/assets?condition=whitelisted');
    if (!res.ok) throw new Error(`STON.fi API ${res.status}`);
    const json = await res.json();
    const assets: StonFiAsset[] = json.asset_list ?? [];
    return assets.map(a => ({
      address: a.contract_address,
      symbol: a.symbol,
      name: a.display_name,
      decimals: a.decimals,
      icon: a.image_url || '🔵',
      verification: 'whitelist' as const,
    }));
  } catch (e) {
    console.warn('[STON.fi] Token list fetch failed:', e);
    return [];
  }
}

// ─── Token Selector Dropdown ─────────────────────────────────────────────────
interface TokenDropdownProps {
  value: Token;
  options: Token[];        // full merged list for search
  favorites: Token[];      // shown at top without search
  onChange: (t: Token) => void;
  onAddCustom: (side: 'from' | 'to') => void;
  side: 'from' | 'to';
  customSearch: string;
  onCustomSearchChange: (v: string) => void;
  showCustomInput: boolean;
  onToggleCustom: () => void;
  isSearching: boolean;
  isLoadingList: boolean;
}

const TokenDropdown: React.FC<TokenDropdownProps> = ({
  value, options, favorites, onChange, onAddCustom, side,
  customSearch, onCustomSearchChange, showCustomInput, onToggleCustom,
  isSearching, isLoadingList,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, options]);

  // Enrich favorites & the trigger value with real STON.fi images once the list loads
  const enrichedFavs = useMemo(() =>
    favorites.map(fav => {
      const match = options.find(t => t.address.toLowerCase() === fav.address.toLowerCase());
      return match?.icon?.startsWith('http') || match?.icon?.startsWith('data:image') ? { ...fav, icon: match.icon } : fav;
    }),
  [favorites, options]);

  // Also enrich the currently-selected token shown in the trigger button
  const enrichedValue = useMemo(() => {
    if (value.icon?.startsWith('http') || value.icon?.startsWith('data:image')) return value; // already has a real image
    const match = options.find(t => t.address.toLowerCase() === value.address.toLowerCase());
    return match?.icon?.startsWith('http') || match?.icon?.startsWith('data:image') ? { ...value, icon: match.icon } : value;
  }, [value, options]);

  const renderToken = (token: Token, key?: string) => (
    <button
      key={key ?? token.address}
      className={`swap-token-item ${value.address === token.address ? 'active' : ''}`}
      onClick={() => { onChange(token); setOpen(false); setQuery(''); }}
    >
      {token.icon && (token.icon.startsWith('http') || token.icon.startsWith('data:image')) ? (
        <img src={token.icon} alt={token.symbol}
          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center', flexShrink: 0 }}>{token.icon || '🔵'}</span>
      )}
      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{token.symbol}</div>
        <div style={{ fontSize: '11px', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {token.name}
        </div>
      </div>
      {token.verification === 'whitelist' && <span className="swap-verified">✓</span>}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button className="swap-token-btn" onClick={() => setOpen(o => !o)}>
        {enrichedValue.icon && (enrichedValue.icon.startsWith('http') || enrichedValue.icon.startsWith('data:image')) ? (
          <img src={enrichedValue.icon} alt={enrichedValue.symbol}
            style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{enrichedValue.icon || '💎'}</span>
        )}
        <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{enrichedValue.symbol}</span>
        {enrichedValue.verification === 'whitelist' && <span className="swap-verified">✓</span>}
        <span className={`swap-chevron ${open ? 'open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="swap-token-menu">
          {/* Search */}
          <div style={{ padding: 'var(--space-2) var(--space-2) var(--space-1)' }}>
            <input
              ref={searchRef}
              className="input"
              style={{ width: '100%', fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)', boxSizing: 'border-box' }}
              placeholder="Search name, symbol or address…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {query ? (
              filtered.length > 0 ? (
                filtered.map(t => renderToken(t))
              ) : (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                  {isLoadingList ? '⏳ Loading token list…' : 'No tokens found'}
                </div>
              )
            ) : (
              <>
                <div style={{ padding: 'var(--space-1) var(--space-3)', fontSize: '10px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Popular
                </div>
                {enrichedFavs.map(t => renderToken(t, `fav-${t.address}`))}
                {isLoadingList ? (
                  <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '11px', color: 'var(--color-muted)' }}>
                    ⏳ Loading full STON.fi list…
                  </div>
                ) : (
                  <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '11px', color: 'var(--color-muted)' }}>
                    🔍 Search above to browse all {options.length.toLocaleString()} STON.fi tokens
                  </div>
                )}
              </>
            )}
          </div>

          {/* Custom address */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', marginTop: 'var(--space-1)', paddingTop: 'var(--space-2)' }}>
            {showCustomInput ? (
              <div style={{ padding: '0 var(--space-2) var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-3)' }}
                  placeholder="EQ... contract address"
                  value={customSearch}
                  onChange={e => onCustomSearchChange(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && onAddCustom(side)}
                />
                {isSearching && <span style={{ fontSize: '12px' }}>⏳</span>}
                <button onClick={() => onAddCustom(side)} className="btn btn-sm btn-primary">Add</button>
                <button onClick={onToggleCustom} className="btn btn-sm btn-ghost">✕</button>
              </div>
            ) : (
              <button className="swap-token-item" onClick={() => { onToggleCustom(); setQuery(''); }}>
                <span>📋</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)' }}>Paste contract address</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ─── Main Swap Page ──────────────────────────────────────────────────────────
export const AdvancedSwapPage: React.FC = () => {
  const { address, sender } = useWallet();
  const omniston = useOmniston();
  const { jettons, loading: jettonsLoading } = useJettonBalances();
  // Dedicated fast TON balance (single API call, updates quickly)
  const { balance: tonBalanceNano, loading: tonLoading } = useTonBalance();

  // Tokens
  const [fromToken, setFromToken] = useState<Token>(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(DEFAULT_TOKENS[1]);
  const [amount, setAmount] = useState('');
  const [customTokens, setCustomTokens] = useState<Token[]>([]);

  // Settings state
  const [slippageBps, setSlippageBps] = useState(300);
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [swapping, setSwapping] = useState(false);

  // Ref for closing settings popover on outside click
  const settingsRef = useRef<HTMLDivElement>(null);

  // Custom token search state
  const [showCustomFrom, setShowCustomFrom] = useState(false);
  const [showCustomTo, setShowCustomTo] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // STON.fi full token list
  const [stonFiTokens, setStonFiTokens] = useState<Token[]>([]);
  const [isLoadingTokenList, setIsLoadingTokenList] = useState(true);

  // Fetch STON.fi token list on mount
  useEffect(() => {
    fetchStonFiTokens().then(tokens => {
      setStonFiTokens(tokens);
      setIsLoadingTokenList(false);
    });
  }, []);


  // Close settings on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
    type: 'info' | 'confirm' | 'success' | 'error';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', content: null, type: 'info' });

  // Amount in base units
  const amountNum = parseFloat(amount) || 0;
  const nanoAmount = useMemo(() => {
    if (amountNum <= 0) return '0';
    return fromToken.decimals === 9
      ? tonToNano(amountNum)
      : String(Math.floor(amountNum * Math.pow(10, fromToken.decimals)));
  }, [amountNum, fromToken.decimals]);

  // Live quote from Omniston
  const { data: quote, isLoading: isQuoting } = useRfq({
    settlementMethods: [SettlementMethod.SETTLEMENT_METHOD_SWAP],
    bidAssetAddress: { blockchain: Blockchain.TON, address: fromToken.address },
    askAssetAddress: { blockchain: Blockchain.TON, address: toToken.address },
    amount: { bidUnits: nanoAmount },
    settlementParams: { maxPriceSlippageBps: slippageBps },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any, { enabled: amountNum > 0 });

  // Parse quote output amount
  const quoteOutput = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any;
    if (!q) return null;
    if (q.type === 'quoteUpdated' || q.type === 'quote_updated') {
      const askUnits = q.quote?.askUnits || q.quote?.ask_units;
      if (askUnits) return formatJettonAmount(String(askUnits), toToken.decimals);
    }
    if (q.askUnits || q.ask_units) {
      return formatJettonAmount(String(q.askUnits || q.ask_units), toToken.decimals);
    }
    return null;
  }, [quote, toToken.decimals]);

  // Exchange rate
  const exchangeRate = useMemo(() => {
    if (!quoteOutput || !amountNum) return null;
    const rate = parseFloat(quoteOutput) / amountNum;
    return `1 ${fromToken.symbol} ≈ ${rate.toFixed(4)} ${toToken.symbol}`;
  }, [quoteOutput, amountNum, fromToken.symbol, toToken.symbol]);

  // Min received (applying slippage manually for display)
  const minReceived = useMemo(() => {
    if (!quoteOutput) return null;
    const out = parseFloat(quoteOutput);
    const min = out * (1 - slippageBps / 10000);
    return `${min.toFixed(4)} ${toToken.symbol}`;
  }, [quoteOutput, slippageBps, toToken.symbol]);

  // From token wallet balance
  const fromBalance = useMemo(() => {
    if (fromToken.address === TON_NATIVE_ADDRESS) {
      return nanoToTon(Number(tonBalanceNano));
    }
    const j = jettons.find(j => {
      try { return Address.parse(j.jetton.address).equals(Address.parse(fromToken.address)); }
      catch { return j.jetton.symbol?.toLowerCase() === fromToken.symbol.toLowerCase(); }
    });
    return j ? Number(j.balance) / Math.pow(10, fromToken.decimals) : 0;
  }, [fromToken, tonBalanceNano, jettons]);

  // To token wallet balance (shown in You Receive panel)
  const toBalance = useMemo(() => {
    if (toToken.address === TON_NATIVE_ADDRESS) {
      return nanoToTon(Number(tonBalanceNano));
    }
    const j = jettons.find(j => {
      try { return Address.parse(j.jetton.address).equals(Address.parse(toToken.address)); }
      catch { return j.jetton.symbol?.toLowerCase() === toToken.symbol.toLowerCase(); }
    });
    return j ? Number(j.balance) / Math.pow(10, toToken.decimals) : 0;
  }, [toToken, tonBalanceNano, jettons]);

  // Wallet holdings converted to Token shape for the Popular section
  const walletFavorites = useMemo((): Token[] => {
    if (!address) return [];
    return jettons
      .filter(j => !j.isDust) // skip dust
      .map(j => ({
        address: j.jetton.address,
        name: j.jetton.name,
        symbol: j.jetton.symbol,
        decimals: j.jetton.decimals,
        icon: j.jetton.image || '',
        verification: j.jetton.verification as 'whitelist' | 'none' | 'blacklist',
      }));
  }, [address, jettons]);

  const fromUsdValue = useMemo(() => {
    const j = jettons.find(j => {
      try { return Address.parse(j.jetton.address).equals(Address.parse(fromToken.address)); }
      catch { return false; }
    });
    const price = fromToken.address === TON_NATIVE_ADDRESS
      ? (j?.price?.prices?.USD || 0)
      : (j?.price?.prices?.USD || 0);
    return amountNum * price;
  }, [fromToken, jettons, amountNum]);

  // Deduplicated full token lists
  // From list: user's wallet tokens first, then DEFAULT_TOKENS, then all STON.fi tokens
  const allFromTokens = useMemo(() => {
    const seen = new Set<string>();
    const base = [...walletFavorites, ...DEFAULT_TOKENS, ...customTokens].filter(t => t.address !== toToken.address);
    base.forEach(t => seen.add(t.address.toLowerCase()));
    const extra = stonFiTokens.filter(t => !seen.has(t.address.toLowerCase()) && t.address !== toToken.address);
    return [...base, ...extra];
  }, [toToken, customTokens, stonFiTokens, walletFavorites]);

  const allToTokens = useMemo(() => {
    const seen = new Set<string>();
    const base = [...walletFavorites, ...DEFAULT_TOKENS, ...customTokens].filter(t => t.address !== fromToken.address);
    base.forEach(t => seen.add(t.address.toLowerCase()));
    const extra = stonFiTokens.filter(t => !seen.has(t.address.toLowerCase()) && t.address !== fromToken.address);
    return [...base, ...extra];
  }, [fromToken, customTokens, stonFiTokens, walletFavorites]);

  // Favorites for the Popular section: wallet holdings first, then DEFAULT_TOKENS (deduped)
  const fromFavorites = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...walletFavorites, ...DEFAULT_TOKENS].filter(t => t.address !== toToken.address);
    return combined.filter(t => { const k = t.address.toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); });
  }, [walletFavorites, toToken.address]);

  const toFavorites = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...walletFavorites, ...DEFAULT_TOKENS].filter(t => t.address !== fromToken.address);
    return combined.filter(t => { const k = t.address.toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); });
  }, [walletFavorites, fromToken.address]);



  // Flip tokens
  const handleFlip = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      setFromToken(toToken);
      setToToken(fromToken);
      setAmount('');
      setIsFlipping(false);
    }, 180);
  };

  const handleMax = () => {
    const bal = fromToken.address === TON_NATIVE_ADDRESS
      ? Math.max(0, fromBalance - 0.05) // keep tiny buffer for gas on TON native
      : fromBalance;
    setAmount(bal > 0 ? bal.toFixed(fromToken.decimals === 9 ? 4 : Math.min(fromToken.decimals, 6)) : '');
  };

  // Add a custom token from a contract address
  const handleAddCustomToken = async (side: 'from' | 'to') => {
    if (searchAddress.length < 40) return;
    const exists = [...DEFAULT_TOKENS, ...customTokens].find(t => t.address === searchAddress);
    if (exists) {
      if (side === 'from') setFromToken(exists);
      else setToToken(exists);
      setSearchAddress('');
      setShowCustomFrom(false);
      setShowCustomTo(false);
      return;
    }
    setIsSearching(true);
    try {
      const meta = await fetchJettonMetadata(searchAddress);
      if (meta) {
        const token: Token = {
          address: searchAddress,
          name: meta.name,
          symbol: meta.symbol,
          decimals: meta.decimals,
          icon: '🔵',
          verification: meta.verification as 'whitelist' | 'none' | 'blacklist',
        };
        setCustomTokens(prev => [...prev, token]);
        if (side === 'from') setFromToken(token);
        else setToToken(token);
        setSearchAddress('');
        setShowCustomFrom(false);
        setShowCustomTo(false);
      } else {
        setModal({ isOpen: true, title: 'Token Not Found', type: 'error',
          content: 'Could not find a jetton at this address. Check it and try again.' });
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Premium SVG success icon - matches app's neumorphic accent gradient
  const SwapSuccessIcon = () => (
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: 'linear-gradient(135deg, hsl(165, 64%, 38%), hsl(195, 78%, 50%))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto var(--space-5)',
      boxShadow: '0 8px 32px hsla(165, 64%, 38%, 0.40), 0 2px 6px rgba(0,0,0,0.12)',
    }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
        stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );

  // Execute swap
  const handleSwapConfirm = async () => {
    if (!address || !quote) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const innerQuote = (quote as any).quote || quote;
    setSwapping(true);
    try {
      // Capture current tx state so we can detect the new tx after broadcast
      const before = await getLatestTxInfo(address).catch(() => null);

      const tx = await omniston.buildTransfer({
        sourceAddress: { blockchain: 607, address },
        destinationAddress: { blockchain: 607, address },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quote: innerQuote as any,
        useRecommendedSlippage: true,
      });
      if (!tx.ton?.messages.length) throw new Error('No TON messages generated for this swap.');
      const msg = tx.ton.messages[0];
      await sender.send({
        to: Address.parse(msg.targetAddress),
        value: BigInt(msg.sendAmount),
        body: Cell.fromBoc(Buffer.from(msg.payload, 'base64'))[0],
      });

      // Show success modal immediately - explorer link filled in once tx is found
      setModal({
        isOpen: true,
        title: 'Swap Confirmed',
        type: 'success',
        content: (
          <div style={{ textAlign: 'center' }}>
            <SwapSuccessIcon />
            <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
              Your swap has been broadcast to the TON network.
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: 'var(--space-4)' }}>
              Balances update in ~30 seconds.
            </p>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', opacity: 0.7 }}>
              Locating transaction...
            </div>
          </div>
        ),
      });
      setAmount('');

      // Poll for tx hash in background - update modal with explorer link when found
      pollForNewTx(address, before?.lt ?? null).then(found => {
        if (!found?.hash) return;
        const url = tonviewerUrl(found.hash);
        setModal(prev => ({
          ...prev,
          content: (
            <div style={{ textAlign: 'center' }}>
              <SwapSuccessIcon />
              <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                Your swap has been broadcast to the TON network.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: 'var(--space-5)' }}>
                Balances update in ~30 seconds.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-bg)',
                  boxShadow: 'var(--neu-extruded-sm)',
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--color-accent)',
                  textDecoration: 'none',
                  transition: 'box-shadow 200ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--neu-extruded)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--neu-extruded-sm)')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View on TonViewer
              </a>
            </div>
          ),
        }));
      }).catch(() => { /* silently ignore if poll times out */ });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setModal({
        isOpen: true,
        title: 'Swap Failed',
        type: 'error',
        content: (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, hsl(0, 68%, 52%), hsl(20, 80%, 55%))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              boxShadow: '0 6px 24px hsla(0, 68%, 52%, 0.35)',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Transaction failed</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
              {err.message || 'The transaction was cancelled or failed to broadcast.'}
            </p>
          </div>
        ),
      });
    } finally {
      setSwapping(false);
    }
  };

  const handleSwapClick = () => {
    if (!address) {
      setModal({ isOpen: true, title: 'Wallet Required', type: 'info',
        content: 'Connect a TON wallet using the button in the top right to execute swaps.' });
      return;
    }
    if (!quoteOutput) return;

    setModal({
      isOpen: true,
      title: 'Confirm Swap',
      type: 'confirm',
      onConfirm: handleSwapConfirm,
      content: (
        <div>
          {/* Route summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', justifyContent: 'center', margin: 'var(--space-4) 0 var(--space-6)' }}>
            <div style={{ textAlign: 'center' }}>
              <TokenIcon src={fromToken.icon} symbol={fromToken.symbol} size={52} style={{ margin: '0 auto var(--space-2)' }} />
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{amountNum}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{fromToken.symbol}</div>
            </div>
            <div style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <TokenIcon src={toToken.icon} symbol={toToken.symbol} size={52} style={{ margin: '0 auto var(--space-2)' }} />
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-accent)' }}>~{quoteOutput}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{toToken.symbol}</div>
            </div>
          </div>
          {/* Details */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', boxShadow: 'var(--neu-inset-sm)' }}>
            {[
              ['Slippage tolerance', `${(slippageBps / 100).toFixed(1)}%`],
              ['Min. received', minReceived || '-'],
              ['Route via', 'Omniston · STON.fi'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{value}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: 'var(--space-4)', textAlign: 'center' }}>
            Powered by Omniston · Prices are estimated and may shift slightly at execution.
          </p>
        </div>
      ),
    });
  };

  // Button label/state
  const buttonState = (() => {
    if (!address) return { label: 'Connect Wallet', disabled: false };
    if (amountNum <= 0) return { label: 'Enter an Amount', disabled: true };
    if (isQuoting) return { label: 'Fetching Best Route…', disabled: true };
    if (!quoteOutput) return { label: 'No Route Available', disabled: true };
    if (swapping) return { label: 'Confirm in Wallet…', disabled: true };
    return { label: `Swap ${fromToken.symbol} → ${toToken.symbol}`, disabled: false };
  })();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="page-two-col" style={{ alignItems: 'start' }}>

        {/* ── LEFT: Swap Card ── */}
        <div>
          <GlassCard glow="blue" style={{ maxWidth: '480px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Swap</h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', margin: '2px 0 0' }}>Best price via Omniston · STON.fi</p>
              </div>

              {/* Settings gear */}
              <div ref={settingsRef} style={{ position: 'relative' }}>
                <button
                  className={`swap-gear-btn ${showSettings ? 'active' : ''}`}
                  onClick={() => setShowSettings(o => !o)}
                  title="Slippage settings"
                >
                  ⚙
                </button>

                {showSettings && (
                  <div className="swap-settings-popover">
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-muted)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Slippage Tolerance
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      {SLIPPAGE_OPTIONS.map(opt => (
                        <button
                          key={opt.bps}
                          className={`swap-slip-btn ${slippageBps === opt.bps && !customSlippage ? 'active' : ''}`}
                          onClick={() => { setSlippageBps(opt.bps); setCustomSlippage(''); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input"
                      style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
                      placeholder="Custom %"
                      value={customSlippage}
                      onChange={e => {
                        setCustomSlippage(e.target.value);
                        const pct = parseFloat(e.target.value);
                        if (!isNaN(pct) && pct > 0) setSlippageBps(Math.round(pct * 100));
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── You Pay panel ── */}
            <div className="swap-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>You Pay</span>
                {address && (
                  (tonLoading || jettonsLoading) ? (
                    <span style={{ width: 80, height: 14, display: 'inline-block', background: 'var(--color-skeleton)', borderRadius: 4, opacity: 0.5 }} />
                  ) : (
                    <button
                      onClick={handleMax}
                      style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {fromBalance.toFixed(fromToken.decimals === 9 ? 4 : Math.min(fromToken.decimals, 6))} {fromToken.symbol} · MAX
                    </button>
                  )
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <TokenDropdown
                  value={fromToken}
                  options={allFromTokens}
                  favorites={fromFavorites}
                  onChange={t => { setFromToken(t); setAmount(''); }}
                  onAddCustom={handleAddCustomToken}
                  side="from"
                  customSearch={searchAddress}
                  onCustomSearchChange={setSearchAddress}
                  showCustomInput={showCustomFrom}
                  onToggleCustom={() => { setShowCustomFrom(o => !o); setSearchAddress(''); }}
                  isSearching={isSearching}
                  isLoadingList={isLoadingTokenList}
                />
                <input
                  type="number"
                  className="swap-amount-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0"
                />
              </div>

              {fromUsdValue > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: 'var(--space-2)', textAlign: 'right' }}>
                  ≈ ${fromUsdValue.toFixed(2)}
                </div>
              )}
            </div>

            {/* ── Flip button ── */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: 'var(--space-2) 0' }}>
              <motion.button
                className="swap-flip-btn"
                onClick={handleFlip}
                animate={{ rotate: isFlipping ? 180 : 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
              >
                ⇅
              </motion.button>
            </div>

            {/* ── You Receive panel ── */}
            <div className="swap-panel" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>You Receive</span>
                {address && (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    Balance: {toBalance.toFixed(toToken.decimals === 9 ? 4 : Math.min(toToken.decimals, 4))} {toToken.symbol}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <TokenDropdown
                  value={toToken}
                  options={allToTokens}
                  favorites={toFavorites}
                  onChange={t => setToToken(t)}
                  onAddCustom={handleAddCustomToken}
                  side="to"
                  customSearch={searchAddress}
                  onCustomSearchChange={setSearchAddress}
                  showCustomInput={showCustomTo}
                  onToggleCustom={() => { setShowCustomTo(o => !o); setSearchAddress(''); }}
                  isSearching={isSearching}
                  isLoadingList={isLoadingTokenList}
                />
                <div className="swap-output-display">
                  {amountNum > 0 ? (
                    isQuoting ? (
                      <div className="swap-output-skeleton" />
                    ) : quoteOutput ? (
                      <span style={{ color: 'var(--color-fg)' }}>{quoteOutput}</span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>-</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--color-muted)' }}>0.00</span>
                  )}
                </div>
              </div>

              {exchangeRate && (
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end' }}>
                  {exchangeRate}
                </div>
              )}
            </div>

            {/* ── Quote details (expandable) ── */}
            {quoteOutput && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <button
                  onClick={() => setShowDetails(o => !o)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-2) 0',
                    fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Route Details</span>
                  <span style={{ transition: 'transform 200ms', transform: showDetails ? 'rotate(180deg)' : 'none' }}>▾</span>
                </button>
                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      key="details"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', boxShadow: 'var(--neu-inset-sm)', marginTop: 'var(--space-1)' }}>
                        {[
                          ['Slippage', `${(slippageBps / 100).toFixed(1)}%`],
                          ['Min. received', minReceived || '-'],
                          ['Route', 'Omniston · STON.fi'],
                          ['Settlement', 'onchain swap'],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: 'var(--space-2)' }}>
                            <span>{k}</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-fg)', fontFamily: 'var(--font-mono)' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Action button ── */}
            <button
              className="btn btn-accent btn-lg btn-full"
              onClick={handleSwapClick}
              disabled={buttonState.disabled || swapping}
              style={{ fontWeight: 700, letterSpacing: '0.01em' }}
            >
              {buttonState.label}
            </button>

          </GlassCard>
        </div>

        {/* ── RIGHT: Info Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Protocol badge */}
          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, hsl(250,80%,60%), hsl(200,80%,60%))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', boxShadow: 'var(--neu-extruded-sm)',
              }}>
                <AppIcon name="refresh" size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>Omniston Protocol</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>by STON.fi</div>
              </div>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>
              Omniston is a DEX aggregation layer on TON. It finds the best path across all STON.fi pools, routing your swap for maximum output with minimal price impact.
            </p>
          </GlassCard>

          {/* How it works */}
          <GlassCard>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
              How Swapping Works
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              <div>1️⃣ <strong style={{ color: 'var(--color-fg)' }}>Select tokens</strong> - pick any TON Jetton pair</div>
              <div>2️⃣ <strong style={{ color: 'var(--color-fg)' }}>Enter amount</strong> - a live quote loads in ~1-2 seconds</div>
              <div>3️⃣ <strong style={{ color: 'var(--color-fg)' }}>Review & confirm</strong> - see exact amounts before sending</div>
              <div>4️⃣ <strong style={{ color: 'var(--color-fg)' }}>onchain settlement</strong> - swap executes atomically via STON.fi</div>
            </div>
          </GlassCard>

          {/* Slippage quick info */}
          <GlassCard>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
              Current Settings
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>Slippage tolerance</span>
              <span className="badge badge--accent" style={{ fontFamily: 'var(--font-mono)' }}>
                {(slippageBps / 100).toFixed(1)}%
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: 'var(--space-3)', lineHeight: 1.6 }}>
              Your transaction will revert if the price moves more than {(slippageBps / 100).toFixed(1)}% unfavourably.
              Adjust via the ⚙ gear icon on the swap card.
            </p>
          </GlassCard>
        </div>
      </div>

      {/* Modal */}
      <GlassModal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        type={modal.type}
        onConfirm={modal.onConfirm}
        isLoading={swapping}
        confirmLabel="Confirm Swap"
      >
        {modal.content}
      </GlassModal>

      <style>{`
        /* ── Token selector button ── */
        .swap-token-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-bg);
          border-radius: var(--radius-full);
          border: none;
          cursor: pointer;
          box-shadow: var(--neu-extruded-sm);
          transition: all 200ms ease-out;
          white-space: nowrap;
          min-width: 100px;
          font-family: var(--font-sans);
          color: var(--color-fg);
        }
        .swap-token-btn:hover {
          box-shadow: var(--neu-extruded);
          transform: translateY(-1px);
        }
        .swap-chevron {
          font-size: 12px;
          color: var(--color-muted);
          transition: transform 200ms;
          margin-left: 2px;
        }
        .swap-chevron.open { transform: rotate(180deg); }

        /* ── Token dropdown menu ── */
        .swap-token-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 220px;
          background: var(--color-bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--neu-extruded-hover);
          z-index: 100;
          padding: var(--space-2);
          max-height: 300px;
          overflow-y: auto;
        }
        .swap-token-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-3);
          background: none;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 150ms;
          font-family: var(--font-sans);
          color: var(--color-fg);
        }
        .swap-token-item:hover { background: var(--color-surface); }
        .swap-token-item.active {
          background: var(--color-surface);
          box-shadow: var(--neu-inset-sm);
          color: var(--color-accent);
          font-weight: 600;
        }

        /* ── Verified checkmark ── */
        .swap-verified {
          font-size: 10px;
          font-weight: 800;
          color: hsl(145, 68%, 48%);
          margin-left: 2px;
        }

        /* ── Neumorphic input panel ── */
        .swap-panel {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          box-shadow: var(--neu-inset);
          margin-bottom: var(--space-2);
        }

        /* ── Amount input ── */
        .swap-amount-input {
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
        .swap-amount-input::placeholder { color: var(--color-text-tertiary); }
        .swap-amount-input::-webkit-outer-spin-button,
        .swap-amount-input::-webkit-inner-spin-button { -webkit-appearance: none; }

        /* ── Output display ── */
        .swap-output-display {
          flex: 1;
          text-align: right;
          font-size: var(--text-2xl);
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--color-accent);
        }

        /* ── Quote loading skeleton ── */
        .swap-output-skeleton {
          display: inline-block;
          width: 100px;
          height: 28px;
          border-radius: var(--radius-sm);
          background: linear-gradient(90deg, var(--color-surface) 25%, var(--color-bg) 50%, var(--color-surface) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Flip button ── */
        .swap-flip-btn {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          background: var(--color-bg);
          border: none;
          cursor: pointer;
          font-size: 1.3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--neu-extruded-sm);
          color: var(--color-accent);
          transition: box-shadow 200ms;
        }
        .swap-flip-btn:hover { box-shadow: var(--neu-extruded); }

        /* ── Gear button ── */
        .swap-gear-btn {
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          background: var(--color-bg);
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--neu-extruded-sm);
          color: var(--color-muted);
          transition: all 200ms;
        }
        .swap-gear-btn:hover, .swap-gear-btn.active {
          box-shadow: var(--neu-inset-sm);
          color: var(--color-accent);
        }

        /* ── Settings popover ── */
        .swap-settings-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 220px;
          background: var(--color-bg);
          border-radius: var(--radius-lg);
          box-shadow: var(--neu-extruded-hover);
          padding: var(--space-4);
          z-index: 100;
        }

        /* ── Slippage preset buttons ── */
        .swap-slip-btn {
          flex: 1;
          padding: var(--space-2) 0;
          background: var(--color-surface);
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: 600;
          font-family: var(--font-sans);
          cursor: pointer;
          color: var(--color-fg);
          transition: all 150ms;
        }
        .swap-slip-btn.active {
          background: var(--color-bg);
          border-color: var(--color-accent);
          color: var(--color-accent);
          box-shadow: var(--neu-extruded-sm);
        }
        .swap-slip-btn:hover:not(.active) { background: var(--color-bg); }
      `}</style>
    </motion.div>
  );
};
