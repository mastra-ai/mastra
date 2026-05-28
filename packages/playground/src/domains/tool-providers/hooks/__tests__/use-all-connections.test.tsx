// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { useAllConnections } from '../use-all-connections';

const BASE_URL = 'http://localhost:4111';

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const baseHandlers = [
  http.get(`${BASE_URL}/api/tool-providers`, () =>
    HttpResponse.json({
      providers: [
        {
          id: 'composio',
          name: 'Composio',
          description: 'Composio tool provider',
          capabilities: { multipleConnectionsPerToolkit: true },
        },
      ],
    }),
  ),
  http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () =>
    HttpResponse.json({ data: [{ slug: 'gmail', name: 'Gmail' }] }),
  ),
];

const server = setupServer(...baseHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  cleanup();
  server.resetHandlers(...baseHandlers);
});
afterAll(() => server.close());

describe('useAllConnections', () => {
  // Security: Builder picker fan-out must scope to the caller's own authorId
  // so an admin viewing another user's agent does not see cross-author rows.
  it('passes authorId query param on listConnections when scopeToSelf is true', async () => {
    const requestedUrls: string[] = [];
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () =>
        HttpResponse.json({ id: 'user-b', permissions: ['tool-providers:admin'] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json({ items: [], pagination: { page: 1, perPage: 50, hasMore: false } });
      }),
    );

    renderHook(() => useAllConnections({ scopeToSelf: true }), { wrapper: Wrapper });

    await waitFor(() => expect(requestedUrls.length).toBeGreaterThan(0));
    const url = new URL(requestedUrls[0]!);
    expect(url.searchParams.get('toolkit')).toBe('gmail');
    expect(url.searchParams.get('authorId')).toBe('user-b');
  });

  it('does NOT pass authorId when scopeToSelf is false (default)', async () => {
    const requestedUrls: string[] = [];
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () =>
        HttpResponse.json({ id: 'user-b', permissions: ['tool-providers:admin'] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json({ items: [], pagination: { page: 1, perPage: 50, hasMore: false } });
      }),
    );

    renderHook(() => useAllConnections(), { wrapper: Wrapper });

    await waitFor(() => expect(requestedUrls.length).toBeGreaterThan(0));
    const url = new URL(requestedUrls[0]!);
    expect(url.searchParams.get('toolkit')).toBe('gmail');
    expect(url.searchParams.get('authorId')).toBeNull();
  });
});
