import type { Card, HandCategory } from './cards';

export type MatchMode = 'ranked' | 'friend' | 'cpu';
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export interface UserStats {
  matches: number; // 試合数（CPU戦を除く）
  matchWins: number;
  hands: number;
  vpip: number; // 自発的にチップを入れたハンド数
  pfr: number; // プリフロップでレイズしたハンド数
  threeBetOpp: number;
  threeBet: number;
  netBB: number; // 実収支（bb）
  evBB: number; // オールインEV調整後の収支（bb）
  sdBB: number; // ショーダウンでの収支
  nsdBB: number; // ショーダウンなしの収支
}

export const EMPTY_STATS: UserStats = {
  matches: 0, matchWins: 0, hands: 0, vpip: 0, pfr: 0, threeBetOpp: 0, threeBet: 0, netBB: 0, evBB: 0, sdBB: 0, nsdBB: 0,
};

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  isGuest: boolean;
  games: number; // 今アクトのランクマ試合数
  wins: number; // 今アクトのランクマ勝利数
  act: number;
  xHandle: string | null; // X(旧Twitter)のユーザー名
  stats: UserStats; // 通算成績（CPU戦を除く）
}

/** ハンド内の1つの出来事（リプレイ用にその時点の状態も持つ） */
export interface LogEntry {
  street: Street;
  seat: number | null; // null = カードが配られた
  type: 'sb' | 'bb' | 'ante' | ActionType | 'deal';
  add: number; // この行動で出したチップ
  to: number; // この行動後のそのストリートのベット額
  pot: number; // 行動後のポット合計（ベット含む）
  stacks: [number, number];
  board: Card[];
  allIn: boolean;
}

/** 1ハンドの成績（席ごと） */
export interface HandSeatStat {
  netBB: number;
  evBB: number;
  showdown: boolean;
  vpip: boolean;
  pfr: boolean;
  threeBetOpp: boolean;
  threeBet: boolean;
}

export interface HandRecord {
  id: string;
  matchId: string;
  mode: MatchMode;
  handNo: number;
  at: number;
  level: number;
  sb: number;
  bb: number;
  ante: number;
  button: number;
  players: [{ id: string; name: string; avatar: string; isCpu: boolean }, { id: string; name: string; avatar: string; isCpu: boolean }];
  startStacks: [number, number];
  hole: [Card[], Card[]];
  shown: [boolean, boolean]; // ショーダウン等で公開されたか
  board: Card[];
  log: LogEntry[];
  result: HandResult;
  seatStats: [HandSeatStat, HandSeatStat];
}

export interface MatchRecord {
  id: string;
  mode: MatchMode;
  at: number;
  players: [string, string];
  names: [string, string];
  winner: number;
  hands: number;
  rating: [{ before: number; after: number } | null, { before: number; after: number } | null];
}

/** 成績画面用のデータ */
export interface StatsPayload {
  stats: UserStats;
  ratingSeries: { at: number; rating: number }[];
  profitSeries: { net: number; ev: number; sd: number; nsd: number }[]; // 累積（bb）
  matches: (MatchRecord & { you: number })[];
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
  odds: { equity: [number, number]; outs: [Card[] | null, Card[] | null] } | null; // オールイン時の勝率・アウツ
  legal: LegalActions | null;
  lastAction: { seat: number; type: ActionType; amount: number } | null;
  result: HandResult | null;
  log: LogEntry[]; // このハンドのアクションログ
  serverTime: number;
}

export interface MatchEnd {
  matchId: string;
  mode: MatchMode;
  youWon: boolean;
  reason: 'bust' | 'forfeit' | 'disconnect';
  rating: { before: number; after: number; delta: number } | null;
}

export type LeaderboardTab = 'rating' | 'week' | 'actWins';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  rating: number;
  games: number;
  wins: number;
  xHandle: string | null;
  value: number; // タブに応じた値（レート / 今週の勝利数 / Actの勝利数）
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
  'profile:update': (p: { name?: string; avatar?: string; xHandle?: string | null }) => void;
  'stats:get': (ack: (p: StatsPayload) => void) => void;
  'hands:list': (matchId: string, ack: (hands: HandRecord[]) => void) => void;
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
