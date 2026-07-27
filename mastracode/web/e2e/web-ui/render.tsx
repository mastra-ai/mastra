import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, waitFor } from '@testing-library/react';
import type { RenderHookOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

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

function Wrapper({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="mastracode.theme">
      <TooltipProvider delayDuration={0}>
        <QueryClientProvider client={client}>
          <ApiConfigProvider baseUrl={TEST_BASE_URL}>{children}</ApiConfigProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

/** Render a component through the real Query + ApiConfig providers. */
export function renderWithProviders(ui: ReactElement, client: QueryClient = makeQueryClient()) {
  return {
    client,
    ...render(ui, { wrapper: ({ children }) => <Wrapper client={client}>{children}</Wrapper> }),
  };
}

/** Render a hook through the real Query + ApiConfig providers. */
export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'> & { client?: QueryClient },
) {
  const client = options?.client ?? makeQueryClient();
  return {
    client,
    ...renderHook(hook, {
      ...options,
      wrapper: ({ children }) => <Wrapper client={client}>{children}</Wrapper>,
    }),
  };
}

/**
 * Wait until every in-flight query + mutation in the cache has settled — and
 * stays settled. Query chains (session init → resource resolution → messages)
 * have brief idle gaps between links; a single idle sample can pass in such a
 * gap while a later link is about to remount the transcript subtree and
 * detach nodes the test already queried. Requiring two idle samples separated
 * by a macrotask delay rides out those gaps.
 */
export async function waitForMutationsIdle(client: QueryClient) {
  const assertIdle = () => {
    if (client.isMutating() > 0) throw new Error('mutations still pending');
    if (client.isFetching() > 0) throw new Error('queries still fetching');
  };
  await waitFor(async () => {
    assertIdle();
    await new Promise(resolve => setTimeout(resolve, 50));
    assertIdle();
  });
}
