import { createClient } from "@supabase/supabase-js";

// Public by design (shipped to every browser), so they default here and hosting needs no env setup.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gtgpnzoumflvzvswcdpt.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_bQvvbfbeQEr0iaBV5CURtA_eU5seqSD";

// One client for server and browser: the key is publishable and every call is a token-checked RPC.
export const sb = createClient(url, key, { auth: { persistSession: false } });

export function photoUrl(path: string) {
  return `${url}/storage/v1/object/public/photos/${path}`;
}

/** Calls a database function and throws its error message (e.g. NOT_ALLOWED) on failure. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
