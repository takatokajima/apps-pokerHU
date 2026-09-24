import { RULES, blindLevel } from '../../shared/config';
import { randomUUID } from 'node:crypto';
import type { ActionType, HandRecord, MatchMode, SeatView, TableState } from '../../shared/protocol';
import { allInOdds } from '../../shared/cards';
import { decideBot } from './bot';
import { Hand } from './hand';
import { seatStats } from './record';

export interface Participant {
  userId: string;
  name: string;
  avatar: string;
  rating: number;
  isGuest: boolean;
  isCpu: boolean;
}

export type EndReason = 'bust' | 'forfeit' | 'disconnect';

export interface MatchHooks {
  emitState: (seat: number, state: TableState) => void;
  onEnd: (match: Match, winner: number, reason: EndReason) => void;
  onHand: (match: Match, record: HandRecord) => void;
}

const PAUSE_DELAY = 1000; // アクション表示後、次のカードを配るまでの間
const RUNOUT_FIRST_DELAY = 2500; // オールイン: カード公開から最初にめくるまで
const RUNOUT_DELAY = 3000; // オールイン: 次の1枚をめくるまで（勝率・アウツを見る時間）
const RESULT_DELAY = 3200;
const SHOWDOWN_DELAY = 5000;

/** 1試合（どちらかのスタックが0になるまで）を管理 */
export class Match {
  readonly startedAt = Date.now();
  stacks: [number, number] = [RULES.startingStack, RULES.startingStack];
  timebanks: [number, number] = [RULES.timebankCount, RULES.timebankCount];
  connected: [boolean, boolean];
  hand: Hand | null = null;
  handNo = 0;
  over = false;

  private button = Math.random() < 0.5 ? 0 : 1;
  private timer: NodeJS.Timeout | null = null;
  private dcTimers: [NodeJS.Timeout | null, NodeJS.Timeout | null] = [null, null];
  private deadline: number | null = null;
  private timeTotal: number | null = null;
  private usingTimebank = false;
  private odds: TableState['odds'] = null;
  private runoutStarted = false;
  private evAtAllIn: { equity: [number, number]; pot: number } | null = null; // オールインEV計算用
  private handStartStacks: [number, number] = [0, 0];
  private level = blindLevel(0);

  constructor(
    readonly id: string,
    readonly mode: MatchMode,
    readonly players: [Participant, Participant],
    private hooks: MatchHooks,
  ) {
    this.connected = [!players[0].isCpu, !players[1].isCpu];
  }

  start() {
    this.startHand();
  }

  private levelIndex() {
    return Math.floor((Date.now() - this.startedAt) / RULES.levelDurationMs);
  }

  private startHand() {
    if (this.over) return;
    this.handNo++;
    if (this.handNo > 1) this.button = 1 - this.button;
    this.level = blindLevel(this.levelIndex());
    this.runoutStarted = false;
    this.evAtAllIn = null;
    this.handStartStacks = [...this.stacks];
    this.hand = new Hand({ stacks: this.stacks, button: this.button, ...this.level });
    this.step();
  }

  /** 状態が変わるたびに呼び、次のタイマーを設定して配信 */
  private step() {
    this.clearTimer();
    const h = this.hand!;
    this.deadline = null;
    this.timeTotal = null;
    this.usingTimebank = false;
    this.odds = h.phase === 'runout' ? allInOdds(h.hole, h.board) : null;
    // オールインが決まった瞬間の勝率を記録（EV収支に使う）
    if (this.odds && !this.evAtAllIn) this.evAtAllIn = { equity: this.odds.equity, pot: h.totalPot };

    if (h.phase === 'betting' && h.toAct !== null) {
      const seat = h.toAct;
      this.deadline = Date.now() + RULES.actionTimeMs;
      this.timeTotal = RULES.actionTimeMs;
      this.timer = setTimeout(() => this.onTimeout(seat), RULES.actionTimeMs);
      if (this.players[seat].isCpu) {
        this.timer = setTimeout(() => this.botAct(seat), 700 + Math.random() * 1600);
      } else if (!this.connected[seat]) {
        this.timer = setTimeout(() => this.autoAct(seat), 1000);
      }
    } else if (h.phase === 'transition') {
      this.timer = setTimeout(() => {
        h.proceed();
        this.step();
      }, PAUSE_DELAY);
    } else if (h.phase === 'runout') {
      this.timer = setTimeout(
        () => {
          h.runoutStep();
          this.step();
        },
        this.runoutStarted ? RUNOUT_DELAY : RUNOUT_FIRST_DELAY,
      );
      this.runoutStarted = true;
    } else if (h.phase === 'done') {
      this.stacks = [...h.stacks];
      this.emitHandRecord(h);
      const delay = h.result?.byFold ? RESULT_DELAY : SHOWDOWN_DELAY;
      this.timer = setTimeout(() => {
        const busted = this.stacks.findIndex((s) => s <= 0);
        if (busted >= 0) this.finish(1 - busted, 'bust');
        else this.startHand();
      }, delay);
    }
    this.broadcast();
  }

