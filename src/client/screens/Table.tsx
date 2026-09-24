import { useEffect, useMemo, useState } from 'react';
import { bestHand, type BestHand } from '../../shared/cards';
import type { SeatView, TableState } from '../../shared/protocol';
import { Avatar } from '../components/Avatar';
import { BetChips, ChipStack } from '../components/Chips';
import { PlayingCard } from '../components/PlayingCard';
import { fmt, handName, useT } from '../lib/i18n';
import { formatAmount, useSettings } from '../lib/settings';
import { go, setState, socket, useApp } from '../lib/store';

function useServerNow(offset: number, interval = 200) {
  const [now, setNow] = useState(Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), interval);
    return () => clearInterval(id);
  }, [offset, interval]);
  return now;
}

function useAmount(bb: number) {
  const { bbMode } = useSettings();
  return (n: number) => formatAmount(n, bb, bbMode);
}

/** アバターの周りを回る持ち時間リング */
function TimerRing({ left, total, size, bank }: { left: number; total: number; size: number; bank: boolean }) {
  const frac = Math.max(0, Math.min(1, left / total));
  const r = size / 2 + 4;
  const c = 2 * Math.PI * r;
  const color = bank ? '#ff9f5a' : frac < 0.3 ? '#ff7a73' : '#d9bf8c';
  const box = size + 12;
  return (
    <svg className="pointer-events-none absolute -rotate-90" width={box} height={box} style={{ left: -6, top: -6 }}>
      <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={3} />
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
        style={{ transition: 'stroke-dashoffset .2s linear, stroke .3s' }}
      />
    </svg>
  );
}

