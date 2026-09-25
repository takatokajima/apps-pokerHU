import { useSyncExternalStore } from 'react';

export type Lang = 'ja' | 'en';

const dict = {
  online: { ja: '人がオンライン', en: 'online' },
  ranked: { ja: 'ランクマッチ', en: 'Ranked' },
  rankedSub: { ja: 'レーティングを賭けて、実力を証明する', en: 'Put your rating on the line' },
  friend: { ja: 'フレンドマッチ', en: 'Friend Match' },
  friendSub: { ja: '合言葉で友達と対戦（レート変動なし）', en: 'Play a friend with a passphrase. Unrated.' },
  leaderboard: { ja: 'ランキング', en: 'Leaderboard' },
  profile: { ja: 'プロフィール', en: 'Profile' },
  guest: { ja: 'ゲスト', en: 'Guest' },
  guestNote: {
    ja: 'ゲストの記録はこの端末のブラウザにだけ保存されます。アカウントを作ると今のレートを引き継げます。',
    en: 'Guest progress lives only in this browser. Create an account to keep your rating.',
  },
  createAccount: { ja: 'アカウントを作成', en: 'Create account' },
  act: { ja: 'アクト', en: 'Act' },
  actEnds: { ja: '終了まで', en: 'ends in' },
  days: { ja: '日', en: 'd' },
  rating: { ja: 'レート', en: 'Rating' },
  record: { ja: '戦績', en: 'Record' },
  wins: { ja: '勝', en: 'W' },
  losses: { ja: '敗', en: 'L' },
  rules: { ja: '持ち点 50,000 ／ 3分ごとにブラインド2倍 ／ 100-200 (BBアンテ200) から', en: '50,000 chips · blinds double every 3 min · from 100/200 (BB ante 200)' },
  searching: { ja: '対戦相手を探しています', en: 'Finding an opponent' },
  cancel: { ja: 'キャンセル', en: 'Cancel' },
  cpuOffer: { ja: '相手が見つかりにくい時間帯です', en: 'Few players online right now' },
  playCpu: { ja: 'CPUと練習する（レート変動なし）', en: 'Practice vs CPU (unrated)' },
  // CPUの強さ（日本語表示でも英語）
  cpuWeak: { ja: 'JACK', en: 'JACK' },
  cpuNormal: { ja: 'QUEEN', en: 'QUEEN' },
  cpuStrong: { ja: 'KING', en: 'KING' },
  matchFound: { ja: '対戦相手が見つかりました', en: 'Opponent found' },
  timebankArmed: { ja: '予約中', en: 'Armed' },
  timebankHint: { ja: '持ち時間が切れたら+30秒', en: '+30s when time runs out' },
  passphrase: { ja: '合言葉', en: 'Passphrase' },
  passphraseHint: { ja: '友達と同じ合言葉を入力してください', en: 'Enter the same passphrase as your friend' },
  passphrasePh: { ja: '例：さくら2026', en: 'e.g. sunset42' },
  enterRoom: { ja: '入室する', en: 'Join' },
  waitingFriend: { ja: '友達の入室を待っています', en: 'Waiting for your friend' },
  back: { ja: '戻る', en: 'Back' },
  fold: { ja: 'フォールド', en: 'Fold' },
  check: { ja: 'チェック', en: 'Check' },
  call: { ja: 'コール', en: 'Call' },
  raise: { ja: 'レイズ', en: 'Raise' },
  bet: { ja: 'ベット', en: 'Bet' },
  allIn: { ja: 'オールイン', en: 'All-in' },
  pot: { ja: 'ポット', en: 'Pot' },
  play: { ja: '対戦を始める', en: 'Play' },
  friendPlay: { ja: '合言葉で対戦', en: 'Play with passphrase' },
  settings: { ja: '設定', en: 'Settings' },
  display: { ja: '表示', en: 'Display' },
  bbDisplay: { ja: 'BB表示', en: 'Show in big blinds' },
  bbDisplaySub: { ja: 'チップ額をビッグブラインドの何倍かで表示します', en: 'Show amounts as multiples of the big blind' },
  raisePresets: { ja: 'レイズ倍率（相手のベットの何倍か）', en: 'Raise sizes (× opponent bet)' },
  betPresets: { ja: 'ベット額（ポットの何%か）', en: 'Bet sizes (% of pot)' },
  resetDefaults: { ja: '初期設定に戻す', en: 'Reset to defaults' },
  languageLabel: { ja: '言語', en: 'Language' },
  useTimebank: { ja: '+30秒', en: '+30s' },
  seconds: { ja: '秒', en: 's' },
  outs: { ja: 'アウツ', en: 'Outs' },
  cardsUnit: { ja: '枚', en: '' },
  winRate: { ja: '勝率', en: 'Win rate' },
  period: { ja: '期間', en: 'Season' },
  updates: { ja: 'アップデート情報', en: 'Updates' },
  updatesNote: { ja: '最新情報はこのページで発信中。', en: 'Latest news is posted here.' },
  unread: { ja: '未読', en: 'New' },
  legalBoth: { ja: '利用規約・プライバシーポリシー', en: 'Terms & Privacy' },
  playerName: { ja: 'Player Name', en: 'Player Name' },
  userId: { ja: 'User ID', en: 'User ID' },
  copied: { ja: 'コピーしました', en: 'Copied' },
  loginMethod: { ja: 'ログイン', en: 'Sign-in' },
  playersOnline: { ja: '参加中のプレイヤー', en: 'Players online' },
  features: { ja: 'FEATURES', en: 'FEATURES' },
  more: { ja: 'もっと見る', en: 'See more' },
  featStats: { ja: 'プレイ成績、アクションスタッツ、収支グラフが表示されます。', en: 'Results, action stats and profit graphs.' },
  featLeaderboard: { ja: '全プレイヤーのランキングが表示されます。', en: 'Rankings of all players.' },
  featHistory: { ja: 'プレイしたハンドの履歴とリプレイが表示されます。', en: 'History and replays of your hands.' },
  featFriend: { ja: '合言葉で友達と対戦できます。', en: 'Play a friend with a passphrase.' },
  handsShown: { ja: 'ハンドを表示中', en: 'hands shown' },
  recentN: { ja: '直近', en: 'Last' },
  all: { ja: 'すべて', en: 'All' },
  bookmarks: { ja: 'ブックマーク', en: 'Bookmarks' },
  thisWeek: { ja: '今週', en: 'Week' },
  thisMonth: { ja: '今月', en: 'Month' },
  realProfit: { ja: '実収支', en: 'Profit' },
  totalHands: { ja: '総ハンド数', en: 'Total hands' },
  noHands: { ja: 'プレイされたハンドがありません。', en: 'No hands played yet.' },
  matchOver: { ja: '試合終了', en: 'Match over' },
  thisMatch: { ja: 'この試合', en: 'This match' },
  time: { ja: '時間', en: 'Time' },
  guestPlaying: { ja: 'ゲストで遊んでいます', en: 'Playing as guest' },
  aggregateTarget: { ja: '* 集計対象: 登録プレイヤー', en: '* Registered players only' },
  matchesUnit: { ja: '試合', en: 'matches' },
  winsLabel: { ja: '勝利数', en: 'Wins' },
  playAgain: { ja: 'もう一度', en: 'Play again' },
  tipVpip: { ja: 'プリフロップで自分からチップを入れた割合', en: 'How often you put money in preflop' },
  tipPfr: { ja: 'プリフロップでレイズした割合', en: 'How often you raised preflop' },
  tip3bet: { ja: '3ベットできる場面で3ベットした割合', en: '3-bet frequency when possible' },
  tipWinRate: { ja: '100ハンドあたりの収支（bb）', en: 'Profit per 100 hands (bb)' },
  tipEv: { ja: 'オールイン時の勝率で運の影響をならした収支', en: 'Profit adjusted by all-in equity' },
  fourColor: { ja: '4色デッキ', en: 'Four-color deck' },
  fourColorSub: { ja: '♣を緑、♦を青で表示します', en: 'Clubs in green, diamonds in blue' },
  stats: { ja: '成績', en: 'Stats' },
  statsAndHistory: { ja: '成績・ハンド履歴', en: 'Stats & hand history' },
  matches: { ja: '試合数', en: 'Matches' },
  matchWinRate: { ja: '試合勝率', en: 'Match win %' },
  hands: { ja: 'ハンド数', en: 'Hands' },
  profit: { ja: '収支', en: 'Profit' },
  profitEv: { ja: '収支（EV）', en: 'Profit (EV)' },
  winRateBb: { ja: 'bb/100', en: 'bb/100' },
  sd: { ja: 'SD', en: 'SD' },
  nsd: { ja: 'NSD', en: 'NSD' },
  sdLong: { ja: 'ショーダウンでの収支', en: 'Showdown winnings' },
  nsdLong: { ja: 'ショーダウンなしの収支', en: 'Non-showdown winnings' },
  ratingTrend: { ja: 'レート推移', en: 'Rating' },
  profitTrend: { ja: '収支グラフ', en: 'Profit graph' },
  noData: { ja: 'まだデータがありません', en: 'No data yet' },
  recentMatches: { ja: '最近の試合', en: 'Recent matches' },
  handHistory: { ja: 'ハンド履歴', en: 'Hand history' },
  replay: { ja: 'リプレイ', en: 'Replay' },
  prev: { ja: '前へ', en: 'Prev' },
  next: { ja: '次へ', en: 'Next' },
  autoplay: { ja: '自動再生', en: 'Auto' },
  stop: { ja: '停止', en: 'Stop' },
  close: { ja: '閉じる', en: 'Close' },
  vs: { ja: 'vs', en: 'vs' },
  statsNote: { ja: '成績はCPU戦を除いて集計しています', en: 'CPU matches are excluded' },
  evNote: { ja: 'EV: オールイン時の勝率で運の影響をならした収支', en: 'EV: profit adjusted by all-in equity' },
  tabRating: { ja: 'レート', en: 'Rating' },
  tabWeek: { ja: '今週の勝利数', en: 'Wins this week' },
  tabActWins: { ja: 'Actの勝利数', en: 'Act wins' },
  xAccount: { ja: 'X（旧Twitter）', en: 'X (Twitter)' },
  xPh: { ja: 'ユーザー名（@なし）', en: 'username (without @)' },
  noGambling: {
    ja: 'お金を賭ける要素は一切ありません。入金・換金はできません。',
    en: 'No real money involved. No deposits, no cash-outs.',
  },
  terms: { ja: '利用規約', en: 'Terms of Service' },
  privacy: { ja: 'プライバシーポリシー', en: 'Privacy Policy' },
  agreeTerms: { ja: '利用規約とプライバシーポリシーに同意する', en: 'I agree to the Terms and Privacy Policy' },
  agreeRequired: { ja: 'アカウント作成には同意が必要です', en: 'Please agree to continue' },
  guestAgree: {
    ja: '遊び始めると、利用規約とプライバシーポリシーに同意したものとみなされます。',
    en: 'By playing, you agree to the Terms and Privacy Policy.',
  },
  about: { ja: 'このアプリについて', en: 'About' },
  playNow: { ja: 'ゲストで今すぐ遊ぶ', en: 'Play now as guest' },
  haveAccount: { ja: 'アカウントを作成・ログイン', en: 'Sign up / Sign in' },
  faq: { ja: 'よくある質問', en: 'FAQ' },
  level: { ja: 'Lv', en: 'Lv' },
  nextLevel: { ja: '次のレベルまで', en: 'Next level' },
  timebank: { ja: 'タイムバンク', en: 'Time bank' },
  yourTurn: { ja: 'あなたの番です', en: 'Your turn' },
  thinking: { ja: '考え中…', en: 'Thinking…' },
  disconnected: { ja: '接続切れ', en: 'Offline' },
  surrender: { ja: '投了する', en: 'Resign' },
  surrenderConfirm: { ja: '投了すると負けになります。よろしいですか？', en: 'Resigning counts as a loss. Continue?' },
  win: { ja: '勝利', en: 'Victory' },
  lose: { ja: '敗北', en: 'Defeat' },
  toHome: { ja: 'ホームへ', en: 'Home' },
  again: { ja: 'もう一度', en: 'Play again' },
  reason_bust: { ja: '', en: '' },
  reason_forfeit: { ja: '投了による決着', en: 'By resignation' },
  reason_disconnect: { ja: '切断による決着', en: 'By disconnection' },
  unrated: { ja: 'レート変動なし', en: 'Unrated' },
  split: { ja: 'チョップ', en: 'Split pot' },
  wonPot: { ja: 'が獲得', en: 'wins' },
  you: { ja: 'あなた', en: 'You' },
  displayName: { ja: '表示名', en: 'Display name' },
  icon: { ja: 'アイコン', en: 'Icon' },
  save: { ja: '保存', en: 'Save' },
  saved: { ja: '保存しました', en: 'Saved' },
  account: { ja: 'アカウント', en: 'Account' },
  signedInAs: { ja: 'ログイン中', en: 'Signed in' },
  signOut: { ja: 'ログアウト', en: 'Sign out' },
  linkGoogle: { ja: 'Googleで作成', en: 'Continue with Google' },
  linkApple: { ja: 'Appleで作成', en: 'Continue with Apple' },
  linkEmail: { ja: 'メールで作成', en: 'Continue with email' },
  loginExisting: { ja: 'すでにアカウントをお持ちの方', en: 'Already have an account?' },
  loginGoogle: { ja: 'Googleでログイン', en: 'Sign in with Google' },
  loginApple: { ja: 'Appleでログイン', en: 'Sign in with Apple' },
  loginEmail: { ja: 'メールでログイン', en: 'Sign in with email' },
  emailPh: { ja: 'メールアドレス', en: 'Email address' },
  emailSent: { ja: 'メールを送信しました。届いたリンクを開いてください。', en: 'Check your inbox for the link.' },
  authDisabled: {
    ja: 'ログイン機能は準備中です（サーバー設定後に利用できます）。今はゲストとして遊べます。',
    en: 'Sign-in is not configured yet. You can play as a guest.',
  },
  keepRating: { ja: '今のレートと戦績はそのまま引き継がれます', en: 'Your current rating carries over' },
  rank: { ja: '位', en: '' },
  yourRank: { ja: 'あなたの順位', en: 'Your rank' },
  unranked: { ja: 'ランク外', en: 'Unranked' },
  noEntries: { ja: 'まだ誰もランクインしていません', en: 'No ranked players yet' },
  guestNotRanked: { ja: 'ゲストはランキングに掲載されません', en: 'Guests are not listed' },
  connecting: { ja: '接続中…', en: 'Connecting…' },
  otherTab: { ja: '別のタブで接続されたため切断しました', en: 'Opened in another tab' },
  language: { ja: 'English', en: '日本語' },
  highCard: { ja: 'ハイカード', en: 'High Card' },
  pair: { ja: 'ワンペア', en: 'Pair' },
  twoPair: { ja: 'ツーペア', en: 'Two Pair' },
  trips: { ja: 'スリーカード', en: 'Three of a Kind' },
  straight: { ja: 'ストレート', en: 'Straight' },
  flush: { ja: 'フラッシュ', en: 'Flush' },
  fullHouse: { ja: 'フルハウス', en: 'Full House' },
  quads: { ja: 'フォーカード', en: 'Four of a Kind' },
  straightFlush: { ja: 'ストレートフラッシュ', en: 'Straight Flush' },
} as const;

