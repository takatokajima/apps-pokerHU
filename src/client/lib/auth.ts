import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase が設定されていれば使う。未設定ならローカルのゲストIDで遊ぶ */
export const supabase: SupabaseClient | null = url && key && url.startsWith('http') ? createClient(url, key) : null;
export const authEnabled = !!supabase;

let token: string | null = null;
let email: string | null = null;
const listeners = new Set<() => void>();

export const getToken = () => token;
export const getEmail = () => email;
export const onAuthChange = (f: () => void) => (listeners.add(f), () => listeners.delete(f));

export function localGuestId(): string {
  try {
    let id = localStorage.getItem('guestId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('guestId', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** 起動時: セッションが無ければ匿名（ゲスト）としてサインイン */
export async function initAuth() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) await supabase.auth.signInAnonymously();
  const s = (await supabase.auth.getSession()).data.session;
  token = s?.access_token ?? null;
  email = s?.user.email ?? null;
  supabase.auth.onAuthStateChange((_e, session) => {
    const changed = session?.access_token !== token;
    token = session?.access_token ?? null;
    email = session?.user.email ?? null;
    if (changed) listeners.forEach((f) => f());
  });
}

const redirectTo = () => window.location.origin;

/** ゲスト → アカウント化（同じIDのままなのでレートを引き継げる） */
export async function linkProvider(provider: 'google' | 'apple') {
  if (!supabase) return;
  const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: redirectTo() } });
  if (error) throw error;
}

export async function linkEmail(address: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: redirectTo() });
  if (error) throw error;
}

/** 既存アカウントでログイン（この端末のゲスト記録は破棄される） */
export async function signInProvider(provider: 'google' | 'apple') {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
}

export async function signInEmail(address: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  await supabase.auth.signInAnonymously();
}
