import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing in .env file');
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

/**
 * Saves a trade strategy to Supabase and returns the 5-char ID
 */
export async function createShortLink(data: Omit<ShortLink, 'id' | 'created_at'>): Promise<string> {
  const { nanoid } = await import('nanoid');
  const id = nanoid(5); // Generate 5-char alphanumeric ID

  const { error } = await supabase
    .from('short_links')
    .insert([{ id, ...data }]);

  if (error) {
    console.error('Error creating short link:', error);
    throw new Error('Failed to generate short link');
  }

  return id;
}

/**
 * Retrieves a trade strategy from Supabase by its 5-char ID
 */
export async function getShortLink(id: string): Promise<ShortLink | null> {
  const { data, error } = await supabase
    .from('short_links')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching short link:', error);
    return null;
  }

  return data;
}
