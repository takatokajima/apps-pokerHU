import { useT } from '../lib/i18n';
import { back } from '../lib/store';

// ※ 公開前に【】の部分を埋め、必要に応じて専門家の確認を受けること
type Doc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

const TERMS: Record<'ja' | 'en', Doc> = {
  ja: {
    title: '利用規約',
    updated: '制定日: 【2026年◯月◯日】',
    sections: [
      { h: '第1条（適用）', p: ['本規約は、【運営者名】（以下「運営者」）が提供する「HeadsUp Online」（以下「本サービス」）の利用条件を定めるものです。利用者は、本サービスを利用することで本規約に同意したものとみなされます。'] },
      {
        h: '第2条（本サービスの内容）',
        p: [
          '本サービスは、ノーリミット・テキサスホールデムの1対1対戦を無料で楽しめるゲームです。',
          '本サービスでは金銭その他の財産を賭けることはできません。チップ・レーティング・順位には財産的価値がなく、換金・譲渡・景品との交換はできません。',
        ],
      },
      {
        h: '第3条（アカウント）',
        p: [
          '利用者は、ゲストとして、またはメールアドレス・外部サービス（Google・Apple等）の認証を用いてアカウントを作成して本サービスを利用できます。',
          'ゲストの記録は利用者の端末のブラウザにのみ紐づきます。ブラウザのデータを削除した場合等に記録が失われても、運営者は責任を負いません。',
          '利用者は、自己の責任でアカウントを管理するものとします。',
        ],
      },
      {
        h: '第4条（禁止事項）',
        p: [
          '利用者は、以下の行為をしてはなりません。',
          '(1) 複数アカウントの作成・使用、他の利用者との共謀、意図的な負けによるレーティング操作',
          '(2) 自動プログラム（ボット）やリアルタイムの解析ツール等を用いたプレイ',
          '(3) 本サービスを利用した賭博その他金銭のやり取り',
          '(4) 他の利用者への嫌がらせ、不適切な表示名・リンクの登録',
          '(5) 本サービスの運営を妨げる行為、不正アクセス',
          '(6) 法令または公序良俗に反する行為',
        ],
      },
      { h: '第5条（レーティング・記録）', p: ['レーティングはアクトごとに運営者の定める方法で調整されます。運営者は、不正の疑いがある場合や運営上必要な場合、記録の修正・リセットを行うことがあります。'] },
      { h: '第6条（利用停止）', p: ['運営者は、利用者が本規約に違反した場合、事前の通知なく本サービスの利用停止・アカウント削除等の措置を行うことができます。'] },
      { h: '第7条（サービスの変更・停止）', p: ['運営者は、利用者への事前の通知なく、本サービスの内容を変更し、または提供を停止・終了することができます。'] },
      { h: '第8条（免責）', p: ['運営者は、本サービスに不具合・中断・データの消失が生じないことを保証しません。運営者の故意または重過失による場合を除き、本サービスの利用により利用者に生じた損害について責任を負いません。'] },
      { h: '第9条（規約の変更）', p: ['運営者は、必要に応じて本規約を変更できます。変更後に本サービスを利用した場合、変更後の規約に同意したものとみなされます。'] },
      { h: '第10条（準拠法・管轄）', p: ['本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、【運営者所在地を管轄する地方裁判所】を第一審の専属的合意管轄裁判所とします。'] },
      { h: 'お問い合わせ', p: ['【お問い合わせ先（メールアドレス等）】'] },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Effective: [Month Day, 2026]',
    sections: [
      { h: '1. Agreement', p: ['These terms govern your use of HeadsUp Online (the "Service") provided by [Operator]. By using the Service you agree to these terms.'] },
      { h: '2. The Service', p: ['The Service is a free heads-up No-Limit Hold\'em game. No real money can be wagered. Chips, ratings and rankings have no monetary value and cannot be exchanged, transferred or redeemed.'] },
      { h: '3. Accounts', p: ['You may play as a guest or create an account via email or third-party sign-in. Guest progress is tied to your browser and may be lost if browser data is cleared.'] },
      { h: '4. Prohibited conduct', p: ['Multi-accounting, collusion, rating manipulation, bots or real-time assistance tools, gambling, harassment, inappropriate names or links, disrupting the Service, and any unlawful activity are prohibited.'] },
      { h: '5. Ratings', p: ['Ratings are adjusted each Act as determined by the Operator. Records may be corrected or reset in case of suspected abuse or operational need.'] },
      { h: '6. Suspension', p: ['We may suspend or delete accounts that violate these terms without prior notice.'] },
      { h: '7. Changes and disclaimer', p: ['We may change or discontinue the Service at any time. The Service is provided as is, without warranty of uninterrupted operation or data retention.'] },
      { h: '8. Governing law', p: ['These terms are governed by the laws of Japan.'] },
      { h: 'Contact', p: ['[Contact email]'] },
    ],
  },
};

const PRIVACY: Record<'ja' | 'en', Doc> = {
  ja: {
    title: 'プライバシーポリシー',
    updated: '制定日: 【2026年◯月◯日】',
    sections: [
      {
        h: '1. 取得する情報',
        p: [
          '(1) アカウント情報: メールアドレス、外部サービス（Google・Apple）から提供される識別子',
          '(2) プロフィール情報: 表示名、アイコン、X（旧Twitter）のユーザー名（任意・他の利用者に公開されます）',
          '(3) プレイ情報: 対戦記録、ハンド履歴、レーティング、成績',
          '(4) 端末・通信情報: IPアドレス、ブラウザの種類、アクセス日時',
        ],
      },
      { h: '2. 利用目的', p: ['本サービスの提供・運営、対戦のマッチング、ランキング・成績の表示、不正行為の防止、お問い合わせへの対応、サービスの改善のために利用します。'] },
      {
        h: '3. 他の利用者への公開',
        p: ['表示名・アイコン・レーティング・順位・Xのユーザー名は、ランキングや対戦画面で他の利用者に表示されます。メールアドレスが他の利用者に公開されることはありません。'],
      },
      {
        h: '4. 第三者への提供・外部サービス',
        p: [
          '法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供しません。',
          '本サービスは、認証・データ保存のために Supabase を、ログインのために Google・Apple の認証機能を利用しています。これらの事業者は各社のプライバシーポリシーに従って情報を取り扱います。',
        ],
      },
      { h: '5. ブラウザへの保存', p: ['ゲストの識別子、表示設定（言語・BB表示・4色デッキ等）を端末のブラウザ（ローカルストレージ）に保存します。'] },
      { h: '6. 開示・削除', p: ['ご本人からの情報の開示・訂正・削除の請求には、本人確認のうえ対応します。下記お問い合わせ先までご連絡ください。'] },
      { h: '7. 改定', p: ['本ポリシーは必要に応じて改定します。重要な変更は本サービス内でお知らせします。'] },
      { h: 'お問い合わせ', p: ['【運営者名】', '【お問い合わせ先（メールアドレス等）】'] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Effective: [Month Day, 2026]',
    sections: [
      { h: '1. Information we collect', p: ['Account info (email, sign-in provider IDs), profile info (display name, icon, optional X username - shown publicly), play data (matches, hand histories, ratings, stats), and device/access logs (IP, browser, timestamps).'] },
      { h: '2. How we use it', p: ['To operate the Service, match players, show rankings and stats, prevent abuse, respond to inquiries and improve the Service.'] },
      { h: '3. What others see', p: ['Your display name, icon, rating, rank and X username are visible to other players. Your email is never shown to others.'] },
      { h: '4. Third parties', p: ['We do not share personal data without consent except as required by law. We use Supabase (authentication and storage) and Google/Apple sign-in, which process data under their own policies.'] },
      { h: '5. Browser storage', p: ['We store a guest identifier and display settings in your browser\'s local storage.'] },
      { h: '6. Your rights', p: ['Contact us to request access, correction or deletion of your data.'] },
      { h: 'Contact', p: ['[Operator] / [Contact email]'] },
    ],
  },
};

export function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const { t, lang } = useT();
  const doc = (kind === 'terms' ? TERMS : PRIVACY)[lang];
  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-5 pb-10">
      <header className="py-2">
        <button onClick={back} className="py-2 text-[15px] text-[var(--color-gold)]">
          ‹ {t('back')}
        </button>
      </header>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-[12px] text-[var(--color-mist)]">{doc.updated}</p>
      <div className="mt-6 flex flex-col gap-6">
        {doc.sections.map((sec) => (
          <section key={sec.h}>
            <h2 className="text-[15px] font-bold">{sec.h}</h2>
            {sec.p.map((line, i) => (
              <p key={i} className="mt-1.5 text-[13.5px] leading-relaxed text-white/80">
                {line}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
