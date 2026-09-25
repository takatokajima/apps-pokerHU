// スターティングハンドの強さ順位表を作り直す: npx tsx scripts/make-hand-ranks.ts
import { writeFileSync } from 'node:fs';
import { buildPercentiles } from '../src/server/game/bot';

const table = buildPercentiles();
const obj = Object.fromEntries([...table.entries()].map(([k, v]) => [k, Math.round(v * 1e5) / 1e5]));
writeFileSync('src/shared/handRanks.json', JSON.stringify(obj, null, 0) + '\n');
console.log('handRanks.json written:', Object.keys(obj).length, 'hands');
