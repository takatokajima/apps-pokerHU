// アップデート情報（新しい順）。追加したら先頭に足す
export interface UpdateEntry {
  id: number;
  date: string;
  title: { ja: string; en: string };
  body: { ja: string; en: string };
}

export const UPDATES: UpdateEntry[] = [
  {
    id: 5,
    date: '2026/09/25',
    title: { ja: 'ゲーム: CPUの強さを3段階に', en: 'Game: CPU difficulty levels' },
    body: {
      ja: 'CPUと練習するときに「JACK・QUEEN・KING」の3段階から強さを選べるようになりました。\nKING は理論（GTO）に近い判断で打ってきます。',
      en: 'Choose JACK / QUEEN / KING when practicing vs the CPU. KING plays close to GTO.',
    },
  },
  {
    id: 4,
    date: '2026/09/25',
    title: { ja: 'ゲーム: タイムバンクが予約制に', en: 'Game: Time bank is now reserved' },
    body: {
      ja: 'タイムバンクは押すと予約され、持ち時間が切れた時点で1回分を消費します。\n持ち時間内にアクションすれば消費されません。\nあわせて、ブラインドが3分ごとに上がるようになりました。',
      en: 'Tapping the time bank reserves it; it is only used if your time runs out. Blinds now go up every 3 minutes.',
    },
  },
  {
    id: 3,
    date: '2026/09/25',
    title: { ja: 'Stats / Hand History: 成績とハンド履歴', en: 'Stats / Hand History' },
    body: {
      ja: '収支・EV収支・VPIP/PFR/3Betの成績、収支グラフ、ハンド履歴のリプレイとブックマークに対応しました。',
      en: 'Profit, EV, VPIP/PFR/3Bet, profit graphs, hand replays and bookmarks.',
    },
  },
  {
    id: 2,
    date: '2026/09/25',
    title: { ja: 'Leaderboard: 週間ランキング開始', en: 'Leaderboard: Weekly ranking' },
    body: { ja: 'Actのレート・勝利数に加えて、今週の勝利数ランキングを追加しました。', en: 'Added a weekly wins leaderboard.' },
  },
  {
    id: 1,
    date: '2026/09/25',
    title: { ja: 'HeadsUp Online ベータ版公開', en: 'HeadsUp Online beta' },
    body: { ja: 'ヘッズアップ専用のランクマッチ・フレンドマッチを公開しました。', en: 'Heads-up ranked and friend matches are live.' },
  },
];

const KEY = 'updatesSeen.v1';
export const latestUpdateId = UPDATES[0]?.id ?? 0;

export function seenUpdateId(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0);
  } catch {
    return latestUpdateId;
  }
}

export function markUpdatesSeen() {
  try {
    localStorage.setItem(KEY, String(latestUpdateId));
  } catch {
    /* ignore */
  }
}
