// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getTraceQueryNextPageParam, useTraceQuery } from '../use-trace-query';
import type { TraceQueryArgs } from '../use-trace-query';
import { firstTraceQueryPage, lastTraceQueryPage } from './fixtures/trace-query';

const BASE_URL = 'http://localhost:4111';
const server = setupServer();
const query: TraceQueryArgs = {
  timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z' },
};

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('useTraceQuery', () => {
  describe('when fetching the first page', () => {
    it('posts the query with the default limit and exposes traces and the next-page state', async () => {
      const requests: unknown[] = [];
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json(firstTraceQueryPage);
        }),
      );
      const { result } = renderHook(() => useTraceQuery({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.data).toEqual(firstTraceQueryPage.traces));
      expect(requests).toEqual([{ ...query, page: { limit: 25, after: null } }]);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('when fetching the next page', () => {
    it('uses the previous cursor and appends results until there are no more pages', async () => {
      const requests: unknown[] = [];
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json(requests.length === 1 ? firstTraceQueryPage : lastTraceQueryPage);
        }),
      );
      const { result } = renderHook(() => useTraceQuery({ query, limit: 10 }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.hasNextPage).toBe(true));
      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() =>
        expect(result.current.data).toEqual([...firstTraceQueryPage.traces, ...lastTraceQueryPage.traces]),
      );
      expect(requests).toEqual([
        { ...query, page: { limit: 10, after: null } },
        { ...query, page: { limit: 10, after: 'cursor-a' } },
      ]);
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('when pages contain duplicate trace IDs', () => {
    it('returns each trace only once', async () => {
      let requests = 0;
      const overlappingPage: Awaited<ReturnType<MastraClient['queryTraces']>> = {
        ...lastTraceQueryPage,
        traces: [...firstTraceQueryPage.traces, ...lastTraceQueryPage.traces],
      };
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query`, () =>
          HttpResponse.json(++requests === 1 ? firstTraceQueryPage : overlappingPage),
        ),
      );
      const { result } = renderHook(() => useTraceQuery({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.hasNextPage).toBe(true));
      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() => expect(result.current.hasNextPage).toBe(false));
      expect(result.current.data?.map(trace => trace.traceId)).toEqual(['trace-a', 'trace-b']);
    });
  });

  describe('when disabled', () => {
    it('stays idle without making requests', async () => {
      const onRequest = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query`, () => {
          onRequest();
          return HttpResponse.json(firstTraceQueryPage);
        }),
      );
      const { result } = renderHook(() => useTraceQuery({ query, enabled: false }), { wrapper: makeWrapper() });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      expect(result.current.fetchStatus).toBe('idle');
      expect(onRequest).not.toHaveBeenCalled();
    });
  });

  describe('when resolving the next cursor', () => {
    it('normalizes absent cursors and preserves a next cursor', () => {
      expect(getTraceQueryNextPageParam(undefined)).toBeUndefined();
      expect(getTraceQueryNextPageParam(lastTraceQueryPage)).toBeUndefined();
      expect(getTraceQueryNextPageParam(firstTraceQueryPage)).toBe('cursor-a');
    });
  });
});
