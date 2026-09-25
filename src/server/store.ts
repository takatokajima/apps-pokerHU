import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RATING } from '../shared/config';
import {
  EMPTY_STATS,
  type HandRecord,
  type LeaderboardEntry,
  type LeaderboardTab,
  type MatchRecord,
  type UserProfile,
} from '../shared/protocol';
import { softReset } from '../shared/rating';

export interface Store {
  load(id: string): Promise<UserProfile | null>;
  save(user: UserProfile): Promise<void>;
  leaderboard(tab: LeaderboardTab, act: number, weekStart: number, limit: number): Promise<LeaderboardEntry[]>;
  saveHand(h: HandRecord): Promise<void>;
  handsByMatch(matchId: string): Promise<HandRecord[]>;
  handsByUser(userId: string, limit: number): Promise<HandRecord[]>; // 古い順
  saveMatch(m: MatchRecord): Promise<void>;
  matchesByUser(userId: string, limit: number): Promise<MatchRecord[]>; // 新しい順
}

/** 古いデータに無い項目を補う */
export function normalize(u: Partial<UserProfile> & { id: string }): UserProfile {
  return {
    name: 'Player',
    avatar: 'spade',
    rating: RATING.initial,
    isGuest: true,
    games: 0,
    wins: 0,
    act: 1,
    ...u,
    xHandle: u.xHandle ?? null,
    stats: { ...EMPTY_STATS, ...(u.stats ?? {}) },
  };
}

/** アクトが進んでいたらレートをソフトリセットし、アクト内戦績をクリア */
export function rollAct(user: UserProfile, currentAct: number): UserProfile {
  if (user.act >= currentAct) return user;
  let rating = user.rating;
  for (let a = user.act; a < currentAct; a++) rating = softReset(rating);
  return { ...user, rating, act: currentAct, games: 0, wins: 0 };
}

const entry = (u: UserProfile, i: number, value: number): LeaderboardEntry => ({
  rank: i + 1, id: u.id, name: u.name, avatar: u.avatar, rating: u.rating, games: u.games, wins: u.wins, xHandle: u.xHandle, value,
});

/** プロフィール一覧と今週の勝利数からランキングを作る（共通処理） */
export function rank(tab: LeaderboardTab, users: UserProfile[], weekWins: Map<string, number>, limit: number): LeaderboardEntry[] {
  if (tab === 'week') {
    return users
      .filter((u) => (weekWins.get(u.id) ?? 0) > 0)
      .sort((a, b) => (weekWins.get(b.id) ?? 0) - (weekWins.get(a.id) ?? 0) || b.rating - a.rating)
      .slice(0, limit)
      .map((u, i) => entry(u, i, weekWins.get(u.id) ?? 0));
  }
  if (tab === 'actWins') {
    return users
      .filter((u) => u.wins > 0)
      .sort((a, b) => b.wins - a.wins || b.rating - a.rating)
      .slice(0, limit)
      .map((u, i) => entry(u, i, u.wins));
  }
  return users.sort((a, b) => b.rating - a.rating).slice(0, limit).map((u, i) => entry(u, i, u.rating));
}

const countWins = (ms: MatchRecord[]) => {
  const m = new Map<string, number>();
  for (const r of ms) {
    const w = r.players[r.winner];
    m.set(w, (m.get(w) ?? 0) + 1);
  }
  return m;
};

// ---------------------------------------------------------------------------
/** 開発用: data/ フォルダに保存（Supabase未設定時） */
export class FileStore implements Store {
  private users = new Map<string, UserProfile>();
  private hands: HandRecord[] = [];
  private matches: MatchRecord[] = [];
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    mkdirSync('data', { recursive: true });
    if (existsSync('data/users.json')) {
      for (const u of JSON.parse(readFileSync('data/users.json', 'utf8'))) this.users.set(u.id, normalize(u));
    }
    const lines = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
    this.hands = lines('data/hands.jsonl').slice(-50000);
    this.matches = lines('data/matches.jsonl');
  }
  async load(id: string) {
    return this.users.get(id) ?? null;
  }
  async save(user: UserProfile) {
    this.users.set(user.id, user);
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      writeFileSync('data/users.json', JSON.stringify([...this.users.values()]));
    }, 500);
  }
  async leaderboard(tab: LeaderboardTab, act: number, weekStart: number, limit: number) {
    const users = [...this.users.values()].filter((u) => !u.isGuest && u.act === act && u.games > 0);
    const week = countWins(this.matches.filter((m) => m.mode === 'ranked' && m.at >= weekStart));
    return rank(tab, users, week, limit);
  }
  async saveHand(h: HandRecord) {
    this.hands.push(h);
    appendFileSync('data/hands.jsonl', JSON.stringify(h) + '\n');
  }
  async handsByMatch(matchId: string) {
    return this.hands.filter((h) => h.matchId === matchId);
  }
  async handsByUser(userId: string, limit: number) {
    return this.hands.filter((h) => h.players[0].id === userId || h.players[1].id === userId).slice(-limit);
  }
  async saveMatch(m: MatchRecord) {
    this.matches.push(m);
    appendFileSync('data/matches.jsonl', JSON.stringify(m) + '\n');
  }
  async matchesByUser(userId: string, limit: number) {
    return this.matches.filter((m) => m.players.includes(userId)).slice(-limit).reverse();
  }
}