  /** 時間切れ: チェックできればチェック、できなければフォールド */
  private emitHandRecord(h: Hand) {
    const r = h.result!;
    const record: HandRecord = {
      id: randomUUID(),
      matchId: this.id,
      mode: this.mode,
      handNo: this.handNo,
      at: Date.now(),
      level: this.level.level,
      sb: this.level.sb,
      bb: this.level.bb,
      ante: this.level.ante,
      button: h.button,
      players: [0, 1].map((s) => {
        const p = this.players[s];
        return { id: p.userId, name: p.name, avatar: p.avatar, isCpu: p.isCpu };
      }) as HandRecord['players'],
      startStacks: this.handStartStacks,
      hole: h.hole,
      shown: [h.cardsExposed, h.cardsExposed],
      board: h.board.slice(),
      log: h.log,
      result: r,
      seatStats: seatStats({
        log: h.log,
        invested: h.invested,
        won: r.won,
        bb: this.level.bb,
        showdown: !r.byFold,
        evEquity: this.evAtAllIn?.equity ?? null,
        evPot: this.evAtAllIn?.pot ?? null,
      }),
    };
    try {
      this.hooks.onHand(this, record);
    } catch (e) {
      console.error('onHand failed', e);
    }
  }

  private onTimeout(seat: number) {
    if (this.over || this.hand?.toAct !== seat) return;
    this.autoAct(seat);
  }

  /** タイムバンクを自分で使う: 持ち時間に +30秒 */
  useTimebank(seat: number): boolean {
    if (this.over || this.hand?.toAct !== seat || this.hand.phase !== 'betting' || this.timebanks[seat] <= 0 || !this.deadline) return false;
    this.timebanks[seat]--;
    this.usingTimebank = true;
    const left = Math.max(0, this.deadline - Date.now()) + RULES.timebankMs;
    this.deadline = Date.now() + left;
    this.timeTotal = left;
    this.clearTimer();
    this.timer = setTimeout(() => this.onTimeout(seat), left);
    this.broadcast();
    return true;
  }

  private autoAct(seat: number) {
    const legal = this.hand?.legal(seat);
    if (!legal) return;
    this.hand!.act(seat, legal.canCheck ? 'check' : 'fold');
    this.step();
  }

  private botAct(seat: number) {
    if (this.over || this.hand?.toAct !== seat) return;
    const d = decideBot(this.hand, seat);
    if (!this.hand.act(seat, d.type, d.amount)) {
      const legal = this.hand.legal(seat)!;
      this.hand.act(seat, legal.canCheck ? 'check' : 'call');
    }
    this.step();
  }

  handleAction(seat: number, type: ActionType, amount?: number): boolean {
    if (this.over || !this.hand || this.hand.toAct !== seat) return false;
    if (!this.hand.act(seat, type, amount)) return false;
    this.step();
    return true;
  }

  setConnected(seat: number, value: boolean) {
    if (this.over || this.players[seat].isCpu) return;
    this.connected[seat] = value;
    if (this.dcTimers[seat]) clearTimeout(this.dcTimers[seat]!);
    this.dcTimers[seat] = null;
    if (!value) {
      this.dcTimers[seat] = setTimeout(() => this.finish(1 - seat, 'disconnect'), RULES.disconnectForfeitMs);
      if (this.hand?.toAct === seat) {
        this.clearTimer();
        this.timer = setTimeout(() => this.autoAct(seat), 1000);
      }
    } else if (this.hand?.phase === 'betting' && this.hand.toAct === seat) {
      this.step(); // 復帰したら持ち時間を再スタート
      return;
    }
    this.broadcast();
  }

  surrender(seat: number) {
    if (!this.over) this.finish(1 - seat, 'forfeit');
  }

  private finish(winner: number, reason: EndReason) {
    if (this.over) return;
    this.over = true;
    this.clearTimer();
    this.dcTimers.forEach((t) => t && clearTimeout(t));
    this.hooks.onEnd(this, winner, reason);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private broadcast() {
    for (const s of [0, 1]) if (!this.players[s].isCpu) this.hooks.emitState(s, this.stateFor(s));
  }

  stateFor(viewer: number): TableState {
    const h = this.hand!;
    const exposed = h.cardsExposed;
    const seat = (s: number): SeatView => {
      const p = this.players[s];
      return {
        name: p.name,
        avatar: p.avatar,
        rating: p.isGuest && this.mode === 'friend' ? null : p.rating,
        isCpu: p.isCpu,
        isGuest: p.isGuest,
        stack: h.stacks[s],
        bet: h.bets[s],
        folded: h.folded[s],
        allIn: h.stacks[s] === 0 && !h.folded[s],
        connected: this.connected[s] || p.isCpu,
        cards: s === viewer || exposed ? h.hole[s] : null,
        timebanks: this.timebanks[s],
        isButton: h.button === s,
      };
    };
    return {
      matchId: this.id,
      mode: this.mode,
      you: viewer,
      seats: [seat(0), seat(1)],
      handNo: this.handNo,
      level: this.level.level,
      sb: this.level.sb,
      bb: this.level.bb,
      ante: this.level.ante,
      nextLevelAt: this.startedAt + (this.levelIndex() + 1) * RULES.levelDurationMs,
      street: h.street,
      board: h.board,
      pot: h.pot,
      toAct: h.toAct,
      deadline: this.deadline,
      timeTotal: this.timeTotal,
      usingTimebank: this.usingTimebank,
      odds: this.odds,
      legal: h.legal(viewer),
      lastAction: h.lastAction,
      result: h.result,
      log: h.log,
      serverTime: Date.now(),
    };
  }

  seatOf(userId: string): number {
    return this.players.findIndex((p) => p.userId === userId);
  }
}
