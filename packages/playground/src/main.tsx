import { StrictMode } from 'react';

import '@/index.css';

import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';

if (import.meta.env.DEV && import.meta.env.VITE_REACT_GRAB === 'true') {
  void import('react-grab');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
