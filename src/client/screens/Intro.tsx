import { PlayingCard } from '../components/PlayingCard';
import { useT } from '../lib/i18n';
import { markIntroSeen } from '../lib/intro';
import { go } from '../lib/store';

const COPY = {
  ja: {
    hero: ['1対1で、', '実力を証明する。'],
    sub: 'ヘッズアップ専用のノーリミット・ホールデム。無料・登録なしで、ブラウザからすぐ対戦できます。',
    features: [
      { t: 'ランクマッチ', d: '90日ごとのActでレーティングを競う。上位1000人がランキングに載ります。' },
      { t: 'フレンドマッチ', d: '同じ合言葉を入れるだけで友達と対戦。レートは変動しません。' },
      { t: '勝率とアウツ', d: 'オールインになると勝率と逆転できるカードをその場で表示。' },
      { t: '成績とハンド履歴', d: '収支グラフ・VPIP/PFR・リプレイで、自分のプレイを振り返れます。' },
    ],
    rules: 'ルール: 持ち点 50,000 ／ 5分ごとにブラインド2倍 ／ 100-200（BBアンテ200）から',
    faq: [
      { q: '無料ですか？', a: 'すべて無料です。入金や換金の仕組みはなく、お金を賭けることは一切できません。' },
      { q: 'アプリのダウンロードは必要？', a: '不要です。スマホ・PCのブラウザで遊べます。ホーム画面に追加すると、アプリのように起動できます。' },
      { q: '登録しないとどうなりますか？', a: 'ゲストとしてすぐ遊べます。記録はそのブラウザにだけ保存され、後からアカウントを作ればレートを引き継げます。' },
      { q: 'ルールが分からなくても遊べる？', a: '役の名前やオールイン時の勝率を画面に表示するので、遊びながら覚えられます。CPUとの練習もできます。' },
    ],
  },
  en: {
    hero: ['One on one.', 'Prove your skill.'],
    sub: 'Heads-up No-Limit Hold\'em. Free, no sign-up — play right in your browser.',
    features: [
      { t: 'Ranked', d: 'Climb the rating ladder each 90-day Act. Top 1000 make the leaderboard.' },
      { t: 'Friend Match', d: 'Enter the same passphrase to play a friend. Unrated.' },
      { t: 'Equity & outs', d: 'See live win rates and outs whenever players are all-in.' },
      { t: 'Stats & history', d: 'Profit graphs, VPIP/PFR and hand replays to review your play.' },
    ],
    rules: 'Rules: 50,000 chips · blinds double every 5 min · from 100/200 (BB ante 200)',
    faq: [
      { q: 'Is it free?', a: 'Completely free. There are no deposits or cash-outs, and no real money can be wagered.' },
      { q: 'Do I need to download an app?', a: 'No. Play in any mobile or desktop browser, or add it to your home screen.' },
      { q: 'What if I don\'t sign up?', a: 'Play as a guest right away. Create an account later to keep your rating.' },
      { q: 'New to poker?', a: 'Hand names and all-in odds are shown on screen, and you can practice against the CPU.' },
    ],
  },
} as const;

export function Intro() {
  const { t, lang } = useT();
  const c = COPY[lang];
  const start = (to: 'home' | 'profile') => {
    markIntroSeen();
    go(to);
  };
  return (
    <div className="safe-top mx-auto flex min-h-full max-w-md flex-col px-5 pb-48">
      <header className="flex items-center justify-center py-3">
        <div className="flex items-center gap-2 text-[15px] font-bold tracking-[0.28em]">
          <span className="text-[var(--color-gold)]">♠</span>
          HEADS-UP
        </div>
      </header>

      <section className="rise mt-8">
        <h1 className="text-[40px] font-extrabold leading-[1.1] tracking-tight">
          {c.hero[0]}
          <br />
          <span className="text-[var(--color-gold)]">{c.hero[1]}</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/75">{c.sub}</p>
      </section>

      {/* 画面イメージ（実際のカード部品で表示） */}
      <section className="rise mt-8 rounded-2xl p-5 ring-1 ring-[#d9bf8c]/25" style={{ animationDelay: '80ms', background: 'radial-gradient(ellipse at 50% 40%, #3a2f73, #141236 80%)' }}>
        <div className="flex justify-center gap-1.5">
          {['Ah', 'Kd', '7h', '2c', 'Qh'].map((x, i) => (
            <PlayingCard key={x} card={x} size="board" delay={i * 90} glow={x === 'Ah' || x === '7h' || x === 'Qh'} />
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className="flex gap-1.5">
            <PlayingCard card="9h" size="md" glow />
            <PlayingCard card="4h" size="md" glow />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full bg-[#e9cf98] px-3 py-1 text-[13px] font-bold text-[#1a1408]">{lang === 'ja' ? 'Aハイのフラッシュ' : 'Ace-High Flush'}</span>
            <span className="rounded-xl bg-[#0d3a28] px-3 py-1 text-[18px] font-extrabold text-[var(--color-win)] ring-1 ring-[var(--color-win)]/60">87.5%</span>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3">
        {c.features.map((f, i) => (
          <div key={f.t} className="glass rise rounded-xl p-4" style={{ animationDelay: `${120 + i * 50}ms` }}>
            <div className="text-[15px] font-bold">{f.t}</div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-white/65">{f.d}</div>
          </div>
        ))}
      </section>

      <p className="mt-6 text-center text-[12px] text-white/50">{c.rules}</p>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('faq')}</h2>
        <div className="mt-3 flex flex-col gap-2">
          {c.faq.map((f) => (
            <details key={f.q} className="glass group rounded-xl px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[14.5px] font-semibold">
                {f.q}
                <span className="text-[var(--color-gold)] transition group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-8 rounded-xl bg-black/25 px-4 py-3 text-center text-[13px] font-semibold text-[#f3e3bd] ring-1 ring-[#d9bf8c]/25">{t('noGambling')}</p>

      <div className="mt-6 flex justify-center gap-4 text-[12px]">
        <button onClick={() => go('terms')} className="text-white/55 underline underline-offset-2">
          {t('terms')}
        </button>
        <button onClick={() => go('privacy')} className="text-white/55 underline underline-offset-2">
          {t('privacy')}
        </button>
      </div>

      {/* 画面下に固定の開始ボタン */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-[#0c0a1c] via-[#0c0a1c]/95 to-transparent px-5 pt-8">
        <button
          onClick={() => start('home')}
          className="w-full rounded-xl bg-[#f5f3ee] py-4 text-[17px] font-bold text-[#0c0a1c] transition active:scale-[.98]"
        >
          {t('playNow')}
        </button>
        <button onClick={() => start('profile')} className="mt-2 w-full py-2.5 text-[14px] font-medium text-[var(--color-gold)]">
          {t('haveAccount')}
        </button>
        <p className="pb-1 text-center text-[11px] leading-relaxed text-white/40">{t('guestAgree')}</p>
      </div>
    </div>
  );
}
