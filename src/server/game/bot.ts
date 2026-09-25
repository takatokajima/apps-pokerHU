import { evaluate, fullDeck, RANKS, rankOf, shuffle, suitOf, type Card } from '../../shared/cards';
import type { ActionType, CpuLevel } from '../../shared/protocol';
import type { Hand } from './hand';
import handRanks from '../../shared/handRanks.json';

type Decision = { type: ActionType; amount?: number };

// ---------------------------------------------------------------------------
// 169種類のスターティングハンドの強さ順位（ランダムな相手への勝率で並べる）
// ---------------------------------------------------------------------------

/** 手の種類のキー（例: "AKs" "AKo" "QQ"） */
export function handClass(a: Card, b: Card): string {
  const hi = rankOf(a) >= rankOf(b) ? a : b;
  const lo = hi === a ? b : a;
  if (hi[0] === lo[0]) return hi[0] + lo[0];
  return hi[0] + lo[0] + (suitOf(a) === suitOf(b) ? 's' : 'o');
}

// 事前計算済みの順位表（scripts/make-hand-ranks.ts で再生成できる）
let percentileTable: Map<string, number> | null = new Map(Object.entries(handRanks as Record<string, number>));

/** 0 = 最強（AA）〜 1 = 最弱（72o）。組み合わせ数で重み付けした上位何%か */
export function handPercentile(a: Card, b: Card): number {
  if (!percentileTable) percentileTable = buildPercentiles();
  return percentileTable.get(handClass(a, b)) ?? 1;
}

/** 再現可能な乱数（順位表を毎回同じにするため） */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPercentiles(): Map<string, number> {
  const classes: { key: string; combos: number; eq: number }[] = [];
  const rand = seeded(20260925);
  const R = RANKS.split('').reverse(); // A..2
  for (let i = 0; i < R.length; i++) {
    for (let j = i; j < R.length; j++) {
      const variants = i === j ? [[R[i] + 's', R[j] + 'h', 6]] : [[R[i] + 's', R[j] + 's', 4], [R[i] + 's', R[j] + 'h', 12]];
      for (const [c1, c2, combos] of variants as [string, string, number][]) {
        classes.push({ key: handClass(c1, c2), combos, eq: estimateEquity([c1, c2], [], 2500, 1, undefined, rand) });
      }
    }
  }
  classes.sort((x, y) => y.eq - x.eq);
  const total = classes.reduce((s, c) => s + c.combos, 0);
  const map = new Map<string, number>();
  let acc = 0;
  for (const c of classes) {
    acc += c.combos;
    map.set(c.key, acc / total);
  }
  return map;
}

/** 手の強さのざっくり指標（よわい/ふつう用） */
export function preflopStrength(a: Card, b: Card): number {
  return 1 - handPercentile(a, b);
}

/**
 * 相手の手に対する勝率をモンテカルロで推定
 * @param oppTop 相手の手を「上位何%」と想定するか（1 = 何でもあり）
 */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  iterations = 300,
  oppTop = 1,
  oppFilter?: (opp: Card[]) => boolean,
  rand: () => number = Math.random,
): number {
  const known = new Set([...hole, ...board]);
  const rest = fullDeck().filter((c) => !known.has(c));
  let score = 0;
  let n = 0;
  for (let i = 0; i < iterations * 6 && n < iterations; i++) {
    const d = shuffle(rest, rand);
    const opp = [d[0], d[1]];
    if (oppTop < 1 && percentileTable && handPercentile(opp[0], opp[1]) > oppTop) continue;
    if (oppFilter && !oppFilter(opp)) continue;
    const runout = [...board, ...d.slice(2, 2 + (5 - board.length))];
    const a = evaluate([...hole, ...runout]).score;
    const b = evaluate([...opp, ...runout]).score;
    score += a > b ? 1 : a === b ? 0.5 : 0;
    n++;
  }
  return n ? score / n : 0.5;
}

// ---------------------------------------------------------------------------

const preflopRaises = (hand: Hand) => hand.log.filter((e) => e.street === 'preflop' && e.type === 'raise').length;
const streetBetMade = (hand: Hand) => hand.log.some((e) => e.street === hand.street && e.type === 'raise');

