import { describe, expect, it } from 'vitest';
import { allInOdds, bestHand, evaluate } from '../src/shared/cards';
import { ratingDelta, softReset } from '../src/shared/rating';
import { blindLevel } from '../src/shared/config';
import { Hand } from '../src/server/game/hand';

const cat = (s: string) => evaluate(s.split(' ')).category;

describe('evaluate', () => {
  it('役を判定できる', () => {
    expect(cat('As Ks Qs Js Ts 2d 3c')).toBe('straightFlush');
    expect(cat('Ah 2h 3h 4h 5h 9c 9d')).toBe('straightFlush');
    expect(cat('9s 9h 9d 9c 2s 3d 4c')).toBe('quads');
    expect(cat('9s 9h 9d 2c 2s 3d 4c')).toBe('fullHouse');
    expect(cat('9s 9h 9d 2c 2s 2d 4c')).toBe('fullHouse');
    expect(cat('As 9s 7s 4s 2s Kd Kc')).toBe('flush');
    expect(cat('Ad 2c 3h 4s 5d Kc Qc')).toBe('straight');
    expect(cat('9s 9h 9d Ac Ks 3d 4c')).toBe('trips');
    expect(cat('9s 9h 8d 8c Ks 3d 4c')).toBe('twoPair');
    expect(cat('9s 9h 8d 7c Ks 3d 2c')).toBe('pair');
    expect(cat('As Jh 8d 7c 5s 3d 2c')).toBe('highCard');
  });
  it('強さを比較できる', () => {
    const a = evaluate('As Ad Kc 7h 2s 3d 9c'.split(' ')).score;
    const b = evaluate('As Ad Qc 7h 2s 3d 9c'.split(' ')).score;
    expect(a).toBeGreaterThan(b);
    const wheel = evaluate('Ad 2c 3h 4s 5d'.split(' ')).score;
    const six = evaluate('6d 2c 3h 4s 5d'.split(' ')).score;
    expect(six).toBeGreaterThan(wheel);
  });
});

describe('rating', () => {
  it('同レートは±30', () => expect(ratingDelta(1500, 1500)).toBe(30));
  it('格上に勝つと多くもらえる', () => expect(ratingDelta(1500, 1800)).toBeGreaterThan(30));
  it('ソフトリセット', () => {
    expect(softReset(3000)).toBe(2000);
    expect(softReset(2000)).toBe(1500);
    expect(softReset(1200)).toBe(1200);
    expect(softReset(9500)).toBe(7000);
  });
  it('ブラインドは2倍ずつ', () => {
    expect(blindLevel(0)).toEqual({ level: 1, sb: 100, bb: 200, ante: 200 });
    expect(blindLevel(2)).toEqual({ level: 3, sb: 400, bb: 800, ante: 800 });
  });
});

const cfg = { stacks: [50000, 50000] as [number, number], button: 0, sb: 100, bb: 200, ante: 200 };

