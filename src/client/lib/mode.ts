import { actInfo } from '../../shared/rating';

/** オフライン版（サーバーなし・CPU戦のみ）かどうか */
export const OFFLINE: boolean = __OFFLINE__;

const ACT_EPOCH = '2026-09-01';

/** Act情報（オフライン版は端末で計算、通常はサーバーから取得） */
export async function fetchMeta(): Promise<{ act: number; startsAt: number; endsAt: number }> {
  if (OFFLINE) return actInfo(Date.now(), ACT_EPOCH);
  return fetch('/api/meta').then((r) => r.json());
}
