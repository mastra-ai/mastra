import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useExistingConnections } from '../use-existing-connections';

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

describe('useExistingConnections — scopeToSelf', () => {
  it('resolves connections for an authenticated caller', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_a', status: 'active', label: 'work' }] }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections('composio', 'gmail', { scopeToSelf: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('resolves connections when auth is disabled (401, no current user)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE_URL}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_a', status: 'active', label: 'work' }] }),
      ),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections('composio', 'gmail', { scopeToSelf: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('stays blocked on a non-401 user lookup failure (fail closed)', async () => {
    const onConnections = vi.fn<() => void>();
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => {
        onConnections();
        return HttpResponse.json({ items: [] });
      }),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections('composio', 'gmail', { scopeToSelf: true }), {
      wrapper,
    });

    await waitForAuthError(queryClient);

    expect(onConnections).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});

describe('useExistingConnections — request shape and gating', () => {
  const CONNECTIONS_URL = `${BASE_URL}/api/tool-providers/composio/connections`;

  /** Answers the connections endpoint and records the URL it was called with. */
  const captureConnections = () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers/:providerId/connections`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json({ items: [] });
      }),
    );
    return seen;
  };

  it('asks for the toolkit the caller named', async () => {
    const seen = captureConnections();

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections('composio', 'gmail'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0]?.searchParams.get('toolkit')).toBe('gmail');
  });

  it('does not narrow to the caller by default', async () => {
    const seen = captureConnections();

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections('composio', 'gmail'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0]?.searchParams.get('authorId')).toBeNull();
  });

  it('narrows to the caller when scopeToSelf is set', async () => {
    const seen = captureConnections();

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections('composio', 'gmail', { scopeToSelf: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0]?.searchParams.get('authorId')).toBe('tester');
  });

  it('does not narrow to the caller when scopeToSelf is explicitly false', async () => {
    const seen = captureConnections();

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections('composio', 'gmail', { scopeToSelf: false }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0]?.searchParams.get('authorId')).toBeNull();
  });

  it.each([
    ['the provider is not chosen yet', null, 'gmail'],
    ['the toolkit is not chosen yet', 'composio', null],
  ])('stays idle while %s', async (_label, providerId, toolkit) => {
    const onConnections = vi.fn<() => void>();
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers/:providerId/connections`, () => {
        onConnections();
        return HttpResponse.json({ items: [] });
      }),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useExistingConnections(providerId, toolkit), { wrapper });

    // Settle the current-user query first, so this asserts "never fired"
    // rather than racing the auth response.
    await waitFor(() => expect(queryClient.getQueryState(['auth', 'me'])?.status).toBe('success'));
    expect(onConnections).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('keeps each toolkit in its own cache entry', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(CONNECTIONS_URL, ({ request }) => {
        const toolkit = new URL(request.url).searchParams.get('toolkit');
        return HttpResponse.json({ items: [{ connectionId: `conn_${toolkit}`, status: 'active' }] });
      }),
    );

    const { wrapper } = makeWrapper();
    const gmail = renderHook(() => useExistingConnections('composio', 'gmail'), { wrapper });
    await waitFor(() => expect(gmail.result.current.data?.items[0]?.connectionId).toBe('conn_gmail'));

    const slack = renderHook(() => useExistingConnections('composio', 'slack'), { wrapper });
    await waitFor(() => expect(slack.result.current.data?.items[0]?.connectionId).toBe('conn_slack'));

    expect(gmail.result.current.data?.items[0]?.connectionId).toBe('conn_gmail');
  });

  it('keeps the scoped and unscoped reads in separate cache entries', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(CONNECTIONS_URL, ({ request }) => {
        const scoped = new URL(request.url).searchParams.get('authorId') !== null;
        return HttpResponse.json({ items: scoped ? [{ connectionId: 'mine', status: 'active' }] : [] });
      }),
    );

    const { wrapper } = makeWrapper();
    const everyone = renderHook(() => useExistingConnections('composio', 'gmail'), { wrapper });
    await waitFor(() => expect(everyone.result.current.isSuccess).toBe(true));

    const mine = renderHook(() => useExistingConnections('composio', 'gmail', { scopeToSelf: true }), { wrapper });
    await waitFor(() => expect(mine.result.current.data?.items[0]?.connectionId).toBe('mine'));

    expect(everyone.result.current.data?.items).toHaveLength(0);
  });
});
