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

describe('useAllConnections — the reads it issues', () => {
  it("asks the server for only the caller's own connections when self-scoped", async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('authorId'));
        return HttpResponse.json({ items: [{ connectionId: 'conn_a', status: 'active' }] });
      }),
      ...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(seen).toEqual(['tester']);
  });

  it('leaves the author filter off when not self-scoped, so admins see every row', async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('authorId'));
        return HttpResponse.json({ items: [{ connectionId: 'conn_a', status: 'active' }] });
      }),
      ...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(seen).toEqual([null]);
  });

  it('caches a self-scoped read apart from an unscoped one', async () => {
    server.use(...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]));

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(queryClient.getQueryData(['tool-integration-connections-all', 'composio', 'gmail', 'tester'])).toBeDefined();
    expect(queryClient.getQueryData(['tool-integration-connections-all', 'composio', 'gmail'])).toBeUndefined();
  });

  it('files an unscoped read under the author-free key', async () => {
    server.use(...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]));

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useAllConnections(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The mirror of the self-scoped case above: an unscoped read is filed under
    // the same prefix with no author segment, so the two never share a cache.
    expect(queryClient.getQueryData(['tool-integration-connections-all', 'composio', 'gmail'])).toBeDefined();
    expect(
      queryClient.getQueryData(['tool-integration-connections-all', 'composio', 'gmail', 'tester']),
    ).toBeUndefined();
  });

  it('reads connections for exactly the pairs its providers expose', async () => {
    const seen: Array<string> = [];
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/:providerId/connections`, ({ params, request }) => {
        seen.push(`${params.providerId}:${new URL(request.url).searchParams.get('toolkit')}`);
        return HttpResponse.json({ items: [] });
      }),
      ...baseHandlers([]),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // One read per real pair and nothing else — no placeholder row sneaks into
    // the fan-out and fires a request for a provider that does not exist.
    expect(seen).toEqual(['composio:gmail']);
  });

  it('reports itself loading until every fan-out read has landed', async () => {
    server.use(...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('settles even when no provider is registered', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json({ providers: [] })),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasConnection('composio', 'gmail')).toBe(false);
  });

  it('settles when a provider exposes no toolkits', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({ providers: [{ id: 'composio', name: 'Composio' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () => HttpResponse.json({ data: [] })),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getConnections('composio', 'gmail')).toEqual([]);
  });
});

describe('useAllConnections — getConnections', () => {
  it('returns every connection on the pair, whatever its status', async () => {
    server.use(
      ...baseHandlers([
        { connectionId: 'conn_a', status: 'active', label: 'work' },
        { connectionId: 'conn_b', status: 'pending', label: 'home' },
      ]),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getConnections('composio', 'gmail').map(c => c.connectionId)).toEqual(['conn_a', 'conn_b']);
  });

  it('returns an empty list for a pair it never fetched', async () => {
    server.use(...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getConnections('composio', 'slack')).toEqual([]);
    expect(result.current.hasConnection('composio', 'slack')).toBe(false);
  });

  it('returns an empty list when the server answers with no items', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({})),
      ...baseHandlers([]),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getConnections('composio', 'gmail')).toEqual([]);
  });

  it('keeps each toolkit of the same provider in its own bucket', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({ providers: [{ id: 'composio', name: 'Composio' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () =>
        HttpResponse.json({ data: [{ slug: 'gmail' }, { slug: 'slack' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, ({ request }) => {
        const toolkit = new URL(request.url).searchParams.get('toolkit');
        return HttpResponse.json({ items: [{ connectionId: `conn_${toolkit}`, status: 'active' }] });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getConnections('composio', 'gmail')[0].connectionId).toBe('conn_gmail');
    expect(result.current.getConnections('composio', 'slack')[0].connectionId).toBe('conn_slack');
  });
});

describe('useAllConnections — what it reports while the fan-out is in flight', () => {
  it('stays loading until the toolkits of every provider have landed', async () => {
    let releaseToolkits: () => void = () => {};
    const toolkitsInFlight = new Promise<void>(resolve => {
      releaseToolkits = resolve;
    });
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({ providers: [{ id: 'composio', name: 'Composio' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, async () => {
        await toolkitsInFlight;
        return HttpResponse.json({ data: [{ slug: 'gmail' }] });
      }),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({ items: [] })),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    // Wait until the current user and the provider list have both landed — the
    // toolkits query only exists once the providers do — so the toolkits read
    // is the only thing left that can hold the hook in a loading state.
    await waitFor(() => {
      expect(queryClient.getQueryState(['auth', 'me'])?.status).toBe('success');
      expect(queryClient.getQueryState(['tool-integration-services', 'composio'])?.fetchStatus).toBe('fetching');
    });
    expect(result.current.isLoading).toBe(true);

    releaseToolkits();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('stays loading while the current user is still being resolved', async () => {
    let releaseUser: () => void = () => {};
    const userInFlight = new Promise<void>(resolve => {
      releaseUser = resolve;
    });
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, async () => {
        await userInFlight;
        return HttpResponse.json({ id: 'tester', permissions: [] });
      }),
      ...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    // Providers and toolkits have both landed, and the per-pair reads are gated
    // shut until the caller is known, so the user lookup is the only thing left.
    await waitFor(() =>
      expect(queryClient.getQueryState(['tool-integration-services', 'composio'])?.status).toBe('success'),
    );
    expect(result.current.isLoading).toBe(true);

    releaseUser();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('stays loading until the connections of every pair have landed', async () => {
    let releaseConnections: () => void = () => {};
    const connectionsInFlight = new Promise<void>(resolve => {
      releaseConnections = resolve;
    });
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({ providers: [{ id: 'composio', name: 'Composio' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () =>
        HttpResponse.json({ data: [{ slug: 'gmail' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, async () => {
        await connectionsInFlight;
        return HttpResponse.json({ items: [{ connectionId: 'conn_a', status: 'active' }] });
      }),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    // The user, provider and toolkit reads have all landed by now — the pair
    // read only starts once the caller is known — so the connection read is the
    // only thing that can still hold the hook loading.
    await waitFor(() => {
      expect(queryClient.getQueryState(['auth', 'me'])?.status).toBe('success');
      expect(
        queryClient.getQueryState(['tool-integration-connections-all', 'composio', 'gmail', 'tester'])?.fetchStatus,
      ).toBe('fetching');
    });
    expect(result.current.getConnections('composio', 'gmail')).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    releaseConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("files each provider's toolkits under a key of its own", async () => {
    server.use(...baseHandlers([{ connectionId: 'conn_a', status: 'active' }]));

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryClient.getQueryData(['tool-integration-services', 'composio'])).toBeDefined();
    expect(queryClient.getQueryData(['tool-integration-services', 'other'])).toBeUndefined();
  });
});
