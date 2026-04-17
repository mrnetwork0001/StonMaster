import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { fetchJettonBalances, fetchTonBalance, getJettonUsdValue } from '../services/tonapi';
import type { JettonBalance } from '../services/tonapi';

export interface JettonWithValue extends JettonBalance {
  usdValue: number;
  isDust: boolean;
}

export function useJettonBalances(dustThreshold: number = 1.0) {
  const { address } = useWallet();
  const [jettons, setJettons] = useState<JettonWithValue[]>([]);
  const [tonBalance, setTonBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setJettons([]);
      setTonBalance('0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [jettonsData, tonBal] = await Promise.all([
        fetchJettonBalances(address),
        fetchTonBalance(address),
      ]);

      const enriched: JettonWithValue[] = jettonsData.map(j => {
        const usdValue = getJettonUsdValue(j);
        return {
          ...j,
          usdValue,
          isDust: usdValue < dustThreshold && usdValue > 0,
        };
      });

      // Sort: dust first, then by value ascending
      enriched.sort((a, b) => {
        if (a.isDust && !b.isDust) return -1;
        if (!a.isDust && b.isDust) return 1;
        return a.usdValue - b.usdValue;
      });

      setJettons(enriched);
      setTonBalance(tonBal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setLoading(false);
    }
  }, [address, dustThreshold]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dustJettons = jettons.filter(j => j.isDust);
  const totalDustValue = dustJettons.reduce((sum, j) => sum + j.usdValue, 0);
  const totalValue = jettons.reduce((sum, j) => sum + j.usdValue, 0);
  const clutterScore = Math.min(100, Math.round((dustJettons.length / Math.max(jettons.length, 1)) * 100));

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
  };
}