export function decideBot(hand: Hand, seat: number, level: CpuLevel = 'normal'): Decision {
  if (level === 'weak') return decideWeak(hand, seat);
  if (level === 'strong') return decideStrong(hand, seat);
  return decideNormal(hand, seat);
}

function sizer(hand: Hand, seat: number) {
  const legal = hand.legal(seat)!;
  return (target: number): Decision => ({
    type: 'raise',
    amount: Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(target / 100) * 100)),
  });
}

/**
 * よわい: 強い手ならベット、弱い手ならチェック。
 * 相手のベット/レイズには手に関係なくコール（リレイズ・フォールドはしない）
 */
function decideWeak(hand: Hand, seat: number): Decision {
  const legal = hand.legal(seat)!;
  const raiseTo = sizer(hand, seat);
  const pot = hand.totalPot;
  const opponentBet = streetBetMade(hand); // このストリートで既にベット/レイズがある
  if (!opponentBet && legal.canRaise) {
    const strong =
      hand.street === 'preflop'
        ? handPercentile(hand.hole[seat][0], hand.hole[seat][1]) <= 0.2
        : estimateEquity(hand.hole[seat], hand.board, 150) >= 0.7;
    if (strong) return hand.street === 'preflop' ? raiseTo(hand.bb * 2.5) : raiseTo(hand.bets[1 - seat] + pot * 0.6);
  }
  if (legal.canCheck) return { type: 'check' };
  return { type: 'call' };
}

/** ふつう: 勝率・ポットオッズ・スタック深さで判断 */
function decideNormal(hand: Hand, seat: number): Decision {
  const legal = hand.legal(seat)!;
  const raiseTo = sizer(hand, seat);
  const opp = 1 - seat;
  const pot = hand.totalPot;
  const bbDepth = (hand.stacks[seat] + hand.bets[seat]) / hand.bb;
  const need = legal.callAmount / (pot + legal.callAmount || 1);
  const r = Math.random();
  const eq = estimateEquity(hand.hole[seat], hand.board);
  if (bbDepth <= 12 && hand.street === 'preflop') {
    if (eq > 0.5 && legal.canRaise) return raiseTo(legal.maxRaiseTo);
    if (legal.canCheck) return { type: 'check' };
    return eq > need + 0.05 ? { type: 'call' } : { type: 'fold' };
  }
  const strong = hand.street === 'preflop' ? 0.62 : 0.72;
  if (legal.canRaise && (eq > strong || (r < 0.08 && eq > 0.3))) {
    const size = hand.street === 'preflop' ? hand.bets[opp] + hand.bb * 2.5 : hand.bets[opp] + pot * 0.66;
    if (eq > 0.85 && r < 0.3) return raiseTo(legal.maxRaiseTo);
    return raiseTo(size);
  }
  if (legal.canCheck) {
    if (legal.canRaise && eq > 0.55 && r < 0.35) return raiseTo(hand.bets[opp] + pot * 0.5);
    return { type: 'check' };
  }
  if (eq > need + 0.03 || (hand.street === 'preflop' && eq > 0.4 && legal.callAmount <= hand.bb * 2)) return { type: 'call' };
  return { type: 'fold' };
}

