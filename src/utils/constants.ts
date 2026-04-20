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
    icon: 'https://static.ston.fi/logo/ton_symbol.png',
  },
  {
    address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    symbol: 'USDT', name: 'Tether USD', decimals: 6, verification: 'whitelist',
    icon: 'https://tether.to/images/logoCircle.png',
  },
  {
    address: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT',
    symbol: 'NOT', name: 'Notcoin', decimals: 9, verification: 'whitelist',
    icon: 'https://cdn.joincommunity.xyz/clicker/not_logo.png',
  },
  {
    address: 'EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav',
    symbol: 'tsTON', name: 'Tonstakers TON', decimals: 9, verification: 'whitelist',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjUxJyBoZWlnaHQ9JzI1MScgZmlsbD0nbm9uZScgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZyBjbGlwLXBhdGg9J3VybCgjY2xpcDBfMzQ5XzI2NjUpJz48cmVjdCB4PScuNDY1JyB5PScuODQ1JyB3aWR0aD0nMjUwJyBoZWlnaHQ9JzI1MCcgcng9JzEyNScgZmlsbD0nIzAwMCcvPjxlbGxpcHNlIGN4PSc1Mi4wMycgY3k9Jzc2LjUxNCcgcng9JzUyLjAzJyByeT0nNzYuNTE0JyB0cmFuc2Zvcm09J3JvdGF0ZSgzMCAtNy40NTYgMjYyLjc1MyknIGZpbGw9JyNEOEZBRkYnLz48ZWxsaXBzZSBjeD0nMTYuOTA5JyBjeT0nMjQuODY2JyByeD0nMTYuOTA5JyByeT0nMjQuODY2JyB0cmFuc2Zvcm09J3JvdGF0ZSgzMCAtNzIuNDUzIDE1NC4xMzcpJyBmaWxsPScjRDhGQUZGJy8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0nY2xpcDBfMzQ5XzI2NjUnPjxwYXRoIGZpbGw9JyNmZmYnIHRyYW5zZm9ybT0ndHJhbnNsYXRlKC40NjUgLjg0NSknIGQ9J00wIDBIMjUwVjI1MEgweicvPjwvY2xpcFBhdGg+PC9kZWZzPjwvc3ZnPg==',
  },
  {
    address: 'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmn32llF6',
    symbol: 'STON', name: 'STON.fi', decimals: 9, verification: 'whitelist',
    icon: 'https://static.ston.fi/logo/ston_symbol.png',
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
// IMPORTANT: Must always be an absolute URL — Tonkeeper fetches this from outside
// the browser context and cannot resolve relative paths.
export const MANIFEST_URL = 'https://ston-master.vercel.app/tonconnect-manifest.json';
export const TONAPI_KEY = import.meta.env.VITE_TONAPI_KEY || '';
export const TONSTAKERS_PARTNER_CODE = Number(import.meta.env.VITE_TONSTAKERS_PARTNER_CODE) || 0;

// Module colors for consistent theming
export const MODULE_COLORS = {
  sweep: { primary: 'hsl(210, 100%, 60%)', gradient: 'linear-gradient(135deg, hsl(210, 100%, 60%), hsl(160, 100%, 50%))' },
  earn: { primary: 'hsl(160, 100%, 50%)', gradient: 'linear-gradient(135deg, hsl(160, 100%, 50%), hsl(100, 80%, 50%))' },
  share: { primary: 'hsl(280, 80%, 60%)', gradient: 'linear-gradient(135deg, hsl(280, 80%, 60%), hsl(320, 80%, 60%))' },
};
