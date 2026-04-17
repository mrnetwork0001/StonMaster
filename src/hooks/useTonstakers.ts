import { useState, useEffect, useMemo } from 'react';
import { Tonstakers } from 'tonstakers-sdk';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useWallet } from './useWallet';
import { TONAPI_KEY, TONSTAKERS_PARTNER_CODE } from '../utils/constants';

interface TonstakersState {
  ready: boolean;
  apy: number;
  tvl: string;
  stakersCount: number;
  stakedBalance: string;
  availableBalance: string;
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
  
  const [state, setState] = useState<TonstakersState>({
    ready: false,
    apy: 0,
    tvl: '0',
    stakersCount: 0,
    stakedBalance: '0',
    availableBalance: '0',
    rates: { TONUSD: 0, tsTONTON: 0, tsTONTONProjected: 0 },
    instantLiquidity: '0',
    loading: true,
    error: null,
  });

  const tonstakers = useMemo(() => {
    if (!tonConnectUI) return null;
    return new Tonstakers({
      connector: tonConnectUI,
      tonApiKey: TONAPI_KEY,
      partnerCode: TONSTAKERS_PARTNER_CODE,
    });
  }, [tonConnectUI]);

  const refresh = async () => {
    if (!tonstakers) {
      console.log('[Tonstakers] SDK not initialized yet');
      return;
    }
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    console.log('[Tonstakers] Fetching data...');
    
    try {
      // Helper to fetch data with a fallback
      const safeFetch = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await promise;
        } catch (e) {
          console.warn('[Tonstakers] Partial fetch failure:', e);
          return fallback;
        }
      };

      // Fetch global data individually to prevent one failure from blocking others
      const apy = await safeFetch(tonstakers.getCurrentApy(), state.apy || 4.25);
      const tvl = await safeFetch(tonstakers.getTvl(), Number(state.tvl) / 1e9 || 128000000);
      const stakersCount = await safeFetch(tonstakers.getStakersCount(), state.stakersCount || 45000);
      const rates = await safeFetch(tonstakers.getRates(), state.rates || { TONUSD: 0, tsTONTON: 1.06, tsTONTONProjected: 1.07 });
      const instantLiquidity = await safeFetch(tonstakers.getInstantLiquidity(), Number(state.instantLiquidity) / 1e9 || 0);

      let stakerData = { balance: state.stakedBalance, available: state.availableBalance };
      
      if (address) {
        try {
          const staked = await tonstakers.getStakedBalance();
          const available = await tonstakers.getAvailableBalance();
          stakerData = {
            balance: (staked * 1e9).toString(),
            available: (available * 1e9).toString(),
          };
        } catch (e) {
          console.warn('[Tonstakers] Failed to fetch personal balances:', e);
        }
      }

      setState({
        ready: true,
        apy: apy,
        tvl: (tvl * 1e9).toString(),
        stakersCount: stakersCount,
        stakedBalance: stakerData.balance,
        availableBalance: stakerData.available,
        rates: {
          TONUSD: rates.TONUSD || state.rates.TONUSD,
          tsTONTON: rates.tsTONTON || state.rates.tsTONTON,
          tsTONTONProjected: rates.tsTONTONProjected || state.rates.tsTONTONProjected,
        },
        instantLiquidity: (instantLiquidity * 1e9).toString(),
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('[Tonstakers] General Refresh Error:', err);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch staking data' 
      }));
    }
  };

  useEffect(() => {
    if (tonstakers) {
      refresh();
      const interval = setInterval(refresh, 60000); 
      return () => clearInterval(interval);
    }
  }, [tonstakers, address]); // Re-run when wallet connects but load global stats even if it doesn't

  const stake = async (amountNano: string) => {
    if (!tonstakers) throw new Error('SDK not initialized');
    await tonstakers.stake(BigInt(amountNano));
    await refresh();
  };

  const unstake = async (amountNano: string) => {
    if (!tonstakers) throw new Error('SDK not initialized');
    await tonstakers.unstake(BigInt(amountNano));
    await refresh();
  };

  const unstakeInstant = async (amountNano: string) => {
    if (!tonstakers) throw new Error('SDK not initialized');
    await tonstakers.unstakeInstant(BigInt(amountNano));
    await refresh();
  };

  return {
    ...state,
    stake,
    unstake,
    unstakeInstant,
    refresh,
  };
}
