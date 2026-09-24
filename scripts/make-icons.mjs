// アイコンPNGを生成: node scripts/make-icons.mjs
import sharp from 'sharp';
const svg = 'scripts/icon.svg';
const out = 'src/client/public/icons';
for (const size of [192, 512]) await sharp(svg).resize(size, size).png().toFile(`${out}/icon-${size}.png`);
await sharp(svg).resize(180, 180).png().toFile(`${out}/apple-touch-icon.png`);
console.log('icons generated');
