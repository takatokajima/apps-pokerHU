import { describe, expect, it } from 'vitest';
import { Hand } from '../src/server/game/hand';
import { preflopFlags, seatStats } from '../src/server/game/record';

const cfg = { stacks: [50000, 50000] as [number, number], button: 0, sb: 100, bb: 200, ante: 200 };

describe('成績集計', () => {
  it('SBオープン → BB 3Bet → SBコール', () => {
    const h = new Hand(cfg);
    h.act(0, 'raise', 500);
    h.act(1, 'raise', 1500);
    h.act(0, 'call');
    const f = preflopFlags(h.log);
    expect(f[0]).toEqual({ vpip: true, pfr: true, threeBetOpp: false, threeBet: false });
    expect(f[1]).toEqual({ vpip: true, pfr: true, threeBetOpp: true, threeBet: true });
  });
  it('SBリンプ → BBチェック はBBのVPIPにならない', () => {
    const h = new Hand(cfg);
    h.act(0, 'call');
    h.act(1, 'check');
    const f = preflopFlags(h.log);
    expect(f[0].vpip).toBe(true);
    expect(f[1].vpip).toBe(false);
  });
  it('SBフォールド: 収支はBB単位で -0.5 / +0.5 (+アンテ分)', () => {
    const h = new Hand(cfg);
    h.act(0, 'fold');
    const st = seatStats({ log: h.log, invested: h.invested, won: h.result!.won, bb: 200, showdown: false, evEquity: null, evPot: null });
    expect(st[0].netBB).toBe(-0.5);
    expect(st[1].netBB).toBe(0.5);
    expect(st[0].evBB).toBe(st[0].netBB);
  });
  it('オールインEV: 勝率×ポット − 投資額', () => {
    const st = seatStats({ log: [], invested: [10000, 10000], won: [20000, 0], bb: 200, showdown: true, evEquity: [25, 75], evPot: 20000 });
    expect(st[0].netBB).toBe(50);
    expect(st[0].evBB).toBe(-25); // 20000*0.25 - 10000 = -5000
  });
  it('ログにブラインド・アンテ・アクション・配札が記録される', () => {
    const h = new Hand(cfg);
    h.act(0, 'call');
    h.act(1, 'check');
    h.proceed();
    expect(h.log.map((e) => e.type)).toEqual(['sb', 'bb', 'ante', 'call', 'check', 'deal']);
    expect(h.log.at(-1)!.board.length).toBe(3);
    expect(h.invested).toEqual([200, 400]);
  });
});
