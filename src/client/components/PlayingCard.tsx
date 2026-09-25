import { cardFace, useSettings } from '../lib/settings';

const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK: Record<string, string> = { T: '10' };

// サイズごとの寸法（数字は大きく、マークは小さく）。short/tiny は高さの狭い画面（ブラウザ表示のスマホ）用
const DIMS = {
  sm: { box: 'w-9 h-[52px] tiny:w-8 tiny:h-[46px]', rank: 'text-[24px] tiny:text-[21px]', ten: 'text-[20px] tiny:text-[17px]', suit: 'text-[11px]' },
  md: { box: 'w-12 h-[68px]', rank: 'text-[32px]', ten: 'text-[26px]', suit: 'text-[13px]' },
  board: {
    box: 'w-[50px] h-[72px] short:w-[46px] short:h-[64px] tiny:w-[42px] tiny:h-[58px]',
    rank: 'text-[34px] short:text-[30px] tiny:text-[27px]',
    ten: 'text-[28px] short:text-[25px] tiny:text-[22px]',
    suit: 'text-[14px] tiny:text-[12px]',
  },
  lg: {
    box: 'w-[58px] h-[82px] short:w-[50px] short:h-[70px] tiny:w-[46px] tiny:h-[62px]',
    rank: 'text-[40px] short:text-[34px] tiny:text-[30px]',
    ten: 'text-[33px] short:text-[28px] tiny:text-[25px]',
    suit: 'text-[16px] short:text-[14px] tiny:text-[13px]',
  },
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
      <span className={`absolute left-[4px] top-[2px] leading-none ${d.suit}`}>
        {SUIT[s]}
      </span>
      <span
        className={`absolute inset-x-0 bottom-[2px] text-center leading-none tracking-[-0.06em] ${r === '10' ? d.ten : d.rank}`}
      >
        {r}
      </span>
    </div>
  );
}

/** 一覧表示用の小さな文字カード（例: A♠） */
export function MiniCard({ card, size = 'sm' }: { card: string; size?: 'sm' | 'md' }) {
  const { fourColor } = useSettings();
  const face = cardFace(card[1], fourColor);
  const dims = size === 'md' ? 'h-[32px] min-w-[36px] text-[16px] rounded-[5px]' : 'h-[22px] min-w-[25px] text-[12px] rounded-[4px]';
  return (
    <span
      className={`inline-flex items-center justify-center px-1 font-black leading-none shadow ${dims}`}
      style={{ color: face.fg, background: face.bg }}
    >
      {RANK[card[0]] ?? card[0]}
      {SUIT[card[1]]}
    </span>
  );
}
