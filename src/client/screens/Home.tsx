import { ChartLine, ChevronRight, KeyRound, Layers, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '../../shared/protocol';
import { AppShell } from '../components/AppShell';
import { fmt, useT, type Key } from '../lib/i18n';
import { fetchMeta, OFFLINE } from '../lib/mode';
import { go, setState, socket, startCpu, useApp, type Screen } from '../lib/store';

export function OnlinePill() {
  const online = useApp((s) => s.online);
  const connected = useApp((s) => s.connected);
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="relative flex h-2 w-2">
        {connected && <span className="pulse-ring absolute inset-0 rounded-full bg-[var(--color-win)]" />}
        <span className={`relative h-2 w-2 rounded-full ${connected ? 'bg-[var(--color-win)]' : 'bg-zinc-500'}`} />
      </span>
      <span className="font-semibold tabular-nums">{connected ? fmt(online) : '—'}</span>
      <span className="text-[var(--color-mist)]">{t('online')}</span>
    </div>
  );
}

const md = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** カードの見出し（小さな英字ラベル + 大きなタイトル） */
function CardHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-bold tracking-[.2em] text-[var(--color-mist)]">{label}</div>
      <div className="mt-0.5 text-[20px] font-black tracking-wide">{title}</div>
    </div>
  );
}

const FEATURES: { screen: Screen; title: string; desc: Key; Icon: LucideIcon; tint: string }[] = [
  { screen: 'stats', title: 'Stats', desc: 'featStats', Icon: ChartLine, tint: '#2d4a7a' },
  { screen: 'history', title: 'Hand History', desc: 'featHistory', Icon: Layers, tint: '#1f5a4c' },
];

const CARD = 'rise rounded-xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/10';