export type Key = keyof typeof dict;

const detect = (): Lang => {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return navigator.language.startsWith('ja') ? 'ja' : 'en';
};

let lang: Lang = detect();
const listeners = new Set<() => void>();

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem('lang', l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function useT() {
  const l = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => lang,
  );
  const t = (k: Key) => dict[k][l];
  return { t, lang: l };
}

export const fmt = (n: number) => n.toLocaleString('en-US');

const RANK_JA: Record<number, string> = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };
const RANK_EN_ONE: Record<number, string> = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two' };
const RANK_EN_MANY: Record<number, string> = { 14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos' };

/** 役名を具体的に（例: 「Jのワンペア」「Kと7のフルハウス」） */
export function handName(category: string, ranks: number[], l: Lang): string {
  const [a, b] = ranks;
  if (l === 'ja') {
    const r = (n: number) => RANK_JA[n] ?? String(n);
    switch (category) {
      case 'highCard': return `${r(a)}ハイ`;
      case 'pair': return `${r(a)}のワンペア`;
      case 'twoPair': return `${r(a)}と${r(b)}のツーペア`;
      case 'trips': return `${r(a)}のスリーカード`;
      case 'straight': return `${r(a)}ハイのストレート`;
      case 'flush': return `${r(a)}ハイのフラッシュ`;
      case 'fullHouse': return `${r(a)}と${r(b)}のフルハウス`;
      case 'quads': return `${r(a)}のフォーカード`;
      case 'straightFlush': return a === 14 ? 'ロイヤルフラッシュ' : `${r(a)}ハイのストレートフラッシュ`;
    }
  } else {
    const one = (n: number) => RANK_EN_ONE[n];
    const many = (n: number) => RANK_EN_MANY[n];
    switch (category) {
      case 'highCard': return `${one(a)} High`;
      case 'pair': return `Pair of ${many(a)}`;
      case 'twoPair': return `${many(a)} and ${many(b)}`;
      case 'trips': return `Three ${many(a)}`;
      case 'straight': return `${one(a)}-High Straight`;
      case 'flush': return `${one(a)}-High Flush`;
      case 'fullHouse': return `${many(a)} Full of ${many(b)}`;
      case 'quads': return `Four ${many(a)}`;
      case 'straightFlush': return a === 14 ? 'Royal Flush' : `${one(a)}-High Straight Flush`;
    }
  }
  return category;
}
