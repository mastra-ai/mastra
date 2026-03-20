import { ErrorBoundary } from '@mastra/playground-ui';
import { StrictMode } from 'react';

import '@/index.css';

import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