export function Home() {
  const { t } = useT();
  const me = useApp((s) => s.me);
  const online = useApp((s) => s.online);
  const friend = useApp((s) => s.friend);
  const [meta, setMeta] = useState<{ act: number; startsAt: number; endsAt: number } | null>(null);
  const [top, setTop] = useState<LeaderboardEntry[] | null>(null);
  const [code, setCode] = useState(friend.code);

  useEffect(() => {
    fetchMeta().then(setMeta).catch(() => {});
    if (OFFLINE) return; // オフライン版はランキングなし
    fetch('/api/leaderboard?tab=rating')
      .then((r) => r.json())
      .then((d) => setTop(d.entries.slice(0, 3)))
      .catch(() => setTop([]));
  }, []);

  const validCode = code.trim().length >= 2;
  const enterRoom = () => {
    if (!validCode) return;
    setState({ friend: { waiting: false, code: code.trim() } });
    socket.emit('friend:join', code);
    go('friend');
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pt-2">
        <div className="py-2 text-center">
          <div className="text-[26px] font-black tracking-[0.16em]">HEADS-UP</div>
          <div className="text-[10px] font-bold tracking-[.5em] text-[var(--color-mist)]">ONLINE</div>
        </div>

        {/* ランクマッチ（レート・ランキング・CPU もここにまとめる） */}
        <section className={CARD}>
          <CardHead label="RANKED MATCH" title={`ACT ${meta?.act ?? 1}`} />
          <div className="mt-1 flex items-center justify-center gap-3 text-[12px] text-[var(--color-mist)] tabular-nums">
            {meta && (
              <span>
                {md(meta.startsAt)}–{md(meta.endsAt - 1)}
              </span>
            )}
            {!OFFLINE && (
              <span className="flex items-center gap-1">
                <Users size={13} />
                <span className="font-bold text-white">{fmt(online)}</span> {t('online')}
              </span>
            )}
          </div>

          {/* 自分のレート */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-black/25 px-4 py-2.5">
            <span className="text-[13px] font-bold text-[var(--color-mist)]">{t('yourRating')}</span>
            <span className="text-[22px] font-black text-[var(--color-gold)] tabular-nums">{OFFLINE || !me ? '—' : fmt(me.rating)}</span>
          </div>

          <button
            onClick={() => {
              socket.emit('queue:join');
              go('queue');
            }}
            disabled={OFFLINE}
            className="mt-3 flex w-full flex-col items-center justify-center rounded-lg bg-[linear-gradient(160deg,#27b56a,#168a55)] py-4 transition active:scale-[.98] disabled:bg-none disabled:bg-[#2e2a4d] disabled:opacity-60"
          >
            <span className="text-[24px] font-black tracking-wider">PLAY</span>
            <span className="text-[12px] font-bold text-white/85">{OFFLINE ? t('comingSoon') : t('ranked')}</span>
          </button>
          {OFFLINE && <p className="mt-2 text-center text-[12px] leading-relaxed text-[var(--color-mist)]">{t('comingSoonNote')}</p>}

          {/* ランキング上位 */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-bold tracking-[.15em] text-[var(--color-mist)]">LEADERBOARD</span>
              {!OFFLINE && (
                <button onClick={() => go('leaderboard')} className="flex items-center gap-0.5 text-[var(--color-mist)] hover:text-white">
                  {t('more')} <ChevronRight size={14} />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {OFFLINE && <p className="py-2 text-center text-[13px] text-[var(--color-mist)]">{t('comingSoon')}</p>}
              {top?.length === 0 && <p className="py-2 text-center text-[13px] text-[var(--color-mist)]">{t('noEntries')}</p>}
              {top?.map((e, i) => (
                <div key={e.id} className={`flex items-center justify-between rounded-full bg-[#2a2645] px-4 ${i === 0 ? 'py-2.5' : 'py-1.5'}`}>
                  <span className={`font-black ${i === 0 ? 'text-[16px]' : 'text-[13px]'}`}>
                    <span className="text-[#34d27b]">#{e.rank}</span> {e.name}
                  </span>
                  <span className="text-[12px] font-bold text-[var(--color-gold)] tabular-nums">{fmt(e.rating)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 相手がいないときは CPU */}
          <div className="mt-4 rounded-lg bg-black/25 p-3">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="font-bold text-[var(--color-mist)]">{t('noOpponent')}</span>
              <span className="shrink-0 text-white/40">{t('unrated')}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['weak', 'normal', 'strong'] as const).map((lv) => (
                <button key={lv} onClick={() => startCpu(lv)} className="rounded-lg bg-[#2e2a4d] py-2.5 text-[14px] font-black tracking-wider transition active:scale-95">
                  {t(lv === 'weak' ? 'cpuWeak' : lv === 'normal' ? 'cpuNormal' : 'cpuStrong')}
                </button>
              ))}
            </div>
          </div>
          {me?.isGuest && !OFFLINE && (
            <button onClick={() => setState({ modal: 'account' })} className="mt-3 w-full rounded-lg bg-black/25 py-2 text-[12px] text-[var(--color-mist)]">
              {t('guestPlaying')} · <span className="font-bold text-[#6fd6a0]">{t('createAccount')}</span>
            </button>
          )}
        </section>

        {/* フレンドマッチ（合言葉で対戦） */}
        <section className={CARD} style={{ animationDelay: '60ms' }}>
          <CardHead label="FRIEND MATCH" title={t('friend')} />
          <p className="mt-1 text-center text-[12.5px] text-[var(--color-mist)]">{t('friendCardSub')}</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enterRoom();
            }}
          >
            <label className="sr-only" htmlFor="home-code">
              {t('passphrase')}
            </label>
            <div className="relative min-w-0 flex-1">
              <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mist)]" />
              <input
                id="home-code"
                value={code}
                onChange={(e) => setCode(e.target.value.slice(0, 32))}
                placeholder={t('passphrasePh')}
                autoComplete="off"
                autoCapitalize="off"
                className="h-12 w-full rounded-lg bg-[#0b0a18] pl-9 pr-3 text-[16px] outline-none ring-1 ring-[#c4b8ff]/20 placeholder:text-white/25 focus:ring-2 focus:ring-[var(--color-gold)]"
              />
            </div>
            <button disabled={!validCode} className="h-12 shrink-0 rounded-lg bg-[#f5f3ee] px-5 text-[15px] font-bold text-[#0c0a1c] transition active:scale-95 disabled:opacity-30">
              {t('enterRoom')}
            </button>
          </form>
          <p className="mt-2 text-center text-[11.5px] leading-relaxed text-white/40">
            {t('unrated')}
            {OFFLINE && ` · ${t('p2pNote')}`}
          </p>
        </section>

        {/* 機能一覧 */}
        <section className={CARD} style={{ animationDelay: '120ms' }}>
          <div className="text-center text-[11px] font-bold tracking-[.2em] text-[var(--color-mist)]">{t('features')}</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <button key={f.title} onClick={() => go(f.screen)} className="flex items-start gap-3 rounded-lg p-2 text-left hover:bg-white/[.04]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ background: f.tint }}>
                  <f.Icon size={20} />
                </span>
                <span>
                  <span className="block text-[15px] font-bold">{f.title}</span>
                  <span className="block text-[12.5px] leading-snug text-[var(--color-mist)]">{t(f.desc)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
