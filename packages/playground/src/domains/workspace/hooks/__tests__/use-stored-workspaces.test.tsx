import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStoredWorkspaces } from '../use-stored-workspaces';
import { makeStoredWorkspace, storedWorkspacesPage } from './fixtures/stored-workspaces';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const wrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useStoredWorkspaces', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists stored workspaces and forwards pagination + authorId params', async () => {
    let receivedUrl: URL | undefined;
    server.use(
      http.get(`${BASE_URL}/api/stored/workspaces`, ({ request }) => {
        receivedUrl = new URL(request.url);
        return HttpResponse.json(storedWorkspacesPage([makeStoredWorkspace({ name: 'WS' })], { page: 2, perPage: 10 }));
      }),
    );

    const { result } = renderHook(() => useStoredWorkspaces({ page: 2, perPage: 10, authorId: 'me' }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.workspaces).toHaveLength(1);
    expect(receivedUrl?.searchParams.get('page')).toBe('2');
    expect(receivedUrl?.searchParams.get('perPage')).toBe('10');
    expect(receivedUrl?.searchParams.get('authorId')).toBe('me');
  });

  it('does not run when enabled is false', async () => {
    const onFetch = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/stored/workspaces`, () => {
        onFetch();
        return HttpResponse.json(storedWorkspacesPage([]));
      }),
    );

    const { result } = renderHook(() => useStoredWorkspaces(undefined, { enabled: false }), {
      wrapper: wrapper(),
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('keeps each set of list params in its own cache entry', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/workspaces`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        return HttpResponse.json(
          storedWorkspacesPage([makeStoredWorkspace({ id: `ws-page-${page}`, name: `WS ${page}` })], {
            total: 2,
            page: Number(page),
            perPage: 1,
            hasMore: page === '1',
          }),
        );
      }),
    );
    const sharedWrapper = wrapper();

    const first = renderHook(() => useStoredWorkspaces({ page: 1, perPage: 1 }), { wrapper: sharedWrapper });
    await waitFor(() => expect(first.result.current.data?.workspaces[0]?.id).toBe('ws-page-1'));

    const second = renderHook(() => useStoredWorkspaces({ page: 2, perPage: 1 }), { wrapper: sharedWrapper });
    await waitFor(() => expect(second.result.current.data?.workspaces[0]?.id).toBe('ws-page-2'));

    expect(first.result.current.data?.workspaces[0]?.id).toBe('ws-page-1');
  });
});
