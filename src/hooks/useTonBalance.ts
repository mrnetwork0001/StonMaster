import { useState, useEffect, useCallback } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { fetchTonBalance } from '../services/tonapi';

export function useTonBalance() {
  const address = useTonAddress();
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setBalance('0');
      return;
    }
    setLoading(true);
    try {
      const bal = await fetchTonBalance(address);
      setBalance(bal);
    } catch {
      setBalance('0');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
