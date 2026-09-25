import { ChartLine, KeyRound, Layers, Trophy, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '../../shared/protocol';
import { AppShell } from '../components/AppShell';
import { fmt, useT, type Key } from '../lib/i18n';
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

const FEATURES: { screen: Screen; title: string; desc: Key; Icon: LucideIcon; tint: string; friend?: boolean }[] = [
  { screen: 'stats', title: 'Stats', desc: 'featStats', Icon: ChartLine, tint: '#2d4a7a' },
  { screen: 'leaderboard', title: 'Leaderboard', desc: 'featLeaderboard', Icon: Trophy, tint: '#5e2e48' },
  { screen: 'history', title: 'Hand History', desc: 'featHistory', Icon: Layers, tint: '#1f5a4c' },
  { screen: 'friend', title: 'Friend Match', desc: 'featFriend', Icon: KeyRound, tint: '#5a4a1f', friend: true },
];

export function Home() {
  const { t } = useT();
  const me = useApp((s) => s.me);
  const online = useApp((s) => s.online);
  const [meta, setMeta] = useState<{ act: number; startsAt: number; endsAt: number } | null>(null);
  const [top, setTop] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/meta').then((r) => r.json()).then(setMeta).catch(() => {});
    fetch('/api/leaderboard?tab=rating')
      .then((r) => r.json())
      .then((d) => setTop(d.entries.slice(0, 3)))
      .catch(() => setTop([]));
  }, []);

  const openFriend = () => {
    setState({ friend: { waiting: false, code: '' } });
    go('friend');
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pt-2">
        <div className="py-2 text-center">
          <div className="text-[26px] font-black tracking-[0.16em]">HEADS-UP</div>
          <div className="text-[10px] font-bold tracking-[.5em] text-[var(--color-mist)]">ONLINE</div>
        </div>

        {/* PLAY */}
        <section className="rise rounded-xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/10">
          <CardHead label="PLAY POKER" title="HEADS-UP NLH" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                socket.emit('queue:join');
                go('queue');
              }}
              className="flex flex-col items-center justify-center rounded-lg bg-[linear-gradient(160deg,#27b56a,#168a55)] px-2 py-5 transition active:scale-[.98]"
            >
              <span className="text-[13px] font-bold text-white/90">{t('ranked')}</span>
              <span className="text-[24px] font-black tracking-wider">PLAY</span>
              <span className="mt-0.5 text-[11px] font-bold text-white/85 tabular-nums">
                Act.{meta?.act ?? '–'} · {t('rating')} {me ? fmt(me.rating) : '—'}
              </span>
            </button>
            <button onClick={openFriend} className="flex flex-col items-center justify-center rounded-lg bg-[#3a3560] px-2 py-5 transition active:scale-[.98]">
              <span className="text-[13px] font-bold text-white/90">{t('friend')}</span>
              <span className="text-[24px] font-black tracking-wider">PLAY</span>
              <span className="mt-0.5 text-[11px] font-bold text-white/70">{t('friendPlay')}</span>
            </button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-[13px] text-[var(--color-mist)]">
            <span className="flex items-center gap-1.5">
              <Users size={15} />
              {t('playersOnline')}: <span className="font-bold text-white tabular-nums">{fmt(online)}</span>
            </span>
            {meta && (
              <span className="tabular-nums">
                Act.{meta.act} {md(meta.startsAt)}–{md(meta.endsAt - 1)}
              </span>
            )}
          </div>
          {/* CPU練習: 相手を待たずにすぐ遊べる（レート変動なし） */}
          <div className="mt-3 rounded-lg bg-black/25 p-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-bold tracking-[.15em] text-[var(--color-mist)]">CPU PRACTICE</span>
              <span className="text-white/40">{t('unrated')}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['weak', 'normal', 'strong'] as const).map((lv) => (
                <button key={lv} onClick={() => startCpu(lv)} className="rounded-lg bg-[#2e2a4d] py-2.5 text-[14px] font-black tracking-wider transition active:scale-95">
                  {t(lv === 'weak' ? 'cpuWeak' : lv === 'normal' ? 'cpuNormal' : 'cpuStrong')}
                </button>
              ))}
            </div>
          </div>
          {me?.isGuest && (
            <button onClick={() => setState({ modal: 'account' })} className="mt-3 w-full rounded-lg bg-black/25 py-2 text-[12px] text-[var(--color-mist)]">
              {t('guestPlaying')} · <span className="font-bold text-[#6fd6a0]">{t('createAccount')}</span>
            </button>
          )}
        </section>

        {/* ランキングのプレビュー */}
        <section className="rise rounded-xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/10" style={{ animationDelay: '60ms' }}>
          <CardHead label="LEADERBOARD" title={`ACT ${meta?.act ?? 1}: RATING`} />
          <div className="mt-3 flex flex-col gap-1.5">
            {top?.length === 0 && <p className="py-4 text-center text-[13px] text-[var(--color-mist)]">{t('noEntries')}</p>}
            {top?.map((e, i) => (
              <div key={e.id} className={`flex items-center justify-between rounded-full bg-[#2a2645] px-4 ${i === 0 ? 'py-2.5' : 'py-1.5'}`}>
                <span className={`font-black ${i === 0 ? 'text-[16px]' : 'text-[13px]'}`}>
                  <span className="text-[#34d27b]">#{e.rank}</span> {e.name}
                </span>
                <span className="text-[12px] font-bold text-[var(--color-gold)] tabular-nums">{fmt(e.rating)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => go('leaderboard')} className="mt-3 w-full py-1 text-[14px] text-[var(--color-mist)]">
            {t('more')}
          </button>
        </section>

        {/* 機能一覧 */}
        <section className="rise rounded-xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/10" style={{ animationDelay: '120ms' }}>
          <div className="text-center text-[11px] font-bold tracking-[.2em] text-[var(--color-mist)]">{t('features')}</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <button key={f.title} onClick={() => (f.friend ? openFriend() : go(f.screen))} className="flex items-start gap-3 rounded-lg p-2 text-left hover:bg-white/[.04]">
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
