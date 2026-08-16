import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// The token getter is set by useSupabaseAuth() in the app root.
// All Supabase calls use this to attach the Clerk JWT as the Bearer token.
let _getClerkToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(fn: () => Promise<string | null>) {
  _getClerkToken = fn;
}

export async function getClerkToken(): Promise<string | null> {
  if (!_getClerkToken) return null;
  try {
    return await _getClerkToken();
  } catch {
    return null;
  }
}

async function clerkFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let token: string | null = null;
  if (_getClerkToken) {
    try {
      token = await _getClerkToken();
    } catch {
      // Token retrieval failed (e.g. Clerk refreshing mid-navigation); proceed without auth header.
    }
  }
  const headers = new Headers((init?.headers as HeadersInit) ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: clerkFetch },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionFromUrl: false },
});

export type Product = {
  id: string;
  clerk_user_id: string;
  title: string;
  description: string;
  price: number | null;
  tags: string[] | null;
  image_url: string;
  shopify_product_id: string | null;
  shopify_status: 'pending' | 'published' | 'failed' | null;
  shopify_url: string | null;
  ai_raw_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AppSetting = {
  id: string;
  clerk_user_id: string;
  key: string;
  value: string;
};

export async function getSetting(key: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .eq('clerk_user_id', userId)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string, userId: string): Promise<void> {
  await supabase
    .from('app_settings')
    .upsert({ key, value, clerk_user_id: userId }, { onConflict: 'clerk_user_id,key' });
}
