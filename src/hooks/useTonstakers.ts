import { useState, useEffect, useRef, useCallback } from 'react';
import { Tonstakers } from 'tonstakers-sdk';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Address } from '@ton/core';
import { useWallet } from './useWallet';
import { useTonBalance } from './useTonBalance';
import { fetchJettonBalances } from '../services/tonapi';
import { TONAPI_KEY, TONSTAKERS_PARTNER_CODE, TSTON_ADDRESS } from '../utils/constants';
import { getLatestTxInfo, pollForNewTx } from '../utils/tonExplorer';

// ─── Tonstakers pool contract address (mainnet) ─────────────────────────────
const TONSTAKERS_POOL_ADDRESS = 'EQCkWxfyhAkim3g2DjKQQg8T5P4g-Q1-K_jErGcDJZ4i-vqR';
const TONAPI_BASE = 'https://tonapi.io/v2';

// ─── Fallback values (kept close to real values as of April 2026) ─────────────
// These are only used if ALL fetch attempts fail.
const FALLBACK_APY      = 19.74;
const FALLBACK_TVL_NANO = 72_000_000 * 1e9;    // ~72M TON in nanoTON
const FALLBACK_STAKERS  = 126_000;
const FALLBACK_RATES    = { TONUSD: 3.2, tsTONTON: 1.096, tsTONTONProjected: 1.115 };
const FALLBACK_LIQ_NANO = 1_656_991 * 1e9;     // from last known instantLiquidity

// ─── Tonstakers official cache endpoint ─────────────────────────────────────
// Primary source - single call, no auth needed, matches exactly what
// the tonstakers.com dashboard displays.
const TONSTAKERS_CACHE_URL = 'https://api.tonstakers.com/cache/v1/blockchain/staking';

interface TonstakersPoolStats {
  apy: number;
  tvlNano: number;
  stakersCount: number;
  tsTONTON: number;
  instantLiquidityNano: number;
  TONUSD: number; // extracted from Tonstakers' own rates map
}

// zero-address key = TON in the Tonstakers rates map
const TON_ZERO_ADDRESS = '0:0000000000000000000000000000000000000000000000000000000000000000';

async function fetchPoolStatsFromTonstakers(): Promise<TonstakersPoolStats> {
  const res = await fetch(TONSTAKERS_CACHE_URL);
  if (!res.ok) throw new Error(`Tonstakers cache HTTP ${res.status}`);
  const json = await res.json();
  const d = json.data?.staking_data;
  if (!d) throw new Error('Tonstakers cache: missing staking_data');

  // Extract TON/USD from the Tonstakers rates map - this is the same price
  // the Tonstakers dashboard uses, ensuring our TVL USD value matches.
  const rates = json.data?.rates ?? {};
  const TONUSD = Number(rates[TON_ZERO_ADDRESS] ?? FALLBACK_RATES.TONUSD);

  return {
    apy:                  Number(d.currentApy),
    tvlNano:              Number(d.tvl),
    stakersCount:         Number(d.stakers),
    tsTONTON:             Number(d.tsTONPrice),   // tsTON/TON ratio
    instantLiquidityNano: Number(d.instantLiquidity),
    TONUSD,
  };
}

// ─── TonAPI pool stats (fallback) ────────────────────────────────────────────
// Used only if the Tonstakers endpoint is unavailable.
async function fetchPoolStatsFromTonApi(): Promise<TonstakersPoolStats> {
  const headers: Record<string, string> = { 'Content-type': 'application/json' };
  const isMockKey = !TONAPI_KEY || TONAPI_KEY === 'mock_tonapi_key_replace_me';
  if (!isMockKey) headers['Authorization'] = `Bearer ${TONAPI_KEY}`;

  const res = await fetch(`${TONAPI_BASE}/staking/pool/${TONSTAKERS_POOL_ADDRESS}`, { headers });
  if (!res.ok) throw new Error(`TonAPI pool stats HTTP ${res.status}`);
  const data = await res.json();
  const pool = data.pool;

  // Fetch TON/USD alongside pool data
  let TONUSD = FALLBACK_RATES.TONUSD;
  try {
    const rr = await fetch(`${TONAPI_BASE}/rates?tokens=ton&currencies=usd`, { headers });
    if (rr.ok) TONUSD = Number((await rr.json())?.rates?.TON?.prices?.USD ?? FALLBACK_RATES.TONUSD);
  } catch { /* keep fallback */ }

  return {
    apy:                  Number(pool.apy),
    tvlNano:              Number(pool.total_amount),
    stakersCount:         Number(pool.current_nominators),
    tsTONTON:             FALLBACK_RATES.tsTONTON,
    instantLiquidityNano: FALLBACK_LIQ_NANO,
    TONUSD,
  };
}


