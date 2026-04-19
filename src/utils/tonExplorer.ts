/**
 * Shared utility for fetching TON transaction info and polling for new transactions.
 * Used by both EarnPage (stake) and SweepPage (batch sweep) to get tx hashes
 * for "View in Explorer" links.
 */
import { TONAPI_BASE_URL, TONAPI_KEY } from './constants';

export function tonviewerUrl(hash: string): string {
  return `https://tonviewer.com/transaction/${hash}`;
}

function apiHeaders(): Record<string, string> {
  return TONAPI_KEY && TONAPI_KEY !== 'mock_tonapi_key_replace_me'
    ? { Authorization: `Bearer ${TONAPI_KEY}` }
    : {};
}

export interface TxInfo {
  lt: string;
  hash: string; // base64url tx hash - used by tonviewer
}

/** Returns the most recent transaction for a wallet, or null on failure. */
export async function getLatestTxInfo(address: string): Promise<TxInfo | null> {
  try {
    const r = await fetch(
      `${TONAPI_BASE_URL}/blockchain/accounts/${address}/transactions?limit=1`,
      { headers: apiHeaders() }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const tx = d.transactions?.[0];
    if (!tx) return null;
    return { lt: String(tx.lt), hash: tx.hash };
  } catch { return null; }
}

/**
 * Polls TonAPI every `intervalMs` until a new transaction (with a different lt)
 * appears, or the timeout is reached.
 * Returns the new transaction's info (including hash), or null on timeout.
 */
export async function pollForNewTx(
  address: string,
  prevLt: string | null,
  timeoutMs = 60_000,
  intervalMs = 2_500,
): Promise<TxInfo | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));
    const info = await getLatestTxInfo(address);
    if (info && info.lt !== prevLt) return info;
  }
  return null;
}
