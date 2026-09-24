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