interface TonstakersState {
  sdkReady: boolean;
  sdkInitFailed: boolean;  // true after all retry attempts exhausted
  apy: number;
  tvl: string;             // nanoTON string - consumed by nanoToTon() in EarnPage
  stakersCount: number;
  stakedBalance: string;   // tsTON jetton balance in nanoTON (from TonAPI, not SDK)
  rates: {
    TONUSD: number;
    tsTONTON: number;
    tsTONTONProjected: number;
  };
  instantLiquidity: string; // nanoTON string
  loading: boolean;
  error: string | null;
}

export function useTonstakers() {
  const [tonConnectUI] = useTonConnectUI();
  const { address } = useWallet();

  // Real wallet TON balance from TonAPI - displayed as "Available" on the stake page
  const { balance: walletBalanceNano, refresh: refreshBalance } = useTonBalance();

  const sdkRef        = useRef<Tonstakers | null>(null);
  const sdkReadyRef   = useRef<boolean>(false);
  const refreshingRef = useRef<boolean>(false); // deduplicate concurrent refresh() calls
  // retryCount is incremented by retryInit() to force SDK re-instantiation
  const [retryCount, setRetryCount] = useState(0);

  const [state, setState] = useState<TonstakersState>({
    sdkReady: false,
    sdkInitFailed: false,
    // Pre-populate with fallback values so the UI never shows 0 while fetching
    apy:              FALLBACK_APY,
    tvl:              String(FALLBACK_TVL_NANO),
    stakersCount:     FALLBACK_STAKERS,
    stakedBalance:    '0',
    rates:            { ...FALLBACK_RATES },   // includes TONUSD - prevents $0 portfolio flash
    instantLiquidity: String(FALLBACK_LIQ_NANO),
    loading:          true,   // true only until the first real fetch completes
    error:            null,
  });

  // Tracks whether at least one successful fetch has completed.
  // After hasLoaded=true, subsequent refreshes won't set loading:true,
  // so the UI shows stale-but-correct data instead of flickering to 0.
  const hasLoadedRef = useRef(false);

  // ─── Fetch real tsTON jetton balance directly from TonAPI ─────────────────
  // More reliable than SDK.getStakedBalance() which requires internal SDK setup.
  // TonAPI returns jetton.address in raw hex form (0:xxx...) while TSTON_ADDRESS
  // is stored in user-friendly EQ form - normalize both with @ton/core before comparing.
  const fetchTstonBalance = useCallback(async (): Promise<string> => {
    if (!address) return '0';
    try {
      const normalize = (addr: string) => {
        try { return Address.parse(addr).toRawString().toLowerCase(); }
        catch { return addr.toLowerCase(); }
      };
      const tstonRaw = normalize(TSTON_ADDRESS);
      const jettons = await fetchJettonBalances(address);
      const tston = jettons.find(j =>
        normalize(j.jetton.address) === tstonRaw ||
        j.jetton.symbol?.toLowerCase() === 'tston'  // fallback: match by symbol
      );
      console.log('[tsTON] Found:', tston?.balance, 'from', jettons.length, 'jettons');
      return tston?.balance ?? '0';
    } catch (e) {
      console.warn('[tsTON] fetchTstonBalance failed:', e);
      return '0';
    }
  }, [address]);

  // ─── Fetch global pool stats - primary: Tonstakers cache, fallback: TonAPI ──
  // A single call to Tonstakers returns APY, TVL, stakers, tsTONPrice, and
  // instantLiquidity - no SDK or wallet needed. Matches the official dashboard.
  const refreshStats = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    // Only show the loading skeleton on the very first fetch.
    // Subsequent background refreshes keep existing values visible.
    if (!hasLoadedRef.current) {
      setState(prev => ({ ...prev, loading: true }));
    }

    try {
      const [poolStats, tstonBalanceNano] = await Promise.all([
        // Primary: official Tonstakers cache - includes TONUSD from their own rates map
        // Fallback chain: TonAPI (with its own price fetch) → hardcoded constants
        fetchPoolStatsFromTonstakers().catch(async (e) => {
          console.warn('[Tonstakers] Primary endpoint failed, trying TonAPI fallback:', e);
          return fetchPoolStatsFromTonApi().catch((e2) => {
            console.warn('[Tonstakers] TonAPI fallback also failed, using constants:', e2);
            return {
              apy:                  FALLBACK_APY,
              tvlNano:              FALLBACK_TVL_NANO,
              stakersCount:         FALLBACK_STAKERS,
              tsTONTON:             FALLBACK_RATES.tsTONTON,
              instantLiquidityNano: FALLBACK_LIQ_NANO,
              TONUSD:               FALLBACK_RATES.TONUSD,
            };
          });
        }),
        fetchTstonBalance(),
      ]);

      console.log(
        '[Tonstakers] Live stats → APY:', poolStats.apy.toFixed(2) + '%',
        '| TVL:', (poolStats.tvlNano / 1e9).toFixed(0), 'TON',
        '| TON/USD:', poolStats.TONUSD.toFixed(4),
        '| tsTON/TON:', poolStats.tsTONTON.toFixed(4),
      );

      setState(prev => ({
        ...prev,
        apy:              poolStats.apy,
        tvl:              String(poolStats.tvlNano),
        stakersCount:     poolStats.stakersCount,
        rates: {
          TONUSD:            poolStats.TONUSD,
          tsTONTON:          poolStats.tsTONTON,
          tsTONTONProjected: poolStats.tsTONTON,
        },
        stakedBalance:    tstonBalanceNano,
        instantLiquidity: String(poolStats.instantLiquidityNano),
        loading:          false,
        error:            null,
      }));
      hasLoadedRef.current = true;


    } catch (err) {
      console.error('[Tonstakers] refreshStats error:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch staking data',
      }));
    } finally {
      refreshingRef.current = false;
    }
  }, [fetchTstonBalance]);


  /** Alias kept for compatibility - now delegates to refreshStats */
  const refresh = refreshStats;

  /** Call this from the UI to force a fresh SDK instantiation after a failed init. */
  const retryInit = useCallback(() => {
    console.log('[Tonstakers] Manual retry triggered');
    setState(prev => ({ ...prev, sdkInitFailed: false, sdkReady: false }));
    sdkReadyRef.current = false;
    setRetryCount(c => c + 1);
  }, []);

  // ─── Pool stats - fetched directly from TonAPI, no SDK needed ───────────────
  // Runs immediately on mount and every 90s. Provides APY, TVL, stakers count.
  useEffect(() => {
    let destroyed = false;
    refreshStats();
    const interval = setInterval(() => {
      if (!destroyed) refreshStats();
    }, 90_000);
    return () => {
      destroyed = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]); // re-run when wallet address changes to update tsTON balance

  // ─── SDK lifecycle (wallet-dependent, needed only for transactions) ──────────
  // re-runs on retryCount change so retryInit() forces a fresh instance
  useEffect(() => {
    if (!tonConnectUI) return;

    // Reset failure state for this attempt
    setState(prev => ({ ...prev, sdkInitFailed: false }));

    console.log(`[Tonstakers] Creating SDK instance… (attempt ${retryCount + 1})`);
    const isMockKey = !TONAPI_KEY || TONAPI_KEY === 'mock_tonapi_key_replace_me';
    const sdk = new Tonstakers({
      connector: tonConnectUI,
      ...(isMockKey ? {} : { tonApiKey: TONAPI_KEY }),
      partnerCode: TONSTAKERS_PARTNER_CODE,
    });

    sdkRef.current = sdk;

    const onInit = () => {
      console.log('[Tonstakers] initialized ✅');
      sdkReadyRef.current = true;
      setState(prev => ({ ...prev, sdkReady: true, sdkInitFailed: false }));
      // Refresh balance now that SDK+wallet are ready
      refreshStats();
    };

    const onDeinit = () => {
      console.log('[Tonstakers] deinitialized');
      sdkReadyRef.current = false;
      setState(prev => ({ ...prev, sdkReady: false }));
    };

    sdk.addEventListener('initialized', onInit);
    sdk.addEventListener('deinitialized', onDeinit);

    // ── Ready-poll with auto-retry ─────────────────────────────────────────
    // The SDK only fires 'initialized' when the wallet status *changes*.
    // If the wallet is already connected, the event won't fire, so we poll.
    const POLL_INTERVAL_MS = 300;
    const POLL_TIMEOUT_MS  = 8_000;   // wait 8 s per attempt
    const MAX_AUTO_RETRIES = 3;
    let pollElapsed = 0;
    let destroyed = false;

    const pollTimer = setInterval(() => {
      if (destroyed || sdkReadyRef.current) {
        clearInterval(pollTimer);
        return;
      }
      if (sdk.ready) {
        console.log('[Tonstakers] sdk.ready detected via poll ✅');
        clearInterval(pollTimer);
        onInit();
        return;
      }
      pollElapsed += POLL_INTERVAL_MS;
      if (pollElapsed >= POLL_TIMEOUT_MS) {
        clearInterval(pollTimer);
        if (retryCount < MAX_AUTO_RETRIES) {
          console.warn(`[Tonstakers] SDK timeout - auto-retry ${retryCount + 1}/${MAX_AUTO_RETRIES}`);
          setTimeout(() => {
            if (!destroyed) setRetryCount(c => c + 1);
          }, 1_000);
        } else {
          console.error('[Tonstakers] All SDK retries exhausted - showing Retry button');
          // Stats already loaded - just mark SDK init failed so stake button
          // shows the retry instead of an infinite loader
          setState(prev => ({ ...prev, sdkInitFailed: true, loading: false }));
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      destroyed = true;
      clearInterval(pollTimer);
      sdk.removeEventListener('initialized', onInit);
      sdk.removeEventListener('deinitialized', onDeinit);
      sdkReadyRef.current = false;
      sdkRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonConnectUI, retryCount]);

  // Re-fetch personal balance when wallet connects / disconnects.
  useEffect(() => {
    refreshBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ─── Transaction helpers ────────────────────────────────────────────────────

  /** Wait up to 10s for the SDK instance to exist (set almost immediately on mount).
   *  Does NOT wait for sdk.ready — that check is done via withSdkRetry retries. */
  const waitForSdk = (): Promise<Tonstakers | undefined> => {
    return new Promise((resolve) => {
      // Instance is normally set synchronously during the useEffect — resolve right away.
      const sdk = sdkRef.current;
      if (sdk) return resolve(sdk);
      const deadline = Date.now() + 10_000;
      const id = setInterval(() => {
        const s = sdkRef.current;
        if (s) { clearInterval(id); resolve(s); }
        else if (Date.now() >= deadline) { clearInterval(id); resolve(undefined); }
      }, 150);
    });
  };

  /** Returns true if an error is the SDK's own internal "not ready" error. */
  const isSdkNotReady = (err: unknown) => {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('not fully initialized') || msg.includes('not initialized') || msg.includes('not ready');
  };

  /** Generic retry wrapper — retries up to 6 times on SDK-not-ready errors, 2s apart.
   *  Gives the SDK up to 12 seconds to finish its internal initialization. */
  async function withSdkRetry<T>(fn: (sdk: Tonstakers) => Promise<T>): Promise<T> {
    const sdk = await waitForSdk();
    if (!sdk) throw new Error('Tonstakers SDK not initialized. Please refresh the page and try again.');
    let lastErr: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await fn(sdk);
      } catch (err) {
        if (isSdkNotReady(err)) {
          lastErr = err;
          console.warn(`[Tonstakers] SDK not ready (attempt ${attempt + 1}/6): ${(err as Error).message} — retrying in 2s`);
          await new Promise(r => setTimeout(r, 2_000));
        } else {
          throw err; // user rejected, network error, etc. — rethrow immediately
        }
      }
    }
    throw lastErr ?? new Error('Stake failed after retries. Please try again.');
  }

  /** Stakes TON. Returns the onchain tx hash for the explorer link, or null on timeout. */
  const stake = async (amountNano: string): Promise<string | null> => {
    return withSdkRetry(async (sdk) => {
      const before = await getLatestTxInfo(address ?? '');
      await sdk.stake(BigInt(amountNano));
      const tx = await pollForNewTx(address ?? '', before?.lt ?? null);
      await Promise.all([refresh(), refreshBalance()]);
      return tx?.hash ?? null;
    });
  };

  /** Unstakes tsTON (standard). Returns the onchain tx hash or null. */
  const unstake = async (amountNano: string): Promise<string | null> => {
    return withSdkRetry(async (sdk) => {
      const before = await getLatestTxInfo(address ?? '');
      await sdk.unstake(BigInt(amountNano));
      const tx = await pollForNewTx(address ?? '', before?.lt ?? null);
      await Promise.all([refresh(), refreshBalance()]);
      return tx?.hash ?? null;
    });
  };

  /** Unstakes tsTON instantly. Returns the onchain tx hash or null. */
  const unstakeInstant = async (amountNano: string): Promise<string | null> => {
    return withSdkRetry(async (sdk) => {
      const before = await getLatestTxInfo(address ?? '');
      await sdk.unstakeInstant(BigInt(amountNano));
      const tx = await pollForNewTx(address ?? '', before?.lt ?? null);
      await Promise.all([refresh(), refreshBalance()]);
      return tx?.hash ?? null;
    });
  };


  return {
    ...state,
    // Expose real wallet TON nano balance as "Available" for the stake input
    availableBalance: walletBalanceNano,
    stake,
    unstake,
    unstakeInstant,
    refresh,
    retryInit,
  };
}
