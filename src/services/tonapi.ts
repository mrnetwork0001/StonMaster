import { TONAPI_BASE_URL, TONAPI_KEY, TONCENTER_API_URL } from '../utils/constants';

/**
 * Helper for retrying fetches
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (retries > 0 && (response.status === 429 || response.status >= 500)) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export interface JettonBalance {
  balance: string;
  wallet_address: {
    address: string;
    name?: string;
    is_scam: boolean;
  };
  jetton: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    image?: string;
    verification: string;
  };
  price?: {
    prices?: Record<string, number>;
  };
}

export interface JettonBalancesResponse {
  balances: JettonBalance[];
}

export interface AccountInfo {
  balance: string;
  status: string;
  address: {
    address: string;
  };
}



/**
 * Build request headers, picking up the current TONAPI_KEY each call.
 * (A static const initialised at module-load time would miss late env changes.)
 */
function getHeaders(): Record<string, string> {
  const key = TONAPI_KEY;
  if (key && key !== 'mock_tonapi_key_replace_me') {
    return { Authorization: `Bearer ${key}` };
  }
  return {};
}

const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();

/**
 * Deduplicates identical requests made within a short TTL
 */
function withCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = requestCache.get(key);
  if (cached && now - cached.timestamp < ttl) {
    return cached.promise;
  }
  const promise = fetcher().catch((err) => {
    requestCache.delete(key);
    throw err;
  });
  requestCache.set(key, { promise, timestamp: now });
  return promise;
}

/**
 * Force-invalidates cached entries for an address so the next fetch hits the network.
 * Call this before a user-initiated manual refresh to bypass the TTL.
 */
export function invalidateBalanceCache(address: string): void {
  requestCache.delete(`jettons-${address}`);
  requestCache.delete(`ton-${address}`);
}

/**
 * Fetch jetton balances for a wallet address
 */
export async function fetchJettonBalances(address: string): Promise<JettonBalance[]> {
  return withCache(`jettons-${address}`, 5000, async () => {
    const response = await fetchWithRetry(
      `${TONAPI_BASE_URL}/accounts/${address}/jettons?currencies=usd`,
      { headers: getHeaders() }
    );
    if (!response.ok) throw new Error(`TonAPI error: ${response.status}`);
    const data: JettonBalancesResponse = await response.json();
    return data.balances;
  });
}

/**
 * Fetch TON balance for a wallet address
 */
export async function fetchTonBalance(address: string): Promise<string> {
  return withCache(`ton-${address}`, 5000, async () => {
    // 1. Try TonAPI first
    try {
      const response = await fetchWithRetry(
        `${TONAPI_BASE_URL}/accounts/${address}`,
        { headers: getHeaders() }
      );
      if (response.ok) {
        const data: AccountInfo = await response.json();
        return data.balance;
      }
      console.warn(`TonAPI failed (${response.status}), trying Toncenter fallback...`);
    } catch (error) {
      console.warn('TonAPI request failed, trying Toncenter fallback:', error);
    }

    // 2. Fallback to Toncenter
    const response = await fetch(
      `${TONCENTER_API_URL}/jsonRPC`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'getAddressInformation',
          params: { address }
        })
      }
    );
    if (!response.ok) throw new Error(`Toncenter error: ${response.status}`);
    const data = await response.json();
    if (data.result && data.result.balance !== undefined) {
      return data.result.balance;
    }
    
    throw new Error('All balance fetchers failed to retrieve balance');
  });
}

/**
 * Fetch metadata for a specific jetton master address
 */
export async function fetchJettonMetadata(jettonAddress: string): Promise<JettonBalance['jetton'] | null> {

  try {
    const response = await fetch(
      `${TONAPI_BASE_URL}/jettons/${jettonAddress}`,
      { headers: getHeaders() }
    );
    if (!response.ok) return null;
    const data = await response.json();
    
    // TonAPI returns jetton metadata in a slightly different format here
    // but we'll normalize it to our JettonBalance['jetton'] format
    return {
      address: data.metadata.address || jettonAddress,
      name: data.metadata.name,
      symbol: data.metadata.symbol,
      decimals: Number(data.metadata.decimals),
      image: data.metadata.image,
      verification: data.verification || 'none',
    };
  } catch (error) {
    console.error('Failed to fetch jetton metadata:', error);
    return null;
  }
}

/**
 * Calculate USD value from jetton balance
 */
export function getJettonUsdValue(jetton: JettonBalance): number {
  const amount = Number(jetton.balance) / Math.pow(10, jetton.jetton.decimals);
  const price = jetton.price?.prices?.USD || 0;
  return amount * price;
}