function SeatInfo({ seat, seatIdx, mine, state, now, winner }: { seat: SeatView; seatIdx: number; mine: boolean; state: TableState; now: number; winner: boolean }) {
  const { t } = useT();
  const amt = useAmount(state.bb);
  const acting = state.toAct === seatIdx && state.deadline && state.timeTotal;
  return (
    <div className={`flex items-center gap-3 ${mine ? 'flex-row-reverse text-right' : ''}`}>
      <div className="relative">
        <Avatar id={seat.avatar} size={48} dim={seat.folded || !seat.connected} />
        {acting && <TimerRing left={state.deadline! - now} total={state.timeTotal!} size={48} bank={state.usingTimebank} />}
        {seat.isButton && (
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[#f5f3ee] text-[10px] font-extrabold text-black shadow">D</span>
        )}
      </div>
      <div className="min-w-0">
        <div className={`flex items-center gap-1.5 ${mine ? 'justify-end' : ''}`}>
          <span className="truncate text-[14px] font-semibold">{mine ? t('you') : seat.name}</span>
          {seat.rating !== null && !seat.isCpu && <span className="text-[12px] text-[var(--color-gold)] tabular-nums">{fmt(seat.rating)}</span>}
          {!seat.connected && <span className="rounded bg-[var(--color-lose)]/20 px-1.5 text-[10px] text-[var(--color-lose)]">{t('disconnected')}</span>}
        </div>
        <div className={`text-[24px] font-bold leading-tight tracking-tight tabular-nums ${winner ? 'text-[var(--color-win)]' : ''}`}>{amt(seat.stack)}</div>
        <div className="text-[11px] text-[var(--color-mist)] tabular-nums">⏱ ×{seat.timebanks}</div>
      </div>
    </div>
  );
}

/** 役名のラベル（カードのすぐ近くに表示） */
function HandLabel({ best, strong }: { best: BestHand | null; strong: boolean }) {
  const { lang } = useT();
  if (!best) return <div className="h-7" />;
  return (
    <div className="flex h-7 items-center">
      <span
        className={`pop whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold ${
          strong ? 'bg-[#e9cf98] text-[#1a1408] shadow-[0_0_16px_rgba(233,207,152,.5)]' : 'bg-black/50 text-[#f3e3bd] ring-1 ring-[#d9bf8c]/40'
        }`}
      >
        {handName(best.category, best.ranks, lang)}
      </span>
    </div>
  );
}

/** 直前のアクション表示（コール・チェック等） */
function ActionBubble({ state, seatIdx }: { state: TableState; seatIdx: number }) {
  const { t } = useT();
  const amt = useAmount(state.bb);
  const a = state.lastAction;
  if (!a || a.seat !== seatIdx) return null;
  const allIn = state.seats[seatIdx].allIn && a.type !== 'check' && a.type !== 'fold';
  const label = allIn
    ? t('allIn')
    : a.type === 'raise'
      ? `${state.street === 'preflop' || state.seats[1 - seatIdx].bet > 0 ? t('raise') : t('bet')} ${amt(a.amount)}`
      : { fold: t('fold'), check: t('check'), call: t('call') }[a.type];
  const color = a.type === 'fold' ? 'bg-white/15 text-white/70' : allIn || a.type === 'raise' ? 'bg-[#e9cf98] text-[#1a1408]' : 'bg-white text-[#0a1a13]';
  return <span key={`${a.seat}-${a.type}-${a.amount}`} className={`pop rounded-full px-3 py-1 text-[13px] font-extrabold uppercase tracking-wide shadow-lg ${color}`}>{label}</span>;
}

/** オールイン時の勝率・アウツ */
function OddsBadge({ state, seatIdx }: { state: TableState; seatIdx: number }) {
  const { t } = useT();
  if (!state.odds) return null;
  const eq = state.odds.equity[seatIdx];
  const outs = state.odds.outs[seatIdx];
  const leading = eq >= state.odds.equity[1 - seatIdx];
  return (
    <div className={`pop flex items-center gap-2 rounded-2xl px-3 py-1.5 ring-1 ${leading ? 'bg-[var(--color-win)]/15 ring-[var(--color-win)]/50' : 'bg-[var(--color-lose)]/15 ring-[var(--color-lose)]/40'}`}>
      <span className={`text-[20px] font-extrabold tabular-nums ${leading ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'}`}>{eq}%</span>
      {outs !== null && (
        <span className="text-[12px] font-semibold text-white/80">
          {t('outs')} {outs}
        </span>
      )}
    </div>
  );
}

function ActionBar({ state, now }: { state: TableState; now: number }) {
  const { t } = useT();
  const settings = useSettings();
  const amt = useAmount(state.bb);
  const legal = state.legal!;
  const me = state.seats[state.you];
  const opp = state.seats[1 - state.you];
  const totalPot = state.pot + me.bet + opp.bet;
  const base = Math.max(me.bet, opp.bet); // 現在のベット額
  const raiseMode = base > 0; // 誰かがベット済み（プリフロップはブラインド）→ レイズ
  const unit = state.sb;
  const clamp = (v: number) => Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(v / unit) * unit));
  const [raiseTo, setRaiseTo] = useState(legal.minRaiseTo);
  const [open, setOpen] = useState(false);

  const act = (type: 'fold' | 'check' | 'call' | 'raise', amount?: number) => {
    if (navigator.vibrate) navigator.vibrate(8);
    socket.emit('game:action', { type, amount });
  };

  const presets = useMemo(
    () =>
      raiseMode
        ? settings.raisePresets.map((m) => ({ label: `×${m}`, v: clamp(base * m) }))
        : settings.betPresets.map((p) => ({ label: `${p}%`, v: clamp((totalPot * p) / 100) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raiseMode, settings, base, totalPot, legal.minRaiseTo, legal.maxRaiseTo],
  );

  const isAllIn = raiseTo >= legal.maxRaiseTo;
  const verb = raiseMode ? t('raise') : t('bet');
  const sizeLabel = raiseMode ? `×${(raiseTo / base).toFixed(1).replace(/\.0$/, '')}` : `${Math.round((raiseTo / totalPot) * 100)}%`;

  return (
    <div className="pop relative">
      {open && legal.canRaise && (
        // レイアウトを押し下げないよう、手元の上に重ねて表示
        <div className="glass pop absolute inset-x-0 bottom-full z-30 mb-2 rounded-3xl p-4 shadow-[0_-10px_40px_rgba(0,0,0,.5)]" style={{ background: 'rgba(10,30,22,.92)' }}>
          <div className="flex items-baseline justify-between">
            <span className="text-[30px] font-extrabold leading-none tracking-tight text-[var(--color-gold)] tabular-nums">{isAllIn ? t('allIn') : sizeLabel}</span>
            <span className="text-[20px] font-bold tabular-nums">{amt(raiseTo)}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => setRaiseTo((v) => clamp(v - state.bb))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[20px]" aria-label="-">
              −
            </button>
            <input
              type="range"
              className="w-full"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={unit}
              value={raiseTo}
              onChange={(e) => setRaiseTo(clamp(Number(e.target.value)))}
              aria-label={verb}
            />
            <button onClick={() => setRaiseTo((v) => clamp(v + state.bb))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[20px]" aria-label="+">
              +
            </button>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => setRaiseTo(p.v)}
                className={`rounded-xl py-2.5 text-[14px] font-bold tabular-nums transition active:bg-white/20 ${raiseTo === p.v ? 'bg-white/20' : 'bg-white/[.07]'}`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setRaiseTo(legal.maxRaiseTo)}
              className={`whitespace-nowrap rounded-xl py-2.5 text-[11px] font-bold tracking-tight text-[var(--color-gold)] active:bg-white/20 ${isAllIn ? 'bg-white/20' : 'bg-white/[.07]'}`}
            >
              {t('allIn')}
            </button>
          </div>
        </div>
      )}
      <TimeRow state={state} now={now} />
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => (open ? setOpen(false) : act('fold'))}
          disabled={!open && legal.canCheck}
          className="rounded-2xl bg-white/[.06] py-4 text-[16px] font-bold text-[var(--color-lose)] ring-1 ring-white/10 transition active:scale-95 disabled:opacity-25"
        >
          {open ? t('cancel') : t('fold')}
        </button>
        <button onClick={() => act(legal.canCheck ? 'check' : 'call')} className="rounded-2xl bg-white/[.12] py-4 text-[16px] font-bold ring-1 ring-white/10 transition active:scale-95">
          {legal.canCheck ? t('check') : `${t('call')} ${amt(legal.callAmount)}`}
        </button>
        <button
          onClick={() => {
            if (open) act('raise', raiseTo);
            else {
              setRaiseTo(presets[0]?.v ?? legal.minRaiseTo);
              setOpen(true);
            }
          }}
          disabled={!legal.canRaise}
          className="rounded-2xl bg-[#f5f3ee] py-4 text-[16px] font-bold text-[#0a1a13] transition active:scale-95 disabled:opacity-25"
        >
          {open ? (isAllIn ? t('allIn') : `${verb} ${sizeLabel}`) : verb}
        </button>
      </div>
    </div>
  );
}

