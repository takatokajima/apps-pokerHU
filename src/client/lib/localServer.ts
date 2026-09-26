/**
 * ブラウザ内サーバー（オフライン版 / Vercel 公開用）
 * サーバーと同じイベントのやり取りをブラウザの中で再現し、CPU戦をブラウザだけで完結させる。
 * フレンドマッチはスマホ同士を直接つなぐ（P2P / PeerJS）。先に合言葉を入れた人の端末が試合を進行し、
 * 相手には相手用の画面情報（こちらの手札は伏せたもの）だけを送る。
 * プロフィール・ハンド履歴はこの端末のブラウザ（localStorage）に保存する。
 */
import { RATING } from '../../shared/config';
import {
  AVATARS,
  EMPTY_STATS,
  type CpuLevel,
  type HandRecord,
  type MatchEnd,
  type StatsPayload,
  type TableState,
  type UserProfile,
} from '../../shared/protocol';
import { Match, type Participant } from '../../server/game/match';
import Peer, { type DataConnection } from 'peerjs';

type Handler = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

/** 端末どうしで送り合うメッセージ */
type Wire =
  | { t: 'hello'; profile: { id: string; name: string; avatar: string } } // 参加者 → 進行役
  | { t: 'busy' } // 進行役 → 参加者（満室）
  | { t: 'ev'; e: 'match:state' | 'match:end' | 'hand'; a: unknown[] } // 進行役 → 参加者
  | { t: 'act'; e: string; a: unknown[] }; // 参加者 → 進行役（操作）

interface FriendRoom {
  code: string;
  peer: Peer;
  conn: DataConnection | null;
  retry: ReturnType<typeof setTimeout> | null;
}

/** 合言葉から部屋ID（つなぐ先の名前）を作る。合言葉そのものは送らない */
async function roomId(code: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`headsup-online:${code}`));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `headsup-online-${hex.slice(0, 32)}`;
}

const cleanName = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '') || 'Player';

const PROFILE_KEY = 'localProfile.v1';
const HANDS_KEY = 'localHands.v1';
const MAX_HANDS = 150; // ブラウザの保存容量を考えて直近のみ
const CPU_NAMES = ['Aria', 'Kai', 'Noah', 'Rin', 'Sora', 'Luca', 'Mei', 'Theo'];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 容量不足などは無視 */
  }
}

function loadProfile(): UserProfile {
  const saved = read<Partial<UserProfile> | null>(PROFILE_KEY, null);
  const id = saved?.id ?? crypto.randomUUID();
  const profile: UserProfile = {
    id,
    name: saved?.name ?? `Player-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`,
    avatar: saved?.avatar ?? 'spade',
    rating: RATING.initial,
    isGuest: true,
    games: 0,
    wins: 0,
    act: 1,
    xHandle: saved?.xHandle ?? null,
    stats: { ...EMPTY_STATS },
  };
  write(PROFILE_KEY, { id: profile.id, name: profile.name, avatar: profile.avatar, xHandle: profile.xHandle });
  return profile;
}

export class LocalSocket {
  connected = false;
  private handlers = new Map<string, Handler[]>();
  private me = loadProfile();
  private match: Match | null = null;
  private room: FriendRoom | null = null;
  /** 参加者側: 相手の端末で進行中の試合（自分は席1） */
  private guest: { matchId: string; state: TableState | null; summary: { netBB: number; evBB: number } } | null = null;

  on(event: string, fn: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
    return this;
  }

  /** サーバー → 画面 への通知 */
  private send(event: string, ...args: unknown[]) {
    // 実際の通信のように少し遅らせて、画面側の処理順を本番と揃える
    setTimeout(() => this.handlers.get(event)?.forEach((f) => f(...args)), 0);
  }

  connect() {
    this.connected = true;
    this.send('connect');
    this.send('me', this.me);
    this.send('online', 1);
    if (this.match && !this.match.over) this.send('match:state', this.match.stateFor(0));
    else if (this.guest?.state) this.send('match:state', this.guest.state);
    return this;
  }

  disconnect() {
    this.connected = false;
    this.send('disconnect');
    return this;
  }

