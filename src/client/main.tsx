import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAuth } from './lib/auth';
import { connect } from './lib/store';
import './styles.css';

initAuth()
  .catch((e) => console.error('auth init failed', e))
  .finally(connect);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: 本番ビルドのみサービスワーカーを登録（開発中はキャッシュで古い画面が出ないように）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.error('SW registration failed', e));
  });
}