/** 自分の番の残り時間とタイムバンクボタン */
function TimeRow({ state, now }: { state: TableState; now: number }) {
  const { t } = useT();
  const me = state.seats[state.you];
  const left = Math.max(0, Math.ceil(((state.deadline ?? now) - now) / 1000));
  const frac = state.timeTotal ? Math.max(0, Math.min(1, ((state.deadline ?? now) - now) / state.timeTotal)) : 0;
  return (
    <div className="mb-2.5 flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${state.usingTimebank ? 'bg-[#ff9f5a]' : frac < 0.3 ? 'bg-[var(--color-lose)]' : 'bg-[var(--color-gold)]'}`}
          style={{ width: `${frac * 100}%`, transition: 'width .2s linear' }}
        />
      </div>
      <span className="w-10 text-right text-[14px] font-bold tabular-nums">
        {left}
        {t('seconds')}
      </span>
      <button
        onClick={() => socket.emit('game:timebank')}
        disabled={me.timebanks <= 0}
        className="rounded-full bg-[#ff9f5a]/15 px-3 py-1.5 text-[13px] font-bold text-[#ffb27a] ring-1 ring-[#ff9f5a]/40 transition active:scale-95 disabled:opacity-30"
      >
        ⏱ {t('useTimebank')} ×{me.timebanks}
      </button>
    </div>
  );
}

