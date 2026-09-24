import './env';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { RATING } from '../shared/config';
import { AVATARS, type ClientToServer, type ServerToClient, type UserProfile } from '../shared/protocol';
import { actInfo, ratingDelta } from '../shared/rating';
import { Match, type Participant } from './game/match';
import { newUser, rollAct, store, supabaseAdmin } from './store';

// 開発時(--dev)は Vite のプロキシ先 3001 に固定
const PORT = process.argv.includes('--dev') ? 3001 : Number(process.env.PORT ?? 3001);
const ACT_EPOCH = process.env.ACT_EPOCH ?? '2026-09-01';
const CPU_OFFER_MS = 20_000;
const currentAct = () => actInfo(Date.now(), ACT_EPOCH).act;

const app = express();
const http = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(http, { cors: { origin: false } });

type Sock = Socket<ClientToServer, ServerToClient>;
interface Session {
  user: UserProfile;
  socket: Sock | null;
  matchId: string | null;
  queuedAt: number | null;
  friendCode: string | null;
}
const sessions = new Map<string, Session>();
const matches = new Map<string, Match>();
const friendRooms = new Map<string, string>(); // 合言葉 → 待っている userId

// ---------- 認証 ----------
const UUID = /^[0-9a-f-]{36}$/i;

async function authenticate(auth: Record<string, unknown>): Promise<{ id: string; isGuest: boolean; name?: string } | null> {
  if (supabaseAdmin) {
    if (typeof auth.token !== 'string') return null;
    const { data, error } = await supabaseAdmin.auth.getUser(auth.token);
    if (error || !data.user) return null;
    const meta = data.user.user_metadata ?? {};
    return { id: data.user.id, isGuest: data.user.is_anonymous ?? false, name: meta.full_name ?? meta.name };
  }
  // Supabase未設定（ローカル開発）: ブラウザに保存したゲストIDを使う
  if (typeof auth.guestId === 'string' && UUID.test(auth.guestId)) return { id: auth.guestId, isGuest: true };
  return null;
}

