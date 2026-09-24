import { RATING } from './config';

/** 勝者・敗者のレート変動（Elo方式。同レートなら±30） */
export function ratingDelta(winner: number, loser: number): number {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  return Math.max(1, Math.round(RATING.kFactor * (1 - expected)));
}

/** 新アクト開始時のレート: 1000下げる（初期値1500は下回らない）、上限7000 */
export function softReset(prev: number): number {
  const dropped = Math.max(prev - RATING.resetDrop, Math.min(prev, RATING.initial));
  return Math.min(RATING.resetCap, dropped);
}

const DAY = 24 * 60 * 60 * 1000;

export function actInfo(now: number, epochIso: string) {
  const epoch = new Date(epochIso + 'T00:00:00+09:00').getTime();
  const len = RATING.actLengthDays * DAY;
  const idx = now < epoch ? 0 : Math.floor((now - epoch) / len);
  const start = now < epoch ? epoch - len : epoch + idx * len;
  return { act: idx + 1, startsAt: start, endsAt: start + len };
}
