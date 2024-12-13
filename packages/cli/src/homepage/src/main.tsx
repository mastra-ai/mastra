import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import { Toaster } from './components/ui/sonner.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toaster position="bottom-right" />
    <App />
  </StrictMode>,
);
