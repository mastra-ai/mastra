import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderHookOptions, RenderHookResult, RenderOptions, RenderResult } from '@testing-library/react';
import { render, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { expect } from 'vitest';

/**
 * Shared test rendering helpers for the playground package.
 *
 * Every helper drives the real `@mastra/client-js` + React Query stack through
 * `MastraReactProvider` + `QueryClientProvider`, matching the MSW testing
 * strategy (see the `playground-msw-tests` skill). Mock only the network.
 *
 * jsdom is the default Vitest environment and `globals: true` enables React
 * Testing Library's automatic `afterEach(cleanup)`, so tests do not need a
 * per-file `// @vitest-environment jsdom` pragma or a manual `cleanup()` call.
 */

export const TEST_BASE_URL = 'http://localhost:4111';

export interface ProvidersOptions {
  /** Base URL handed to `MastraReactProvider`; must match MSW handler URLs. */
  baseUrl?: string;
  /** Wrap children in a `MemoryRouter`. Pass entries to seed the history/state. */
  router?: boolean | { initialEntries?: MemoryRouterEntry[] };
}

type MemoryRouterEntry = string | { pathname: string; state?: unknown };

const makeQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Builds a wrapper component plus the `QueryClient` backing it, so a test can
 * wait for in-flight queries/mutations to settle via {@link waitForMutationsIdle}.
 */
export const makeWrapper = (options: ProvidersOptions = {}) => {
  const { baseUrl = TEST_BASE_URL, router } = options;
  const queryClient = makeQueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => {
    const tree = (
      <MastraReactProvider baseUrl={baseUrl}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MastraReactProvider>
    );

    if (!router) {
      return tree;
    }

    const initialEntries = typeof router === 'object' ? router.initialEntries : undefined;
    return <MemoryRouter initialEntries={initialEntries}>{tree}</MemoryRouter>;
  };

  return { wrapper, queryClient };
};

/** Renders UI inside the real provider stack and returns the `QueryClient`. */
export const renderWithProviders = (
  ui: ReactElement,
  options: ProvidersOptions & Omit<RenderOptions, 'wrapper'> = {},
): RenderResult & { queryClient: QueryClient } => {
  const { baseUrl, router, ...renderOptions } = options;
  const { wrapper, queryClient } = makeWrapper({ baseUrl, router });
  return { ...render(ui, { ...renderOptions, wrapper }), queryClient };
};

/** Renders a hook inside the real provider stack and returns the `QueryClient`. */
export const renderHookWithProviders = <Result, Props>(
  callback: (props: Props) => Result,
  options: ProvidersOptions & Omit<RenderHookOptions<Props>, 'wrapper'> = {},
): RenderHookResult<Result, Props> & { queryClient: QueryClient } => {
  const { baseUrl, router, ...hookOptions } = options;
  const { wrapper, queryClient } = makeWrapper({ baseUrl, router });
  return { ...renderHook(callback, { ...hookOptions, wrapper }), queryClient };
};

/**
 * Waits until every React Query query and mutation has settled.
 *
 * This flushes trailing state updates (e.g. an internal best-effort mutation
 * resolving after the observed one) inside React Testing Library's act-wrapped
 * `waitFor`, preventing post-test "not wrapped in act(...)" warnings and the
 * deferred-timer leaks they cause once the jsdom `window` is torn down.
 */
export const waitForMutationsIdle = (queryClient: QueryClient) =>
  waitFor(() => {
    expect(queryClient.isMutating()).toBe(0);
    expect(queryClient.isFetching()).toBe(0);
    // Every mutation observed so far must have reached a terminal state. Polling
    // this inside `waitFor` keeps the success/error React commit inside act, so
    // no observer notification lands after the test (which would warn and, once
    // the jsdom window is torn down, throw "window is not defined").
    const pending = queryClient
      .getMutationCache()
      .getAll()
      .some(mutation => mutation.state.status === 'pending');
    expect(pending).toBe(false);
  });
