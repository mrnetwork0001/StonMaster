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
const FALLBACK_APY      = 18.70;
const FALLBACK_TVL_NANO = 72_287_710 * 1e9;
const FALLBACK_STAKERS  = 126_688;
const FALLBACK_RATES    = { TONUSD: 1.29, tsTONTON: 1.097, tsTONTONProjected: 1.115 };
const FALLBACK_LIQ_NANO = 15_957_420_246_917;

// ─── Tonstakers official cache endpoint ─────────────────────────────────────
const TONSTAKERS_CACHE_URL = 'https://api.tonstakers.com/cache/v1/blockchain/staking';

interface TonstakersPoolStats {
  apy: number;
  tvlNano: number;
  stakersCount: number;
  tsTONTON: number;
  instantLiquidityNano: number;
  TONUSD: number;
}

const TON_ZERO_ADDRESS = '0:0000000000000000000000000000000000000000000000000000000000000000';

async function fetchPoolStatsFromTonstakers(): Promise<TonstakersPoolStats> {
  const res = await fetch(TONSTAKERS_CACHE_URL);
  if (!res.ok) throw new Error(`Tonstakers cache HTTP ${res.status}`);
  const json = await res.json();
  const d = json.data?.staking_data;
  if (!d) throw new Error('Tonstakers cache: missing staking_data');

  const rates = json.data?.rates ?? {};
  const TONUSD = Number(rates[TON_ZERO_ADDRESS] ?? FALLBACK_RATES.TONUSD);

  return {
    apy:                  Number(d.currentApy),
    tvlNano:              Number(d.tvl),
    stakersCount:         Number(d.stakers),
    tsTONTON:             Number(d.tsTONPrice),
    instantLiquidityNano: Number(d.instantLiquidity),
    TONUSD,
  };
}

async function fetchPoolStatsFromTonApi(): Promise<TonstakersPoolStats> {
  const headers: Record<string, string> = { 'Content-type': 'application/json' };
  const isMockKey = !TONAPI_KEY || TONAPI_KEY === 'mock_tonapi_key_replace_me';
  if (!isMockKey) headers['Authorization'] = `Bearer ${TONAPI_KEY}`;

  const res = await fetch(`${TONAPI_BASE}/staking/pool/${TONSTAKERS_POOL_ADDRESS}`, { headers });
  if (!res.ok) throw new Error(`TonAPI pool stats HTTP ${res.status}`);
  const data = await res.json();
  const pool = data.pool;

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
  sdkInitFailed: boolean;
  apy: number;
  tvl: string;
  stakersCount: number;
  stakedBalance: string;
  rates: {
    TONUSD: number;
    tsTONTON: number;
    tsTONTONProjected: number;
  };
  instantLiquidity: string;
  loading: boolean;
  error: string | null;
}

