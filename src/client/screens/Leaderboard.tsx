import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '../../shared/protocol';
import { Avatar } from '../components/Avatar';
import { fmt, useT } from '../lib/i18n';
import { go, useApp } from '../lib/store';

export function Leaderboard() {
  const { t } = useT();
  const me = useApp((s) => s.me);
  const [data, setData] = useState<{ act: number; entries: LeaderboardEntry[] } | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard').then((r) => r.json()).then(setData).catch(() => setData({ act: 0, entries: [] }));
  }, []);

  const mine = data?.entries.find((e) => e.id === me?.id);

  return (
    <div className="safe-top mx-auto flex h-full max-w-md flex-col">
      <header className="px-5 py-2">
        <button onClick={() => go('home')} className="py-2 text-[15px] text-[var(--color-gold)]">
          ‹ {t('back')}
        </button>
        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[.2em] text-[var(--color-gold)]">{t('ranked')}</div>
            <h1 className="text-[32px] font-bold tracking-tight">{t('leaderboard')}</h1>
          </div>
          {data && <span className="text-[13px] text-[var(--color-mist)]">Act.{data.act} · TOP 1000</span>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-32">
        {!data && <div className="py-20 text-center text-[var(--color-mist)] breathe">…</div>}
        {data && data.entries.length === 0 && <div className="py-20 text-center text-[var(--color-mist)]">{t('noEntries')}</div>}
        <ol className="flex flex-col">
          {data?.entries.map((e, i) => (
            <li
              key={e.id}
              className={`rise flex items-center gap-3 border-b border-white/[.06] py-3 ${e.id === me?.id ? 'text-[var(--color-gold)]' : ''}`}
              style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
            >
              <span
                className={`w-10 text-center tabular-nums ${
                  e.rank <= 3 ? 'font-display text-[26px] text-[var(--color-gold)]' : 'text-[15px] text-[var(--color-mist)]'
                }`}
              >
                {e.rank}
              </span>
              <Avatar id={e.avatar} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{e.name}</div>
                <div className="text-[11.5px] text-[var(--color-mist)] tabular-nums">
                  {e.wins}
                  {t('wins')} {e.games - e.wins}
                  {t('losses')}
                </div>
              </div>
              <span className="font-display text-[22px] tabular-nums">{fmt(e.rating)}</span>
            </li>
          ))}
        </ol>
      </div>

      {me && (
        <div className="glass safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl px-5 pt-4">
          <div className="flex items-center gap-3">
            <span className="w-10 text-center text-[13px] text-[var(--color-mist)]">{mine ? mine.rank : '—'}</span>
            <Avatar id={me.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">{me.name}</div>
              <div className="text-[11.5px] text-[var(--color-mist)]">
                {me.isGuest ? t('guestNotRanked') : mine ? `${t('yourRank')} ${mine.rank}${t('rank')}` : t('unranked')}
              </div>
            </div>
            <span className="font-display text-[22px] tabular-nums text-[var(--color-gold)]">{fmt(me.rating)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