describe('Hand', () => {
  it('ブラインドとBBアンテが正しく入る', () => {
    const h = new Hand(cfg);
    expect(h.stacks).toEqual([49900, 49600]);
    expect(h.totalPot).toBe(500);
    expect(h.toAct).toBe(0);
  });
  it('オールインにフォールドされたら獲得額は相手の出した分だけ', () => {
    const h = new Hand(cfg);
    h.act(0, 'raise', h.legal(0)!.maxRaiseTo);
    h.act(1, 'fold');
    expect(h.result!.won[0]).toBe(600); // ポット = 両者200ずつ + アンテ200（コールされなかった分は含めない）
    expect(h.stacks).toEqual([50400, 49600]);
  });
  it('SBフォールドでBBが獲得', () => {
    const h = new Hand(cfg);
    h.act(0, 'fold');
    expect(h.stacks).toEqual([49900, 50100]);
    expect(h.stacks[0] + h.stacks[1]).toBe(100000);
  });
  it('リンプ→BBチェックでフロップ、BBから', () => {
    const h = new Hand(cfg);
    expect(h.act(0, 'call')).toBe(true);
    expect(h.toAct).toBe(1);
    expect(h.act(1, 'check')).toBe(true);
    expect(h.phase).toBe('transition'); // 1秒の間
    expect(h.board.length).toBe(0);
    h.proceed();
    expect(h.street).toBe('flop');
    expect(h.board.length).toBe(3);
    expect(h.toAct).toBe(1);
  });
  it('ミニマムレイズ未満は拒否', () => {
    const h = new Hand(cfg);
    expect(h.act(0, 'raise', 300)).toBe(false);
    expect(h.act(0, 'raise', 400)).toBe(true);
    expect(h.legal(1)!.minRaiseTo).toBe(600);
  });
  it('オールイン→コールでランアウトしてチップ保存', () => {
    const h = new Hand(cfg);
    expect(h.act(0, 'raise', h.legal(0)!.maxRaiseTo)).toBe(true);
    h.act(1, 'call');
    h.proceed();
    expect(h.phase).toBe('runout');
    while (h.phase === 'runout') h.runoutStep();
    expect(h.board.length).toBe(5);
    expect(h.stacks[0] + h.stacks[1]).toBe(100000);
  });
  it('スタックが違うオールインは余剰を返却', () => {
    const h = new Hand({ ...cfg, stacks: [10000, 50000] });
    h.act(0, 'raise', 10000);
    h.act(1, 'call');
    h.proceed();
    while (h.phase === 'runout') h.runoutStep();
    expect(h.stacks[0] + h.stacks[1]).toBe(60000);
    if (h.result!.winners.length === 1) expect([0, 20200]).toContain(h.stacks[0]);
  });
  it('ブラインドだけでオールインでも進行', () => {
    const h = new Hand({ ...cfg, stacks: [100, 150] });
    h.proceed();
    expect(h.phase).toBe('runout');
    while (h.phase === 'runout') h.runoutStep();
    expect(h.stacks[0] + h.stacks[1]).toBe(250);
  });
  it('ランダムな1000ハンドでチップが保存される', () => {
    for (let n = 0; n < 1000; n++) {
      const s0 = 1000 + Math.floor(Math.random() * 99000);
      const h = new Hand({ ...cfg, stacks: [s0, 100000 - s0], button: n % 2 });
      let guard = 0;
      while (h.phase !== 'done' && guard++ < 200) {
        if (h.phase === 'transition') { h.proceed(); continue; }
        if (h.phase === 'runout') { h.runoutStep(); continue; }
        const s = h.toAct!;
        const l = h.legal(s)!;
        const r = Math.random();
        if (l.canRaise && r < 0.3) h.act(s, 'raise', l.minRaiseTo + Math.floor(Math.random() * (l.maxRaiseTo - l.minRaiseTo + 1)));
        else if (r < 0.4 && !l.canCheck) h.act(s, 'fold');
        else h.act(s, l.canCheck ? 'check' : 'call');
      }
      expect(h.phase).toBe('done');
      expect(h.stacks[0] + h.stacks[1]).toBe(100000);
    }
  });
});

describe('表示用の役・勝率', () => {
  it('ペアは2枚だけ光らせる', () => {
    const b = bestHand('Js Jd 7c 2h 9s Kd 4c'.split(' '))!;
    expect(b.category).toBe('pair');
    expect(b.core.sort()).toEqual(['Jd', 'Js']);
    expect(b.ranks).toEqual([11]);
  });
  it('ホイールのストレートは5ハイ', () => {
    const b = bestHand('Ad 2c 3h 4s 5d Kc Qc'.split(' '))!;
    expect(b.ranks).toEqual([5]);
  });
  it('フロップの勝率とアウツ（フラッシュドロー）', () => {
    const o = allInOdds([['As', 'Kd'], ['9h', '8h']], ['Ah', '2h', '7c']);
    expect(o.equity[0] + o.equity[1]).toBeCloseTo(100, 0);
    expect(o.outs[1]!.length).toBeGreaterThanOrEqual(9);
    expect(o.outs[1]!.every((c) => c[1] === 'h' || c[0] === '9' || c[0] === '8')).toBe(true);
    expect(o.outs[0]).toBeNull();
  });
});
