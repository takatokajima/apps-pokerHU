import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, CpuLevel, MatchEnd, ServerToClient, TableState, UserProfile } from '../../shared/protocol';
import { introSeen } from './intro';
import { getToken, localGuestId, onAuthChange, supabase } from './auth';

export type Screen =
  | 'intro'
  | 'home'
  | 'queue'
  | 'friend'
  | 'table'
  | 'leaderboard'
  | 'profile'
  | 'settings'
  | 'stats'
  | 'history'
  | 'terms'
  | 'privacy';

export interface AppState {
  connected: boolean;
  me: UserProfile | null;
  online: number;
  screen: Screen;
  queue: { searching: boolean; since: number; cpuOfferAfter: number };
  friend: { waiting: boolean; code: string };
  table: TableState | null;
  clockOffset: number; // サーバー時刻 - 端末時刻
  matchEnd: MatchEnd | null;
  notice: string | null;
  lastCpuLevel: CpuLevel; // 「もう一度」で同じ強さのCPUと対戦するため
  modal: 'account' | 'updates' | null; // 画面の上に重ねて開くポップアップ
}

let state: AppState = {
  connected: false,
  me: null,
  online: 0,
  screen: introSeen() ? 'home' : 'intro', // 初めての人には紹介ページ
  queue: { searching: false, since: 0, cpuOfferAfter: 20000 },
  friend: { waiting: false, code: '' },
  table: null,
  clockOffset: 0,
  matchEnd: null,
  notice: null,
  lastCpuLevel: 'normal',
  modal: null,
};
const listeners = new Set<() => void>();

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((f) => f());
}

export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => sel(state),
  );
}

// 設定・規約などのサブ画面は「戻る」で直前の画面へ戻れるよう履歴を持つ
const SUB: Screen[] = ['settings', 'terms', 'privacy', 'intro'];
let backStack: Screen[] = [];
export const go = (screen: Screen) => {
  if (SUB.includes(screen)) backStack.push(state.screen);
  else backStack = [];
  setState({ screen });
};
export const back = () => {
  let prev = backStack.pop() ?? 'home';
  if (prev === 'table' && (!state.table || state.matchEnd)) prev = 'home'; // 試合が終わっていたらホームへ
  setState({ screen: prev });
};

export let socket: Socket<ServerToClient, ClientToServer>;

export function connect() {
  socket = io({
    auth: (cb) => cb(supabase ? { token: getToken() } : { guestId: localGuestId() }),
    transports: ['websocket', 'polling'],
  });
  socket.on('connect', () => setState({ connected: true }));
  socket.on('disconnect', () => setState({ connected: false }));
  socket.on('me', (me) => setState({ me }));
  socket.on('online', (online) => setState({ online }));
  socket.on('queue:status', (queue) => {
    setState({ queue });
    if (queue.searching && state.screen !== 'table') setState({ screen: 'queue' });
  });
  socket.on('friend:status', (friend) => setState({ friend }));
  socket.on('match:state', (table) => {
    // 試合中に設定を開いている場合は画面を切り替えない
    setState({ table, clockOffset: table.serverTime - Date.now(), screen: SUB.includes(state.screen) ? state.screen : 'table' });
    if (state.matchEnd?.matchId !== table.matchId) setState({ matchEnd: null });
  });
  socket.on('match:end', (matchEnd) => setState({ matchEnd }));
  socket.on('notice', (notice) => setState({ notice }));
  // ログイン状態が変わったら新しい資格情報で繋ぎ直す
  onAuthChange(() => {
    socket.disconnect();
    socket.connect();
  });
}

export function startCpu(level: CpuLevel) {
  setState({ lastCpuLevel: level });
  socket.emit('cpu:start', level);
}
