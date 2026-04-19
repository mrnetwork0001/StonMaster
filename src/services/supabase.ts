import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasSupabase = !!(supabaseUrl && supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder'));

if (!hasSupabase) {
  console.warn('[Supabase] Credentials not configured - using localStorage fallback for short links.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export interface ShortLink {
  id: string;
  from_token: string;
  to_token: string;
  amount: string;
  referrer: string;
  created_at?: string;
}

// ─── localStorage fallback (no Supabase configured) ─────────────────────────
const LS_KEY = 'stonmaster_short_links';

function lsGet(id: string): ShortLink | null {
  try {
    const map: Record<string, ShortLink> = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return map[id] ?? null;
  } catch { return null; }
}

function lsSave(link: ShortLink): void {
  try {
    const map: Record<string, ShortLink> = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    map[link.id] = link;
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Saves a trade strategy and returns the 5-char short ID.
 * Falls back to localStorage if Supabase is not configured.
 */
export async function createShortLink(data: Omit<ShortLink, 'id' | 'created_at'>): Promise<string> {
  const { nanoid } = await import('nanoid');
  const id = nanoid(5);

  if (!hasSupabase) {
    // localStorage mode - link only works on this browser, but still useful for demo
    lsSave({ id, ...data });
    return id;
  }

  const { error } = await supabase.from('short_links').insert([{ id, ...data }]);
  if (error) {
    console.error('[Supabase] Error creating short link:', error);
    // Fallback to localStorage so the user isn't stuck
    lsSave({ id, ...data });
    console.info('[Supabase] Saved to localStorage as fallback.');
    return id;
  }

  return id;
}

/**
 * Retrieves a trade strategy by its short ID.
 * Checks localStorage first (for locally created links), then Supabase.
 */
export async function getShortLink(id: string): Promise<ShortLink | null> {
  // Always check localStorage first (works in both modes)
  const local = lsGet(id);
  if (local) return local;

  if (!hasSupabase) return null;

  const { data, error } = await supabase
    .from('short_links')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Supabase] Error fetching short link:', error);
    return null;
  }

  return data;
}
