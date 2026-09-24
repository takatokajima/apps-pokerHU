import { describe, expect, it } from 'vitest';
import { normalize, rank } from '../src/server/store';

const u = (id: string, rating: number, wins: number, xHandle: string | null = null) =>
  normalize({ id, name: id, rating, wins, games: wins + 1, isGuest: false, xHandle });

describe('ランキングのタブ', () => {
  const users = [u('a', 1600, 3, 'alice'), u('b', 1800, 1), u('c', 1500, 5)];
  it('レート順', () => {
    const r = rank('rating', users.slice(), new Map(), 10);
    expect(r.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(r[1].xHandle).toBe('alice');
    expect(r[0].value).toBe(1800);
  });
  it('Actの勝利数順', () => {
    expect(rank('actWins', users.slice(), new Map(), 10).map((e) => [e.id, e.value])).toEqual([
      ['c', 5],
      ['a', 3],
      ['b', 1],
    ]);
  });
  it('今週の勝利数順（勝利0は載らない）', () => {
    const week = new Map([
      ['a', 2],
      ['b', 4],
    ]);
    expect(rank('week', users.slice(), week, 10).map((e) => [e.id, e.value])).toEqual([
      ['b', 4],
      ['a', 2],
    ]);
  });
});
