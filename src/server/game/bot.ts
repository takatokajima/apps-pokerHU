import { evaluate, fullDeck, shuffle, type Card } from '../../shared/cards';
import type { ActionType } from '../../shared/protocol';
import type { Hand } from './hand';

/** ランダムな相手ハンドに対する勝率をモンテカルロで推定 */
export function estimateEquity(hole: Card[], board: Card[], iterations = 300): number {
  const known = new Set([...hole, ...board]);
  const rest = fullDeck().filter((c) => !known.has(c));
  let score = 0;
  for (let i = 0; i < iterations; i++) {
    const d = shuffle(rest);
    const opp = [d[0], d[1]];
    const runout = [...board, ...d.slice(2, 2 + (5 - board.length))];
    const a = evaluate([...hole, ...runout]).score;
    const b = evaluate([...opp, ...runout]).score;
    score += a > b ? 1 : a === b ? 0.5 : 0;
  }
  return score / iterations;
}

/** シンプルなCPU: 勝率・ポットオッズ・スタック深さで判断 */
export function decideBot(hand: Hand, seat: number): { type: ActionType; amount?: number } {
  const legal = hand.legal(seat)!;
  const eq = estimateEquity(hand.hole[seat], hand.board);
  const pot = hand.totalPot;
  const bbDepth = (hand.stacks[seat] + hand.bets[seat]) / hand.bb;
  const r = Math.random();
  const raiseTo = (target: number) => ({
    type: 'raise' as const,
    amount: Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(target / 100) * 100)),
  });

  // 浅いスタック: プッシュ or フォールド
  if (bbDepth <= 12 && hand.street === 'preflop') {
    if (eq > 0.5 && legal.canRaise) return raiseTo(legal.maxRaiseTo);
    if (legal.canCheck) return { type: 'check' };
    const need = legal.callAmount / (pot + legal.callAmount);
    return eq > need + 0.05 ? { type: 'call' } : { type: 'fold' };
  }

  const strong = hand.street === 'preflop' ? 0.62 : 0.72;
  if (legal.canRaise && (eq > strong || (r < 0.08 && eq > 0.3))) {
    const size = hand.street === 'preflop' ? hand.bets[1 - seat] + hand.bb * 2.5 : hand.bets[1 - seat] + pot * 0.66;
    if (eq > 0.85 && r < 0.3) return raiseTo(legal.maxRaiseTo);
    return raiseTo(size);
  }
  if (legal.canCheck) {
    if (legal.canRaise && eq > 0.55 && r < 0.35) return raiseTo(hand.bets[1 - seat] + pot * 0.5);
    return { type: 'check' };
  }
  const need = legal.callAmount / (pot + legal.callAmount);
  if (eq > need + 0.03 || (hand.street === 'preflop' && eq > 0.4 && legal.callAmount <= hand.bb * 2)) return { type: 'call' };
  return { type: 'fold' };
}
