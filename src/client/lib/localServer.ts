/**
 * ブラウザ内サーバー（オフライン版 / Vercel 公開用）
 * サーバーと同じイベントのやり取りをブラウザの中で再現し、CPU戦をブラウザだけで完結させる。
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
  type UserProfile,
} from '../../shared/protocol';
import { Match, type Participant } from '../../server/game/match';

type Handler = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

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
        this.startCpu(args[0] as CpuLevel);
        break;
      case 'game:action': {
        const a = args[0] as { type: string; amount?: number } | undefined;
        if (this.match && a && typeof a.type === 'string') this.match.handleAction(0, a.type as never, a.amount);
        break;
      }
      case 'game:timebank':
        this.match?.useTimebank(0);
        break;
      case 'game:surrender':
        this.match?.surrender(0);
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
      const st = h.seatStats[0];
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
      onHand: (_m, record) => write(HANDS_KEY, [...this.hands(), record].slice(-MAX_HANDS)),
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
}
