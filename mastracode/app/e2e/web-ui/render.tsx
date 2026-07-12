import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, waitFor } from '@testing-library/react';
import type { RenderHookOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { createDesktopHost, WEB_HOST } from '../../src/host';
import type { MastraCodeHost } from '../../src/host';
import { MastraCodeHostProvider } from '../../src/host-context';
import { ApiConfigProvider } from '../../src/shared/api/config';

/**
 * Base URL every test stubs against. `src/shared` is platform-agnostic and
 * takes the base URL via injection, so tests point it at an absolute origin
 * that MSW intercepts (the web app injects `''` for same-origin requests).
 */
export const TEST_BASE_URL = 'http://localhost:4111';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function activeTestHost(): MastraCodeHost {
  return window.mastracodeDesktop ? createDesktopHost(window.mastracodeDesktop) : WEB_HOST;
}

function Wrapper({ client, host, children }: { client: QueryClient; host: MastraCodeHost; children: ReactNode }) {
  return (
    <MastraCodeHostProvider host={host}>
      <ThemeProvider defaultTheme="dark" storageKey="mastracode.theme">
        <TooltipProvider delayDuration={0}>
          <QueryClientProvider client={client}>
            <ApiConfigProvider baseUrl={TEST_BASE_URL}>{children}</ApiConfigProvider>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    </MastraCodeHostProvider>
  );
}

/** Render a component through the real Query + ApiConfig providers. */
export function renderWithProviders(ui: ReactElement, client: QueryClient = makeQueryClient()) {
  const host = activeTestHost();
  return {
    client,
    ...render(ui, {
      wrapper: ({ children }) => (
        <Wrapper client={client} host={host}>
          {children}
        </Wrapper>
      ),
    }),
  };
}

/** Render a hook through the real Query + ApiConfig providers. */
export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'> & { client?: QueryClient },
) {
  const client = options?.client ?? makeQueryClient();
  const host = activeTestHost();
  return {
    client,
    ...renderHook(hook, {
      ...options,
      wrapper: ({ children }) => (
        <Wrapper client={client} host={host}>
          {children}
        </Wrapper>
      ),
    }),
  };
}

/** Wait until every in-flight query + mutation in the cache has settled. */
export async function waitForMutationsIdle(client: QueryClient) {
  await waitFor(() => {
    if (client.isMutating() > 0) throw new Error('mutations still pending');
    if (client.isFetching() > 0) throw new Error('queries still fetching');
  });
}
