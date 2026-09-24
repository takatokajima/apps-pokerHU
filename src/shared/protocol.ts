import type { Card, HandCategory } from './cards';

export type MatchMode = 'ranked' | 'friend' | 'cpu';
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  isGuest: boolean;
  games: number;
  wins: number;
  act: number;
}

export interface SeatView {
  name: string;
  avatar: string;
  rating: number | null;
  isCpu: boolean;
  isGuest: boolean;
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  connected: boolean;
  cards: Card[] | null; // 見えない場合は null
  timebanks: number;
  isButton: boolean;
}

export interface LegalActions {
  canCheck: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
}

export interface HandResult {
  winners: number[]; // seat index
  won: number[]; // 各席の獲得額
  categories: (HandCategory | null)[];
  byFold: boolean;
}

export interface TableState {
  matchId: string;
  mode: MatchMode;
  you: number; // 自分の席 (0 or 1)
  seats: [SeatView, SeatView];
  handNo: number;
  level: number;
  sb: number;
  bb: number;
  ante: number;
  nextLevelAt: number;
  street: Street;
  board: Card[];
  pot: number; // 前ストリートまでに集まった額
  toAct: number | null;
  deadline: number | null;
  timeTotal: number | null; // 現在のカウントダウンの長さ（リング表示用）
  usingTimebank: boolean;
  odds: { equity: [number, number]; outs: [number | null, number | null] } | null; // オールイン時の勝率・アウツ
  legal: LegalActions | null;
  lastAction: { seat: number; type: ActionType; amount: number } | null;
  result: HandResult | null;
  serverTime: number;
}

export interface MatchEnd {
  matchId: string;
  mode: MatchMode;
  youWon: boolean;
  reason: 'bust' | 'forfeit' | 'disconnect';
  rating: { before: number; after: number; delta: number } | null;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  rating: number;
  games: number;
  wins: number;
}

export interface ServerToClient {
  me: (p: UserProfile) => void;
  online: (n: number) => void;
  'queue:status': (s: { searching: boolean; since: number; cpuOfferAfter: number }) => void;
  'friend:status': (s: { waiting: boolean; code: string }) => void;
  'match:state': (s: TableState) => void;
  'match:end': (e: MatchEnd) => void;
  notice: (key: string) => void;
}

export interface ClientToServer {
  'profile:update': (p: { name?: string; avatar?: string }) => void;
  'queue:join': () => void;
  'queue:leave': () => void;
  'cpu:start': () => void;
  'friend:join': (code: string) => void;
  'friend:leave': () => void;
  'game:action': (a: { type: ActionType; amount?: number }) => void;
  'game:surrender': () => void;
  'game:timebank': () => void;
}

export const AVATARS = [
  'spade', 'heart', 'diamond', 'club', 'star', 'moon', 'sun', 'crown', 'knight', 'bolt', 'gem', 'spark',
] as const;
