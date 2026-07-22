import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
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
import { ActiveFactoryProvider } from './domains/workspaces';

// The web app talks to the Mastra server same-origin (`baseUrl=""`): in prod
// the server serves this build itself, and in dev Vite proxies `/api` + `/auth`
// to :4111. The served index.html also carries `window.__MASTRACODE_CONFIG__`
// (injected by the server in prod, by the Vite plugin in dev) so the UI knows
// whether auth is enabled without probing `/auth/me`. A future React Native
// entry mounts the same providers with its own absolute base URL and fetch
// implementation.
const queryClient = createQueryClient();
const router = createAppRouter();

if (import.meta.env.DEV && import.meta.env.VITE_REACT_GRAB === 'true') {
  void import('react-grab');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="mastracode.theme">
      <TooltipProvider delayDuration={0}>
        <QueryClientProvider client={queryClient}>
          <ApiConfigProvider baseUrl="">
            <ActiveFactoryProvider>
              <RouterProvider router={router} />
              <Toaster position="bottom-right" />
            </ActiveFactoryProvider>
          </ApiConfigProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
