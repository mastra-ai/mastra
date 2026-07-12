import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import type { MastraCodeHost } from './host';
import { MastraCodeHostProvider } from './host-context';
import { ApiConfigProvider } from './shared/api/config';
import { createQueryClient } from './shared/query-client';
import { createAppRouter } from './ui/router';
import '@mastra/playground-ui/style.css';
import './ui/tailwind.css';
import { ToastProvider } from './ui/ui/toast';

export interface MountMastraCodeAppOptions {
  element: HTMLElement;
  host: MastraCodeHost;
  baseUrl?: string;
}

export function mountMastraCodeApp({ element, host, baseUrl = '' }: MountMastraCodeAppOptions): Root {
  const queryClient = createQueryClient();
  const router = createAppRouter();
  const root = createRoot(element);

  root.render(
    <StrictMode>
      <MastraCodeHostProvider host={host}>
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
      </MastraCodeHostProvider>
    </StrictMode>,
  );

  return root;
}
