import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from './useWallet';
import { fetchJettonBalances, fetchTonBalance, getJettonUsdValue, invalidateBalanceCache } from '../services/tonapi';
import type { JettonBalance } from '../services/tonapi';

export interface JettonWithValue extends JettonBalance {
  usdValue: number;
  isDust: boolean;
}

export function useJettonBalances(dustThreshold: number = 1.0) {
  const { address } = useWallet();
  const [jettons, setJettons] = useState<JettonWithValue[]>([]);
  const [tonBalance, setTonBalance] = useState<string>('0');
  // Start as true so the skeleton shows immediately — avoids the 0 → skeleton → value flash
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef   = useRef(false);
  const refreshingRef  = useRef(false); // deduplicate concurrent calls

  const fetchAndUpdate = useCallback(async () => {
    if (!address) {
      setJettons([]);
      setTonBalance('0');
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (refreshingRef.current) return;
    refreshingRef.current = true;

    // Only show the loading skeleton on the very first fetch for this address.
    // Background refreshes keep existing data visible.
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);

    try {
      const [jettonsData, tonBal] = await Promise.all([
        fetchJettonBalances(address),
        fetchTonBalance(address),
      ]);

      const enriched: JettonWithValue[] = jettonsData
        .filter(j => BigInt(j.balance || '0') > 0n)   // drop zero-balance jetton wallets
        .map(j => {
          const usdValue = getJettonUsdValue(j);
          return {
            ...j,
            usdValue,
            isDust: usdValue < dustThreshold && usdValue > 0,
          };
        });

      // Sort: highest value first so wallet tokens appear at the top
      enriched.sort((a, b) => b.usdValue - a.usdValue);

      setJettons(enriched);
      setTonBalance(tonBal);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [address, dustThreshold]);

  // Normal background refresh (respects cache TTL)
  const refresh = useCallback(() => fetchAndUpdate(), [fetchAndUpdate]);

  // Force refresh — bypasses the request cache so the network is always hit.
  // Use this for user-initiated refresh buttons (SweepPage, etc.)
  const forceRefresh = useCallback(() => {
    if (address) invalidateBalanceCache(address);
    refreshingRef.current = false; // release any stuck lock
    return fetchAndUpdate();
  }, [address, fetchAndUpdate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dustJettons   = jettons.filter(j => j.isDust);
  const totalDustValue = dustJettons.reduce((sum, j) => sum + j.usdValue, 0);
  const totalValue    = jettons.reduce((sum, j) => sum + j.usdValue, 0);
  const clutterScore  = Math.min(100, Math.round((dustJettons.length / Math.max(jettons.length, 1)) * 100));

  return {
    jettons,
    dustJettons,
    tonBalance,
    totalDustValue,
    totalValue,
    clutterScore,
    loading,
    error,
    refresh,
    forceRefresh,
  };
}
