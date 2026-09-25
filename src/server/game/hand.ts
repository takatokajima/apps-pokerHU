import { evaluate, fullDeck, shuffle, type Card, type HandCategory } from '../../shared/cards';
import type { ActionType, HandResult, LegalActions, LogEntry, Street } from '../../shared/protocol';

export interface HandConfig {
  stacks: [number, number];
  button: number; // ボタン = SB（ヘッズアップ）
  sb: number;
  bb: number;
  ante: number; // BBアンテ
  deck?: Card[];
}

// transition = ベット終了後、次のカードを配る前の「間」
type Phase = 'betting' | 'transition' | 'runout' | 'done';
const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

/** ヘッズアップ1ハンド分の状態機械（純粋ロジック、タイマー等は持たない） */
export class Hand {
  stacks: [number, number];
  bets: [number, number] = [0, 0];
  pot = 0;
  hole: [Card[], Card[]];
  board: Card[] = [];
  street: Street = 'preflop';
  phase: Phase = 'betting';
  toAct: number | null = null;
  folded: [boolean, boolean] = [false, false];
  result: HandResult | null = null;
  lastAction: { seat: number; type: ActionType; amount: number } | null = null;
  invested: [number, number] = [0, 0]; // このハンドで各席が出した合計（返却分を除く）
  log: LogEntry[] = [];
  readonly button: number;
  readonly bb: number;

  private deck: Card[];
  private acted: [boolean, boolean] = [false, false];
  private reraiseLocked: [boolean, boolean] = [false, false];
  private currentBet = 0;
  private minRaise: number;

  constructor(cfg: HandConfig) {
    this.stacks = [...cfg.stacks];
    this.button = cfg.button;
    this.bb = cfg.bb;
    this.minRaise = cfg.bb;
    this.deck = cfg.deck ? cfg.deck.slice() : shuffle(fullDeck());
    const bbSeat = 1 - cfg.button;
    // ホールカード（ボタンの反対側から配る）
    const h0 = [this.draw(), this.draw()];
    const h1 = [this.draw(), this.draw()];
    this.hole = bbSeat === 0 ? [h0, h1] : [h1, h0];

    this.record(cfg.button, 'sb', this.pay(cfg.button, cfg.sb));
    this.record(bbSeat, 'bb', this.pay(bbSeat, cfg.bb));
    // BBアンテ（ブラインド優先。デッドマネーとしてポットへ）
    const ante = Math.min(cfg.ante, this.stacks[bbSeat]);
    this.stacks[bbSeat] -= ante;
    this.invested[bbSeat] += ante;
    this.pot += ante;
    if (ante > 0) this.record(bbSeat, 'ante', ante);

    this.currentBet = Math.max(...this.bets);
    this.toAct = cfg.button;
    this.advance();
  }

  private draw(): Card {
    return this.deck.shift()!;
  }

  private pay(seat: number, amount: number) {
    const a = Math.min(amount, this.stacks[seat]);
    this.stacks[seat] -= a;
    this.bets[seat] += a;
    this.invested[seat] += a;
    return a;
  }

  private refund(seat: number, amount: number) {
    this.bets[seat] -= amount;
    this.stacks[seat] += amount;
    this.invested[seat] -= amount;
  }

  /** ログに記録（その時点の状態のスナップショット付き） */
  private record(seat: number | null, type: LogEntry['type'], add: number) {
    this.log.push({
      street: this.street,
      seat,
      type,
      add,
      to: seat === null ? 0 : this.bets[seat],
      pot: this.totalPot,
      stacks: [this.stacks[0], this.stacks[1]],
      board: this.board.slice(),
      allIn: seat !== null && this.stacks[seat] === 0 && !this.folded[seat],
    });
  }

  private canAct(seat: number) {
    return !this.folded[seat] && this.stacks[seat] > 0;
  }

  get totalPot() {
    return this.pot + this.bets[0] + this.bets[1];
  }

  legal(seat: number): LegalActions | null {
    if (this.phase !== 'betting' || this.toAct !== seat) return null;
    const opp = 1 - seat;
    const toCall = this.currentBet - this.bets[seat];
    const allInTo = this.bets[seat] + this.stacks[seat];
    const maxRaiseTo = Math.min(allInTo, this.bets[opp] + this.stacks[opp]);
    const canRaise = this.stacks[seat] > toCall && this.stacks[opp] > 0 && !this.reraiseLocked[seat] && maxRaiseTo > this.currentBet;
    return {
      canCheck: toCall <= 0,
      callAmount: Math.min(Math.max(toCall, 0), this.stacks[seat]),
      canRaise,
      minRaiseTo: Math.min(this.currentBet + this.minRaise, maxRaiseTo),
      maxRaiseTo,
    };
  }

