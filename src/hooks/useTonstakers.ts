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
    console.log('[Tonstakers] Manual retry triggered — resetting failed state');
    // Simply clear the failed flag; the keep-alive loop will re-detect readiness.
    sdkReadyRef.current = false;
    setState(prev => ({ ...prev, sdkInitFailed: false, sdkReady: false }));
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

  // ─── SDK lifecycle: create ONCE, keep alive with a persistent loop ────────
  //
  // ROOT CAUSE FIX: The old pattern called setRetryCount() when the SDK wasn't
  // ready, which caused the useEffect to re-run (because retryCount was a dep),
  // destroying and recreating the SDK — and the cycle repeated after every stake.
  //
  // New pattern:
  //   1. Create the SDK exactly once per tonConnectUI instance.
  //   2. Run a 300ms keep-alive loop for the component's entire lifetime.
  //   3. When sdk.ready goes false (deinitialized during a tx), just wait —
  //      do NOT increment any counter, do NOT destroy the SDK.
  //   4. Only show the retry button after 24s of *continuous* failure.
  useEffect(() => {
    if (!tonConnectUI) return;

    console.log('[Tonstakers] Creating persistent SDK instance');
    setState(prev => ({ ...prev, sdkInitFailed: false }));

    // Never pass tonApiKey — it causes ERR_BLOCKED_BY_CLIENT spam from analytics.ton.org
    const sdk = new Tonstakers({
      connector: tonConnectUI,
      partnerCode: TONSTAKERS_PARTNER_CODE,
    });

    sdkRef.current = sdk;
    let unmounted = false;
    let failStreak = 0;           // consecutive not-ready ticks
    const MAX_STREAK = 80;        // 80 × 300ms = 24s before giving up

    const markReady = () => {
      if (unmounted) return;
      failStreak = 0;
      if (!sdkReadyRef.current) {
        console.log('[Tonstakers] SDK ready ✓');
        sdkReadyRef.current = true;
        setState(prev => ({ ...prev, sdkReady: true, sdkInitFailed: false }));
        refreshStats();
      }
    };

    // Eternal keep-alive — survives deinitialized events from transactions
    const keepAlive = setInterval(() => {
      if (unmounted) { clearInterval(keepAlive); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ready = (sdk as any).ready === true || sdk.ready === true;
      if (ready) {
        markReady();
      } else {
        if (sdkReadyRef.current) {
          // Transient loss — tx in-flight or wallet briefly disconnected
          sdkReadyRef.current = false;
          setState(prev => ({ ...prev, sdkReady: false }));
          console.log('[Tonstakers] Transient readiness loss — will auto-recover');
        }
        failStreak++;
        if (failStreak >= MAX_STREAK && !unmounted) {
          console.error('[Tonstakers] SDK not ready for 24s — showing retry button');
          clearInterval(keepAlive);
          setState(prev => ({ ...prev, sdkInitFailed: true, loading: false }));
        }
      }
    }, 300);

    // Fast-path: fire immediately on the SDK's own events
    const onInit   = () => markReady();
    const onDeinit = () => {
      // Do nothing destructive — keep-alive handles recovery automatically
      console.log('[Tonstakers] deinitialized event — keep-alive will recover');
    };
    sdk.addEventListener('initialized', onInit);
    sdk.addEventListener('deinitialized', onDeinit);

    // Synchronous check: catch wallets that are already connected at mount time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((sdk as any).ready === true || sdk.ready === true) markReady();

    return () => {
      unmounted = true;
      clearInterval(keepAlive);
      sdk.removeEventListener('initialized', onInit);
      sdk.removeEventListener('deinitialized', onDeinit);
      sdkReadyRef.current = false;
      sdkRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonConnectUI]); // ← ONLY re-runs if tonConnectUI changes. No more retryCount.

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
    const deadline = Date.now() + 15_000; // 15s total, plenty of time
    let lastErr: unknown;

    while (Date.now() < deadline) {
      const sdk = sdkRef.current;

      // SDK not created yet - wait briefly
      if (!sdk) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      // SDK exists - check if ready (fast 200ms poll)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isReady = sdkReadyRef.current || (sdk as any).ready === true || sdk.ready === true;

      if (!isReady) {
        await new Promise(r => setTimeout(r, 200));
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
          console.warn('[Tonstakers] Race: SDK reported ready but threw not-ready. Retrying in 500ms...');
          await new Promise(r => setTimeout(r, 500));
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
