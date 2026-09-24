# 引き継ぎ（2026-09-25）

## 完了
- Phase 1 の MVP 一式（ランクマ / フレンドマッチ / CPU練習 / ランキング / プロフィール / オンライン人数 / 日英切替）
- エンジンのテスト14件合格、ブラウザで対人ランクマ・CPU・再接続を確認

## 残タスク（優先順）
1. Supabase プロジェクト作成 → `docs/setup/supabase.sql` 実行 → `.env` 設定 → Google/メール認証の実機確認
2. 本番公開先の決定（Render / Railway / Fly.io など WebSocket 対応ホスティング）
3. Git 初期化と GitHub リポジトリ作成
4. 同じ相手との連戦制限（レート稼ぎ対策）
5. Apple 認証（Apple Developer 登録が必要）
6. 3000人規模対応（複数サーバー化する場合は Redis 等で状態共有）

## 次回開始地点
- `npm run dev` → http://localhost:5173
