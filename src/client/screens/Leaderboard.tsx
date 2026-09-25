import { Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LeaderboardEntry, LeaderboardTab } from '../../shared/protocol';
import { AppShell } from '../components/AppShell';
import { XBadge } from '../components/XBadge';
import { fmt, useT } from '../lib/i18n';
import { useApp } from '../lib/store';

type Span = 'weekly' | 'act';

export function Leaderboard() {
  const { t } = useT();
  const me = useApp((s) => s.me);
  const [span, setSpan] = useState<Span>('act');
  const [metric, setMetric] = useState<'rating' | 'wins'>('rating');
  const [data, setData] = useState<{ act: number; entries: LeaderboardEntry[] } | null>(null);
  const [updated, setUpdated] = useState('');

  // 期間 × 指標 → サーバーのタブ
  const tab: LeaderboardTab = span === 'weekly' ? 'week' : metric === 'rating' ? 'rating' : 'actWins';

  useEffect(() => {
    setData(null);
    fetch(`/api/leaderboard?tab=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        const n = new Date();
        setUpdated(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
      })
      .catch(() => setData({ act: 0, entries: [] }));
  }, [tab]);

  const mine = data?.entries.find((e) => e.id === me?.id);
  const valueCell = (e: LeaderboardEntry) =>
    tab === 'rating' ? (
      <span className="text-[17px] font-bold text-[var(--color-gold)] tabular-nums">{fmt(e.value)}</span>
    ) : (
      <span className="text-[17px] font-bold text-[var(--color-win)] tabular-nums">
        {fmt(e.value)}
        <span className="ml-0.5 text-[12px] text-white/50">{t('wins')}</span>
      </span>
    );

  return (
    <AppShell>
      <div className="rise mt-2 rounded-xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <Trophy size={17} />
            Leaderboard
          </div>
          {updated && <span className="text-[11px] text-white/40">Updated: {updated}</span>}
        </div>

        {/* 期間タブ */}
        <div className="mt-3 grid grid-cols-2 rounded-lg bg-[#2a2645] p-1" role="tablist">
          {(['weekly', 'act'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={span === k}
              onClick={() => setSpan(k)}
              className={`rounded-md py-2 text-[14px] font-bold tracking-wider ${span === k ? 'bg-[#1f9a58] text-white' : 'text-[var(--color-mist)]'}`}
            >
              {k === 'weekly' ? 'WEEKLY' : 'ACT'}
            </button>
          ))}
        </div>
        <div className="mt-2 text-center text-[14px] font-bold">{span === 'weekly' ? t('thisWeek') : `Act.${data?.act ?? '–'}`}</div>

        {/* 指標タブ（下線） */}
        <div className="mt-1 grid grid-cols-2 border-b border-white/10">
          {(span === 'act' ? (['rating', 'wins'] as const) : (['wins'] as const)).map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={`-mb-px border-b-2 py-2 text-[14px] font-bold ${
                (span === 'weekly' || metric === k) ? 'border-[#34d27b] text-white' : 'border-transparent text-[var(--color-mist)]'
              } ${span === 'weekly' ? 'col-span-2' : ''}`}
            >
              {k === 'rating' ? t('rating') : t('winsLabel')}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-mist)]">{t('aggregateTarget')}</p>

        <ol className="mt-2 flex flex-col gap-1.5">
          {!data && <div className="breathe py-16 text-center text-[var(--color-mist)]">…</div>}
          {data && data.entries.length === 0 && <p className="py-16 text-center text-[14px] text-[var(--color-mist)]">{t('noEntries')}</p>}
          {data?.entries.map((e) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 ${e.rank <= 3 ? 'bg-[#3a3560]' : 'bg-[#2a2645]'} ${e.id === me?.id ? 'ring-1 ring-[var(--color-gold)]' : ''}`}
            >
              <span className={`w-8 text-center font-bold tabular-nums ${e.rank <= 3 ? 'text-[20px] text-[#34d27b]' : e.rank <= 10 ? 'text-[18px]' : 'text-[15px]'}`}>{e.rank}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate text-[15px] font-bold">{e.name}</span>
                <XBadge handle={e.xHandle} size={20} />
              </span>
              <span className="text-right leading-tight">
                {valueCell(e)}
                <span className="block text-[11px] text-white/45 tabular-nums">
                  {fmt(e.games)} {t('matchesUnit')}
                </span>
              </span>
            </li>
          ))}
        </ol>

        {me && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2.5 text-[13px]">
            <span className="shrink-0 whitespace-nowrap text-[var(--color-mist)]">{t('yourRank')}</span>
            <span className="font-bold">
              {me.isGuest ? t('guestNotRanked') : mine ? `${mine.rank}${t('rank')}` : t('unranked')}
            </span>
            <span className="ml-auto font-bold text-[var(--color-gold)] tabular-nums">{fmt(me.rating)}</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}
