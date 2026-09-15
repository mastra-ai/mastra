// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

  describe('when a visible sentinel encounters a failed next page', () => {
    it('keeps loaded rows, stops automatic requests, and allows explicit recovery', async () => {
      let requests = 0;
      let recover = false;
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(private callback: IntersectionObserverCallback) {}
          observe(target: Element) {
            const rect = target.getBoundingClientRect();
            this.callback(
              [
                {
                  target,
                  isIntersecting: true,
                  intersectionRatio: 1,
                  time: 0,
                  boundingClientRect: rect,
                  intersectionRect: rect,
                  rootBounds: rect,
                },
              ],
              this,
            );
          }
          disconnect() {}
          unobserve() {}
          takeRecords() {
            return [];
          }
          root = null;
          rootMargin = '0px';
          thresholds = [0];
        },
      );
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          const body: Parameters<MastraClient['queryTraces']>[0] = await request.json();
          requests++;
          if (!body.page?.after) return HttpResponse.json(firstTraceQueryPage);
          return recover
            ? HttpResponse.json(lastTraceQueryPage)
            : HttpResponse.json({ error: 'Failed page' }, { status: 500 });
        }),
      );
      try {
        const { result, rerender } = renderHook(() => useTraceQuery({ query }), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.data).toEqual(firstTraceQueryPage.traces));
        act(() => result.current.setEndOfListElement(document.createElement('div')));
        await waitFor(() => expect(result.current.isError).toBe(true));
        rerender();
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
        expect(requests).toBe(2);
        expect(result.current.data).toEqual(firstTraceQueryPage.traces);
        recover = true;
        await act(async () => {
          await result.current.fetchNextPage();
        });
        await waitFor(() => expect(result.current.hasNextPage).toBe(false));
        expect(result.current.data).toEqual([...firstTraceQueryPage.traces, ...lastTraceQueryPage.traces]);
        expect(requests).toBe(3);
      } finally {
        vi.unstubAllGlobals();
      }
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

  describe('when the time window changes', () => {
    it('keeps previous rows until the new response arrives', async () => {
      let release = () => {};
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      let requests = 0;
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query`, async () => {
          if (++requests > 1) await gate;
          return HttpResponse.json(requests === 1 ? firstTraceQueryPage : lastTraceQueryPage);
        }),
      );
      const { result, rerender } = renderHook(({ query }) => useTraceQuery({ query }), {
        initialProps: { query },
        wrapper: makeWrapper(),
      });
      await waitFor(() => expect(result.current.data).toEqual(firstTraceQueryPage.traces));
      rerender({ query: { timeRange: { ...query.timeRange, to: '2026-09-03T00:00:00Z' } } });
      expect(result.current.data).toEqual(firstTraceQueryPage.traces);
      expect(result.current.isLoading).toBe(false);
      await act(async () => release());
      await waitFor(() => expect(result.current.data).toEqual(lastTraceQueryPage.traces));
    });
  });

  describe('when polling is enabled', () => {
    it('issues another POST after the configured interval', async () => {
      const onRequest = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/observability/traces/query`, () => {
          onRequest();
          return HttpResponse.json(lastTraceQueryPage);
        }),
      );
      focusManager.setFocused(true);
      const { result, rerender } = renderHook(({ interval }) => useTraceQuery({ query, refetchInterval: interval }), {
        initialProps: { interval: 0 },
        wrapper: makeWrapper(),
      });
      await waitFor(() => expect(result.current.data).toEqual(lastTraceQueryPage.traces));
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      try {
        rerender({ interval: 10_000 });
        const initialRequests = onRequest.mock.calls.length;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(9_999);
        });
        expect(onRequest).toHaveBeenCalledTimes(initialRequests);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
        await waitFor(() => expect(onRequest.mock.calls.length).toBeGreaterThan(initialRequests));
      } finally {
        cleanup();
        vi.useRealTimers();
        focusManager.setFocused(undefined);
      }
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
