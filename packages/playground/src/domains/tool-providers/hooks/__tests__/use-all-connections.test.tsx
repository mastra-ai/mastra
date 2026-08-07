import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAllConnections } from '../use-all-connections';

import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

// Waits for the `useCurrentUser` query (queryKey ['auth', 'me']) to reach an
// error state, so the "fail closed" assertion runs *after* the 500 resolves
// rather than racing it with an arbitrary sleep (which leaks a state update
// outside act).
const waitForAuthError = (queryClient: QueryClient) =>
  waitFor(() => expect(queryClient.getQueryState(['auth', 'me'])?.status).toBe('error'));

const baseHandlers = (items: Array<{ connectionId: string; status: string; label?: string | null }>) => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
  http.get(`${BASE_URL}/api/tool-providers`, () =>
    HttpResponse.json({ providers: [{ id: 'composio', name: 'Composio' }] }),
  ),
  http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () =>
    HttpResponse.json({ data: [{ slug: 'gmail', name: 'Gmail' }] }),
  ),
  http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({ items })),
];

describe('useAllConnections — hasConnection', () => {
  it('reports a connection only when a connection is active', async () => {
    server.use(...baseHandlers([{ connectionId: 'conn_a', status: 'active', label: 'work' }]));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.hasConnection('composio', 'gmail')).toBe(true));
  });

  it('does not report a connection when the only connection is pending', async () => {
    server.use(...baseHandlers([{ connectionId: 'conn_a', status: 'pending', label: 'work' }]));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // The pending row is still returned by getConnections, but it must not
    // satisfy the "has connection" gate that drives the card hint.
    await waitFor(() => expect(result.current.getConnections('composio', 'gmail')).toHaveLength(1));
    expect(result.current.hasConnection('composio', 'gmail')).toBe(false);
  });

  it('does not report a connection when every row is failed or inactive', async () => {
    server.use(
      ...baseHandlers([
        { connectionId: 'conn_a', status: 'failed' },
        { connectionId: 'conn_b', status: 'inactive' },
      ]),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.getConnections('composio', 'gmail')).toHaveLength(2));
    expect(result.current.hasConnection('composio', 'gmail')).toBe(false);
  });

  it('ignores failed/inactive rows but still counts a mixed active row', async () => {
    server.use(
      ...baseHandlers([
        { connectionId: 'conn_a', status: 'failed' },
        { connectionId: 'conn_b', status: 'inactive' },
        { connectionId: 'conn_c', status: 'active', label: 'work' },
      ]),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.hasConnection('composio', 'gmail')).toBe(true));
  });

  it('still resolves connections when auth is disabled (401, no current user)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE_URL}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({ providers: [{ id: 'composio', name: 'Composio' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () =>
        HttpResponse.json({ data: [{ slug: 'gmail', name: 'Gmail' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_a', status: 'active', label: 'work' }] }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.hasConnection('composio', 'gmail')).toBe(true));
  });

  it('stays blocked on a non-401 user lookup failure (fail closed)', async () => {
    const onConnections = vi.fn<() => void>();
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({ providers: [{ id: 'composio', name: 'Composio' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () =>
        HttpResponse.json({ data: [{ slug: 'gmail', name: 'Gmail' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => {
        onConnections();
        return HttpResponse.json({ items: [] });
      }),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitForAuthError(queryClient);

    expect(onConnections).not.toHaveBeenCalled();
    expect(result.current.hasConnection('composio', 'gmail')).toBe(false);
  });
});
