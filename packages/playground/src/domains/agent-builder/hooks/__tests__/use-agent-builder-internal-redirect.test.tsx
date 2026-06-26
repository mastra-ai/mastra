import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAgentBuilderInternalRedirect } from '../use-agent-builder-internal-redirect';
import { emptyStoredAgents, oneDraftAgent, onePublishedAgent, twoPublishedAgents } from './fixtures/stored-agents';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const stubStoredAgents = (handler: (status: string | null) => Response | Promise<Response>) => {
  server.use(
    http.get(`${BASE_URL}/api/stored/agents`, async ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      return handler(status);
    }),
  );
};

const pendingResolvers: Array<() => void> = [];

afterEach(() => {
  // Release any deferred handlers so MSW doesn't hold the request across tests.
  while (pendingResolvers.length) pendingResolvers.pop()?.();
});

const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  pendingResolvers.push(resolve);
  return { promise, resolve };
};

describe('useAgentBuilderInternalRedirect', () => {
  it('reports isLoading=true initially and then hasAgents=false when both lists are empty', async () => {
    stubStoredAgents(() => HttpResponse.json(emptyStoredAgents));

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    expect(result.current).toEqual({ isLoading: true, hasAgents: false });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({ isLoading: false, hasAgents: false });
  });

  it('reports hasAgents=true when only drafts exist', async () => {
    stubStoredAgents(status => HttpResponse.json(status === 'draft' ? oneDraftAgent : emptyStoredAgents));

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({ isLoading: false, hasAgents: true });
  });

  it('reports hasAgents=true when only published agents exist', async () => {
    stubStoredAgents(status => HttpResponse.json(status === 'published' ? onePublishedAgent : emptyStoredAgents));

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({ isLoading: false, hasAgents: true });
  });

  it('reports hasAgents=true when both lists contain agents', async () => {
    stubStoredAgents(status => HttpResponse.json(status === 'draft' ? oneDraftAgent : twoPublishedAgents));

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({ isLoading: false, hasAgents: true });
  });

  it('stays isLoading=true while both queries are pending', async () => {
    const gate = deferred();
    stubStoredAgents(async () => {
      await gate.promise;
      return HttpResponse.json(emptyStoredAgents);
    });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    // Give React-Query a tick to fire the requests.
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.hasAgents).toBe(false);

    gate.resolve();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('stays isLoading=true while only the published query is pending', async () => {
    const gate = deferred();
    stubStoredAgents(async status => {
      if (status === 'draft') return HttpResponse.json(emptyStoredAgents);
      await gate.promise;
      return HttpResponse.json(emptyStoredAgents);
    });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    gate.resolve();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAgents).toBe(false);
  });

  it('stays isLoading=true while only the draft query is pending', async () => {
    const gate = deferred();
    stubStoredAgents(async status => {
      if (status === 'published') return HttpResponse.json(emptyStoredAgents);
      await gate.promise;
      return HttpResponse.json(emptyStoredAgents);
    });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    gate.resolve();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAgents).toBe(false);
  });

  it('treats responses missing the agents field as empty', async () => {
    // Older servers / partial payloads. The hook normalizes `data?.agents ?? []`.
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, () =>
        HttpResponse.json({ total: 0, page: 1, perPage: 50, hasMore: false }),
      ),
    );

    const { result } = renderHook(() => useAgentBuilderInternalRedirect(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({ isLoading: false, hasAgents: false });
  });
});