io.use(async (socket, next) => {
  try {
    const who = await authenticate(socket.handshake.auth ?? {});
    if (!who) return next(new Error('unauthorized'));
    const act = currentAct();
    let user = await store.load(who.id);
    if (!user) {
      const fallback = `Player-${who.id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
      user = newUser(who.id, who.isGuest, sanitizeName(who.name ?? '') || fallback, act);
    }
    const rolled = rollAct(user, act);
    // ゲストがアカウント登録したら同じIDのままランキング対象へ
    const updated = { ...rolled, isGuest: who.isGuest };
    if (updated !== user) await store.save(updated);
    socket.data.userId = who.id;
    socket.data.user = updated;
    next();
  } catch (e) {
    console.error('auth error', e);
    next(new Error('server_error'));
  }
});

function sanitizeName(s: string) {
  return s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
}

// ---------- 接続 ----------
io.on('connection', (socket: Sock) => {
  const userId: string = socket.data.userId;
  let session = sessions.get(userId);
  if (session?.socket && session.socket.id !== socket.id) {
    session.socket.emit('notice', 'otherTab');
    session.socket.disconnect(true);
  }
  if (!session) {
    session = { user: socket.data.user, socket, matchId: null, queuedAt: null, friendCode: null };
    sessions.set(userId, session);
  }
  session.socket = socket;
  session.user = { ...session.user, isGuest: socket.data.user.isGuest };
  const s = session;

  socket.emit('me', s.user);
  socket.emit('online', io.engine.clientsCount);
  scheduleOnlineBroadcast();

  // 試合中なら復帰
  const m = s.matchId ? matches.get(s.matchId) : null;
  if (m && !m.over) {
    const seat = m.seatOf(userId);
    m.setConnected(seat, true);
    socket.emit('match:state', m.stateFor(seat));
  } else if (s.queuedAt) {
    socket.emit('queue:status', { searching: true, since: s.queuedAt, cpuOfferAfter: CPU_OFFER_MS });
  } else if (s.friendCode) {
    socket.emit('friend:status', { waiting: true, code: s.friendCode });
  }

  socket.on('profile:update', async (p) => {
    const name = typeof p?.name === 'string' ? sanitizeName(p.name) : s.user.name;
    const avatar = typeof p?.avatar === 'string' && (AVATARS as readonly string[]).includes(p.avatar) ? p.avatar : s.user.avatar;
    s.user = { ...s.user, name: name || s.user.name, avatar };
    await store.save(s.user).catch(console.error);
    socket.emit('me', s.user);
  });

  socket.on('queue:join', () => {
    if (s.matchId || s.friendCode) return;
    s.queuedAt ??= Date.now();
    socket.emit('queue:status', { searching: true, since: s.queuedAt, cpuOfferAfter: CPU_OFFER_MS });
  });

  socket.on('queue:leave', () => {
    s.queuedAt = null;
    socket.emit('queue:status', { searching: false, since: 0, cpuOfferAfter: CPU_OFFER_MS });
  });

  socket.on('cpu:start', () => {
    if (s.matchId) return;
    s.queuedAt = null;
    leaveFriend(s);
    startMatch('cpu', s, null);
  });

  socket.on('friend:join', (raw) => {
    if (s.matchId || typeof raw !== 'string') return;
    const code = raw.normalize('NFKC').trim().toLowerCase().slice(0, 32);
    if (code.length < 2) return;
    s.queuedAt = null;
    leaveFriend(s);
    const waitingId = friendRooms.get(code);
    const other = waitingId ? sessions.get(waitingId) : null;
    if (other && waitingId !== userId && other.friendCode === code && !other.matchId) {
      friendRooms.delete(code);
      other.friendCode = null;
      startMatch('friend', other, s);
      return;
    }
    friendRooms.set(code, userId);
    s.friendCode = code;
    socket.emit('friend:status', { waiting: true, code });
  });

  socket.on('friend:leave', () => {
    leaveFriend(s);
    socket.emit('friend:status', { waiting: false, code: '' });
  });

  socket.on('game:action', (a) => {
    const match = s.matchId ? matches.get(s.matchId) : null;
    if (!match || !a || typeof a.type !== 'string') return;
    match.handleAction(match.seatOf(userId), a.type, typeof a.amount === 'number' ? a.amount : undefined);
  });

  socket.on('game:timebank', () => {
    const match = s.matchId ? matches.get(s.matchId) : null;
    match?.useTimebank(match.seatOf(userId));
  });

  socket.on('game:surrender', () => {
    const match = s.matchId ? matches.get(s.matchId) : null;
    match?.surrender(match.seatOf(userId));
  });

  socket.on('disconnect', () => {
    if (s.socket?.id !== socket.id) return;
    s.socket = null;
    s.queuedAt = null;
    leaveFriend(s);
    const match = s.matchId ? matches.get(s.matchId) : null;
    if (match && !match.over) match.setConnected(match.seatOf(userId), false);
    else if (!s.matchId) sessions.delete(userId);
    scheduleOnlineBroadcast();
  });
});

function leaveFriend(s: Session) {
  if (s.friendCode && friendRooms.get(s.friendCode) === s.user.id) friendRooms.delete(s.friendCode);
  s.friendCode = null;
}

// ---------- オンライン人数 ----------
let onlineTimer: NodeJS.Timeout | null = null;
function scheduleOnlineBroadcast() {
  if (onlineTimer) return;
  onlineTimer = setTimeout(() => {
    onlineTimer = null;
    io.emit('online', io.engine.clientsCount);
  }, 1000);
}

// ---------- ランクマッチのマッチング ----------
// 待ち時間が長いほどレート許容幅を広げる（100 → 5秒ごとに +50）
const allowedGap = (waitMs: number) => 100 + Math.floor(waitMs / 5000) * 50;

setInterval(() => {
  const now = Date.now();
  const queue = [...sessions.values()]
    .filter((s) => s.queuedAt && s.socket && !s.matchId)
    .sort((a, b) => a.queuedAt! - b.queuedAt!);
  const used = new Set<string>();
  for (const a of queue) {
    if (used.has(a.user.id)) continue;
    let best: Session | null = null;
    for (const b of queue) {
      if (b === a || used.has(b.user.id)) continue;
      const gap = Math.abs(a.user.rating - b.user.rating);
      const limit = Math.max(allowedGap(now - a.queuedAt!), allowedGap(now - b.queuedAt!));
      if (gap <= limit && (!best || gap < Math.abs(a.user.rating - best.user.rating))) best = b;
    }
    if (best) {
      used.add(a.user.id);
      used.add(best.user.id);
      a.queuedAt = null;
      best.queuedAt = null;
      startMatch('ranked', a, best);
    }
  }
}, 1000);

// ---------- 試合 ----------
const CPU_NAMES = ['Aria', 'Kai', 'Noah', 'Rin', 'Sora', 'Luca', 'Mei', 'Theo'];

function participant(s: Session): Participant {
  const u = s.user;
  return { userId: u.id, name: u.name, avatar: u.avatar, rating: u.rating, isGuest: u.isGuest, isCpu: false };
}

function startMatch(mode: 'ranked' | 'friend' | 'cpu', a: Session, b: Session | null) {
  const id = randomUUID();
  const cpu: Participant = {
    userId: `cpu:${id}`,
    name: `CPU ${CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)]}`,
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    rating: a.user.rating,
    isGuest: false,
    isCpu: true,
  };
  const players: [Participant, Participant] = [participant(a), b ? participant(b) : cpu];
  const match = new Match(id, mode, players, {
    emitState: (seat, state) => sessions.get(players[seat].userId)?.socket?.emit('match:state', state),
    onEnd: (m, winner, reason) => void endMatch(m, winner, reason),
  });
  matches.set(id, match);
  for (const s of [a, b]) {
    if (!s) continue;
    s.matchId = id;
    s.socket?.emit('queue:status', { searching: false, since: 0, cpuOfferAfter: CPU_OFFER_MS });
    s.socket?.emit('friend:status', { waiting: false, code: '' });
  }
  match.start();
}

async function endMatch(m: Match, winner: number, reason: 'bust' | 'forfeit' | 'disconnect') {
  matches.delete(m.id);
  const loser = 1 - winner;
  const ids = m.players.map((p) => p.userId);
  const ss = ids.map((id) => sessions.get(id) ?? null);
  const changes: ({ before: number; after: number; delta: number } | null)[] = [null, null];

  if (m.mode === 'ranked' && ss[0] && ss[1]) {
    const act = currentAct();
    const [w, l] = [ss[winner]!, ss[loser]!];
    // 最新の値で計算（アクトをまたいだ場合も考慮）
    w.user = rollAct(w.user, act);
    l.user = rollAct(l.user, act);
    const delta = ratingDelta(w.user.rating, l.user.rating);
    changes[winner] = { before: w.user.rating, after: w.user.rating + delta, delta };
    const lAfter = Math.max(RATING.floor, l.user.rating - delta);
    changes[loser] = { before: l.user.rating, after: lAfter, delta: lAfter - l.user.rating };
    w.user = { ...w.user, rating: w.user.rating + delta, games: w.user.games + 1, wins: w.user.wins + 1 };
    l.user = { ...l.user, rating: lAfter, games: l.user.games + 1 };
    await Promise.all([store.save(w.user), store.save(l.user)]).catch(console.error);
    leaderboardCache = null;
  }

  ss.forEach((s, seat) => {
    if (!s) return;
    s.matchId = null;
    s.socket?.emit('match:end', { matchId: m.id, mode: m.mode, youWon: seat === winner, reason, rating: changes[seat] });
    s.socket?.emit('me', s.user);
    if (!s.socket) sessions.delete(s.user.id);
  });
}

// ---------- HTTP API ----------
let leaderboardCache: { at: number; act: number; data: Awaited<ReturnType<typeof store.leaderboard>> } | null = null;

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const act = currentAct();
    if (!leaderboardCache || leaderboardCache.act !== act || Date.now() - leaderboardCache.at > 30_000) {
      leaderboardCache = { at: Date.now(), act, data: await store.leaderboard(act, RATING.leaderboardSize) };
    }
    const info = actInfo(Date.now(), ACT_EPOCH);
    res.json({ act: info.act, endsAt: info.endsAt, entries: leaderboardCache.data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/meta', (_req, res) => {
  const info = actInfo(Date.now(), ACT_EPOCH);
  res.json({ act: info.act, startsAt: info.startsAt, endsAt: info.endsAt, authEnabled: !!supabaseAdmin });
});

const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

http.listen(PORT, () => {
  console.log(`HeadsUp Online server: http://localhost:${PORT}  (store: ${supabaseAdmin ? 'supabase' : 'local file'})`);
});