  /** 画面 → サーバー への送信 */
  emit(event: string, ...args: unknown[]) {
    const ack = typeof args[args.length - 1] === 'function' ? (args[args.length - 1] as Handler) : null;
    switch (event) {
      case 'profile:update': {
        const p = (args[0] ?? {}) as { name?: string; avatar?: string; xHandle?: string | null };
        const name = typeof p.name === 'string' ? p.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '';
        const avatar = typeof p.avatar === 'string' && (AVATARS as readonly string[]).includes(p.avatar) ? p.avatar : this.me.avatar;
        let xHandle = this.me.xHandle;
        if ('xHandle' in p) {
          const raw = typeof p.xHandle === 'string' ? p.xHandle.trim().replace(/^@/, '') : '';
          xHandle = /^[A-Za-z0-9_]{1,15}$/.test(raw) ? raw : null;
        }
        this.me = { ...this.me, name: name || this.me.name, avatar, xHandle };
        write(PROFILE_KEY, { id: this.me.id, name: this.me.name, avatar: this.me.avatar, xHandle: this.me.xHandle });
        this.send('me', this.me);
        break;
      }
      case 'cpu:start':
        if (this.guest) break;
        this.leaveFriend();
        this.startCpu(args[0] as CpuLevel);
        break;
      case 'friend:join':
        void this.joinFriend(args[0]);
        break;
      case 'friend:leave':
        this.leaveFriend();
        this.send('friend:status', { waiting: false, code: '' });
        break;
      case 'game:action':
      case 'game:timebank':
      case 'game:surrender':
        // 相手の端末が進行役なら、操作をそちらへ送る
        if (this.guest) this.room?.conn?.send({ t: 'act', e: event, a: args.filter((x) => typeof x !== 'function') } satisfies Wire);
        else this.applyAction(0, event, args);
        break;
      case 'hands:recent':
        ack?.(this.hands().slice().reverse().slice(0, 100));
        break;
      case 'hands:list':
        ack?.(this.hands().filter((h) => h.matchId === args[0]));
        break;
      case 'stats:get':
        ack?.(this.stats());
        break;
      // ランクマッチ・フレンドマッチはオフライン版では使えない
      default:
        break;
    }
    return this;
  }

  private hands(): HandRecord[] {
    return read<HandRecord[]>(HANDS_KEY, []);
  }

  private stats(): StatsPayload {
    const hands = this.hands();
    const rows = hands.map((h) => {
      const st = h.seatStats[h.players[1]?.id === this.me.id ? 1 : 0];
      return { at: h.at, net: st.netBB, ev: st.evBB, sd: st.showdown, vpip: st.vpip, pfr: st.pfr, tbo: st.threeBetOpp, tb: st.threeBet };
    });
    return { stats: this.me.stats, ratingSeries: [], hands: rows, firstPlayAt: rows[0]?.at ?? null, matches: [] };
  }

  private startCpu(level: CpuLevel) {
    if (this.match && !this.match.over) return;
    const lv: CpuLevel = level === 'weak' || level === 'strong' ? level : 'normal';
    const id = crypto.randomUUID();
    const human: Participant = { userId: this.me.id, name: this.me.name, avatar: this.me.avatar, rating: this.me.rating, isGuest: true, isCpu: false };
    const cpu: Participant = {
      userId: `cpu:${id}`,
      name: `CPU ${CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)]}`,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      rating: RATING.initial,
      isGuest: false,
      isCpu: true,
      cpuLevel: lv,
    };
    // 自分は常に席0
    const match = new Match(id, 'cpu', [human, cpu], {
      emitState: (seat, state) => seat === 0 && this.send('match:state', state),
      onHand: (_m, record) => this.saveHand(record),
      onEnd: (m, winner, reason) => {
        const end: MatchEnd = {
          matchId: m.id,
          mode: 'cpu',
          youWon: winner === 0,
          reason,
          rating: null,
          summary: { hands: m.handNo, durationMs: Date.now() - m.startedAt, ...m.summary[0] },
        };
        this.send('match:end', end);
        this.send('me', this.me);
        this.match = null;
      },
    });
    this.match = match;
    match.start();
  }

  private saveHand(record: HandRecord) {
    write(HANDS_KEY, [...this.hands(), record].slice(-MAX_HANDS));
  }

