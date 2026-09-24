const MAP: Record<string, { s: string; g: string }> = {
  spade: { s: '♠', g: 'from-zinc-700 to-zinc-900' },
  heart: { s: '♥', g: 'from-rose-700 to-rose-950' },
  diamond: { s: '♦', g: 'from-amber-600 to-orange-900' },
  club: { s: '♣', g: 'from-emerald-700 to-emerald-950' },
  star: { s: '★', g: 'from-yellow-600 to-amber-900' },
  moon: { s: '☾', g: 'from-indigo-700 to-slate-950' },
  sun: { s: '☀', g: 'from-orange-500 to-red-900' },
  crown: { s: '♛', g: 'from-[#d9bf8c] to-[#6b5530]' },
  knight: { s: '♞', g: 'from-stone-600 to-stone-900' },
  bolt: { s: 'ϟ', g: 'from-sky-600 to-blue-950' },
  gem: { s: '◆', g: 'from-teal-600 to-cyan-950' },
  spark: { s: '✦', g: 'from-fuchsia-700 to-purple-950' },
};

export function Avatar({ id, size = 44, dim = false }: { id: string; size?: number; dim?: boolean }) {
  const a = MAP[id] ?? MAP.spade;
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${a.g} ring-1 ring-white/15 shadow-lg transition-opacity ${dim ? 'opacity-40' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      aria-hidden
    >
      <span className="text-white/90 leading-none">{a.s}</span>
    </div>
  );
}
