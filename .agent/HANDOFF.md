# 引き継ぎ（2026-09-26 更新）

## 完了
- main に取り込み済み（PR #1〜#5）: MVP、Ten-Four 参考の機能・UI、CPU（JACK/QUEEN/KING）、PWA、Vercel 用オフライン版
- Vercel 公開済み: https://pokerapps.vercel.app （CLI の `vercel --prod --yes` で手動デプロイ。GitHub 自動連携は未設定）
- 背の低い画面（ブラウザ表示のスマホ）向けにテーブルを詰める（short/tiny 表示 + 自動縮小）
- ホームを「ランクマ（レート・ランキング・CPU を同じ枠）」と「フレンドマッチ（合言葉入力つき別枠）」に分割
- オフライン版でもフレンドマッチを解放: スマホ同士を直接つなぐ P2P（PeerJS。先に入室した端末が試合を進行）

## 残タスク（優先順）
1. フレンドマッチを実機2台（別回線含む）で確認。つながらない回線があれば TURN（中継）を自前で用意する
2. 公開URLでスマホ実機の動作・PWA を確認
3. ランクマッチの公開方法を決める（Render にサーバー等）。P2P はランクマには不向き（不正対策できない）
4. 規約・ポリシーの【】部分の記入 / Supabase 設定 / 連戦制限・Apple 認証

## 次回開始地点
- ローカル: `npm run dev` → http://localhost:5173（サーバー版）
- オフライン版の確認: `OFFLINE=1 npm run build` → `npx vite preview --port 4173`
