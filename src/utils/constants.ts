// TON Mainnet addresses
export const TON_NATIVE_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
export const USDT_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
export const TSTON_ADDRESS = 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav';

export interface Token {
  address: string;
  symbol: string;
  name: string;
  icon: string;
  decimals: number;
  verification: 'whitelist' | 'none' | 'blacklist';
}

// Default tokens for strategy builder
export const DEFAULT_TOKENS: Token[] = [
  {
    address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
    symbol: 'TON', name: 'Toncoin', decimals: 9, verification: 'whitelist',
    icon: 'https://cache.tonapi.io/imgproxy/a53RmBJv70J8qYJcRhSmTpkxPHGqUrJbFHKriT-q9Kk/rs:fill:200:200:1/aHR0cHM6Ly9zdGF0aWMuc3Rvbi5maS90b2tlbnMvdG9uX3N5bWJvbC5wbmc.webp',
  },
  {
    address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    symbol: 'USDT', name: 'Tether USD', decimals: 6, verification: 'whitelist',
    icon: 'https://cache.tonapi.io/imgproxy/XpCFg3IUxMBPP7DHhN3k9b2GhqAJNS5RTQTGULIJ5Os/rs:fill:200:200:1/aHR0cHM6Ly90ZXRoZXIudG8vaW1hZ2VzL2xvZ29DaXJjbGUucG5n.webp',
  },
  {
    address: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT',
    symbol: 'NOT', name: 'Notcoin', decimals: 9, verification: 'whitelist',
    icon: 'https://cache.tonapi.io/imgproxy/P1OAbUH6-L1RKqmGqVKHoCe_mRmW0Cnn8TRTJHAP4GU/rs:fill:200:200:1/aHR0cHM6Ly9zdGF0aWMuc3Rvbi5maS90b2tlbnMvbm90Y29pbi5wbmc.webp',
  },
  {
    address: 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav',
    symbol: 'tsTON', name: 'Tonstakers TON', decimals: 9, verification: 'whitelist',
    icon: 'https://cache.tonapi.io/imgproxy/07zGQCbHyz07a4qMGOl2BuiT2lG9aH01fGxJWmm0Zyg/rs:fill:200:200:1/aHR0cHM6Ly9hcGkudG9uc3Rha2Vycy5jb20vc3RhdGljL3RzVE9OLnBuZw.webp',
  },
  {
    address: 'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmn32llF6',
    symbol: 'STON', name: 'STON.fi', decimals: 9, verification: 'whitelist',
    icon: 'https://cache.tonapi.io/imgproxy/FliLF5hFMZznnKMaWHWdBxnSUJhvxvAzE1J7fGmHhVo/rs:fill:200:200:1/aHR0cHM6Ly9zdGF0aWMuc3Rvbi5maS90b2tlbnMvc3Rvbi5zdmc.webp',
  },
];


// API URLs
export const TONAPI_BASE_URL = 'https://tonapi.io/v2';
export const TONCENTER_API_URL = 'https://toncenter.com/api/v2';
export const OMNISTON_WS_URL = 'wss://omni-ws.ston.fi';
export const OMNISTON_SANDBOX_URL = 'wss://omni-ws-sandbox.ston.fi';

// App Config
export const APP_NAME = 'StonMaster';
export const DUST_THRESHOLD_USD = 1.0;
export const DEFAULT_SLIPPAGE_BPS = 300; // 3%
export const MANIFEST_URL = import.meta.env.VITE_MANIFEST_URL || '/tonconnect-manifest.json';
export const TONAPI_KEY = import.meta.env.VITE_TONAPI_KEY || '';
export const TONSTAKERS_PARTNER_CODE = Number(import.meta.env.VITE_TONSTAKERS_PARTNER_CODE) || 0;

// Module colors for consistent theming
export const MODULE_COLORS = {
  sweep: { primary: 'hsl(210, 100%, 60%)', gradient: 'linear-gradient(135deg, hsl(210, 100%, 60%), hsl(160, 100%, 50%))' },
  earn: { primary: 'hsl(160, 100%, 50%)', gradient: 'linear-gradient(135deg, hsl(160, 100%, 50%), hsl(100, 80%, 50%))' },
  share: { primary: 'hsl(280, 80%, 60%)', gradient: 'linear-gradient(135deg, hsl(280, 80%, 60%), hsl(320, 80%, 60%))' },
};
