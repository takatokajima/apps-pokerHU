const SUIT: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK: Record<string, string> = { T: '10' };

export function PlayingCard({
  card, size = 'md', delay = 0, glow = false, dim = false,
}: { card: string | null; size?: 'sm' | 'md' | 'board' | 'lg'; delay?: number; glow?: boolean; dim?: boolean }) {
  const dims = { sm: 'w-9 h-[52px] text-[15px]', md: 'w-12 h-[68px] text-[19px]', board: 'w-[50px] h-[72px] text-[20px]', lg: 'w-[58px] h-[82px] text-[23px]' }[size];
  if (!card) {
    return (
      <div
        className={`${dims} deal rounded-[7px] border border-[#d9bf8c]/30 shadow-lg`}
        style={{
          animationDelay: `${delay}ms`,
          background: 'repeating-linear-gradient(45deg,#1b1b21 0 4px,#15151a 4px 8px)',
          boxShadow: 'inset 0 0 0 3px #0e0e12, 0 6px 16px rgba(0,0,0,.45)',
        }}
        aria-label="card"
      />
    );
  }
  const r = RANK[card[0]] ?? card[0];
  const s = card[1];
  const red = s === 'h' || s === 'd';
  return (
    <div
      className={`${dims} deal relative flex flex-col items-start justify-between rounded-[7px] bg-[#f7f4ec] px-[5px] py-[3px] font-semibold shadow-[0_6px_16px_rgba(0,0,0,.45)] transition ${
        glow ? 'card-glow -translate-y-1.5' : ''
      } ${dim ? 'brightness-50' : ''}`}
      style={{ animationDelay: `${delay}ms`, color: red ? 'var(--color-suit-red)' : '#16161a' }}
      aria-label={`${r}${s}`}
    >
      <span className="leading-none tracking-tight">{r}</span>
      <span className="self-end text-[1.35em] leading-none">{SUIT[s]}</span>
    </div>
  );
}
