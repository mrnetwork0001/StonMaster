// TON Mainnet addresses
export const TON_NATIVE_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
export const USDT_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
export const TSTON_ADDRESS = 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav';

// Default tokens for strategy builder
export const DEFAULT_TOKENS = [
  { address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', symbol: 'TON', name: 'Toncoin', icon: '💎', decimals: 9, verification: 'whitelist' },
  { address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', symbol: 'USDT', name: 'Tether USD', icon: '💵', decimals: 6, verification: 'whitelist' },
  { address: 'EQBynBO23ywHy_CgarY9NK9FTz0yDRg0KLF0Qf', symbol: 'NOT', name: 'Notcoin', icon: '🪙', decimals: 9, verification: 'whitelist' },
  { address: 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav', symbol: 'tsTON', name: 'Tonstakers TON', icon: '🔷', decimals: 9, verification: 'whitelist' },
  { address: 'EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVf', symbol: 'STON', name: 'STON.fi', icon: '🪨', decimals: 9, verification: 'whitelist' },
];

// API URLs
export const TONAPI_BASE_URL = 'https://tonapi.io/v2';
export const OMNISTON_WS_URL = 'wss://omni-ws.ston.fi';
export const OMNISTON_SANDBOX_URL = 'wss://omni-ws-sandbox.ston.fi';
export const STONFI_API_URL = 'https://api.ston.fi';

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
