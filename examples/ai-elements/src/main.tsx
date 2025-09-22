import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { MastraClientProvider } from '@mastra/react-hooks';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MastraClientProvider>
      <App />
    </MastraClientProvider>
  </StrictMode>,
);
