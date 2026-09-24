import type { HandSeatStat, LogEntry, UserStats } from '../../shared/protocol';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** プリフロップのVPIP/PFR/3Betをログから判定 */
export function preflopFlags(log: LogEntry[]) {
  const flags = [0, 1].map(() => ({ vpip: false, pfr: false, threeBetOpp: false, threeBet: false }));
  let raises = 0;
  let lastRaiser: number | null = null;
  for (const e of log) {
    if (e.street !== 'preflop' || e.seat === null) continue;
    if (e.type !== 'fold' && e.type !== 'check' && e.type !== 'call' && e.type !== 'raise') continue;
    const f = flags[e.seat];
    // 3Betの機会: 相手のレイズ（2ベット目）に直面している
    if (raises === 1 && lastRaiser !== e.seat) {
      f.threeBetOpp = true;
      if (e.type === 'raise') f.threeBet = true;
    }
    if (e.type === 'raise') {
      f.vpip = true;
      f.pfr = true;
      raises++;
      lastRaiser = e.seat;
    } else if (e.type === 'call') f.vpip = true;
  }
  return flags;
}

/**
 * 1ハンドの席ごとの成績
 * @param evEquity オールイン時の勝率(%)。オールインでなければ null
 * @param evPot オールイン時のポット総額
 */
export function seatStats(args: {
  log: LogEntry[];
  invested: [number, number];
  won: number[];
  bb: number;
  showdown: boolean;
  evEquity: [number, number] | null;
  evPot: number | null;
}): [HandSeatStat, HandSeatStat] {
  const pf = preflopFlags(args.log);
  const make = (s: number): HandSeatStat => {
    const net = args.won[s] - args.invested[s];
    const ev = args.evEquity && args.evPot !== null ? (args.evPot * args.evEquity[s]) / 100 - args.invested[s] : net;
    return {
      netBB: round2(net / args.bb),
      evBB: round2(ev / args.bb),
      showdown: args.showdown,
      ...pf[s],
    };
  };
  return [make(0), make(1)];
}

/** 通算成績にハンド1つ分を加算 */
export function addHand(stats: UserStats, h: HandSeatStat): UserStats {
  return {
    ...stats,
    hands: stats.hands + 1,
    vpip: stats.vpip + (h.vpip ? 1 : 0),
    pfr: stats.pfr + (h.pfr ? 1 : 0),
    threeBetOpp: stats.threeBetOpp + (h.threeBetOpp ? 1 : 0),
    threeBet: stats.threeBet + (h.threeBet ? 1 : 0),
    netBB: round2(stats.netBB + h.netBB),
    evBB: round2(stats.evBB + h.evBB),
    sdBB: round2(stats.sdBB + (h.showdown ? h.netBB : 0)),
    nsdBB: round2(stats.nsdBB + (h.showdown ? 0 : h.netBB)),
  };
}
