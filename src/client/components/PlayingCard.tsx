import { cardFace, useSettings } from '../lib/settings';

const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK: Record<string, string> = { T: '10' };

// サイズごとの寸法（数字は大きく、マークは小さく）
const DIMS = {
  sm: { box: 'w-9 h-[52px]', rank: 24, suit: 11 },
  md: { box: 'w-12 h-[68px]', rank: 32, suit: 13 },
  board: { box: 'w-[50px] h-[72px]', rank: 34, suit: 14 },
  lg: { box: 'w-[58px] h-[82px]', rank: 40, suit: 16 },
} as const;

export function PlayingCard({
  card, size = 'md', delay = 0, glow = false, dim = false,
}: { card: string | null; size?: keyof typeof DIMS; delay?: number; glow?: boolean; dim?: boolean }) {
  const { fourColor } = useSettings();
  const d = DIMS[size];
  if (!card) {
    return (
      <div
        className={`${d.box} deal rounded-[7px] border border-[#c4b8ff]/25 shadow-lg`}
        style={{
          animationDelay: `${delay}ms`,
          background: 'repeating-linear-gradient(45deg,#2b2456 0 4px,#221c48 4px 8px)',
          boxShadow: 'inset 0 0 0 3px #120f28, 0 6px 16px rgba(0,0,0,.45)',
        }}
        aria-label="card"
      />
    );
  }
  const r = RANK[card[0]] ?? card[0];
  const s = card[1];
  const face = cardFace(s, fourColor);
  return (
    <div
      className={`${d.box} deal relative overflow-hidden rounded-[6px] font-black shadow-[0_4px_12px_rgba(0,0,0,.45)] ring-1 ring-black/20 transition ${
        glow ? 'card-glow -translate-y-1.5' : ''
      } ${dim ? 'brightness-50' : ''}`}
      style={{ animationDelay: `${delay}ms`, color: face.fg, background: face.bg }}
      aria-label={`${r}${s}`}
    >
      <span className="absolute left-[4px] top-[2px] leading-none" style={{ fontSize: d.suit }}>
        {SUIT[s]}
      </span>
      <span
        className="absolute inset-x-0 bottom-[2px] text-center leading-none tracking-[-0.06em]"
        style={{ fontSize: r === '10' ? d.rank * 0.82 : d.rank }}
      >
        {r}
      </span>
    </div>
  );
}

/** 一覧表示用の小さな文字カード（例: A♠） */
export function MiniCard({ card }: { card: string }) {
  const { fourColor } = useSettings();
  const face = cardFace(card[1], fourColor);
  return (
    <span
      className="inline-flex h-[22px] min-w-[25px] items-center justify-center rounded-[4px] px-1 text-[12px] font-black leading-none shadow"
      style={{ color: face.fg, background: face.bg }}
    >
      {RANK[card[0]] ?? card[0]}
      {SUIT[card[1]]}
    </span>
  );
}
