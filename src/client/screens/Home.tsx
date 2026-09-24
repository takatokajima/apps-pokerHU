import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { fmt, useT } from '../lib/i18n';
import { go, setState, socket, useApp } from '../lib/store';

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

export function Home() {
  const { t } = useT();
  const me = useApp((s) => s.me);
  const [meta, setMeta] = useState<{ act: number; startsAt: number; endsAt: number } | null>(null);

  useEffect(() => {
    fetch('/api/meta').then((r) => r.json()).then(setMeta).catch(() => {});
  }, []);

  const losses = me ? me.games - me.wins : 0;
  const winRate = me && me.games > 0 ? Math.round((me.wins / me.games) * 100) : null;

  return (
    <div className="safe-top safe-bottom relative mx-auto flex min-h-full max-w-md flex-col px-5">
      <header className="rise flex items-center justify-center py-3">
        <div className="flex items-center gap-2 text-[15px] font-bold tracking-[0.28em]">
          <span className="text-[var(--color-gold)]">♠</span>
          HEADS-UP
        </div>
      </header>

      {/* ランクマッチ */}
      <section
        className="rise relative mt-6 overflow-hidden rounded-2xl p-5 shadow-[0_30px_60px_-25px_rgba(0,0,0,.8)] ring-1 ring-[#d9bf8c]/25"
        style={{ animationDelay: '60ms', background: 'linear-gradient(160deg, #2e2560 0%, #1d1a45 55%, #111a3d 100%)' }}
      >
        <div className="pointer-events-none absolute -right-6 -top-10 text-[150px] leading-none text-white/[.04]">♠</div>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[#d9bf8c]/15 px-2.5 py-1 text-[12px] font-semibold tracking-wider text-[var(--color-gold)]">
            Act.{meta?.act ?? '–'}
            {meta && <span className="ml-2 font-normal text-[var(--color-gold)]/80">{md(meta.startsAt)} – {md(meta.endsAt - 1)}</span>}
          </span>
          <OnlinePill />
        </div>

        <h2 className="mt-4 text-[26px] font-bold tracking-tight">{t('ranked')}</h2>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('rating')}</div>
            <div className="text-[44px] font-semibold leading-none tracking-tight text-[var(--color-gold)] tabular-nums">{me ? fmt(me.rating) : '—'}</div>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-[17px] font-semibold">
              {me?.wins ?? 0}
              <span className="text-[13px] font-normal text-[var(--color-mist)]">{t('wins')}</span> {losses}
              <span className="text-[13px] font-normal text-[var(--color-mist)]">{t('losses')}</span>
            </div>
            <div className="text-[12px] text-[var(--color-mist)]">
              {t('winRate')} {winRate === null ? '—' : `${winRate}%`}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            socket.emit('queue:join');
            go('queue');
          }}
          className="mt-5 w-full rounded-xl bg-[#f5f3ee] py-4 text-[17px] font-bold text-[#0c0a1c] transition active:scale-[.98]"
        >
          {t('play')}
        </button>

        <div className="mt-2 divide-y divide-white/[.07]">
          <button onClick={() => go('leaderboard')} className="flex w-full items-center justify-between px-1 py-3 text-[15px] transition active:opacity-60">
            <span className="font-medium">{t('leaderboard')}</span>
            <span className="text-[var(--color-gold)]">TOP 1000 →</span>
          </button>
          <button onClick={() => go('stats')} className="flex w-full items-center justify-between px-1 py-3 text-[15px] transition active:opacity-60">
            <span className="font-medium">{t('statsAndHistory')}</span>
            <span className="text-[var(--color-gold)]">→</span>
          </button>
        </div>
      </section>

      {/* フレンドマッチ */}
      <button
        onClick={() => {
          setState({ friend: { waiting: false, code: '' } });
          go('friend');
        }}
        className="glass rise mt-4 flex items-center justify-between rounded-2xl px-5 py-5 text-left transition active:scale-[.98]"
        style={{ animationDelay: '120ms' }}
      >
        <div>
          <div className="text-[20px] font-bold tracking-tight">{t('friend')}</div>
          <div className="mt-0.5 text-[13px] text-[var(--color-mist)]">{t('friendPlay')}</div>
        </div>
        <span className="text-[22px] text-[var(--color-gold)]">→</span>
      </button>

      {/* 下部: プロフィール・設定 */}
      <nav className="rise mt-auto pt-10" style={{ animationDelay: '180ms' }}>
        <div className="hairline-gold mb-3 opacity-60" />
        <div className="flex items-center justify-between">
          <button onClick={() => go('profile')} className="flex min-w-0 items-center gap-3 py-2 transition active:opacity-60">
            <Avatar id={me?.avatar ?? 'spade'} size={36} />
            <span className="truncate text-[15px] font-medium">{me?.name ?? '…'}</span>
            {me?.isGuest && (
              <span className="shrink-0 whitespace-nowrap rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-[var(--color-mist)]">{t('guest')}</span>
            )}
          </button>
          <button
            onClick={() => go('settings')}
            className="glass grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] transition active:scale-95"
            aria-label={t('settings')}
          >
            ⚙
          </button>
        </div>
      </nav>
    </div>
  );
}
