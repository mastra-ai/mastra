import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { ApiConfigProvider } from '../../shared/api/config';
import { createQueryClient } from '../../shared/query-client';
import { createAppRouter } from './router';
import '@mastra/playground-ui/style.css';
import './tailwind.css';
import { ToastProvider } from './ui';

// The web app talks to the Mastra server same-origin (Vite proxies `/api`), so
// it injects an empty base URL. A future React Native entry mounts the same
// providers with its own absolute base URL and fetch implementation.
const baseUrl = '';
const queryClient = createQueryClient();
const router = createAppRouter(queryClient, baseUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="mastracode.theme">
      <TooltipProvider delayDuration={0}>
        <QueryClientProvider client={queryClient}>
          <ApiConfigProvider baseUrl={baseUrl}>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </ApiConfigProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
