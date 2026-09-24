// チップの額面と色（上から大きい順）
const DENOMS: { v: number; c: string }[] = [
  { v: 25000, c: '#2f8f6a' },
  { v: 5000, c: '#d9822b' },
  { v: 1000, c: '#d8b54a' },
  { v: 500, c: '#7b4fb0' },
  { v: 100, c: '#23232a' },
];

function columns(amount: number, maxCols: number) {
  const cols: { c: string; n: number }[] = [];
  let rest = amount;
  for (const d of DENOMS) {
    const n = Math.floor(rest / d.v);
    if (n > 0) {
      cols.push({ c: d.c, n: Math.min(n, 8) });
      rest -= n * d.v;
    }
  }
  if (!cols.length && amount > 0) cols.push({ c: DENOMS[DENOMS.length - 1].c, n: 1 });
  return cols.slice(0, maxCols);
}

/** 横から見たチップの山 */
export function ChipStack({ amount, size = 22, maxCols = 3 }: { amount: number; size?: number; maxCols?: number }) {
  if (amount <= 0) return null;
  const cols = columns(amount, maxCols);
  const edge = Math.round(size * 0.22);
  return (
    <div className="flex items-end" style={{ gap: size * 0.12 }} aria-hidden>
      {cols.map((col, i) => (
        <div key={i} className="relative" style={{ width: size, height: size * 0.45 + edge * col.n }}>
          {Array.from({ length: col.n }).map((_, k) => (
            <div
              key={k}
              className="chip-edge absolute left-0 rounded-[50%/40%] shadow-[0_1px_0_rgba(0,0,0,.55)]"
              style={{ ['--c' as string]: col.c, width: size, height: size * 0.45, bottom: k * edge }}
            />
          ))}
          <div
            className="chip-top absolute left-0 rounded-[50%] ring-1 ring-black/30"
            style={{ ['--c' as string]: col.c, width: size, height: size * 0.45, bottom: col.n * edge }}
          />
        </div>
      ))}
    </div>
  );
}

/** ベット表示: チップの山 + 見やすい金額ラベル */
export function BetChips({ amount, label }: { amount: number; label: string }) {
  if (amount <= 0) return null;
  return (
    <div className="pop flex items-center gap-2">
      <ChipStack amount={amount} />
      <span className="rounded-full bg-black/60 px-3 py-1 text-[15px] font-bold tabular-nums text-white ring-1 ring-[#d9bf8c]/40 shadow-lg">{label}</span>
    </div>
  );
}