export function useTonstakers() {
  const [tonConnectUI] = useTonConnectUI();
  const { address } = useWallet();

  const { balance: walletBalanceNano, refresh: refreshBalance } = useTonBalance();

  const sdkRef        = useRef<Tonstakers | null>(null);
  const sdkReadyRef   = useRef<boolean>(false);
  const refreshingRef = useRef<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);

  const [state, setState] = useState<TonstakersState>({
    sdkReady: false,
    sdkInitFailed: false,
    apy:              FALLBACK_APY,
    tvl:              String(FALLBACK_TVL_NANO),
    stakersCount:     FALLBACK_STAKERS,
    stakedBalance:    '0',
    rates:            { ...FALLBACK_RATES },
    instantLiquidity: String(FALLBACK_LIQ_NANO),
    loading:          true,
    error:            null,
  });

  const hasLoadedRef = useRef(false);

  // ─── Fetch tsTON jetton balance ──────────────────────────────────────────
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
        j.jetton.symbol?.toLowerCase() === 'tston'
      );
      return tston?.balance ?? '0';
    } catch (e) {
      console.warn('[tsTON] fetchTstonBalance failed:', e);
      return '0';
    }
  }, [address]);

  // ─── Fetch pool stats ────────────────────────────────────────────────────
  const refreshStats = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (!hasLoadedRef.current) {
      setState(prev => ({ ...prev, loading: true }));
    }

    try {
      const [poolStats, tstonBalanceNano] = await Promise.all([
        fetchPoolStatsFromTonstakers().catch(async (e) => {
          console.warn('[Tonstakers] Primary endpoint failed:', e);
          return fetchPoolStatsFromTonApi().catch(() => ({
            apy:                  FALLBACK_APY,
            tvlNano:              FALLBACK_TVL_NANO,
            stakersCount:         FALLBACK_STAKERS,
            tsTONTON:             FALLBACK_RATES.tsTONTON,
            instantLiquidityNano: FALLBACK_LIQ_NANO,
            TONUSD:               FALLBACK_RATES.TONUSD,
          }));
        }),
        fetchTstonBalance(),
      ]);

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

  const refresh = refreshStats;

  const retryInit = useCallback(() => {
    console.log('[Tonstakers] Manual retry triggered');
    setState(prev => ({ ...prev, sdkInitFailed: false, sdkReady: false }));
    sdkReadyRef.current = false;
    setRetryCount(c => c + 1);
  }, []);

  // ─── Pool stats fetch on mount and every 90s ─────────────────────────────
  useEffect(() => {
    let destroyed = false;
    refreshStats();
    const interval = setInterval(() => {
      if (!destroyed) refreshStats();
    }, 90_000);
    return () => { destroyed = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ─── SDK lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tonConnectUI) return;

    setState(prev => ({ ...prev, sdkInitFailed: false }));
    console.log(`[Tonstakers] Creating SDK instance (attempt ${retryCount + 1})`);

    const isMockKey = !TONAPI_KEY || TONAPI_KEY === 'mock_tonapi_key_replace_me';
    // If the SDK failed to initialize the first time, drop the custom API key and let Tonstakers use its fallback.
    const disableKey = isMockKey || retryCount > 0;
    
    const sdk = new Tonstakers({
      connector: tonConnectUI,
      ...(disableKey ? {} : { tonApiKey: TONAPI_KEY }),
      partnerCode: TONSTAKERS_PARTNER_CODE,
    });

    sdkRef.current = sdk;
    let destroyed = false;

    const onInit = () => {
      if (destroyed) return;
      console.log('[Tonstakers] SDK initialized');
      sdkReadyRef.current = true;
      setState(prev => ({ ...prev, sdkReady: true, sdkInitFailed: false }));
      refreshStats();
    };

    const onDeinit = () => {
      sdkReadyRef.current = false;
      setState(prev => ({ ...prev, sdkReady: false }));
    };

    sdk.addEventListener('initialized', onInit);
    sdk.addEventListener('deinitialized', onDeinit);

    // ── Aggressive polling: check sdk.ready every 500ms for up to 20s ─────
    // This handles the case where wallet is already connected on mount
    // (the 'initialized' event won't fire for already-connected wallets).
    const POLL_MS = 500;
    const TIMEOUT_MS = retryCount === 0 ? 5_000 : 15_000;
    let elapsed = 0;

    const poll = setInterval(() => {
      if (destroyed || sdkReadyRef.current) { clearInterval(poll); return; }
      // Check sdk.ready
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((sdk as any).ready === true || sdk.ready === true) {
        clearInterval(poll);
        onInit();
        return;
      }
      elapsed += POLL_MS;
      if (elapsed >= TIMEOUT_MS) {
        clearInterval(poll);
        if (!destroyed && !sdkReadyRef.current) {
          if (retryCount < 5) {
            console.warn(`[Tonstakers] SDK not ready after ${TIMEOUT_MS / 1000}s - auto-retry ${retryCount + 1}`);
            setTimeout(() => { if (!destroyed) setRetryCount(c => c + 1); }, 500);
          } else {
            console.error('[Tonstakers] SDK exhausted retries - showing retry button');
            setState(prev => ({ ...prev, sdkInitFailed: true, loading: false }));
          }
        }
      }
    }, POLL_MS);

    return () => {
      destroyed = true;
      clearInterval(poll);
      sdk.removeEventListener('initialized', onInit);
      sdk.removeEventListener('deinitialized', onDeinit);
      sdkReadyRef.current = false;
      // Keep sdkRef.current so withSdkRetry can detect it changing
      if (sdkRef.current === sdk) sdkRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonConnectUI, retryCount]);

  useEffect(() => {
    refreshBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ─── Transaction helpers ─────────────────────────────────────────────────

  /** Returns true if error is SDK's "not ready" sentinel. */
  const isSdkNotReady = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('not fully initialized') ||
           msg.includes('not initialized') ||
           msg.includes('not ready');
  };

  /**
   * Reliable retry wrapper.
   * - Always reads the CURRENT sdkRef (handles SDK recreation across retries)
   * - Waits for sdk.ready before executing fn
   * - Total timeout: 40 seconds
   */
  async function withSdkRetry<T>(fn: (sdk: Tonstakers) => Promise<T>): Promise<T> {
    const deadline = Date.now() + 40_000;
    let lastErr: unknown;

    while (Date.now() < deadline) {
      const sdk = sdkRef.current;

      // SDK not created yet - wait for it
      if (!sdk) {
        await new Promise(r => setTimeout(r, 800));
        continue;
      }

      // SDK exists - check if ready
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isReady = sdkReadyRef.current || (sdk as any).ready === true || sdk.ready === true;

      if (!isReady) {
        // Not ready yet - keep waiting
        await new Promise(r => setTimeout(r, 1_000));
        continue;
      }

      // SDK ready - attempt the transaction
      try {
        return await fn(sdk);
      } catch (err) {
        if (isSdkNotReady(err)) {
          // Race condition: SDK reported ready but internal check disagrees
          lastErr = err;
          sdkReadyRef.current = false; // force re-poll
          console.warn('[Tonstakers] Race: SDK reported ready but threw not-ready. Waiting 2s...');
          await new Promise(r => setTimeout(r, 2_000));
        } else {
          // Real error: user cancellation, network, etc. - throw immediately
          throw err;
        }
      }
    }

    throw lastErr ?? new Error(
      'Wallet timed out. Please disconnect and reconnect your wallet, then try again.'
    );
  }

  /** Stakes TON. Returns onchain tx hash or null. */
  const stake = async (amountNano: string): Promise<string | null> => {
    return withSdkRetry(async (sdk) => {
      const before = await getLatestTxInfo(address ?? '').catch(() => null);
      await sdk.stake(BigInt(amountNano));
      const tx = await pollForNewTx(address ?? '', before?.lt ?? null);
      await Promise.all([refresh(), refreshBalance()]);
      return tx?.hash ?? null;
    });
  };

  /** Unstakes tsTON (standard - next round). Returns onchain tx hash or null. */
  const unstake = async (amountNano: string): Promise<string | null> => {
    return withSdkRetry(async (sdk) => {
      const before = await getLatestTxInfo(address ?? '').catch(() => null);
      await sdk.unstake(BigInt(amountNano));
      const tx = await pollForNewTx(address ?? '', before?.lt ?? null);
      await Promise.all([refresh(), refreshBalance()]);
      return tx?.hash ?? null;
    });
  };

  /** Unstakes tsTON instantly. Returns onchain tx hash or null. */
  const unstakeInstant = async (amountNano: string): Promise<string | null> => {
    return withSdkRetry(async (sdk) => {
      const before = await getLatestTxInfo(address ?? '').catch(() => null);
      await sdk.unstakeInstant(BigInt(amountNano));
      const tx = await pollForNewTx(address ?? '', before?.lt ?? null);
      await Promise.all([refresh(), refreshBalance()]);
      return tx?.hash ?? null;
    });
  };


  return {
    ...state,
    availableBalance: walletBalanceNano,
    stake,
    unstake,
    unstakeInstant,
    refresh,
    retryInit,
  };
}