function ResultSheet() {
  const { t } = useT();
  const end = useApp((s) => s.matchEnd)!;
  const delta = end.rating?.delta ?? 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center">
      <div className="glass safe-bottom pop w-full max-w-md rounded-t-[32px] px-6 pt-8 text-center sm:rounded-[32px]">
        <div className={`text-[12px] font-semibold uppercase tracking-[.3em] ${end.youWon ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'}`}>
          {end.mode === 'ranked' ? t('ranked') : end.mode === 'friend' ? t('friend') : 'CPU'}
        </div>
        <h2 className="mt-2 text-[56px] font-extrabold leading-none tracking-tight">{end.youWon ? t('win') : t('lose')}</h2>
        {end.reason !== 'bust' && <p className="mt-2 text-[13px] text-[var(--color-mist)]">{t(`reason_${end.reason}`)}</p>}
        {end.rating ? (
          <div className="mt-6 flex items-baseline justify-center gap-3 tabular-nums">
            <span className="text-[20px] text-[var(--color-mist)]">{fmt(end.rating.before)}</span>
            <span className="text-[var(--color-mist)]">→</span>
            <span className="text-[40px] font-bold text-[var(--color-gold)]">{fmt(end.rating.after)}</span>
            <span className={`text-[18px] font-bold ${delta >= 0 ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'}`}>
              {delta >= 0 ? '+' : ''}
              {delta}
            </span>
          </div>
        ) : (
          <p className="mt-6 text-[14px] text-[var(--color-mist)]">{t('unrated')}</p>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3 pb-4">
          <button
            onClick={() => {
              setState({ matchEnd: null, table: null });
              go('home');
            }}
            className="rounded-2xl bg-white/[.08] py-4 text-[16px] font-bold ring-1 ring-white/10"
          >
            {t('toHome')}
          </button>
          <button
            onClick={() => {
              const mode = end.mode;
              setState({ matchEnd: null, table: null });
              if (mode === 'friend') go('friend');
              else if (mode === 'cpu') socket.emit('cpu:start');
              else {
                socket.emit('queue:join');
                go('queue');
              }
            }}
            className="rounded-2xl bg-[#f5f3ee] py-4 text-[16px] font-bold text-[#0a1a13]"
          >
            {t('again')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Table() {
  const { t } = useT();
  const state = useApp((s) => s.table);
  const offset = useApp((s) => s.clockOffset);
  const matchEnd = useApp((s) => s.matchEnd);
  const now = useServerNow(offset);
  const [menu, setMenu] = useState(false);
  const amt = useAmount(state?.bb ?? 200);

  if (!state) return null;
  const youIdx = state.you;
  const oppIdx = 1 - youIdx;
  const you = state.seats[youIdx];
  const opp = state.seats[oppIdx];
  const r = state.result;
  const showdown = !!r && !r.byFold;
  const potNow = state.pot + you.bet + opp.bet;
  const levelLeft = Math.max(0, state.nextLevelAt - now);
  const myTurn = state.legal !== null;
  const winners = r ? r.winners : [];

  // 役の判定（表示用）
  const myBest = you.cards && state.board.length >= 3 && !you.folded ? bestHand([...you.cards, ...state.board]) : null;
  const oppBest = opp.cards && state.board.length >= 3 && !opp.folded ? bestHand([...opp.cards, ...state.board]) : null;
  // 光らせるカード: ショーダウンでは勝者の役、それ以外は自分の役
  const glow = new Set<string>();
  if (showdown) {
    for (const w of winners) (w === youIdx ? myBest : oppBest)?.core.forEach((c) => glow.add(c));
  } else myBest?.core.forEach((c) => glow.add(c));

  return (
    <div className="safe-top safe-bottom mx-auto flex h-full max-w-md flex-col px-4">
      {/* 上部 */}
      <div className="relative flex items-center justify-between py-1">
        <button onClick={() => setMenu((v) => !v)} className="glass grid h-9 w-9 place-items-center rounded-full text-[16px]" aria-label="menu">
          ⋯
        </button>
        <div className="text-[11px] text-[var(--color-mist)] tabular-nums">#{state.handNo}</div>
        {menu && (
          <div className="glass pop absolute left-0 top-11 z-40 flex flex-col rounded-2xl p-1.5">
            <button
              onClick={() => {
                setMenu(false);
                go('settings');
              }}
              className="rounded-xl px-4 py-3 text-left text-[15px]"
            >
              ⚙ {t('settings')}
            </button>
            <button
              onClick={() => {
                setMenu(false);
                if (confirm(t('surrenderConfirm'))) socket.emit('game:surrender');
              }}
              className="rounded-xl px-4 py-3 text-left text-[15px] text-[var(--color-lose)]"
            >
              {t('surrender')}
            </button>
          </div>
        )}
      </div>

      {/* 相手 */}
      <div className="mt-2 flex items-start justify-between">
        <SeatInfo seat={opp} seatIdx={oppIdx} mine={false} state={state} now={now} winner={winners.includes(oppIdx) && !!r} />
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            {!opp.folded &&
              (opp.cards ?? [null, null]).map((c, i) => (
                <PlayingCard key={`${state.handNo}-o${i}-${c}`} card={c} size="md" delay={i * 80} glow={!!c && glow.has(c)} dim={showdown && !winners.includes(oppIdx)} />
              ))}
          </div>
          <HandLabel best={oppBest} strong={showdown && winners.includes(oppIdx)} />
        </div>
      </div>

      {/* テーブル */}
      <div className="relative my-3 flex-1">
        <div className="rail" />
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-4 pb-6 pt-9">
          {/* 相手側 */}
          <div className="flex min-h-[34px] flex-col items-center gap-1.5">
            <OddsBadge state={state} seatIdx={oppIdx} />
            <div className="flex items-center gap-2">
              <ActionBubble state={state} seatIdx={oppIdx} />
              <BetChips amount={opp.bet} label={amt(opp.bet)} />
            </div>
          </div>

          {/* 中央: ポット・ブラインド・ボード */}
          <div className="flex flex-col items-center">
            <div className="flex items-end gap-2.5">
              <ChipStack amount={r ? 0 : state.pot} size={20} maxCols={4} />
              <div className="text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[.3em] text-white/50">{t('pot')}</div>
                <div className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{amt(r ? r.won[0] + r.won[1] : potNow)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[12px] font-semibold tabular-nums ring-1 ring-white/10">
              <span className="text-[var(--color-gold)]">Lv{state.level}</span>
              <span>
                {fmt(state.sb)}/{fmt(state.bb)} <span className="text-white/55">({fmt(state.ante)})</span>
              </span>
              <span className="text-white/55">
                {Math.floor(levelLeft / 60000)}:{String(Math.floor((levelLeft % 60000) / 1000)).padStart(2, '0')}
              </span>
            </div>
            <div className="mt-4 flex h-[72px] gap-1.5">
              {state.board.map((c, i) => (
                <PlayingCard key={`${state.handNo}-b${i}`} card={c} size="board" delay={(i < 3 ? i : 0) * 110} glow={glow.has(c)} />
              ))}
              {Array.from({ length: 5 - state.board.length }).map((_, i) => (
                <div key={`e${i}`} className="h-[72px] w-[50px] rounded-[7px] border border-white/[.08] bg-black/10" />
              ))}
            </div>
            <div className="mt-3 h-8">
              {r && (
                <div className="pop rounded-full bg-black/55 px-4 py-1.5 text-[14px] ring-1 ring-[#d9bf8c]/40">
                  {winners.length === 2 ? (
                    t('split')
                  ) : (
                    <>
                      <span className="font-bold text-[var(--color-gold)]">{winners[0] === youIdx ? t('you') : opp.name}</span> {t('wonPot')}{' '}
                      <span className="font-bold tabular-nums">{amt(r.won[winners[0]])}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 自分側 */}
          <div className="flex min-h-[34px] flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <BetChips amount={you.bet} label={amt(you.bet)} />
              <ActionBubble state={state} seatIdx={youIdx} />
            </div>
            <OddsBadge state={state} seatIdx={youIdx} />
          </div>
        </div>
      </div>

      {/* 自分 */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col items-start gap-1.5">
          <HandLabel best={myBest} strong={showdown && winners.includes(youIdx)} />
          <div className="flex gap-1.5">
            {you.cards?.map((c, i) => (
              <PlayingCard key={`${state.handNo}-y${i}`} card={c} size="lg" delay={i * 80} dim={you.folded || (showdown && !winners.includes(youIdx))} glow={glow.has(c)} />
            ))}
          </div>
        </div>
        <SeatInfo seat={you} seatIdx={youIdx} mine state={state} now={now} winner={winners.includes(youIdx) && !!r} />
      </div>

      <div className="mt-3 min-h-[64px]">
        {myTurn ? (
          <ActionBar key={`${state.handNo}-${state.street}-${state.lastAction?.amount ?? 0}`} state={state} now={now} />
        ) : (
          <div className="grid h-[64px] place-items-center text-[13px] text-white/30">{state.toAct !== null ? t('thinking') : ''}</div>
        )}
      </div>

      {matchEnd && <ResultSheet />}
    </div>
  );
}
