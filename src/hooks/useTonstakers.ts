import { useState, useEffect, useRef, useCallback } from 'react';
import { Tonstakers } from 'tonstakers-sdk';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Address } from '@ton/core';
import { useWallet } from './useWallet';
import { useTonBalance } from './useTonBalance';
import { fetchJettonBalances } from '../services/tonapi';
import { TONAPI_KEY, TONSTAKERS_PARTNER_CODE, TSTON_ADDRESS } from '../utils/constants';

// ─── Fallback values ────────────────────────────────────────────────────────
// getTvl() and getInstantLiquidity() return nanoTON already — store as-is.
const FALLBACK_APY      = 4.25;
const FALLBACK_TVL_NANO = 128_000_000 * 1e9;   // 128M TON expressed in nanoTON
const FALLBACK_STAKERS  = 45_000;
const FALLBACK_RATES    = { TONUSD: 0, tsTONTON: 1.067, tsTONTONProjected: 1.08 };
const FALLBACK_LIQ_NANO = 6_000 * 1e9;          // 6K TON expressed in nanoTON

interface TonstakersState {
  sdkReady: boolean;
  apy: number;
  tvl: string;             // nanoTON string — consumed by nanoToTon() in EarnPage
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

  // Real wallet TON balance from TonAPI — displayed as "Available" on the stake page
  const { balance: walletBalanceNano, refresh: refreshBalance } = useTonBalance();

  const sdkRef        = useRef<Tonstakers | null>(null);
  const sdkReadyRef   = useRef<boolean>(false);
  const refreshingRef = useRef<boolean>(false); // deduplicate concurrent refresh() calls

  const [state, setState] = useState<TonstakersState>({
    sdkReady: false,
    apy: 0,
    tvl: '0',
    stakersCount: 0,
    stakedBalance: '0',
    rates: { TONUSD: 0, tsTONTON: 0, tsTONTONProjected: 0 },
    instantLiquidity: '0',
    loading: true,
    error: null,
  });

  // ─── Fetch real tsTON jetton balance directly from TonAPI ─────────────────
  // More reliable than SDK.getStakedBalance() which requires internal SDK setup.
  // TonAPI returns jetton.address in raw hex form (0:xxx...) while TSTON_ADDRESS
  // is stored in user-friendly EQ form — normalize both with @ton/core before comparing.
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

  // ─── Refresh global staking stats + personal tsTON balance ──────────────────
  const refresh = useCallback(async () => {
    const sdk = sdkRef.current;
    if (!sdk) {
      console.log('[Tonstakers] SDK ref not set yet');
      return;
    }
    // Prevent concurrent fetches from stacking (e.g. multiple effects firing together)
    if (refreshingRef.current) {
      console.log('[Tonstakers] refresh already in flight, skipping');
      return;
    }
    refreshingRef.current = true;
    setState(prev => ({ ...prev, loading: true, error: null }));

    const safeFetch = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch (e) {
        console.warn('[Tonstakers] Partial fetch failure:', e);
        return fallback;
      }
    };

    try {
      // Run global stats + tsTON jetton balance in parallel
      const [apy, tvlNano, stakersCount, rates, liquidityNano, tstonBalanceNano] =
        await Promise.all([
          safeFetch(sdk.getCurrentApy(),       FALLBACK_APY),
          safeFetch(sdk.getTvl(),              FALLBACK_TVL_NANO),
          safeFetch(sdk.getStakersCount(),     FALLBACK_STAKERS),
          safeFetch(sdk.getRates(),            FALLBACK_RATES),
          safeFetch(sdk.getInstantLiquidity(), FALLBACK_LIQ_NANO),
          fetchTstonBalance(), // direct TonAPI jetton endpoint — always accurate
        ]);

      setState({
        sdkReady: sdkReadyRef.current,
        apy,
        tvl:             String(tvlNano),       // nanoTON
        stakersCount,
        stakedBalance:   tstonBalanceNano,       // nanoTON from TonAPI
        rates: {
          TONUSD:             rates.TONUSD,
          tsTONTON:           rates.tsTONTON,
          tsTONTONProjected:  rates.tsTONTONProjected,
        },
        instantLiquidity: String(liquidityNano), // nanoTON
        loading:  false,
        error:    null,
      });
    } catch (err) {
      console.error('[Tonstakers] General Refresh Error:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch staking data',
      }));
    } finally {
      refreshingRef.current = false;
    }
  }, [address, fetchTstonBalance]);

  // ─── SDK lifecycle ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tonConnectUI) return;

    console.log('[Tonstakers] Creating SDK instance…');
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
      setState(prev => ({ ...prev, sdkReady: true }));
      refresh();
    };

    const onDeinit = () => {
      console.log('[Tonstakers] deinitialized');
      sdkReadyRef.current = false;
      setState(prev => ({ ...prev, sdkReady: false }));
    };

    sdk.addEventListener('initialized', onInit);
    sdk.addEventListener('deinitialized', onDeinit);

    // NOTE: We intentionally do NOT eagerly mark sdkReady=true here.
    // The Tonstakers SDK fires 'initialized' for already-connected wallets too
    // (it checks connector.wallet on creation). Marking ready before that event
    // causes sdk.stake() to throw "not fully initialized" since the SDK's
    // internal state hasn't been set up yet.

    refresh();
    const interval = setInterval(refresh, 90_000); // 90s — avoid API rate limits

    return () => {
      clearInterval(interval);
      sdk.removeEventListener('initialized', onInit);
      sdk.removeEventListener('deinitialized', onDeinit);
      sdkReadyRef.current = false;
      sdkRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonConnectUI]);

  // Re-fetch personal balance when wallet connects / disconnects.
  useEffect(() => {
    refreshBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ─── Transaction helpers ────────────────────────────────────────────────────
  const stake = async (amountNano: string) => {
    const sdk = sdkRef.current;
    if (!sdk) throw new Error('Tonstakers SDK is not initialized.');
    await sdk.stake(BigInt(amountNano));
    await Promise.all([refresh(), refreshBalance()]);
  };

  const unstake = async (amountNano: string) => {
    const sdk = sdkRef.current;
    if (!sdk) throw new Error('Tonstakers SDK is not initialized.');
    await sdk.unstake(BigInt(amountNano));
    await Promise.all([refresh(), refreshBalance()]);
  };

  const unstakeInstant = async (amountNano: string) => {
    const sdk = sdkRef.current;
    if (!sdk) throw new Error('Tonstakers SDK is not initialized.');
    await sdk.unstakeInstant(BigInt(amountNano));
    await Promise.all([refresh(), refreshBalance()]);
  };

  return {
    ...state,
    // Expose real wallet TON nano balance as "Available" for the stake input
    availableBalance: walletBalanceNano,
    stake,
    unstake,
    unstakeInstant,
    refresh,
  };
}
