import { TONAPI_BASE_URL, TONAPI_KEY } from '../utils/constants';

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

// Mock data for development (when no API key)
const MOCK_JETTONS: JettonBalance[] = [
  {
    balance: '15000000',
    wallet_address: { address: 'EQMock1...', is_scam: false },
    jetton: {
      address: 'EQBynBO23ywHy_CgarY9NK9FTz0yDRg0KLF0Qf',
      name: 'Notcoin',
      symbol: 'NOT',
      decimals: 9,
      image: '',
      verification: 'whitelist',
    },
    price: { prices: { USD: 0.0045 } },
  },
  {
    balance: '250000000',
    wallet_address: { address: 'EQMock2...', is_scam: false },
    jetton: {
      address: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs',
      name: 'Toncoin Wrapped',
      symbol: 'jTON',
      decimals: 9,
      image: '',
      verification: 'whitelist',
    },
    price: { prices: { USD: 3.45 } },
  },
  {
    balance: '8900000000',
    wallet_address: { address: 'EQMock3...', is_scam: false },
    jetton: {
      address: 'EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVf',
      name: 'STON.fi Token',
      symbol: 'STON',
      decimals: 9,
      image: '',
      verification: 'whitelist',
    },
    price: { prices: { USD: 0.00012 } },
  },
  {
    balance: '45000000000',
    wallet_address: { address: 'EQMock4...', is_scam: false },
    jetton: {
      address: 'EQBlqsm144Dq6SjbPI4jjZvA1hqTIP3CvHovbI',
      name: 'DeDust Token',
      symbol: 'DUST',
      decimals: 9,
      image: '',
      verification: 'none',
    },
    price: { prices: { USD: 0.000008 } },
  },
  {
    balance: '100000',
    wallet_address: { address: 'EQMock5...', is_scam: false },
    jetton: {
      address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv',
      name: 'USD₮',
      symbol: 'USDT',
      decimals: 6,
      image: '',
      verification: 'whitelist',
    },
    price: { prices: { USD: 1.0 } },
  },
  {
    balance: '3200000000000',
    wallet_address: { address: 'EQMock6...', is_scam: false },
    jetton: {
      address: 'EQD2NmD_lH5f5u1Kj3KfGyTvhZSX3MbB-xCr',
      name: 'Hamster Kombat',
      symbol: 'HMSTR',
      decimals: 9,
      image: '',
      verification: 'whitelist',
    },
    price: { prices: { USD: 0.0000001 } },
  },
  {
    balance: '75000000',
    wallet_address: { address: 'EQMock7...', is_scam: false },
    jetton: {
      address: 'EQBqSpvo3PP9lTx9l7F_lXMP9l7F_lXMP9l7',
      name: 'Dogs',
      symbol: 'DOGS',
      decimals: 9,
      image: '',
      verification: 'whitelist',
    },
    price: { prices: { USD: 0.0003 } },
  },
];

const isMocked = !TONAPI_KEY || TONAPI_KEY === 'mock_tonapi_key_replace_me';

const headers: Record<string, string> = {};
if (!isMocked && TONAPI_KEY) {
  headers['Authorization'] = `Bearer ${TONAPI_KEY}`;
}

/**
 * Fetch jetton balances for a wallet address
 */
export async function fetchJettonBalances(address: string): Promise<JettonBalance[]> {
  if (isMocked) {
    // Return mock data with a small delay to simulate network
    await new Promise(r => setTimeout(r, 800));
    return MOCK_JETTONS;
  }

  try {
    const response = await fetch(
      `${TONAPI_BASE_URL}/accounts/${address}/jettons?currencies=usd`,
      { headers }
    );
    if (!response.ok) throw new Error(`TonAPI error: ${response.status}`);
    const data: JettonBalancesResponse = await response.json();
    return data.balances;
  } catch (error) {
    console.error('Failed to fetch jetton balances:', error);
    return MOCK_JETTONS; // Fallback to mock
  }
}

/**
 * Fetch TON balance for a wallet address
 */
export async function fetchTonBalance(address: string): Promise<string> {
  if (isMocked) {
    await new Promise(r => setTimeout(r, 400));
    return '5250000000'; // 5.25 TON mock
  }

  try {
    const response = await fetch(
      `${TONAPI_BASE_URL}/accounts/${address}`,
      { headers }
    );
    if (!response.ok) throw new Error(`TonAPI error: ${response.status}`);
    const data: AccountInfo = await response.json();
    return data.balance;
  } catch (error) {
    console.error('Failed to fetch TON balance:', error);
    return '0';
  }
}

/**
 * Fetch metadata for a specific jetton master address
 */
export async function fetchJettonMetadata(jettonAddress: string): Promise<JettonBalance['jetton'] | null> {
  if (isMocked) {
    if (jettonAddress === 'custom_mock_unverified') {
      return {
        address: jettonAddress,
        name: 'New Token',
        symbol: 'NEW',
        decimals: 9,
        verification: 'none'
      };
    }
    return null;
  }

  try {
    const response = await fetch(
      `${TONAPI_BASE_URL}/jettons/${jettonAddress}`,
      { headers }
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
