import { useState, type ReactNode } from 'react';
import { Avatar } from '../components/Avatar';
import { LineChart } from '../components/LineChart';
import { MiniCard, PlayingCard } from '../components/PlayingCard';
import { setLang, useT } from '../lib/i18n';
import { markIntroSeen } from '../lib/intro';
import { go } from '../lib/store';

/** キーワードの下に蛍光ペンのような色を敷く */
function Mark({ children }: { children: ReactNode }) {
  return <span className="bg-[linear-gradient(transparent_55%,rgba(31,154,88,.85)_55%)] px-0.5">{children}</span>;
}

const COPY = {
  ja: {
    hero: [
      <>
        ポーカーの<Mark>ヘッズアップ</Mark>で<Mark>実力</Mark>を競う
      </>,
      <>
        正真正銘、<Mark>最強</Mark>たちの戦い
      </>,
      <>
        無料で対戦。賭けるのは<Mark>プライド</Mark>だけ
      </>,
    ],
    start: '今すぐ遊ぶ（登録不要）',
    account: 'アカウントを作成・ログイン',
    disclaimer: '当サイトでは一切の賭博行為を行うことはできません。安心してご利用ください。',
    sections: [
      {
        label: 'HEADS-UP RANKED',
        title: '1対1で、レートを奪い合う。',
        body: '勝てば上がり、負ければ下がる。相手との実力差でレートの増減が決まる、ヘッズアップだけのランクマッチ。90日ごとのActで頂点を目指す。',
      },
      {
        label: 'EQUITY & OUTS',
        title: '勝負の行方が、その場で分かる。',
        body: 'オールインになると、お互いの勝率と逆転できるカード（アウツ）をリアルタイムに表示。一枚ごとに揺れ動く勝率に、手に汗握る。',
      },
      {
        label: 'STATS & HAND HISTORY',
        title: '白熱した対戦を振り返る。',
        body: '収支グラフ・オールインEV・VPIP/PFR/3Betを自動で集計。すべてのハンドをリプレイで見返して、次の一戦に活かせる。',
      },
      {
        label: 'LEADERBOARD',
        title: '実力を競い合う。',
        body: 'Actごとのレートランキング上位1000人を掲載。今週の勝利数ランキングも。自分の名前を刻め。',
      },
      {
        label: 'FRIEND MATCH',
        title: '合言葉ひとつで、友達と。',
        body: '同じ合言葉を入れるだけで、すぐに対戦開始。レートは変動しないので、気軽に腕試し。',
      },
    ],
    faqTitle: 'よくある質問',
    faq: [
      { q: 'HeadsUp Online はどんなポーカーアプリですか？', a: 'ノーリミット・テキサスホールデムの1対1（ヘッズアップ）専用の対戦アプリです。持ち点50,000・3分ごとにブラインドが上がるトーナメント形式で、どちらかの持ち点がなくなるまで戦います。' },
      { q: '無料で遊べますか？', a: '無料で遊べます。入金・換金の仕組みはなく、実際のお金を賭けることは一切ありません。' },
      { q: 'スマホやPCで遊べますか？ダウンロードは必要ですか？', a: 'スマホ・タブレット・PCのブラウザで遊べます。ダウンロードは不要で、ホーム画面に追加するとアプリのように起動できます。' },
      { q: '登録しなくても遊べますか？', a: 'ゲストとしてすぐ遊べます。記録はそのブラウザにだけ保存され、あとからアカウントを作るとレートを引き継げます。' },
      { q: '対戦相手がいないときは？', a: 'マッチングを20秒待つと、CPU（JACK・QUEEN・KING の3段階）と練習できます。CPU戦はレートに影響しません。' },
    ],
  },
  en: {
    hero: [
      <>
        Prove your <Mark>skill</Mark> in <Mark>heads-up</Mark> poker
      </>,
      <>
        The real battle of the <Mark>strongest</Mark>
      </>,
      <>
        Free to play. Only your <Mark>pride</Mark> is at stake
      </>,
    ],
    start: 'Play now (no sign-up)',
    account: 'Sign up / Sign in',
    disclaimer: 'No gambling of any kind is possible on this site.',
    sections: [
      { label: 'HEADS-UP RANKED', title: 'One on one. Take their rating.', body: 'Win and climb, lose and fall — rating changes depend on the skill gap. Reach the top of each 90-day Act.' },
      { label: 'EQUITY & OUTS', title: 'See the odds as they happen.', body: 'When players are all-in, live win rates and outs appear on every card.' },
      { label: 'STATS & HAND HISTORY', title: 'Relive every heated battle.', body: 'Profit graphs, all-in EV, VPIP/PFR/3Bet — plus replays of every hand.' },
      { label: 'LEADERBOARD', title: 'Compete on skill.', body: 'Top 1000 by rating each Act, plus weekly wins.' },
      { label: 'FRIEND MATCH', title: 'Just share a passphrase.', body: 'Enter the same passphrase and play instantly. Unrated.' },
    ],
    faqTitle: 'FAQ',
    faq: [
      { q: 'What is HeadsUp Online?', a: 'A heads-up only No-Limit Hold\'em game: 50,000 chips, blinds up every 3 minutes, play until one player is out.' },
      { q: 'Is it free?', a: 'Yes. There are no deposits or cash-outs, and no real money is involved.' },
      { q: 'Which devices? Download needed?', a: 'Any mobile or desktop browser. No download — add it to your home screen to launch like an app.' },
      { q: 'Can I play without signing up?', a: 'Yes, as a guest. Create an account later to keep your rating.' },
      { q: 'No opponents online?', a: 'After 20 seconds in the queue you can practice against the CPU (JACK / QUEEN / KING). Unrated.' },
    ],
  },
} as const;

