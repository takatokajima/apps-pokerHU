import { useEffect, useState } from 'react';
import type { HandRecord, StatsPayload } from '../../shared/protocol';
import { Avatar } from '../components/Avatar';
import { HandReplay } from '../components/HandReplay';
import { LineChart } from '../components/LineChart';
import { MiniCard } from '../components/PlayingCard';
import { XBadge } from '../components/XBadge';
import { fmt, useT } from '../lib/i18n';
import { go, socket, useApp } from '../lib/store';

// 検証済みのグラフ色（暗い背景上で色覚の違いがあっても区別できる組み合わせ）
const C = { net: '#3987e5', ev: '#d95926', sd: '#199e70', nsd: '#c98500' };

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
const signed = (n: number) => `${n > 0 ? '+' : ''}${(Math.round(n * 10) / 10).toLocaleString('en-US')}`;
const dateStr = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5 ring-1 ring-white/[.06]">
      <div className="text-[11px] text-[var(--color-mist)]">{label}</div>
      <div
        className={`mt-0.5 text-[19px] font-bold tabular-nums ${tone === 'up' ? 'text-[var(--color-win)]' : tone === 'down' ? 'text-[var(--color-lose)]' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

export function Stats() {
  const { t } = useT();
  const me = useApp((s) => s.me)!;
  const [data, setData] = useState<StatsPayload | null>(null);
  const [tab, setTab] = useState<'rating' | 'profit'>('profit');
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const [hands, setHands] = useState<HandRecord[] | null>(null);
  const [replay, setReplay] = useState<HandRecord | null>(null);

  useEffect(() => {
    socket.emit('stats:get', setData);
  }, []);

  useEffect(() => {
    if (!openMatch) return;
    setHands(null);
    socket.emit('hands:list', openMatch, setHands);
  }, [openMatch]);

  const s = data?.stats;
  const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : undefined);

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-5 pb-8">
      <header className="py-2">
        <button onClick={() => go('home')} className="py-2 text-[15px] text-[var(--color-gold)]">
          ‹ {t('back')}
        </button>
      </header>

      <div className="rise mt-2 flex items-center gap-3">
        <Avatar id={me.avatar} size={52} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[22px] font-bold">{me.name}</span>
            <XBadge handle={me.xHandle} />
          </div>
          <div className="text-[13px] text-[var(--color-mist)]">
            {t('rating')} <span className="font-semibold text-[var(--color-gold)] tabular-nums">{fmt(me.rating)}</span>
          </div>
        </div>
      </div>

      {!data && <div className="breathe py-20 text-center text-[var(--color-mist)]">…</div>}

      {s && (
        <>
          <section className="rise mt-6 grid grid-cols-3 gap-2" style={{ animationDelay: '60ms' }}>
            <Kpi label={t('matches')} value={fmt(s.matches)} />
            <Kpi label={t('matchWinRate')} value={pct(s.matchWins, s.matches)} />
            <Kpi label={t('hands')} value={fmt(s.hands)} />
            <Kpi label={`${t('profit')} (bb)`} value={signed(s.netBB)} tone={tone(s.netBB)} />
            <Kpi label={`${t('profitEv')} (bb)`} value={signed(s.evBB)} tone={tone(s.evBB)} />
            <Kpi label={t('winRateBb')} value={s.hands ? signed((s.netBB / s.hands) * 100) : '—'} tone={tone(s.netBB)} />
            <Kpi label="VPIP" value={pct(s.vpip, s.hands)} />
            <Kpi label="PFR" value={pct(s.pfr, s.hands)} />
            <Kpi label="3Bet" value={pct(s.threeBet, s.threeBetOpp)} />
          </section>

          <section className="rise mt-4 rounded-2xl bg-black/25 p-4 ring-1 ring-white/[.06]" style={{ animationDelay: '120ms' }}>
            <div className="grid grid-cols-2 rounded-xl bg-black/30 p-1">
              {(['profit', 'rating'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded-lg py-2 text-[14px] font-semibold transition ${tab === k ? 'bg-white/15' : 'text-[var(--color-mist)]'}`}
                >
                  {k === 'profit' ? t('profitTrend') : t('ratingTrend')}
                </button>
              ))}
            </div>
            <div className="mt-3">
              {tab === 'profit' ? (
                data.profitSeries.length < 2 ? (
                  <p className="py-12 text-center text-[13px] text-[var(--color-mist)]">{t('noData')}</p>
                ) : (
                  <LineChart
                    zeroLine
                    xLabel={(i) => `${fmt(i + 1)} ${t('hands')}`}
                    series={[
                      { key: 'net', label: t('profit'), color: C.net, values: data.profitSeries.map((p) => p.net) },
                      { key: 'ev', label: 'EV', color: C.ev, values: data.profitSeries.map((p) => p.ev) },
                      { key: 'sd', label: t('sd'), color: C.sd, values: data.profitSeries.map((p) => p.sd) },
                      { key: 'nsd', label: t('nsd'), color: C.nsd, values: data.profitSeries.map((p) => p.nsd) },
                    ]}
                  />
                )
              ) : data.ratingSeries.length < 2 ? (
                <p className="py-12 text-center text-[13px] text-[var(--color-mist)]">{t('noData')}</p>
              ) : (
                <LineChart
                  xLabel={(i) => dateStr(data.ratingSeries[i].at)}
                  series={[{ key: 'rating', label: t('rating'), color: C.net, values: data.ratingSeries.map((p) => p.rating) }]}
                />
              )}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              {t('evNote')} / {t('sd')}: {t('sdLong')} / {t('nsd')}: {t('nsdLong')} · {t('statsNote')}
            </p>
          </section>

          <section className="rise mt-6" style={{ animationDelay: '180ms' }}>
            <h2 className="text-[12px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('recentMatches')}</h2>
            {data.matches.length === 0 && <p className="py-8 text-center text-[13px] text-[var(--color-mist)]">{t('noData')}</p>}
            <ul className="mt-2 flex flex-col">
              {data.matches.map((m) => {
                const won = m.winner === m.you;
                const r = m.rating[m.you];
                const d = r ? r.after - r.before : null;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => setOpenMatch(openMatch === m.id ? null : m.id)}
                      className="flex w-full items-center gap-3 border-b border-white/[.06] py-3 text-left"
                    >
                      <span className={`w-10 text-[13px] font-extrabold ${won ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'}`}>
                        {won ? 'WIN' : 'LOSE'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">
                          {t('vs')} {m.names[1 - m.you]}
                        </div>
                        <div className="text-[11.5px] text-[var(--color-mist)]">
                          {dateStr(m.at)} · {m.mode === 'ranked' ? t('ranked') : m.mode === 'friend' ? t('friend') : 'CPU'} · {m.hands} {t('hands')}
                        </div>
                      </div>
                      {d !== null && (
                        <span className={`text-[14px] font-bold tabular-nums ${d >= 0 ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'}`}>
                          {d >= 0 ? '+' : ''}
                          {d}
                        </span>
                      )}
                      <span className="text-[var(--color-gold)]">{openMatch === m.id ? '▾' : '›'}</span>
                    </button>
                    {openMatch === m.id && (
                      <div className="pop border-b border-white/[.06] bg-black/20 px-2 py-2">
                        <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('handHistory')}</div>
                        {!hands && <div className="breathe py-4 text-center text-[var(--color-mist)]">…</div>}
                        {hands?.map((h) => {
                          const seat = h.players.findIndex((p) => p.id === me.id);
                          const net = h.seatStats[seat]?.netBB ?? 0;
                          return (
                            <button key={h.id} onClick={() => setReplay(h)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left active:bg-white/10">
                              <span className="w-8 text-[12px] text-[var(--color-mist)] tabular-nums">#{h.handNo}</span>
                              <div className="flex gap-0.5">
                                {h.hole[seat].map((c) => (
                                  <MiniCard key={c} card={c} />
                                ))}
                              </div>
                              <div className="flex min-w-0 flex-1 gap-0.5 overflow-hidden opacity-75">
                                {h.board.map((c) => (
                                  <MiniCard key={c} card={c} />
                                ))}
                              </div>
                              <span className={`text-[13px] font-bold tabular-nums ${net > 0 ? 'text-[var(--color-win)]' : net < 0 ? 'text-[var(--color-lose)]' : 'text-white/60'}`}>
                                {signed(net)}bb
                              </span>
                              <span className="text-[var(--color-gold)]">▶</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {replay && <HandReplay hand={replay} viewerId={me.id} onClose={() => setReplay(null)} />}
    </div>
  );
}
