export type Card = string; // 例: "As" "Td" "7c"
export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';

export function fullDeck(): Card[] {
  const d: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  return d;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const rankOf = (c: Card) => RANKS.indexOf(c[0]) + 2; // 2..14
export const suitOf = (c: Card) => c[1];

/** 役カテゴリ: 0=ハイカード … 8=ストレートフラッシュ */
export const HAND_CATEGORIES = [
  'highCard', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush',
] as const;
export type HandCategory = (typeof HAND_CATEGORIES)[number];

export interface HandValue {
  score: number; // 大きいほど強い
  category: HandCategory;
}

const encode = (cat: number, kick: number[]) => {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (kick[i] ?? 0);
  return s;
};

function straightHigh(ranksDesc: number[]): number {
  const set = new Set(ranksDesc);
  if (set.has(14)) set.add(1);
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) if (!set.has(hi - k)) { ok = false; break; }
    if (ok) return hi;
  }
  return 0;
}

/** 5〜7枚から最強の役を判定 */
export function evaluate(cards: Card[]): HandValue {
  const counts = new Map<number, number>();
  const bySuit = new Map<string, number[]>();
  for (const c of cards) {
    const r = rankOf(c);
    counts.set(r, (counts.get(r) ?? 0) + 1);
    const s = suitOf(c);
    if (!bySuit.has(s)) bySuit.set(s, []);
    bySuit.get(s)!.push(r);
  }
  const mk = (cat: number, kick: number[]): HandValue => ({ score: encode(cat, kick), category: HAND_CATEGORIES[cat] });

  let flushRanks: number[] | null = null;
  for (const rs of bySuit.values()) if (rs.length >= 5) flushRanks = rs.sort((a, b) => b - a);
  if (flushRanks) {
    const sf = straightHigh(flushRanks);
    if (sf) return mk(8, [sf]);
  }
  // [rank, count] を 枚数→ランク の降順で
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniq = [...counts.keys()].sort((a, b) => b - a);

  if (groups[0][1] === 4) {
    const q = groups[0][0];
    return mk(7, [q, uniq.find((r) => r !== q)!]);
  }
  const trips = groups.filter((g) => g[1] === 3).map((g) => g[0]);
  const pairs = groups.filter((g) => g[1] === 2).map((g) => g[0]);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0];
    const p = Math.max(trips[1] ?? 0, pairs[0] ?? 0);
    return mk(6, [t, p]);
  }
  if (flushRanks) return mk(5, flushRanks.slice(0, 5));
  const st = straightHigh(uniq);
  if (st) return mk(4, [st]);
  if (trips.length) return mk(3, [trips[0], ...uniq.filter((r) => r !== trips[0]).slice(0, 2)]);
  if (pairs.length >= 2) {
    const [a, b] = pairs;
    return mk(2, [a, b, uniq.find((r) => r !== a && r !== b)!]);
  }
  if (pairs.length) return mk(1, [pairs[0], ...uniq.filter((r) => r !== pairs[0]).slice(0, 3)]);
  return mk(0, uniq.slice(0, 5));
}

export interface BestHand {
  category: HandCategory;
  score: number;
  five: Card[]; // 役を構成する5枚
  core: Card[]; // 役の中心となるカード（ペアの2枚など）
  ranks: number[]; // 役の主要ランク（例: ツーペアなら [A, K]）
}

function combos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) return void out.push(acc.slice());
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

/** 表示用: 最強の5枚と、光らせるカードを求める */
export function bestHand(cards: Card[]): BestHand | null {
  if (cards.length < 5) return null;
  let best: { v: HandValue; five: Card[] } | null = null;
  for (const five of combos(cards, 5)) {
    const v = evaluate(five);
    if (!best || v.score > best.v.score) best = { v, five };
  }
  const { v, five } = best!;
  const counts = new Map<number, number>();
  for (const c of five) counts.set(rankOf(c), (counts.get(rankOf(c)) ?? 0) + 1);
  const grouped = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([r]) => r);
  let core: Card[];
  let ranks: number[];
  switch (v.category) {
    case 'pair':
    case 'twoPair':
    case 'trips':
    case 'quads':
    case 'fullHouse':
      core = five.filter((c) => grouped.includes(rankOf(c)));
      ranks = grouped;
      break;
    case 'highCard': {
      const hi = Math.max(...five.map(rankOf));
      core = five.filter((c) => rankOf(c) === hi);
      ranks = [hi];
      break;
    }
    default: {
      core = five;
      const rs = five.map(rankOf);
      // ホイール(A-5)はストレートの最高位を5とする
      const wheel = rs.includes(14) && rs.includes(2) && !rs.includes(13) && (v.category === 'straight' || v.category === 'straightFlush');
      ranks = [wheel ? 5 : Math.max(...rs)];
    }
  }
  return { category: v.category, score: v.score, five, core, ranks };
}

/** オールイン時の勝率（%）とアウツ。ボード3枚以上は全通り計算、プリフロップはサンプリング */
export function allInOdds(holes: [Card[], Card[]], board: Card[]): { equity: [number, number]; outs: [number | null, number | null] } {
  const known = new Set([...holes[0], ...holes[1], ...board]);
  const rest = fullDeck().filter((c) => !known.has(c));
  const need = 5 - board.length;
  const tally = [0, 0];
  let total = 0;
  const score = (runout: Card[]) => {
    const a = evaluate([...holes[0], ...board, ...runout]).score;
    const b = evaluate([...holes[1], ...board, ...runout]).score;
    if (a > b) tally[0] += 1;
    else if (b > a) tally[1] += 1;
    else (tally[0] += 0.5), (tally[1] += 0.5);
    total++;
  };
  if (need === 0) score([]);
  else if (board.length >= 3) for (const r of combos(rest, need)) score(r);
  else for (let i = 0; i < 20000; i++) score(shuffle(rest).slice(0, need));
  const equity: [number, number] = [Math.round((tally[0] / total) * 1000) / 10, Math.round((tally[1] / total) * 1000) / 10];

  // アウツ: 負けている側が「次の1枚」で逆転できるカードの枚数
  const outs: [number | null, number | null] = [null, null];
  if (board.length === 3 || board.length === 4) {
    const cur = [0, 1].map((s) => evaluate([...holes[s], ...board]).score);
    if (cur[0] !== cur[1]) {
      const behind = cur[0] < cur[1] ? 0 : 1;
      let n = 0;
      for (const c of rest) {
        const me = evaluate([...holes[behind], ...board, c]).score;
        const op = evaluate([...holes[1 - behind], ...board, c]).score;
        if (me > op) n++;
      }
      outs[behind] = n;
    }
  }
  return { equity, outs };
}