// ---- 画面イメージ（実際の部品で組んだ見本） ----

/** スマホの枠 */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[236px] rounded-[34px] bg-[#05040c] p-[7px] shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/15">
      <div className="relative h-[470px] overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#16112e,#0c0a1c_60%,#080b1c)]">{children}</div>
    </div>
  );
}

function Plate({ name, stack, pos, active }: { name: string; stack: string; pos: string; active?: boolean }) {
  return (
    <div className={`rounded-md bg-[#0b0a18] px-2.5 py-1 text-center ${active ? 'ring-2 ring-[var(--color-win)] shadow-[0_0_12px_rgba(52,210,123,.5)]' : 'ring-1 ring-[#c4b8ff]/20'}`}>
      <div className="text-[10px] font-bold">{name}</div>
      <div className="flex items-center justify-center gap-1">
        <span className="rounded-[3px] bg-[#1f9a58] px-1 text-[8px] font-black leading-[12px]">{pos}</span>
        <span className="text-[11px] font-bold tabular-nums">{stack}</span>
      </div>
    </div>
  );
}

function HeroMock() {
  return (
    <Phone>
      <div className="absolute inset-x-3 top-[70px] bottom-[150px]">
        <div className="table-stage" style={{ inset: 0 }}>
          <div className="poker-table" />
        </div>
      </div>
      <div className="relative flex flex-col items-center pt-5">
        <div className="flex gap-0.5">
          <PlayingCard card={null} size="sm" />
          <PlayingCard card={null} size="sm" />
        </div>
        <div className="mt-0.5">
          <Plate name="Rival" stack="92 BB" pos="SB" />
        </div>
        <div className="mt-8 text-[10px] font-bold text-[var(--color-mist)]">
          ポット <span className="text-[13px] text-white">32.5 BB</span>
        </div>
        <div className="mt-2 flex gap-1">
          {['Qh', '8s', '3s', '7d', '2s'].map((c) => (
            <PlayingCard key={c} card={c} size="sm" />
          ))}
        </div>
        <div className="mt-6 flex gap-1">
          <PlayingCard card="As" size="sm" glow />
          <PlayingCard card="Ks" size="sm" glow />
        </div>
        <div className="mt-0.5">
          <Plate name="あなた" stack="92 BB" pos="BB" active />
        </div>
      </div>
      <div className="absolute inset-x-2.5 bottom-3 flex flex-col gap-1.5">
        <div className="flex gap-1">
          {['33%', '50%', '75%', '100%'].map((x) => (
            <span key={x} className="flex-1 rounded-md bg-[#2e2a4d] py-1.5 text-center text-[9px] font-bold">
              {x}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <span className="rounded-md bg-[#2e2a4d] py-2.5 text-center text-[10px] font-bold">フォールド</span>
          <span className="rounded-md bg-[#22a55e] py-2.5 text-center text-[10px] font-bold">チェック</span>
          <span className="rounded-md bg-[#e5484d] py-2.5 text-center text-[10px] font-bold">ベット 75%</span>
        </div>
      </div>
    </Phone>
  );
}

function RankedMock() {
  const row = (name: string, avatar: string, rating: string, delta: string, win: boolean) => (
    <div className="flex items-center gap-3 rounded-xl bg-[#0b0a18] px-4 py-3 ring-1 ring-[#c4b8ff]/20">
      <Avatar id={avatar} size={36} />
      <div className="flex-1 text-[14px] font-bold">{name}</div>
      <div className="text-right">
        <div className="text-[18px] font-black text-[var(--color-gold)] tabular-nums">{rating}</div>
        <div className={`text-[12px] font-bold tabular-nums ${win ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'}`}>{delta}</div>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      {row('Rival', 'knight', '1,742', '−32', false)}
      <div className="text-center text-[16px] font-black tracking-widest text-[var(--color-mist)]">VS</div>
      {row('あなた', 'crown', '1,688', '+32', true)}
    </div>
  );
}

function OddsMock() {
  return (
    <div className="rounded-2xl p-4 ring-1 ring-[#c4b8ff]/15" style={{ background: 'radial-gradient(ellipse at 50% 40%, #3a3072, #1c1944 80%)' }}>
      <div className="flex justify-center gap-1">
        {['Ah', '7h', '2c', 'Kd'].map((c) => (
          <PlayingCard key={c} card={c} size="md" />
        ))}
        <div className="h-[68px] w-12 rounded-[6px] bg-white/[.06]" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1">
          <PlayingCard card="9h" size="sm" />
          <PlayingCard card="8h" size="sm" />
        </div>
        <span className="rounded-lg bg-[#3a1614] px-2.5 py-1 text-[15px] font-extrabold text-[var(--color-lose)] ring-1 ring-[var(--color-lose)]/50">
          20.5% <span className="text-[11px] text-white">アウツ 9枚</span>
        </span>
      </div>
      {/* 残り44枚のうち逆転できる9枚（ハート） → 9 / 44 ≒ 20.5% */}
      <div className="mt-2 flex justify-center gap-0.5 rounded-lg bg-[#0b0a18]/85 p-1">
        {['Kh', 'Qh', 'Jh', 'Th', '6h', '5h', '4h', '3h', '2h'].map((c) => (
          <MiniCard key={c} card={c} />
        ))}
      </div>
    </div>
  );
}

function StatsMock() {
  // 見本用のなめらかな推移
  const n = 60;
  const net = Array.from({ length: n }, (_, i) => Math.round((Math.sin(i / 6) * 18 + i * 2.2) * 10) / 10);
  const ev = net.map((v, i) => Math.round((v + Math.sin(i / 4) * 9 - 4) * 10) / 10);
  return (
    <div className="rounded-2xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/15">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['収支', '+131.2bb', 'text-[var(--color-win)]'],
          ['VPIP', '68%', ''],
          ['3Bet', '14%', ''],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-lg bg-black/25 py-2">
            <div className="text-[10px] text-[var(--color-mist)]">{k}</div>
            <div className={`text-[15px] font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="pointer-events-none mt-2">
        <LineChart
          zeroLine
          xLabel={(i) => `${i + 1}`}
          series={[
            { key: 'net', label: '収支', color: '#3987e5', values: net },
            { key: 'ev', label: 'EV', color: '#d95926', values: ev },
          ]}
        />
      </div>
    </div>
  );
}

function LeaderboardMock() {
  const rows = [
    ['Ace', 'crown', '3,412'],
    ['Nightowl', 'moon', '3,288'],
    ['River_K', 'gem', '3,105'],
    ['Bluffer', 'bolt', '2,987'],
    ['Suited', 'heart', '2,940'],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(([name, av, r], i) => (
        <div key={name} className="flex items-center gap-3 rounded-lg bg-[#1e1a3a] px-3 py-2.5">
          <span className={`w-6 text-center text-[15px] font-black ${i < 3 ? 'text-[var(--color-win)]' : 'text-[var(--color-mist)]'}`}>{i + 1}</span>
          <Avatar id={av} size={26} />
          <span className="flex-1 text-[14px] font-bold">{name}</span>
          <span className="text-[15px] font-black text-[var(--color-gold)] tabular-nums">{r}</span>
        </div>
      ))}
    </div>
  );
}

function FriendMock() {
  return (
    <div className="rounded-2xl bg-[#15122b] p-4 ring-1 ring-[#c4b8ff]/15">
      <div className="text-[11px] font-bold tracking-[.2em] text-[var(--color-mist)]">合言葉</div>
      <div className="mt-2 rounded-lg bg-[#0b0a18] px-4 py-3 text-[18px] font-bold ring-1 ring-[#c4b8ff]/25">さくら2026</div>
      <div className="mt-3 rounded-lg bg-white py-3 text-center text-[15px] font-bold text-[#0c0a1c]">入室する</div>
    </div>
  );
}

const MOCKS = [RankedMock, OddsMock, StatsMock, LeaderboardMock, FriendMock];

export function Intro() {
  const { t, lang } = useT();
  const c = COPY[lang];
  const [agreed, setAgreed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const start = (to: 'home' | 'profile') => {
    if (!agreed) return;
    markIntroSeen();
    go(to);
  };

  // 規約への同意 → 開始ボタン（Ten-Four と同じ流れ）
  const cta = (
    <div className="flex flex-col items-center">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-[#1f9a58]" aria-label={t('agreeTerms')} />
        <span>
          <button type="button" onClick={() => go('terms')} className="text-[#6fd6a0] underline underline-offset-2">
            {lang === 'ja' ? '利用規約' : 'Terms'}
          </button>
          ・
          <button type="button" onClick={() => go('privacy')} className="text-[#6fd6a0] underline underline-offset-2">
            {lang === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}
          </button>
          {lang === 'ja' ? 'に同意する' : ''}
        </span>
      </label>
      <button
        onClick={() => start('home')}
        disabled={!agreed}
        className="mt-4 w-full rounded-lg bg-[#22a55e] py-3.5 text-[16px] font-bold text-white transition active:scale-[.98] disabled:bg-[#2e2a4d] disabled:text-white/40"
      >
        {c.start}
      </button>
      <button onClick={() => start('profile')} disabled={!agreed} className="mt-2 py-2 text-[14px] font-bold text-[var(--color-mist)] disabled:opacity-40">
        {c.account}
      </button>
      <p className="mt-2 text-center text-[11px] text-white/45">{c.disclaimer}</p>
    </div>
  );

  return (
    <div className="safe-top safe-bottom mx-auto min-h-full max-w-md px-5 pb-12">
      {/* ヘッダー: 中央にロゴ、右に言語切り替え */}
      <header className="relative flex items-center justify-center py-3">
        <div className="text-center">
          <div className="text-[20px] font-black tracking-[0.12em]">
            <span className="text-[var(--color-gold)]">♠</span> HEADS-UP
          </div>
          <div className="mt-0.5 text-[9px] font-bold tracking-[.4em] text-[var(--color-mist)]">ONLINE</div>
        </div>
        <button onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')} className="absolute right-0 rounded-md px-2 py-1 text-[12px] font-bold text-[var(--color-mist)]">
          {lang === 'ja' ? '日本語' : 'English'} ▾
        </button>
      </header>

      {/* ファーストビュー */}
      <section className="rise mt-6">
        <HeroMock />
        <div className="mt-8 flex flex-col items-center gap-3 text-center text-[18px] font-black leading-snug">
          {c.hero.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <div className="mt-8">{cta}</div>
        <div className="mt-6 text-center text-[20px] text-[var(--color-mist)]" aria-hidden>
          ⌄
        </div>
      </section>

      {/* 機能紹介 */}
      {c.sections.map((s, i) => {
        const M = MOCKS[i];
        return (
          <section key={s.label} className="mt-16">
            <div className="text-[11px] font-black tracking-[.25em] text-[#6fd6a0]">{s.label}</div>
            <h2 className="mt-2 text-[21px] font-black leading-snug [text-wrap:balance]">{s.title}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-white/75">{s.body}</p>
            <div className="mt-6">
              <M />
            </div>
          </section>
        );
      })}

      {/* よくある質問 */}
      <section className="mt-16">
        <h2 className="text-center text-[22px] font-black">{c.faqTitle}</h2>
        <div className="mt-5 flex flex-col divide-y divide-white/10 rounded-xl bg-[#15122b] ring-1 ring-[#c4b8ff]/15">
          {c.faq.map((f, i) => (
            <div key={f.q}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-[14px] font-bold">
                {f.q}
                <span className={`shrink-0 text-[var(--color-mist)] transition ${openFaq === i ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              {openFaq === i && <p className="px-4 pb-4 text-[13px] leading-relaxed text-white/70">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* 最後にもう一度 */}
      <section className="mt-14">{cta}</section>
      <p className="mt-10 text-center text-[11px] text-white/35">© HeadsUp Online · {t('noGambling')}</p>
    </div>
  );
}
