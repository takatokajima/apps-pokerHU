# HeadsUp Online（プロジェクト差分）

- ヘッズアップ専用 NLHE の Web アプリ（スマホブラウザ優先）
- 構成: `src/server`（Node + Express + Socket.IO、ゲーム進行はサーバー側で管理）/ `src/client`（React + Vite + Tailwind v4）/ `src/shared`（ルール・型・役判定・レート計算）
- ルール値は `src/shared/config.ts`、レート計算は `src/shared/rating.ts` に集約
- 開発起動: `npm run dev`（client: 5173 / server: 3001 固定）。テスト: `npm test`
- Supabase 未設定時はゲストのみ・`data/users.json` に保存（ローカル開発用）
- 4ステップ（調査〜タスク化）はユーザー判断で省略し、走りながら作る方針（2026-09-25）
