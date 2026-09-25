# HeadsUp Online

スマホのブラウザで遊べる、ヘッズアップ（1対1）ノーリミットホールデム。

## 起動（ローカル）
```
npm install
npm run dev
```
http://localhost:5173 を開く。同じWi-FiのスマホからはPCのIPアドレス:5173 でアクセス可能。

## ログイン機能を有効にする（Supabase）
1. https://supabase.com でプロジェクトを作成
2. SQL Editor で `docs/setup/supabase.sql` を実行
3. Authentication → Providers で **Anonymous**・**Email**・**Google**（・Apple）を有効化
4. Authentication → Settings で **Manual linking** を有効化（ゲスト→アカウント引き継ぎに必要）
5. `.env.example` をコピーして `.env` を作り、Project Settings → API の値を入れる

## 本番
```
npm run build
npm start
```

## インターネットに公開する（Render・無料）
GitHub Pages は画面ファイルを配るだけなので、対戦サーバーが必要なこのアプリは動かせません。
Render の無料プランなら、GitHub と連携してプッシュのたびに自動で公開されます。

1. https://render.com に GitHub アカウントでサインアップ
2. ダッシュボードの「New +」→「Blueprint」→ このリポジトリを選ぶ（`render.yaml` が読み込まれる）
3. 「Apply」で作成。数分で `https://headsup-online-xxxx.onrender.com` のような URL で公開される

注意（無料プラン）
- 15分アクセスがないと停止し、次のアクセス時の起動に30秒〜1分かかる
- データベース未設定の間は全員ゲスト扱い。サーバーの再起動・再デプロイで記録（レート・履歴）は消える
- ログインや記録を残したくなったら Supabase を設定する（上の手順）
