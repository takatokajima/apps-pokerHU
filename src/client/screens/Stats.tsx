import { ChartLine, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StatsPayload } from '../../shared/protocol';
import { AppShell } from '../components/AppShell';
import { LineChart } from '../components/LineChart';
import { XBadge } from '../components/XBadge';
import { fmt, useT, type Key } from '../lib/i18n';
import { OFFLINE } from '../lib/mode';
import { socket, useApp } from '../lib/store';

// 検証済みのグラフ色（暗い背景上で色覚の違いがあっても区別できる組み合わせ）
const C = { net: '#3987e5', ev: '#d95926', sd: '#199e70', nsd: '#c98500' };
type SeriesKey = keyof typeof C;
type Period = { kind: 'time'; key: 'week' | 'month' } | { kind: 'count'; n: number } | { kind: 'all' };

const pct = (a: number, b: number) => (b > 0 ? String(Math.round((a / b) * 100)) : '—');
const signed = (n: number) => (Math.abs(n) < 0.005 ? '±0' : `${n > 0 ? '+' : ''}${(Math.round(n * 100) / 100).toLocaleString('en-US')}`);
const ymd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 数値 + 説明（ⓘ をタップ/ホバーで表示） */
function Stat({ label, tip, value, unit, tone }: { label: string; tip?: Key; value: string; unit?: string; tone?: 'up' | 'down' }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative text-center">
      <div className="flex items-center justify-center gap-1 text-[13px] text-white/85">
        {label}
        {tip && (
          <button onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)} className="text-[var(--color-mist)]" aria-label={t(tip)} title={t(tip)}>
            <Info size={13} />
          </button>
        )}
      </div>
      <div
        className={`mt-0.5 inline-block border-b border-dashed border-white/25 text-[18px] font-bold tabular-nums ${
          tone === 'up' ? 'text-[var(--color-win)]' : tone === 'down' ? 'text-[var(--color-lose)]' : ''
        }`}
      >
        {value}
        {unit && <span className="text-[13px] font-bold text-white/70">{unit}</span>}
      </div>
      {open && tip && <div className="pop absolute left-1/2 top-full z-20 mt-1 w-44 -translate-x-1/2 rounded-lg bg-black/90 px-3 py-2 text-[11px] leading-snug text-white/85 shadow-lg">{t(tip)}</div>}
    </div>
  );
}