/** 役ができている（ワンペア以上）か、フラッシュ/ストレートの強いドローがあるか */
function madeOrDraw(opp: Card[], board: Card[]): boolean {
  const cards = [...opp, ...board];
  if (evaluate(cards).category !== 'highCard') return true;
  if (board.length >= 5) return false;
  const suits = new Map<string, number>();
  for (const c of cards) suits.set(suitOf(c), (suits.get(suitOf(c)) ?? 0) + 1);
  if ([...suits.values()].some((n) => n >= 4)) return true;
  const ranks = new Set(cards.map(rankOf));
  if (ranks.has(14)) ranks.add(1);
  for (let lo = 1; lo <= 10; lo++) {
    let n = 0;
    for (let k = 0; k < 5; k++) if (ranks.has(lo + k)) n++;
    if (n >= 4) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// つよい: ヘッズアップの理論（GTO）に近い判断
// ---------------------------------------------------------------------------

/** 浅いスタックのプッシュ/フォールド: 上位何%でオールインするか（ヘッズアップのナッシュ均衡の近似） */
function pushRange(bbDepth: number) {
  if (bbDepth <= 4) return 0.95;
  if (bbDepth <= 6) return 0.8;
  if (bbDepth <= 8) return 0.68;
  if (bbDepth <= 10) return 0.58;
  if (bbDepth <= 12) return 0.5;
  return 0.42; // 〜15BB
}

/** 相手のオールインに対するコール範囲（上位何%） */
function callShoveRange(bbDepth: number) {
  if (bbDepth <= 4) return 0.8;
  if (bbDepth <= 6) return 0.55;
  if (bbDepth <= 8) return 0.44;
  if (bbDepth <= 10) return 0.36;
  if (bbDepth <= 12) return 0.3;
  if (bbDepth <= 15) return 0.25;
  if (bbDepth <= 25) return 0.18;
  return 0.12;
}

/** 強いドロー（フラッシュドロー / 両面・ガットのストレートドロー）を持っているか */
function hasDraw(hole: Card[], board: Card[]): boolean {
  if (board.length >= 5) return false;
  const cards = [...hole, ...board];
  const suits = new Map<string, number>();
  for (const c of cards) suits.set(suitOf(c), (suits.get(suitOf(c)) ?? 0) + 1);
  // 自分の手札を使ったフラッシュドロー
  if (hole.some((h) => (suits.get(suitOf(h)) ?? 0) === 4)) return true;
  const ranks = new Set(cards.map(rankOf));
  if (ranks.has(14)) ranks.add(1);
  for (let lo = 1; lo <= 10; lo++) {
    let n = 0;
    for (let k = 0; k < 5; k++) if (ranks.has(lo + k)) n++;
    if (n >= 4) return true;
  }
  return false;
}

/**
 * このボードで、自分の手が「ありうる手全体」の上位何%にいるか（0 = 最強 〜 1 = 最弱）。
 * 役の強さと将来の伸びしろ（ランダムな相手への勝率）で比べる。
 */
function boardPercentile(hole: Card[], board: Card[]): number {
  const mine = estimateEquity(hole, board, 110);
  const known = new Set([...hole, ...board]);
  const rest = fullDeck().filter((c) => !known.has(c));
  const N = 32;
  let stronger = 0;
  for (let i = 0; i < N; i++) {
    const d = shuffle(rest);
    if (estimateEquity([d[0], d[1]], board, 70) > mine) stronger++;
  }
  return (stronger + 0.5) / (N + 1);
}

/**
 * 相手のベット範囲に対する勝率。
 * 相手はこの場面で freq の割合だけベットし、そのうち (1 - bluffShare) が上位の強い手（バリュー）、
 * bluffShare が下位の手（ブラフ）と想定する（GTOのベット範囲の組み立て方）。
 */
function rangeEquity(hole: Card[], board: Card[], freq: number, bluffShare: number, iterations = 350): number {
  const known = new Set([...hole, ...board]);
  const rest = fullDeck().filter((c) => !known.has(c));
  // 相手のありうる手の「今の役の強さ」の分布からしきい値を求める
  const scores: number[] = [];
  for (let i = 0; i < 300; i++) {
    const d = shuffle(rest);
    scores.push(evaluate([d[0], d[1], ...board]).score + (hasDraw([d[0], d[1]], board) ? 0.5 : 0));
  }
  scores.sort((a, b) => b - a);
  const valueFrac = Math.max(0.02, freq * (1 - bluffShare));
  const bluffFrac = freq * bluffShare;
  const valueThr = scores[Math.min(scores.length - 1, Math.floor(valueFrac * scores.length))];
  const bluffThr = scores[Math.max(0, Math.floor((1 - bluffFrac) * scores.length) - 1)];
  return estimateEquity(hole, board, iterations, 1, (o) => {
    const sc = evaluate([...o, ...board]).score + (hasDraw(o, board) ? 0.5 : 0);
    return sc >= valueThr || sc <= bluffThr;
  });
}

/** プリフロップで最後にレイズした席（いなければ null） */
function preflopAggressor(hand: Hand): number | null {
  const raises = hand.log.filter((e) => e.street === 'preflop' && e.type === 'raise');
  return raises.length ? raises[raises.length - 1].seat : null;
}

/**
 * つよい（KING）: ヘッズアップの GTO の考え方に沿った判断
 * - ベットされたら MDF（最低防衛頻度 = 1/(1+ベット/ポット)）ぶんは降りずに続ける
 * - プリフロップのレイザーはフロップで高頻度に小さく Cベット
 * - バリューとブラフを理論上の比率で混ぜる（リバーのブラフ比率 = s/(1+2s)）
 */
function decideStrong(hand: Hand, seat: number): Decision {
  const legal = hand.legal(seat)!;
  const raiseTo = sizer(hand, seat);
  const opp = 1 - seat;
  const r = Math.random();
  const [c1, c2] = hand.hole[seat];
  const pct = handPercentile(c1, c2);
  // 有効スタック（BB）
  const eff = Math.min(hand.stacks[seat] + hand.bets[seat], hand.stacks[opp] + hand.bets[opp]) / hand.bb;
  const facingAllIn = hand.stacks[opp] === 0;

  // ---------------- プリフロップ ----------------
  if (hand.street === 'preflop') {
    const raises = preflopRaises(hand);
    const isSB = seat === hand.button;

    // オールインされたら、スタックに応じたコール範囲で判断
    if (facingAllIn && !legal.canCheck) return pct <= callShoveRange(eff) ? { type: 'call' } : { type: 'fold' };

    // 浅いスタック（15BB以下）はプッシュ/フォールド（ナッシュ均衡の近似）
    if (eff <= 15) {
      if (raises === 0 && isSB) return pct <= pushRange(eff) && legal.canRaise ? raiseTo(legal.maxRaiseTo) : { type: 'fold' };
      if (raises === 0) {
        if (legal.canRaise && pct <= pushRange(eff) * 0.6) return raiseTo(legal.maxRaiseTo);
        return legal.canCheck ? { type: 'check' } : { type: 'fold' };
      }
      if (legal.canRaise && pct <= callShoveRange(eff) * 0.8) return raiseTo(legal.maxRaiseTo);
      if (pct <= callShoveRange(eff)) return { type: 'call' };
      return legal.canCheck ? { type: 'check' } : { type: 'fold' };
    }

    // 深いスタック
    if (raises === 0 && isSB) {
      // SB: 上位約85%を2.5BBでオープン（残りはフォールド）
      return pct <= 0.85 && legal.canRaise ? raiseTo(hand.bb * 2.5) : { type: 'fold' };
    }
    if (raises === 0) {
      // SBのリンプにBB: 上位約30%でレイズ（+少しブラフ）、残りはチェック
      if (legal.canRaise && (pct <= 0.3 || (pct > 0.6 && r < 0.12))) return raiseTo(hand.bb * 4);
      return { type: 'check' };
    }
    if (raises === 1) {
      // BBがオープンに直面: 3ベット 約16%（バリュー上位10% + 中位のブラフ）、コール 上位約75%まで
      const valueThree = pct <= 0.1;
      const bluffThree = pct > 0.4 && pct <= 0.62 && r < 0.28;
      if (legal.canRaise && (valueThree || bluffThree)) return raiseTo(hand.bets[opp] * 3.5);
      if (pct <= 0.75) return { type: 'call' };
      return { type: 'fold' };
    }
    if (raises === 2) {
      // SBが3ベットに直面: 4ベット 約7%（バリュー5% + ブラフ）、コール 上位約40%まで
      if (legal.canRaise && (pct <= 0.05 || (pct > 0.3 && pct <= 0.45 && r < 0.12))) {
        return eff <= 40 ? raiseTo(legal.maxRaiseTo) : raiseTo(hand.bets[opp] * 2.3);
      }
      if (pct <= 0.4) return { type: 'call' };
      return { type: 'fold' };
    }
    // 4ベット以上: 上位約3%はオールイン、上位約8%はコール
    if (legal.canRaise && pct <= 0.03) return raiseTo(legal.maxRaiseTo);
    if (pct <= 0.08) return { type: 'call' };
    return { type: 'fold' };
  }

  // ---------------- フロップ以降 ----------------
  const street = hand.street;
  const pot = hand.totalPot;
  const hole = hand.hole[seat];
  const p = boardPercentile(hole, hand.board); // このボードでの自分の手の位置（0 = 最強）
  const draw = hasDraw(hole, hand.board);
  const aggressor = preflopAggressor(hand) === seat;
  const ip = seat === hand.button; // ヘッズアップではSB(ボタン)がポストフロップで後から行動

  // 相手のベットに直面
  if (!legal.canCheck) {
    const b = legal.callAmount / Math.max(1, pot - legal.callAmount); // ベット額 / ベット前のポット
    const required = b / (1 + 2 * b); // コールに必要な勝率（ポットオッズ）
    const bluffShare = b / (1 + 2 * b); // 相手のベットに含まれるべきブラフの割合
    // 相手がこの場面でベットしてくる頻度の想定（GTOの目安）
    const oppRaisedMe = hand.log.some((e) => e.street === street && e.seat === seat && e.type === 'raise');
    const oppIsPfr = preflopAggressor(hand) === opp;
    const freq = oppRaisedMe ? 0.15 : street === 'flop' ? (oppIsPfr ? 0.7 : 0.4) : street === 'turn' ? 0.5 : 0.4;
    const eqVsRange = rangeEquity(hole, hand.board, freq, bluffShare);

    // 勝率の実現度: ポジションが不利な側や、役も伸びしろもない手は計算上の勝率ほど勝てない
    const realize = (ip ? 0.95 : 0.8) * (p > 0.6 && !draw ? 0.8 : 1);
    const effEq = eqVsRange * realize;
    const mdf = 1 / (1 + b); // 最低防衛頻度: 下位 (1 - MDF) の最弱の手は降りる

    if (facingAllIn || !legal.canRaise) return effEq >= required ? { type: 'call' } : { type: 'fold' };
    // レイズ: 上位のバリュー + ドローのセミブラフ（リバーは最上位と少しのブラフ）
    const valueRaise = p <= (street === 'river' ? 0.05 : 0.1) && eqVsRange > 0.6;
    const bluffRaise = street !== 'river' ? draw && r < 0.3 : p > 0.9 && r < 0.06;
    if (valueRaise || bluffRaise) return raiseTo(hand.bets[opp] * 3);
    if (p <= mdf && effEq >= required) return { type: 'call' };
    // ドローはオッズが近ければ続ける（将来の伸びしろ）
    if (draw && street !== 'river' && eqVsRange >= required * 0.8) return { type: 'call' };
    return { type: 'fold' };
  }

  // 自分から打てる場面
  if (!legal.canRaise) return { type: 'check' };
  const sizeFor = { flop: 0.33, turn: 0.66, river: 0.75 } as const;
  const s = sizeFor[street as keyof typeof sizeFor] ?? 0.66;
  const bet = () => raiseTo(pot * s);

  if (aggressor || (ip && !aggressor)) {
    // プリフロップのレイザー（または後手で相手がチェックしてきた）
    if (street === 'flop') {
      // Cベット 約70%: 強い手・中くらいの手・ドロー・一部の弱い手
      if (p <= 0.35) return bet();
      if (p <= 0.65) return r < 0.45 ? bet() : { type: 'check' };
      return draw || r < 0.48 ? bet() : { type: 'check' };
    }
    if (street === 'turn') {
      // 2発目 約50%: バリュー + ドローのセミブラフ + 少しの純ブラフ
      if (p <= 0.3) return bet();
      if (draw) return r < 0.6 ? bet() : { type: 'check' };
      if (p > 0.75 && r < 0.3) return bet();
      return { type: 'check' };
    }
    // リバー: バリュー（上位約25%）とブラフ（最弱帯）を理論比率で
    const bluffShare = s / (1 + 2 * s); // ベットのうちブラフの割合（0.75ポットで約30%）
    if (p <= 0.25) return raiseTo(pot * s);
    if (p >= 0.8 && r < (0.25 * bluffShare) / (1 - bluffShare) / 0.2) return raiseTo(pot * s);
    return { type: 'check' };
  }

  // 先に行動する非レイザー: 基本チェック（強い手とドローで時々ドンク）
  if (p <= 0.1 && r < 0.3) return bet();
  if (draw && r < 0.12) return bet();
  return { type: 'check' };
}
