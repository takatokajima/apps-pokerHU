import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { bestHand, type BestHand } from '../../shared/cards';
import type { LogEntry, SeatView, TableState } from '../../shared/protocol';
import { Avatar } from '../components/Avatar';
import { BetChips, ChipStack } from '../components/Chips';
import { MiniCard, PlayingCard } from '../components/PlayingCard';
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

/** プレイヤーの名札（名前・ポジション・スタック）。手番のときは緑に光り、下に秒数入りのタイマーバー */
function SeatPlate({ seat, seatIdx, mine, state, now, winner }: { seat: SeatView; seatIdx: number; mine: boolean; state: TableState; now: number; winner: boolean }) {
  const { t } = useT();
  const amt = useAmount(state.bb);
  const acting = state.toAct === seatIdx && state.deadline && state.timeTotal;
  const left = acting ? Math.max(0, state.deadline! - now) : 0;
  const frac = acting ? Math.min(1, left / state.timeTotal!) : 0;
  const pos = seat.isButton ? 'SB' : 'BB';
  return (
    <div className="relative flex flex-col items-center">
      {seat.isButton && (
        <span className="absolute -left-3 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-black text-[#0c0a1c] shadow">D</span>
      )}
      <div
        className={`min-w-[150px] rounded-lg px-3 py-1.5 text-center transition ${seat.folded || !seat.connected ? 'opacity-50' : ''} ${
          acting
            ? 'bg-[#0b0a18] ring-2 ring-[var(--color-win)] shadow-[0_0_18px_rgba(52,210,123,.45)]'
            : winner
              ? 'bg-[#0b0a18] ring-2 ring-[var(--color-gold)]'
              : 'bg-[#0b0a18] ring-1 ring-[#c4b8ff]/20'
        }`}
      >
        <div className="flex items-center justify-center gap-1.5">
          <Avatar id={seat.avatar} size={18} />
          <span className="max-w-[110px] truncate text-[13px] font-bold">{mine ? t('you') : seat.name}</span>
          {seat.rating !== null && !seat.isCpu && <span className="text-[11px] font-bold text-[var(--color-gold)] tabular-nums">{fmt(seat.rating)}</span>}
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-1.5">
          <span className="rounded-[4px] bg-[#1f9a58] px-1.5 text-[10px] font-black leading-[16px] text-white">{pos}</span>
          <span className={`text-[14px] font-bold tabular-nums ${winner ? 'text-[var(--color-win)]' : ''}`}>{amt(seat.stack)}</span>
          {!seat.connected && <span className="rounded bg-[var(--color-lose)]/25 px-1 text-[10px] font-bold text-[var(--color-lose)]">{t('disconnected')}</span>}
        </div>
      </div>
      {acting ? (
        <div className="relative mt-1 h-4 w-[120px] overflow-hidden rounded-full bg-[#1e1a3a]">
          <div
            className={`h-full rounded-full ${state.usingTimebank ? 'bg-[#ff9f5a]' : frac < 0.3 ? 'bg-[var(--color-lose)]' : 'bg-[var(--color-win)]'}`}
            style={{ width: `${frac * 100}%`, transition: 'width .2s linear' }}
          />
          <span className="absolute inset-0 grid place-items-center text-[10px] font-black tabular-nums">{Math.ceil(left / 1000)}</span>
        </div>
      ) : (
        <div className="mt-1 h-4 text-[10px] font-bold text-[var(--color-mist)] tabular-nums">⏱ ×{seat.timebanks}</div>
      )}
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
  // オールインのランアウト中は勝率・アウツを優先して表示
  if (!a || a.seat !== seatIdx || state.odds) return null;
  const allIn = state.seats[seatIdx].allIn && a.type !== 'check' && a.type !== 'fold';
  const label = allIn
    ? t('allIn')
    : a.type === 'raise'
      ? `${state.street === 'preflop' || state.seats[1 - seatIdx].bet > 0 ? t('raise') : t('bet')} ${amt(a.amount)}`
      : { fold: t('fold'), check: t('check'), call: t('call') }[a.type];
  const color = a.type === 'fold' ? 'bg-white/15 text-white/70' : allIn || a.type === 'raise' ? 'bg-[#e9cf98] text-[#1a1408]' : 'bg-white text-[#0c0a1c]';
  return <span key={`${a.seat}-${a.type}-${a.amount}`} className={`pop rounded-full px-3 py-1 text-[13px] font-extrabold uppercase tracking-wide shadow-lg ${color}`}>{label}</span>;
}

/** オールイン時の勝率・アウツ（枚数とカード） */
function OddsBadge({ state, seatIdx }: { state: TableState; seatIdx: number }) {
  const { t } = useT();
  if (!state.odds) return null;
  const eq = state.odds.equity[seatIdx];
  const outs = state.odds.outs[seatIdx];
  const leading = eq >= state.odds.equity[1 - seatIdx];
  return (
    // 自分側（テーブル下）はアウツ一覧を上に積み、テーブルからはみ出さないようにする
    <div className={`pop flex max-w-[300px] items-center gap-1.5 ${seatIdx === state.you ? 'flex-col-reverse' : 'flex-col'}`}>
      <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ring-1 ${leading ? 'bg-[#0d3a28] ring-[var(--color-win)]/60' : 'bg-[#3a1614] ring-[var(--color-lose)]/50'}`}>
        <span className={`text-[20px] font-extrabold tabular-nums ${leading ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'}`}>{eq}%</span>
        {outs && (
          <span className="text-[13px] font-bold text-white">
            {t('outs')} {outs.length}
            {t('cardsUnit')}
          </span>
        )}
      </div>
      {outs && outs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 rounded-xl bg-black/45 p-1.5">
          {outs.map((c) => (
            <MiniCard key={c} card={c} />
          ))}
        </div>
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
  const [draft, setDraft] = useState<string | null>(null); // 直接入力中の文字

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
  // 入力欄の表示（BB表示ならBB単位で入力）
  const shown = settings.bbMode ? String(Math.round((raiseTo / state.bb) * 10) / 10) : String(raiseTo);
  const commitDraft = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) setRaiseTo(clamp(settings.bbMode ? n * state.bb : n));
    setDraft(null);
  };

  return (
    <div className="pop">
      <TimeRow state={state} now={now} />
      {/* ベット額: 常に表示（ワンタップで選択・直接入力も可） */}
      <div className={`mb-2 flex gap-1.5 ${legal.canRaise ? '' : 'pointer-events-none opacity-30'}`}>
        {presets.map((p, i) => (
          <button
            key={i}
            onClick={() => setRaiseTo(p.v)}
            className={`h-10 flex-1 rounded-lg text-[14px] font-bold tabular-nums transition active:scale-95 ${
              raiseTo === p.v && !isAllIn ? 'bg-white text-[#0c0a1c]' : 'bg-[#2e2a4d] text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setRaiseTo(legal.maxRaiseTo)}
          className={`h-10 flex-1 whitespace-nowrap rounded-lg text-[11px] font-bold tracking-tight transition active:scale-95 ${
            isAllIn ? 'bg-white text-[#0c0a1c]' : 'bg-[#2e2a4d] text-[var(--color-gold)]'
          }`}
        >
          {t('allIn')}
        </button>
        <input
          inputMode="decimal"
          value={draft ?? shown}
          onFocus={(e) => {
            setDraft(shown);
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={commitDraft}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-10 w-[74px] rounded-lg bg-[#0b0a18] text-center text-[15px] font-bold text-white tabular-nums ring-1 ring-[#c4b8ff]/25 outline-none focus:ring-2 focus:ring-white"
          aria-label={settings.bbMode ? `${verb} (BB)` : verb}
        />
      </div>
      {/* メインボタン: フォールド / チェック・コール(緑) / ベット・レイズ(赤) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => act('fold')}
          disabled={legal.canCheck}
          className="h-[58px] rounded-lg bg-[#2e2a4d] text-[16px] font-bold text-white transition active:scale-95 disabled:opacity-25"
        >
          {t('fold')}
        </button>
        <button
          onClick={() => act(legal.canCheck ? 'check' : 'call')}
          className="flex h-[58px] flex-col items-center justify-center rounded-lg bg-[#22a55e] text-white transition active:scale-95"
        >
          <span className="text-[16px] font-bold leading-tight">{legal.canCheck ? t('check') : t('call')}</span>
          {!legal.canCheck && <span className="text-[13px] font-bold leading-tight tabular-nums opacity-90">{amt(legal.callAmount)}</span>}
        </button>
        <button
          onClick={() => act('raise', raiseTo)}
          disabled={!legal.canRaise}
          className="flex h-[58px] flex-col items-center justify-center rounded-lg bg-[#e5484d] text-white transition active:scale-95 disabled:opacity-25"
        >
          <span className="text-[16px] font-bold leading-tight">{isAllIn ? t('allIn') : `${verb} ${sizeLabel}`}</span>
          <span className="text-[13px] font-bold leading-tight tabular-nums opacity-90">{amt(raiseTo)}</span>
        </button>
      </div>
    </div>
  );
}

/** アクションログ: このハンドの流れを1行で表示 */
function ActionLog({ state }: { state: TableState }) {
  const { t } = useT();
  const amt = useAmount(state.bb);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth, behavior: 'smooth' });
  }, [state.log.length]);
  const streetName: Record<string, string> = { flop: 'FLOP', turn: 'TURN', river: 'RIVER' };
  const sbSeat = state.seats[0].isButton ? 0 : 1;
  const items: ReactElement[] = [
    <span key="pre" className="text-[11px] font-bold text-white/45">
      PRE
    </span>,
  ];
  let betMade = true; // プリフロップはBBが「ベット済み」扱い
  state.log.forEach((e: LogEntry, i) => {
    if (e.type === 'sb' || e.type === 'bb' || e.type === 'ante') return;
    if (e.type === 'deal') {
      betMade = false;
      items.push(
        <span key={i} className="ml-1 flex items-center gap-1 border-l border-white/15 pl-2 text-[11px] font-bold text-white/60">
          {streetName[e.street] ?? e.street.toUpperCase()} <span className="text-white/85 tabular-nums">{amt(e.pot)}</span>
        </span>,
      );
      return;
    }
    let label: string;
    if (e.allIn && e.type !== 'fold') label = `${t('allIn')} ${amt(e.to)}`;
    else if (e.type === 'check') label = 'X';
    else if (e.type === 'fold') label = t('fold');
    else if (e.type === 'call') label = `${t('call')} ${amt(e.to)}`;
    else label = `${betMade ? t('raise') : t('bet')} ${amt(e.to)}`;
    if (e.type === 'raise') betMade = true;
    const color = e.type === 'raise' || e.allIn ? 'text-[#ff8f88]' : e.type === 'call' ? 'text-[#7fe0a8]' : 'text-white/60';
    const mine = e.seat === state.you;
    items.push(
      <span key={i} className="flex items-center gap-1">
        <span className={`rounded px-1 text-[10px] font-extrabold ${mine ? 'bg-[#1f9a58] text-white' : 'bg-white/15 text-white'}`}>
          {e.seat === sbSeat ? 'SB' : 'BB'}
        </span>
        <span className={`text-[12px] font-bold tabular-nums ${color}`}>{label}</span>
      </span>,
    );
  });
  return (
    <div
      ref={ref}
      className="mt-2 flex h-8 shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap rounded-lg bg-[#0b0a18] px-3 ring-1 ring-[#c4b8ff]/15 [scrollbar-width:none]"
    >
      {items}
    </div>
  );
}

/** 自分の番の残り時間とタイムバンクボタン */
function TimeRow({ state }: { state: TableState; now: number }) {
  const { t } = useT();
  const me = state.seats[state.you];
  return (
    <div className="mb-2 flex items-center justify-end gap-2">
      {state.usingTimebank && <span className="text-[12px] font-bold text-[#ffb27a]">{t('timebank')}</span>}
      <button
        onClick={() => socket.emit('game:timebank')}
        disabled={me.timebanks <= 0}
        className="rounded-lg bg-[#2e2a4d] px-3 py-1.5 text-[13px] font-bold text-[#ffb27a] transition active:scale-95 disabled:opacity-30"
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
      <div className="glass safe-bottom pop w-full max-w-md rounded-t-2xl px-6 pt-8 text-center sm:rounded-2xl">
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
            className="rounded-xl bg-white/[.08] py-4 text-[16px] font-bold ring-1 ring-white/10"
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
            className="rounded-xl bg-[#f5f3ee] py-4 text-[16px] font-bold text-[#0c0a1c]"
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
  // ハイカードは光らせない（どれが役か分かりにくいため）
  const addGlow = (b: BestHand | null) => b && b.category !== 'highCard' && b.core.forEach((c) => glow.add(c));
  if (showdown) for (const w of winners) addGlow(w === youIdx ? myBest : oppBest);
  else addGlow(myBest);

  return (
    <div className="safe-top safe-bottom mx-auto flex h-full max-w-md flex-col px-4">
      {/* 上部 */}
      <div className="relative flex items-center justify-between py-1">
        <button onClick={() => setMenu((v) => !v)} className="glass grid h-9 w-9 place-items-center rounded-full text-[16px]" aria-label="menu">
          ⋯
        </button>
        <div className="text-[11px] text-[var(--color-mist)] tabular-nums">#{state.handNo}</div>
        {menu && (
          <div className="glass pop absolute left-0 top-11 z-40 flex flex-col rounded-xl p-1.5">
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

      {/* テーブル: 縦長の楕円。相手の名札を上端、自分の名札を下端に重ねる */}
      <div className="relative my-1 min-h-0 flex-1">
        <div className="poker-table" style={{ left: 14, right: 14, top: 64, bottom: 58 }} />

        {/* 相手: カード → 名札 */}
        <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center">
          <div className="flex items-end gap-2">
            <div className="flex gap-1">
              {!opp.folded &&
                (opp.cards ?? [null, null]).map((c, i) => (
                  <PlayingCard key={`${state.handNo}-o${i}-${c}`} card={c} size="sm" delay={i * 80} glow={!!c && glow.has(c)} dim={showdown && !winners.includes(oppIdx)} />
                ))}
            </div>
            <HandLabel best={oppBest} strong={showdown && winners.includes(oppIdx)} />
          </div>
          <div className="-mt-1">
            <SeatPlate seat={opp} seatIdx={oppIdx} mine={false} state={state} now={now} winner={winners.includes(oppIdx) && !!r} />
          </div>
        </div>

        {/* フェルトの上 */}
        <div className="absolute inset-x-0 z-10 flex flex-col items-center justify-between px-6" style={{ top: 132, bottom: 150 }}>
          <div className="flex min-h-[30px] flex-col items-center gap-1">
            <OddsBadge state={state} seatIdx={oppIdx} />
            <div className="flex items-center gap-2">
              <ActionBubble state={state} seatIdx={oppIdx} />
              <BetChips amount={opp.bet} label={amt(opp.bet)} />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <ChipStack amount={r ? 0 : state.pot} size={18} maxCols={4} />
              <span className="text-[15px] font-bold text-[var(--color-mist)]">
                {t('pot')} <span className="text-[20px] font-black text-white tabular-nums">{amt(r ? r.won[0] + r.won[1] : potNow)}</span>
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-bold tabular-nums text-[var(--color-mist)]">
              <span className="text-[var(--color-gold)]">Lv{state.level}</span>
              <span className="text-white/85">
                {fmt(state.sb)}/{fmt(state.bb)} ({fmt(state.ante)})
              </span>
              <span>
                {Math.floor(levelLeft / 60000)}:{String(Math.floor((levelLeft % 60000) / 1000)).padStart(2, '0')}
              </span>
            </div>
            <div className="mt-3 flex h-[72px] gap-1">
              {state.board.map((c, i) => (
                <PlayingCard key={`${state.handNo}-b${i}`} card={c} size="board" delay={(i < 3 ? i : 0) * 110} glow={glow.has(c)} />
              ))}
              {Array.from({ length: 5 - state.board.length }).map((_, i) => (
                <div key={`e${i}`} className="h-[72px] w-[50px] rounded-[6px] bg-white/[.06] ring-1 ring-white/[.06]" />
              ))}
            </div>
            <div className="mt-2 h-8">
              {r && (
                <div className="pop rounded-lg bg-[#0b0a18]/90 px-4 py-1.5 text-[14px] font-bold ring-1 ring-[#d9bf8c]/40">
                  {winners.length === 2 ? (
                    t('split')
                  ) : (
                    <>
                      <span className="text-[var(--color-gold)]">{winners[0] === youIdx ? t('you') : opp.name}</span> {t('wonPot')}{' '}
                      <span className="tabular-nums">{amt(r.won[winners[0]])}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[30px] flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <BetChips amount={you.bet} label={amt(you.bet)} />
              <ActionBubble state={state} seatIdx={youIdx} />
            </div>
            <OddsBadge state={state} seatIdx={youIdx} />
          </div>
        </div>

        {/* 自分: 役名 → カード → 名札 */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center">
          <HandLabel best={myBest} strong={showdown && winners.includes(youIdx)} />
          <div className="flex gap-1.5">
            {you.cards?.map((c, i) => (
              <PlayingCard key={`${state.handNo}-y${i}`} card={c} size="lg" delay={i * 80} dim={you.folded || (showdown && !winners.includes(youIdx))} glow={glow.has(c)} />
            ))}
          </div>
          <div className="mt-1">
            <SeatPlate seat={you} seatIdx={youIdx} mine state={state} now={now} winner={winners.includes(youIdx) && !!r} />
          </div>
        </div>
      </div>

      {/* 操作エリア（高さを固定して、手番が変わっても画面が動かないように） */}
      <div className="relative z-40 mt-2 min-h-[150px]">
        {myTurn ? (
          <ActionBar key={`${state.handNo}-${state.street}-${state.lastAction?.amount ?? 0}`} state={state} now={now} />
        ) : (
          <div className="grid h-[150px] place-items-center text-[13px] text-white/30">{state.toAct !== null ? t('thinking') : ''}</div>
        )}
      </div>
      <ActionLog state={state} />

      {matchEnd && <ResultSheet />}
    </div>
  );
}
