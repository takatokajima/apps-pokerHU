import { describe, expect, it } from 'vitest';
import { decideBot, handClass, handPercentile } from '../src/server/game/bot';
import { Hand } from '../src/server/game/hand';

describe('手の強さ順位', () => {
  it('AAが最強、72oが最弱付近', () => {
    const t0 = Date.now();
    const aa = handPercentile('As', 'Ah');
    console.log('順位表の作成時間(ms):', Date.now() - t0);
    expect(aa).toBeLessThan(0.01);
    expect(handPercentile('7c', '2d')).toBeGreaterThan(0.95);
    expect(handPercentile('Ks', 'Qs')).toBeLessThan(handPercentile('Kd', 'Qc'));
    expect(handClass('2h', 'Ah')).toBe('A2s');
  });
});

const cfg = { stacks: [50000, 50000] as [number, number], button: 0, sb: 100, bb: 200, ante: 200 };

describe('よわい', () => {
  it('相手のレイズにはリレイズもフォールドもせずコール', () => {
    for (let i = 0; i < 40; i++) {
      const h = new Hand(cfg); // seat0=SB が先に行動
      h.act(0, 'raise', 600);
      const d = decideBot(h, 1, 'weak');
      expect(d.type).toBe('call');
    }
  });
  it('ベットがない場面ではチェックかベット（コール/フォールドはしない）', () => {
    for (let i = 0; i < 40; i++) {
      const h = new Hand(cfg);
      h.act(0, 'call');
      const d = decideBot(h, 1, 'weak');
      expect(['check', 'raise']).toContain(d.type);
    }
  });
});

describe('CPU同士で対戦してもルール違反やエラーが起きない', () => {
  for (const [a, b] of [['strong', 'weak'], ['strong', 'normal'], ['strong', 'strong']] as const) {
    it(`${a} vs ${b}`, () => {
      let stacks: [number, number] = [50000, 50000];
      for (let n = 0; n < 60 && stacks[0] > 0 && stacks[1] > 0; n++) {
        const lv = Math.min(4, Math.floor(n / 12));
        const bb = 200 * 2 ** lv;
        const h = new Hand({ stacks, button: n % 2, sb: bb / 2, bb, ante: bb });
        let guard = 0;
        while (h.phase !== 'done' && guard++ < 100) {
          if (h.phase === 'transition') { h.proceed(); continue; }
          if (h.phase === 'runout') { h.runoutStep(); continue; }
          const s = h.toAct!;
          const d = decideBot(h, s, s === 0 ? a : b);
          if (!h.act(s, d.type, d.amount)) {
            const l = h.legal(s)!;
            throw new Error(`不正なアクション ${JSON.stringify(d)} legal=${JSON.stringify(l)}`);
          }
        }
        expect(h.phase).toBe('done');
        stacks = [...h.stacks] as [number, number];
        expect(stacks[0] + stacks[1]).toBe(100000);
      }
    }, 60000);
  }
});
