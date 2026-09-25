import { useEffect, useState } from 'react';
import { bestHand } from '../../shared/cards';
import type { HandRecord, LogEntry } from '../../shared/protocol';
import { fmt, handName, useT } from '../lib/i18n';
import { formatAmount, useSettings } from '../lib/settings';
import { Avatar } from './Avatar';
import { PlayingCard } from './PlayingCard';

/** 1ハンドのリプレイ（ログの各時点を順に表示） */
export function HandReplay({ hand, viewerId, onClose }: { hand: HandRecord; viewerId: string; onClose: () => void }) {
  const { t, lang } = useT();
  const { bbMode } = useSettings();
  const amt = (n: number) => formatAmount(n, hand.bb, bbMode);
  const steps = hand.log;
  const last = steps.length; // steps.length = 結果表示
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const me = Math.max(0, hand.players.findIndex((p) => p.id === viewerId));
  const opp = 1 - me;

  useEffect(() => {
    if (!auto) return;
    if (i >= last) {
      setAuto(false);
      return;
    }
    const id = setTimeout(() => setI((v) => v + 1), 900);
    return () => clearTimeout(id);
  }, [auto, i, last]);

  const atEnd = i >= last;
  const e: LogEntry | undefined = steps[Math.min(i, steps.length - 1)];
  const board = atEnd ? hand.board : (e?.board ?? []);
  const stacks = atEnd ? null : e?.stacks;
  const pot = atEnd ? hand.result.won[0] + hand.result.won[1] : (e?.pot ?? 0);
  const sbSeat = hand.button;
  const pos = (s: number) => (s === sbSeat ? 'SB' : 'BB');
  const label = (x: LogEntry) => {
    if (x.type === 'deal') return `${x.street.toUpperCase()}`;
    const who = x.seat === me ? t('you') : hand.players[x.seat!].name;
    const verb: Record<string, string> = {
      sb: 'SB', bb: 'BB', ante: 'Ante', fold: t('fold'), check: t('check'), call: t('call'), raise: t('raise'),
    };
    const amount = x.type === 'check' || x.type === 'fold' ? '' : ` ${amt(x.type === 'ante' ? x.add : x.to)}`;
    return `${who}: ${x.allIn && x.type !== 'fold' && x.type !== 'ante' ? t('allIn') : verb[x.type]}${amount}`;
  };

  const seatRow = (s: number) => {
    const p = hand.players[s];
    const cards = hand.hole[s];
    const best = atEnd && cards.length && board.length >= 3 ? bestHand([...cards, ...board]) : null;
    const won = atEnd ? hand.result.won[s] : 0;
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar id={p.avatar} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold">
              <span className="rounded bg-white/15 px-1 text-[10px] font-extrabold">{pos(s)}</span>
              <span className="truncate">{s === me ? t('you') : p.name}</span>
            </div>
            <div className="text-[15px] font-bold tabular-nums">
              {stacks ? amt(stacks[s]) : won > 0 ? <span className="text-[var(--color-win)]">+{amt(won)}</span> : '—'}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1">
            {cards.length ? cards.map((c) => <PlayingCard key={c} card={c} size="sm" />) : [0, 1].map((k) => <PlayingCard key={k} card={null} size="sm" />)}
          </div>
          {best && <span className="text-[11px] font-bold text-[#f3e3bd]">{handName(best.category, best.ranks, lang)}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <div
        className="safe-bottom pop w-full max-w-md rounded-t-2xl bg-[#15122b] px-5 pt-5 ring-1 ring-[#d9bf8c]/30 sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-label={t('replay')}
      >
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-[var(--color-mist)]">
            #{hand.handNo} · Lv{hand.level} {fmt(hand.sb)}/{fmt(hand.bb)} ({fmt(hand.ante)})
          </div>
          <button onClick={onClose} className="px-2 py-1 text-[14px] text-[var(--color-gold)]">
            {t('close')}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {seatRow(opp)}
          <div className="rounded-xl bg-[#262052]/60 px-3 py-4 ring-1 ring-[#d9bf8c]/20">
            <div className="text-center text-[12px] text-white/60">
              {t('pot')} <span className="text-[16px] font-extrabold text-white tabular-nums">{amt(pot)}</span>
            </div>
            <div className="mt-2 flex h-[52px] justify-center gap-1">
              {board.map((c) => (
                <PlayingCard key={c} card={c} size="sm" />
              ))}
              {Array.from({ length: 5 - board.length }).map((_, k) => (
                <div key={k} className="h-[52px] w-9 rounded-[7px] border border-white/10" />
              ))}
            </div>
          </div>
          {seatRow(me)}
        </div>

        <div className="mt-4 h-10 rounded-xl bg-black/40 px-3 py-2.5 text-center text-[14px] font-bold">
          {atEnd
            ? hand.result.winners.length === 2
              ? t('split')
              : `${hand.result.winners[0] === me ? t('you') : hand.players[hand.result.winners[0]].name} ${t('wonPot')} ${amt(hand.result.won[hand.result.winners[0]])}`
            : e
              ? label(e)
              : ''}
        </div>

        <div className="mt-3 flex items-center gap-2 pb-4">
          <button onClick={() => setI(0)} className="h-11 w-11 rounded-xl bg-white/10 text-[16px]" aria-label="first">
            ⏮
          </button>
          <button onClick={() => setI((v) => Math.max(0, v - 1))} className="h-11 flex-1 whitespace-nowrap rounded-xl bg-white/10 text-[13px] font-bold">
            ‹ {t('prev')}
          </button>
          <button onClick={() => setAuto((a) => !a)} className="h-11 flex-1 whitespace-nowrap rounded-xl bg-[#f3d493] text-[13px] font-bold text-[#1a1408]">
            {auto ? t('stop') : `▶ ${t('autoplay')}`}
          </button>
          <button onClick={() => setI((v) => Math.min(last, v + 1))} className="h-11 flex-1 whitespace-nowrap rounded-xl bg-white/10 text-[13px] font-bold">
            {t('next')} ›
          </button>
          <button onClick={() => setI(last)} className="h-11 w-11 rounded-xl bg-white/10 text-[16px]" aria-label="last">
            ⏭
          </button>
        </div>
        <div className="-mt-2 pb-4 text-center text-[11px] text-white/40 tabular-nums">
          {Math.min(i, last)} / {last}
        </div>
      </div>
    </div>
  );
}
