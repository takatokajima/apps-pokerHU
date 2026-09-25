# 引き継ぎ（2026-09-25 更新）

## 完了
- main に取り込み済み（PR #1, #2）: MVP、Ten-Four 参考の機能・UI、CPU（JACK/QUEEN/KING）、PWA、Vercel 用オフライン版
- Vercel 公開済み（2026-09-26）: https://pokerapps.vercel.app （CLI の `vercel --prod` で手動デプロイ。GitHub 自動連携は未設定）

## 残タスク（優先順）
1. 公開URLでスマホ実機の動作・PWA（ホーム画面に追加）を確認。必要なら Vercel ダッシュボードで GitHub 連携（push で自動デプロイ）
2. 対人戦の公開方法を決める（Render にサーバー / Supabase Realtime へ作り替え）
3. 規約・ポリシーの【】部分の記入
4. Supabase 設定（ログイン・記録の保存）
5. 同じ相手との連戦制限、Apple 認証

## 次回開始地点
- ローカル: `npm run dev` → http://localhost:5173（サーバー版）
- オフライン版の確認: `OFFLINE=1 npx vite build` → `npx vite preview --port 4173`