  private applyAction(seat: number, event: string, args: unknown[]) {
    const m = this.match;
    if (!m || m.over) return;
    if (event === 'game:action') {
      const a = args[0] as { type?: unknown; amount?: unknown } | undefined;
      if (a && typeof a.type === 'string') m.handleAction(seat, a.type as never, typeof a.amount === 'number' ? a.amount : undefined);
    } else if (event === 'game:timebank') m.useTimebank(seat);
    else if (event === 'game:surrender') m.surrender(seat);
  }

  // ---------- フレンドマッチ（P2P） ----------

  private async joinFriend(raw: unknown) {
    if ((this.match && !this.match.over) || this.guest || typeof raw !== 'string') return;
    const code = raw.normalize('NFKC').trim().toLowerCase().slice(0, 32);
    if (code.length < 2) return;
    this.leaveFriend();
    this.send('friend:status', { waiting: true, code });
    this.host(code, await roomId(code));
  }

  /** まず自分が部屋を作る。既に誰かが作っていれば参加者になる */
  private host(code: string, id: string) {
    const peer = new Peer(id);
    const room: FriendRoom = { code, peer, conn: null, retry: null };
    this.room = room;
    peer.on('connection', (conn) => {
      if (this.room !== room) return;
      conn.on('data', (d) => this.onHostData(room, conn, d as Wire));
      conn.on('close', () => {
        if (this.room !== room || room.conn !== conn) return;
        room.conn = null;
        // 試合中の切断: 自動でチェック/フォールドし、3分戻らなければ不戦敗（サーバー版と同じ）
        if (this.match && !this.match.over && this.match.mode === 'friend') this.match.setConnected(1, false);
      });
    });
    peer.on('error', (err) => {
      if (this.room !== room) return;
      if (err.type === 'unavailable-id') {
        peer.destroy();
        this.join(code, id);
      } else if (err.type !== 'peer-unavailable') this.friendFailed();
    });
  }

  private join(code: string, id: string) {
    const peer = new Peer();
    const room: FriendRoom = { code, peer, conn: null, retry: null };
    this.room = room;
    peer.on('open', () => {
      if (this.room !== room) return;
      const conn = peer.connect(id, { reliable: true });
      room.conn = conn;
      conn.on('open', () => conn.send({ t: 'hello', profile: { id: this.me.id, name: this.me.name, avatar: this.me.avatar } } satisfies Wire));
      conn.on('data', (d) => this.onGuestData(room, d as Wire));
      conn.on('close', () => this.onHostGone(room));
    });
    peer.on('error', (err) => {
      if (this.room !== room) return;
      if (err.type === 'peer-unavailable') {
        // 部屋を作った人が抜けた直後など: 少し待って自分が部屋を作り直す
        peer.destroy();
        room.retry = setTimeout(() => this.room === room && this.host(code, id), 1500);
      } else this.friendFailed();
    });
  }

  /** 進行役: 参加者からのメッセージ */
  private onHostData(room: FriendRoom, conn: DataConnection, d: Wire) {
    if (this.room !== room || !d || typeof d !== 'object') return;
    const refuse = () => {
      conn.send({ t: 'busy' } satisfies Wire);
      setTimeout(() => conn.close(), 500);
    };
    if (d.t === 'hello') {
      const p = (d.profile ?? {}) as Partial<{ id: unknown; name: unknown; avatar: unknown }>;
      const pid = typeof p.id === 'string' ? p.id.slice(0, 64) : '';
      const m = this.match;
      if (m && !m.over) {
        // 試合中は、同じ人が入り直した場合だけ復帰させる
        if (m.mode === 'friend' && pid && m.players[1].userId === pid && !room.conn) {
          room.conn = conn;
          m.setConnected(1, true);
          conn.send({ t: 'ev', e: 'match:state', a: [m.stateFor(1)] } satisfies Wire);
        } else refuse();
        return;
      }
      if (room.conn && room.conn !== conn) return refuse();
      room.conn = conn;
      const avatar = typeof p.avatar === 'string' && (AVATARS as readonly string[]).includes(p.avatar) ? p.avatar : 'spade';
      this.startFriend(room, { userId: pid || crypto.randomUUID(), name: cleanName(p.name), avatar, rating: RATING.initial, isGuest: true, isCpu: false });
      return;
    }
    if (d.t === 'act' && room.conn === conn && Array.isArray(d.a) && ['game:action', 'game:timebank', 'game:surrender'].includes(d.e)) {
      this.applyAction(1, d.e, d.a);
    }
  }