// ---------------------------------------------------------------------------
interface Row {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  is_guest: boolean;
  games: number;
  wins: number;
  act: number;
  x_handle: string | null;
  stats: UserProfile['stats'] | null;
}
const fromRow = (r: Row): UserProfile =>
  normalize({
    id: r.id, name: r.name, avatar: r.avatar, rating: r.rating, isGuest: r.is_guest, games: r.games, wins: r.wins, act: r.act,
    xHandle: r.x_handle, stats: r.stats ?? undefined,
  });

/** 本番用: Supabase（profiles / matches / hands テーブル） */
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
      x_handle: u.xHandle, stats: u.stats, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
  async leaderboard(tab: LeaderboardTab, act: number, weekStart: number, limit: number) {
    let users: UserProfile[];
    let week = new Map<string, number>();
    if (tab === 'week') {
      const { data, error } = await this.db
        .from('matches')
        .select('data')
        .eq('mode', 'ranked')
        .gte('at', new Date(weekStart).toISOString())
        .limit(20000);
      if (error) throw error;
      week = countWins((data as { data: MatchRecord }[]).map((r) => r.data));
      const ids = [...week.keys()].filter((id) => !id.startsWith('cpu:'));
      if (!ids.length) return [];
      const res = await this.db.from('profiles').select('*').in('id', ids).eq('is_guest', false);
      if (res.error) throw res.error;
      users = (res.data as Row[]).map(fromRow);
    } else {
      const res = await this.db
        .from('profiles')
        .select('*')
        .eq('act', act)
        .eq('is_guest', false)
        .gt('games', 0)
        .order(tab === 'actWins' ? 'wins' : 'rating', { ascending: false })
        .limit(limit);
      if (res.error) throw res.error;
      users = (res.data as Row[]).map(fromRow);
    }
    return rank(tab, users, week, limit);
  }
  async saveHand(h: HandRecord) {
    const { error } = await this.db.from('hands').insert({
      id: h.id, match_id: h.matchId, at: new Date(h.at).toISOString(), p0: h.players[0].id, p1: h.players[1].id, data: h,
    });
    if (error) throw error;
  }
  async handsByMatch(matchId: string) {
    const { data, error } = await this.db.from('hands').select('data').eq('match_id', matchId).order('at');
    if (error) throw error;
    return (data as { data: HandRecord }[]).map((r) => r.data);
  }
  async handsByUser(userId: string, limit: number) {
    const { data, error } = await this.db
      .from('hands')
      .select('data')
      .or(`p0.eq.${userId},p1.eq.${userId}`)
      .order('at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as { data: HandRecord }[]).map((r) => r.data).reverse();
  }
  async saveMatch(m: MatchRecord) {
    const { error } = await this.db.from('matches').insert({
      id: m.id, mode: m.mode, at: new Date(m.at).toISOString(), p0: m.players[0], p1: m.players[1], data: m,
    });
    if (error) throw error;
  }
  async matchesByUser(userId: string, limit: number) {
    const { data, error } = await this.db
      .from('matches')
      .select('data')
      .or(`p0.eq.${userId},p1.eq.${userId}`)
      .order('at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as { data: MatchRecord }[]).map((r) => r.data);
  }
}

export const supabaseAdmin: SupabaseClient | null =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

export const store: Store = supabaseAdmin ? new SupabaseStore(supabaseAdmin) : new FileStore();

export const newUser = (id: string, isGuest: boolean, name: string, act: number): UserProfile =>
  normalize({ id, name, isGuest, act });
