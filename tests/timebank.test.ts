import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Match, type Participant } from '../src/server/game/match';

const p = (id: string): Participant => ({ userId: id, name: id, avatar: 'spade', rating: 1500, isGuest: true, isCpu: false });

function setup() {
  const m = new Match('m1', 'friend', [p('a'), p('b')], { emitState: () => {}, onEnd: () => {}, onHand: () => {} });
  m.start();
  return m;
}

describe('タイムバンク（予約式）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('予約しても、持ち時間内にアクションすれば消費しない', () => {
    const m = setup();
    const seat = m.hand!.toAct!;
    expect(m.useTimebank(seat)).toBe(true);
    expect(m.timebanks[seat]).toBe(5);
    vi.advanceTimersByTime(10_000);
    m.handleAction(seat, 'call');
    expect(m.timebanks[seat]).toBe(5);
  });

  it('予約して持ち時間が切れたら1回消費して+30秒', () => {
    const m = setup();
    const seat = m.hand!.toAct!;
    m.useTimebank(seat);
    vi.advanceTimersByTime(15_001);
    expect(m.timebanks[seat]).toBe(4);
    expect(m.hand!.toAct).toBe(seat); // まだ自分の番
    expect(m.stateFor(seat).usingTimebank).toBe(true);
    vi.advanceTimersByTime(30_000); // タイムバンクも切れたら自動で降りる
    expect(m.hand!.phase === 'done' || m.hand!.toAct !== seat).toBe(true);
  });

  it('予約しなければ時間切れで自動アクション（消費なし）', () => {
    const m = setup();
    const seat = m.hand!.toAct!;
    vi.advanceTimersByTime(15_001);
    expect(m.timebanks[seat]).toBe(5);
    expect(m.hand!.phase === 'done' || m.hand!.toAct !== seat).toBe(true);
  });
});
