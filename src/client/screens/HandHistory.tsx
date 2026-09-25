import { Bookmark, Layers } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { HandRecord } from '../../shared/protocol';
import { AppShell } from '../components/AppShell';
import { HandReplay } from '../components/HandReplay';
import { MiniCard } from '../components/PlayingCard';
import { useT } from '../lib/i18n';
import { socket, useApp } from '../lib/store';

// ブックマーク（この端末のブラウザに保存）
const BM_KEY = 'bookmarks.v1';
function loadBookmarks(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(BM_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}
function saveBookmarks(s: Set<string>) {
  try {
    localStorage.setItem(BM_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

const dt = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const signed = (n: number) => (Math.abs(n) < 0.005 ? '±0' : `${n > 0 ? '+' : ''}${Math.round(n * 100) / 100}`);

/** プリフロップのレイズ回数（SRP = 1回、3BP+ = 2回以上） */
const preRaises = (h: HandRecord) => h.log.filter((e) => e.street === 'preflop' && e.type === 'raise').length;

type Street = 'pre' | 'post' | null;
type Pot = 'srp' | '3bp' | null;

/** 2択の切り替え（もう一度押すと解除） */
function Toggle2<T extends string>({ value, options, onChange }: { value: T | null; options: [T, string][]; onChange: (v: T | null) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg ring-1 ring-white/15">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(value === v ? null : v)} className={`px-3 py-1.5 text-[12px] font-bold ${value === v ? 'bg-[#1f9a58] text-white' : 'text-white/80'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function HandHistory() {
  const { t } = useT();
  const me = useApp((s) => s.me)!;
  const [hands, setHands] = useState<HandRecord[] | null>(null);
  const [tab, setTab] = useState<'all' | 'bookmarks'>('all');
  const [street, setStreet] = useState<Street>(null);
  const [pot, setPot] = useState<Pot>(null);
  const [bm, setBm] = useState(loadBookmarks);
  const [replay, setReplay] = useState<HandRecord | null>(null);

  useEffect(() => {
    socket.emit('hands:recent', setHands);
  }, []);

  const list = useMemo(
    () =>
      (hands ?? []).filter((h) => {
        if (tab === 'bookmarks' && !bm.has(h.id)) return false;
        if (street === 'pre' && h.board.length > 0) return false;
        if (street === 'post' && h.board.length === 0) return false;
        const r = preRaises(h);
        if (pot === 'srp' && r !== 1) return false;
        if (pot === '3bp' && r < 2) return false;
        return true;
      }),
    [hands, tab, bm, street, pot],
  );

  const toggleBm = (id: string) => {
    const next = new Set(bm);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveBookmarks(next);
    setBm(next);
  };

  return (
    <AppShell>
      <div className="rise mt-2 rounded-xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/10">
        <div className="flex items-center gap-2 text-[15px] font-bold">
          <Layers size={17} />
          Hand History
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <Toggle2<'pre' | 'post'> value={street} onChange={setStreet} options={[['pre', 'Preflop'], ['post', 'Postflop']]} />
          <Toggle2<'srp' | '3bp'> value={pot} onChange={setPot} options={[['srp', 'SRP'], ['3bp', '3BP+']]} />
        </div>
        <div className="mt-3 grid grid-cols-2 border-b border-white/10" role="tablist">
          {(['all', 'bookmarks'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 py-2 text-[14px] font-bold ${tab === k ? 'border-[#34d27b] text-white' : 'border-transparent text-[var(--color-mist)]'}`}
            >
              {k === 'all' ? t('all') : t('bookmarks')}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[12px] text-[var(--color-mist)]">
          {t('recentN')} {hands?.length ?? 0} {t('handsShown')}
        </p>

        <div className="mt-2 flex flex-col gap-1.5">
          {!hands && <div className="breathe py-16 text-center text-[var(--color-mist)]">…</div>}
          {hands && list.length === 0 && <p className="py-16 text-center text-[14px] text-[var(--color-mist)]">{t('noHands')}</p>}
          {list.map((h) => {
            const seat = Math.max(0, h.players.findIndex((p) => p.id === me.id));
            const net = h.seatStats[seat]?.netBB ?? 0;
            const pos = seat === h.button ? 'SB' : 'BB';
            return (
              <div key={h.id} className="flex items-center gap-2 rounded-lg bg-[#2a2645] px-2 py-2">
                <button onClick={() => toggleBm(h.id)} className="grid h-9 w-8 place-items-center text-[var(--color-mist)]" aria-label={t('bookmarks')} aria-pressed={bm.has(h.id)}>
                  <Bookmark size={18} fill={bm.has(h.id) ? '#d9bf8c' : 'none'} color={bm.has(h.id) ? '#d9bf8c' : 'currentColor'} />
                </button>
                <button onClick={() => setReplay(h)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-mist)] tabular-nums">
                      {dt(h.at)}
                      <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold text-white/85">{pos}</span>
                      {h.mode === 'cpu' && <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold text-white/60">CPU</span>}
                    </div>
                    {/* 幅が足りないときはボードが次の行へ回り込む */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <div className="flex gap-1">
                        {h.hole[seat].map((c) => (
                          <MiniCard key={c} card={c} size="md" />
                        ))}
                      </div>
                      <div className="flex gap-0.5">
                        {h.board.map((c) => (
                          <MiniCard key={c} card={c} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[14px] font-bold tabular-nums ${net > 0.005 ? 'text-[var(--color-win)]' : net < -0.005 ? 'text-[var(--color-lose)]' : 'text-white/60'}`}>
                    {signed(net)}bb
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {replay && <HandReplay hand={replay} viewerId={me.id} onClose={() => setReplay(null)} />}
    </AppShell>
  );
}