  /** アクションを適用。不正なら false */
  act(seat: number, type: ActionType, amount = 0): boolean {
    const legal = this.legal(seat);
    if (!legal) return false;
    const opp = 1 - seat;
    switch (type) {
      case 'fold':
        this.folded[seat] = true;
        this.lastAction = { seat, type, amount: 0 };
        this.record(seat, 'fold', 0);
        this.finishByFold(opp);
        return true;
      case 'check':
        if (!legal.canCheck) return false;
        this.lastAction = { seat, type, amount: 0 };
        this.record(seat, 'check', 0);
        break;
      case 'call': {
        if (legal.canCheck) return false;
        const paid = this.pay(seat, legal.callAmount);
        this.lastAction = { seat, type, amount: paid };
        this.record(seat, 'call', paid);
        break;
      }
      case 'raise': {
        if (!legal.canRaise) return false;
        const to = Math.floor(amount);
        if (!Number.isFinite(to) || to < legal.minRaiseTo || to > legal.maxRaiseTo) return false;
        const raiseSize = to - this.currentBet;
        const added = this.pay(seat, to - this.bets[seat]);
        if (raiseSize >= this.minRaise) {
          this.minRaise = raiseSize;
          this.reraiseLocked = [false, false];
        } else {
          // 額に満たないオールインレイズはアクションを再開しない
          this.reraiseLocked[opp] = this.acted[opp];
        }
        this.currentBet = to;
        this.acted[opp] = false;
        this.lastAction = { seat, type, amount: to };
        this.record(seat, 'raise', added);
        break;
      }
      default:
        return false;
    }
    this.acted[seat] = true;
    this.toAct = opp;
    this.advance();
    return true;
  }

  private bettingDone(): boolean {
    for (const s of [0, 1]) {
      if (!this.canAct(s)) continue;
      const other = 1 - s;
      if (this.bets[s] < this.currentBet) return false;
      if (!this.acted[s] && this.canAct(other)) return false;
    }
    return true;
  }

  private advance() {
    if (this.phase !== 'betting') return;
    if (this.bettingDone()) {
      this.endStreet();
      return;
    }
    if (this.toAct === null || !this.canAct(this.toAct)) this.toAct = this.toAct === null ? 0 : 1 - this.toAct;
  }

  private endStreet() {
    // コールされなかった分を返却
    const [a, b] = this.bets;
    if (a !== b) {
      const hi = a > b ? 0 : 1;
      this.refund(hi, Math.abs(a - b));
    }
    this.pot += this.bets[0] + this.bets[1];
    this.bets = [0, 0];
    this.currentBet = 0;
    this.minRaise = this.bb;
    this.acted = [false, false];
    this.reraiseLocked = [false, false];
    this.toAct = null;

    this.phase = 'transition';
  }

  /** 「間」の後に呼ぶ: 次のストリートを配る／オールインならランアウトへ／リバー後はショーダウン */
  proceed() {
    if (this.phase !== 'transition') return;
    if (this.street === 'river') {
      this.showdown();
      return;
    }
    if (!this.canAct(0) || !this.canAct(1)) {
      this.phase = 'runout'; // オールイン: 両者のカードを公開して残りを順にめくる
      return;
    }
    this.phase = 'betting';
    this.lastAction = null;
    this.dealNextStreet();
    this.toAct = 1 - this.button; // ポストフロップはBBから
  }

  private dealNextStreet() {
    const next = STREETS[STREETS.indexOf(this.street) + 1];
    this.street = next;
    if (next === 'flop') this.board.push(this.draw(), this.draw(), this.draw());
    else this.board.push(this.draw());
    this.record(null, 'deal', 0);
  }

  /** オールイン後のランアウトを1ストリート進める */
  runoutStep() {
    if (this.phase !== 'runout') return;
    if (this.board.length >= 5) {
      this.showdown();
      return;
    }
    this.dealNextStreet();
    if (this.board.length >= 5) this.showdown();
  }

  private finishByFold(winner: number) {
    // コールされなかった自分のベットは「獲得額」に含めず、そのまま返却
    const loser = 1 - winner;
    if (this.bets[winner] > this.bets[loser]) {
      this.refund(winner, this.bets[winner] - this.bets[loser]);
    }
    const amount = this.totalPot;
    this.stacks[winner] += amount;
    this.bets = [0, 0];
    this.pot = 0;
    const won = [0, 0];
    won[winner] = amount;
    this.phase = 'done';
    this.toAct = null;
    this.result = { winners: [winner], won, categories: [null, null], byFold: true };
  }

  private showdown() {
    this.street = 'showdown';
    this.phase = 'done';
    this.toAct = null;
    const v = [0, 1].map((s) => evaluate([...this.hole[s], ...this.board]));
    const total = this.pot;
    const won = [0, 0];
    let winners: number[];
    if (v[0].score === v[1].score) {
      winners = [0, 1];
      const half = Math.floor(total / 2);
      won[0] = half;
      won[1] = half;
      won[1 - this.button] += total - half * 2; // 端数はBB側へ
    } else {
      const w = v[0].score > v[1].score ? 0 : 1;
      winners = [w];
      won[w] = total;
    }
    this.stacks[0] += won[0];
    this.stacks[1] += won[1];
    this.pot = 0;
    const categories = v.map((x) => x.category) as HandCategory[];
    this.result = { winners, won, categories, byFold: false };
  }

  /** 相手のカードを見せてよいか（オールイン時・ショーダウン時） */
  get cardsExposed(): boolean {
    if (this.folded[0] || this.folded[1]) return false;
    return this.phase === 'runout' || this.street === 'showdown';
  }
}
