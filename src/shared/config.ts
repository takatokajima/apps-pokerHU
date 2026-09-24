// ゲームルール・レート設定（ここを変えればルールを調整できる）
export const RULES = {
  startingStack: 50_000,
  levelDurationMs: 5 * 60 * 1000,
  baseSmallBlind: 100,
  baseBigBlind: 200,
  actionTimeMs: 15_000,
  timebankMs: 30_000,
  timebankCount: 5,
  disconnectForfeitMs: 3 * 60 * 1000,
} as const;

export const RATING = {
  initial: 1500,
  kFactor: 60, // 同レート同士なら ±30
  floor: 0,
  actLengthDays: 90,
  resetDrop: 1000,
  resetCap: 7000,
  leaderboardSize: 1000,
} as const;

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number; // BBアンテ
}

// レベル1: 100-200(200)、以降2倍ずつ
export function blindLevel(index: number): BlindLevel {
  const m = 2 ** index;
  const bb = RULES.baseBigBlind * m;
  return { level: index + 1, sb: RULES.baseSmallBlind * m, bb, ante: bb };
}
