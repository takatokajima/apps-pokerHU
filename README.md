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