export function Stats() {
  const { t } = useT();
  const me = useApp((s) => s.me)!;
  const [data, setData] = useState<StatsPayload | null>(null);
  const [view, setView] = useState<'profit' | 'rating'>('profit');
  const [period, setPeriod] = useState<Period>({ kind: 'all' });
  const [shown, setShown] = useState<Record<SeriesKey, boolean>>({ net: true, ev: true, sd: false, nsd: false });

  useEffect(() => {
    socket.emit('stats:get', setData);
  }, []);

  // 期間で絞り込んだハンド
  const rows = useMemo(() => {
    if (!data) return [];
    const all = data.hands;
    if (period.kind === 'all') return all;
    if (period.kind === 'count') return all.slice(-period.n);
    const now = new Date();
    const start =
      period.key === 'month'
        ? new Date(now.getFullYear(), now.getMonth(), 1).getTime()
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    return all.filter((h) => h.at >= start);
  }, [data, period]);

  const agg = useMemo(() => {
    const s = { hands: rows.length, net: 0, ev: 0, vpip: 0, pfr: 0, tbo: 0, tb: 0 };
    for (const r of rows) {
      s.net += r.net;
      s.ev += r.ev;
      s.vpip += r.vpip ? 1 : 0;
      s.pfr += r.pfr ? 1 : 0;
      s.tbo += r.tbo ? 1 : 0;
      s.tb += r.tb ? 1 : 0;
    }
    return s;
  }, [rows]);

  const series = useMemo(() => {
    let net = 0, ev = 0, sd = 0, nsd = 0;
    const out = { net: [] as number[], ev: [] as number[], sd: [] as number[], nsd: [] as number[] };
    for (const r of rows) {
      net += r.net;
      ev += r.ev;
      if (r.sd) sd += r.net;
      else nsd += r.net;
      out.net.push(Math.round(net * 100) / 100);
      out.ev.push(Math.round(ev * 100) / 100);
      out.sd.push(Math.round(sd * 100) / 100);
      out.nsd.push(Math.round(nsd * 100) / 100);
    }
    return out;
  }, [rows]);

  const tone = (n: number) => (n > 0.005 ? 'up' : n < -0.005 ? 'down' : undefined);
  const wr = (n: number) => (agg.hands ? (Math.round((n / agg.hands) * 10000) / 100).toFixed(2) : '0.00');
  const legend: { key: SeriesKey; label: string }[] = [
    { key: 'net', label: t('profit') },
    { key: 'ev', label: t('profitEv') },
    { key: 'sd', label: 'SD' },
    { key: 'nsd', label: 'NSD' },
  ];
  const isPeriod = (p: Period) => JSON.stringify(p) === JSON.stringify(period);

  return (
    <AppShell>
      <div className="rise mt-2 rounded-xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/10">
        {/* 見出し */}
        <div className="flex items-center gap-2 text-[15px]">
          <ChartLine size={17} />
          <span className="font-bold">{me.name}</span>
          <span className="font-mono text-[11px] text-[var(--color-mist)]">({me.id.slice(0, 4)}*)</span>
          <div className="ml-auto grid grid-cols-2 rounded-lg bg-black/30 p-0.5 text-[12px] font-bold">
            {(['profit', 'rating'] as const).map((k) => (
              <button key={k} onClick={() => setView(k)} className={`rounded-md px-2.5 py-1 ${view === k ? 'bg-white/15' : 'text-[var(--color-mist)]'}`}>
                {k === 'profit' ? t('profit') : t('rating')}
              </button>
            ))}
          </div>
        </div>

        {/* 成績の表（左に緑のライン） */}
        <div className="mt-3 border-l-4 border-[#1f9a58] pl-3">
          <div className="flex items-center justify-center gap-3 border-b border-white/10 pb-3">
            <div className="text-center">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] text-white/85">{t('totalHands')}</span>
                <span className="text-[20px] font-black tabular-nums">{fmt(data?.hands.length ?? 0)}</span>
              </div>
              <div className="text-[11px] text-[var(--color-mist)]">
                First Play <span className="font-bold text-white/85">{data?.firstPlayAt ? ymd(data.firstPlayAt) : '—'}</span>
              </div>
            </div>
            <XBadge handle={me.xHandle} size={30} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-y-4">
            <Stat label={t('hands')} value={fmt(agg.hands)} />
            <Stat label={t('realProfit')} value={signed(agg.net)} unit="bb" tone={tone(agg.net)} />
            <Stat label="Win Rate" tip="tipWinRate" value={wr(agg.net)} unit="bb/100" tone={tone(agg.net)} />
            <div />
            <Stat label={t('profitEv')} tip="tipEv" value={signed(agg.ev)} unit="bb" tone={tone(agg.ev)} />
            <Stat label="Win Rate (EV)" tip="tipWinRate" value={wr(agg.ev)} unit="bb/100" tone={tone(agg.ev)} />
            <Stat label="VPIP" tip="tipVpip" value={pct(agg.vpip, agg.hands)} />
            <Stat label="PFR" tip="tipPfr" value={pct(agg.pfr, agg.hands)} />
            <Stat label="3Bet" tip="tip3bet" value={pct(agg.tb, agg.tbo)} />
          </div>
        </div>

        {/* グラフ */}
        <div className="mt-5 min-h-[220px]">
          {!data ? (
            <div className="breathe py-20 text-center text-[var(--color-mist)]">…</div>
          ) : view === 'profit' ? (
            rows.length < 2 ? (
              <p className="py-20 text-center text-[14px] text-[var(--color-mist)]">{t('noHands')}</p>
            ) : (
              <LineChart
                zeroLine
                xLabel={(i) => (rows[i] ? hm(rows[i].at) : '')}
                series={legend.filter((l) => shown[l.key]).map((l) => ({ key: l.key, label: l.label, color: C[l.key], values: series[l.key] }))}
              />
            )
          ) : data.ratingSeries.length < 2 ? (
            <p className="py-20 text-center text-[14px] text-[var(--color-mist)]">{t('noData')}</p>
          ) : (
            <LineChart xLabel={(i) => hm(data.ratingSeries[i].at)} series={[{ key: 'r', label: t('rating'), color: C.net, values: data.ratingSeries.map((p) => p.rating) }]} />
          )}
        </div>

        {view === 'profit' && (
          <>
            {/* 系列の表示切り替え（丸い色つきボタン） */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {legend.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setShown((s) => ({ ...s, [l.key]: !s[l.key] }))}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold transition"
                  style={{
                    background: shown[l.key] ? `${C[l.key]}33` : 'transparent',
                    boxShadow: `inset 0 0 0 1px ${shown[l.key] ? C[l.key] : 'rgba(255,255,255,.15)'}`,
                    color: shown[l.key] ? '#fff' : 'rgba(255,255,255,.5)',
                  }}
                  aria-pressed={shown[l.key]}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: C[l.key] }} />
                  {l.label}
                </button>
              ))}
            </div>
            {/* 期間の絞り込み */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12px]">
              <span className="text-[var(--color-mist)]">{t('period')}</span>
              <div className="flex overflow-hidden rounded-lg ring-1 ring-white/15">
                {(['week', 'month'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setPeriod({ kind: 'time', key: k })}
                    className={`px-3 py-1.5 font-bold ${isPeriod({ kind: 'time', key: k }) ? 'bg-[#1f9a58] text-white' : 'text-white/70'}`}
                  >
                    {k === 'week' ? t('thisWeek') : t('thisMonth')}
                  </button>
                ))}
              </div>
              <span className="text-[var(--color-mist)]">{t('recentN')}</span>
              <div className="flex overflow-hidden rounded-lg ring-1 ring-white/15">
                {[1000, 10000, 20000, 50000].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPeriod({ kind: 'count', n })}
                    className={`px-2.5 py-1.5 font-bold ${isPeriod({ kind: 'count', n }) ? 'bg-[#1f9a58] text-white' : 'text-white/70'}`}
                  >
                    {n / 1000}k
                  </button>
                ))}
                <button onClick={() => setPeriod({ kind: 'all' })} className={`px-2.5 py-1.5 font-bold ${period.kind === 'all' ? 'bg-[#1f9a58] text-white' : 'text-white/70'}`}>
                  All
                </button>
              </div>
            </div>
          </>
        )}
        <p className="mt-4 text-center text-[11px] text-white/35">{OFFLINE ? t('offlineNote') : t('statsNote')}</p>
      </div>
    </AppShell>
  );
}
