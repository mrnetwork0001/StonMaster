/**
 * Format a number with commas and decimal places
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number as USD currency
 */
export function formatUSD(value: number): string {
  if (isNaN(value) || value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  return `$${formatNumber(value, 2)}`;
}

/**
 * Format TON amounts from nanoton
 */
export function formatTON(nanoton: number | string): string {
  const value = Number(nanoton) / 1e9;
  if (value === 0) return '0';
  if (value < 0.001) return '<0.001';
  return formatNumber(value, value < 1 ? 4 : 2);
}

/**
 * Format a jetton amount given its raw balance and decimals
 */
export function formatJettonAmount(rawBalance: string, decimals: number): string {
  const value = Number(rawBalance) / Math.pow(10, decimals);
  if (value === 0) return '0';
  if (value < 0.0001) return '<0.0001';
  return formatNumber(value, value < 1 ? 4 : 2);
}

/**
 * Truncate a wallet address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address || address.length < chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a percentage
 */
export function formatPercent(value: number): string {
  if (isNaN(value)) return '0%';
  return `${formatNumber(value, 2)}%`;
}

/**
 * Convert nanoton string to TON number
 */
export function nanoToTon(nanoton: string | number): number {
  return Number(nanoton) / 1e9;
}

/**
 * Convert TON to nanoton string
 */
export function tonToNano(ton: number): string {
  return Math.floor(ton * 1e9).toString();
}

/**
 * Time ago format
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() / 1000) - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
