import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RATING } from '../shared/config';
import type { LeaderboardEntry, UserProfile } from '../shared/protocol';
import { softReset } from '../shared/rating';

export interface Store {
  load(id: string): Promise<UserProfile | null>;
  save(user: UserProfile): Promise<void>;
  leaderboard(act: number, limit: number): Promise<LeaderboardEntry[]>;
}

/** アクトが進んでいたらレートをソフトリセットし、アクト内戦績をクリア */
export function rollAct(user: UserProfile, currentAct: number): UserProfile {
  if (user.act >= currentAct) return user;
  let rating = user.rating;
  for (let a = user.act; a < currentAct; a++) rating = softReset(rating);
  return { ...user, rating, act: currentAct, games: 0, wins: 0 };
}

const toEntries = (users: UserProfile[]): LeaderboardEntry[] =>
  users.map((u, i) => ({ rank: i + 1, id: u.id, name: u.name, avatar: u.avatar, rating: u.rating, games: u.games, wins: u.wins }));

/** 開発用: data/users.json に保存（Supabase未設定時） */
export class FileStore implements Store {
  private users = new Map<string, UserProfile>();
  private file = 'data/users.json';
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (existsSync(this.file)) {
      const list = JSON.parse(readFileSync(this.file, 'utf8')) as UserProfile[];
      for (const u of list) this.users.set(u.id, u);
    }
  }
  async load(id: string) {
    return this.users.get(id) ?? null;
  }
  async save(user: UserProfile) {
    this.users.set(user.id, user);
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      mkdirSync('data', { recursive: true });
      writeFileSync(this.file, JSON.stringify([...this.users.values()]));
    }, 500);
  }
  async leaderboard(act: number, limit: number) {
    const list = [...this.users.values()]
      .filter((u) => !u.isGuest && u.act === act && u.games > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
    return toEntries(list);
  }
}

interface Row {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  is_guest: boolean;
  games: number;
  wins: number;
  act: number;
}
const fromRow = (r: Row): UserProfile => ({
  id: r.id, name: r.name, avatar: r.avatar, rating: r.rating, isGuest: r.is_guest, games: r.games, wins: r.wins, act: r.act,
});

/** 本番用: Supabase の profiles テーブル */
export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}
  async load(id: string) {
    const { data, error } = await this.db.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  }
  async save(u: UserProfile) {
    const { error } = await this.db.from('profiles').upsert({
      id: u.id, name: u.name, avatar: u.avatar, rating: u.rating, is_guest: u.isGuest, games: u.games, wins: u.wins, act: u.act,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
  async leaderboard(act: number, limit: number) {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('act', act)
      .eq('is_guest', false)
      .gt('games', 0)
      .order('rating', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return toEntries((data as Row[]).map(fromRow));
  }
}

export const supabaseAdmin: SupabaseClient | null =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

export const store: Store = supabaseAdmin ? new SupabaseStore(supabaseAdmin) : new FileStore();

export const newUser = (id: string, isGuest: boolean, name: string, act: number): UserProfile => ({
  id, name, avatar: 'spade', rating: RATING.initial, isGuest, games: 0, wins: 0, act,
});
