import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'src/client',
  envDir: '../..',
  plugins: [react(), tailwindcss()],
  // オフライン版（CPU戦をブラウザ内で完結）: Vercel でのビルド時、または OFFLINE=1 のとき
  define: { __OFFLINE__: JSON.stringify(process.env.VERCEL === '1' || process.env.OFFLINE === '1') },
  build: { outDir: '../../dist', emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true }, '/api': 'http://localhost:3001' },
  },
});
