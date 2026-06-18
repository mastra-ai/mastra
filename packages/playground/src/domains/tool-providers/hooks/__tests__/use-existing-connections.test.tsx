// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useExistingConnections } from '../use-existing-connections';

import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const wrapper = ({ children }: PropsWithChildren) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useExistingConnections — scopeToSelf', () => {
  it('resolves connections for an authenticated caller', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_a', status: 'active', label: 'work' }] }),
      ),
    );

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

    const { result } = renderHook(() => useExistingConnections('composio', 'gmail', { scopeToSelf: true }), {
      wrapper,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(onConnections).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
