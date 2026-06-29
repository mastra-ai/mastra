import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ApiConfigProvider } from '../../shared/api/config';
import { createQueryClient } from '../../shared/query-client';
import App from './App';
import './styles.css';
import { ToastProvider } from './toast';

// The web app talks to the Mastra server same-origin (Vite proxies `/api`), so
// it injects an empty base URL. A future React Native entry mounts the same
// providers with its own absolute base URL and fetch implementation.
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiConfigProvider baseUrl="">
        <ToastProvider>
          <App />
        </ToastProvider>
      </ApiConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
);
