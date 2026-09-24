import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, MatchEnd, ServerToClient, TableState, UserProfile } from '../../shared/protocol';
import { getToken, localGuestId, onAuthChange, supabase } from './auth';

export type Screen = 'home' | 'queue' | 'friend' | 'table' | 'leaderboard' | 'profile' | 'settings';

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
  returnTo: Screen; // 設定画面から戻る先
}

let state: AppState = {
  connected: false,
  me: null,
  online: 0,
  screen: 'home',
  queue: { searching: false, since: 0, cpuOfferAfter: 20000 },
  friend: { waiting: false, code: '' },
  table: null,
  clockOffset: 0,
  matchEnd: null,
  notice: null,
  returnTo: 'home',
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

export const go = (screen: Screen) => setState({ screen, returnTo: state.screen === 'settings' ? state.returnTo : state.screen });

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
    setState({ table, clockOffset: table.serverTime - Date.now(), screen: state.screen === 'settings' ? 'settings' : 'table' });
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
