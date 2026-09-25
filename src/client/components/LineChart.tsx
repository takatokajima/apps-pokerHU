import { useMemo, useRef, useState } from 'react';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

const W = 340;
const H = 190;
const PAD = { l: 44, r: 12, t: 12, b: 22 };

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const fmtNum = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n * 10) / 10));

/** シンプルな折れ線グラフ（SVG）。なぞると十字線と値を表示 */
export function LineChart({ series, xLabel, zeroLine = false }: { series: Series[]; xLabel: (i: number) => string; zeroLine?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const n = Math.max(...series.map((s) => s.values.length));

  const { x, y, ticks } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    let min = Math.min(...all, zeroLine ? 0 : Infinity);
    let max = Math.max(...all, zeroLine ? 0 : -Infinity);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const padY = (max - min) * 0.08;
    min -= padY;
    max += padY;
    const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
    return { x, y, ticks: niceTicks(min, max) };
  }, [series, n, zeroLine]);

  // 点が多いときは間引いて描画（見た目は変わらない程度）
  const path = (vals: number[]) => {
    const stepN = Math.max(1, Math.floor(vals.length / 400));
    let d = '';
    for (let i = 0; i < vals.length; i += stepN) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(vals[i]).toFixed(1)}`;
    const last = vals.length - 1;
    if (last % stepN !== 0) d += `L${x(last).toFixed(1)},${y(vals[last]).toFixed(1)}`;
    return d;
  };

  const onMove = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={series.map((s) => s.label).join(', ')}
      >
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(tv)} y2={y(tv)} stroke="rgba(255,255,255,.07)" />
            <text x={PAD.l - 6} y={y(tv) + 3.5} textAnchor="end" fontSize="10" fill="rgba(255,255,255,.5)">
              {fmtNum(tv)}
            </text>
          </g>
        ))}
        {zeroLine && <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.3)" strokeDasharray="3 3" />}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="rgba(255,255,255,.45)">
          {xLabel(0)}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end" fill="rgba(255,255,255,.45)">
          {xLabel(n - 1)}
        </text>
        {/* 先頭の系列（収支）が一番手前に来るよう、逆順に描く */}
        {[...series].reverse().map((s) => (
          <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,.35)" />
            {series.map((s) =>
              s.values[hover] !== undefined ? (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="#15122b" strokeWidth={2} />
              ) : null,
            )}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-black/85 px-2.5 py-1.5 text-[11px] shadow-lg ring-1 ring-white/10"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) > W / 2 ? '-105%' : '5%'})` }}
        >
          <div className="text-white/60">{xLabel(hover)}</div>
          {series.map((s) =>
            s.values[hover] !== undefined ? (
              <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-white/75">{s.label}</span>
                <span className="font-bold text-white tabular-nums">{fmtNum(s.values[hover])}</span>
              </div>
            ) : null,
          )}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[12px] text-white/75">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