  private startFriend(room: FriendRoom, remote: Participant) {
    const me: Participant = { userId: this.me.id, name: this.me.name, avatar: this.me.avatar, rating: this.me.rating, isGuest: true, isCpu: false };
    const toGuest = (msg: Wire) => {
      try {
        room.conn?.send(msg);
      } catch {
        /* 切断中は送らない（戻ってきたら最新の状態を送る） */
      }
    };
    const match = new Match(crypto.randomUUID(), 'friend', [me, remote], {
      emitState: (seat, state) => (seat === 0 ? this.send('match:state', state) : toGuest({ t: 'ev', e: 'match:state', a: [state] })),
      onHand: (_m, record) => {
        this.saveHand(record);
        toGuest({ t: 'ev', e: 'hand', a: [record] });
      },
      onEnd: (m, winner, reason) => {
        const end = (seat: number): MatchEnd => ({
          matchId: m.id,
          mode: 'friend',
          youWon: winner === seat,
          reason,
          rating: null,
          summary: { hands: m.handNo, durationMs: Date.now() - m.startedAt, ...m.summary[seat] },
        });
        this.send('match:end', end(0));
        toGuest({ t: 'ev', e: 'match:end', a: [end(1)] });
        this.match = null;
        // 相手に結果が届いてから部屋を閉じる
        setTimeout(() => this.room === room && this.leaveFriend(), 1500);
      },
    });
    this.match = match;
    this.send('friend:status', { waiting: false, code: room.code });
    match.start();
  }

  /** 参加者: 進行役からのメッセージ */
  private onGuestData(room: FriendRoom, d: Wire) {
    if (this.room !== room || !d || typeof d !== 'object') return;
    if (d.t === 'busy') {
      this.leaveFriend();
      this.send('friend:status', { waiting: false, code: room.code });
      this.send('notice', 'roomFull');
      return;
    }
    if (d.t !== 'ev' || !Array.isArray(d.a)) return;
    if (d.e === 'match:state') {
      const st = d.a[0] as TableState;
      if (!st?.matchId) return;
      if (!this.guest || this.guest.matchId !== st.matchId) {
        this.guest = { matchId: st.matchId, state: null, summary: { netBB: 0, evBB: 0 } };
        this.send('friend:status', { waiting: false, code: room.code });
      }
      this.guest.state = st;
      this.send('match:state', st);
    } else if (d.e === 'hand') {
      const rec = d.a[0] as HandRecord;
      if (!rec?.seatStats?.[1]) return;
      this.saveHand(rec);
      if (this.guest) {
        this.guest.summary.netBB += rec.seatStats[1].netBB;
        this.guest.summary.evBB += rec.seatStats[1].evBB;
      }
    } else if (d.e === 'match:end') {
      this.guest = null;
      this.send('match:end', d.a[0]);
      this.leaveFriend();
    }
  }

  /** 参加者: 進行役との接続が切れた */
  private onHostGone(room: FriendRoom) {
    if (this.room !== room) return;
    const g = this.guest;
    this.leaveFriend();
    if (!g) {
      // 試合前なら、今度は自分が部屋を作って待つ
      void this.joinFriend(room.code);
      return;
    }
    this.guest = null;
    const round = (n: number) => Math.round(n * 100) / 100;
    this.send('notice', 'friendLeft');
    this.send('match:end', {
      matchId: g.matchId,
      mode: 'friend',
      youWon: true,
      reason: 'disconnect',
      rating: null,
      summary: { hands: g.state?.handNo ?? 0, durationMs: 0, netBB: round(g.summary.netBB), evBB: round(g.summary.evBB) },
    } satisfies MatchEnd);
  }

  private friendFailed() {
    const code = this.room?.code ?? '';
    this.leaveFriend();
    this.send('friend:status', { waiting: false, code });
    this.send('notice', 'p2pFailed');
  }

  private leaveFriend() {
    const r = this.room;
    if (!r) return;
    this.room = null;
    if (r.retry) clearTimeout(r.retry);
    try {
      r.conn?.close();
      r.peer.destroy();
    } catch {
      /* 既に閉じている */
    }
  }
}
