// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { buildTraceListFilters } from '../../trace-filters';
import { useTraceMetadataFilterFields } from '../use-trace-metadata-filter-fields';
import { getTraceQueryNextPageParam, useTraceQuery } from '../use-trace-query';
import type { TraceQueryArgs } from '../use-trace-query';
import { firstTraceQueryPage, lastTraceQueryPage } from './fixtures/trace-query';
import { firstLegacyTracePage, lastLegacyTracePage } from './fixtures/trace-query-legacy';

const BASE_URL = 'http://localhost:4111';
const QUERY_URL = `${BASE_URL}/api/observability/traces/query`;
const LEGACY_URL = `${BASE_URL}/api/observability/traces/light`;
const FIELDS_URL = `${BASE_URL}/api/observability/traces/query/fields`;
const VALUES_URL = `${BASE_URL}/api/observability/traces/query/values`;
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
  describe('when defining caller-owned query arguments', () => {
    it('excludes both pagination modes owned by the cursor hook', () => {
      expectTypeOf<TraceQueryArgs>().not.toHaveProperty('page');
      expectTypeOf<TraceQueryArgs>().not.toHaveProperty('pagination');
    });
  });

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
      const overlappingPage: typeof firstTraceQueryPage = {
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

  describe('when withQueryTrace is true', () => {
    it('never calls the legacy light endpoint', async () => {
      const onLegacyRequest = vi.fn();
      server.use(
        http.post(QUERY_URL, () => HttpResponse.json(lastTraceQueryPage)),
        http.get(LEGACY_URL, () => {
          onLegacyRequest();
          throw new Error('legacy endpoint must not be called when withQueryTrace is true');
        }),
      );
      const { result } = renderHook(() => useTraceQuery({ query, withQueryTrace: true }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.data).toEqual(lastTraceQueryPage.traces));
      expect(onLegacyRequest).not.toHaveBeenCalled();
    });
  });

  describe('when withQueryTrace is false', () => {
    const legacyFilters = buildTraceListFilters({ rootEntityType: 'agent', status: 'error', tokens: [] });

    it('lists traces through the light endpoint and never calls the trace-query API', async () => {
      const onQueryRequest = vi.fn();
      const urls: URL[] = [];
      server.use(
        http.post(QUERY_URL, () => {
          onQueryRequest();
          throw new Error('trace-query endpoint must not be called when withQueryTrace is false');
        }),
        http.get(LEGACY_URL, ({ request }) => {
          urls.push(new URL(request.url));
          return HttpResponse.json(lastLegacyTracePage);
        }),
      );
      const { result } = renderHook(() => useTraceQuery({ query, withQueryTrace: false, legacyFilters, limit: 10 }), {
        wrapper: makeWrapper(),
      });
      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(onQueryRequest).not.toHaveBeenCalled();
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(Object.fromEntries(url.searchParams)).toEqual({
          page: '0',
          perPage: '10',
          field: 'startedAt',
          direction: 'DESC',
          entityType: 'agent',
          status: 'error',
        });
      }
    });

    it('maps light root spans into trace-query rows', async () => {
      server.use(
        http.get(LEGACY_URL, ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          return HttpResponse.json(page === '0' ? firstLegacyTracePage : lastLegacyTracePage);
        }),
      );
      const { result } = renderHook(() => useTraceQuery({ query, withQueryTrace: false }), {
        wrapper: makeWrapper(),
      });
      await waitFor(() => expect(result.current.hasNextPage).toBe(true));
      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() => expect(result.current.hasNextPage).toBe(false));
      expect(result.current.data).toEqual([
        {
          traceId: 'trace-legacy-a',
          rootSpanId: 'span-legacy-a',
          name: 'Agent run',
          entityId: 'assistant',
          parentSpanId: null,
          createdAt: '2026-09-01T10:00:00.000Z',
          metadata: { region: 'eu-west' },
          inputPreview: 'Hello',
          threadId: null,
          resourceId: null,
          startedAt: '2026-09-01T10:00:00.000Z',
          endedAt: '2026-09-01T10:01:00.000Z',
          entityName: 'assistant',
          entityType: 'agent',
          environment: null,
          status: 'success',
        },
        expect.objectContaining({
          traceId: 'trace-legacy-b',
          rootSpanId: 'span-legacy-b',
          endedAt: null,
          status: 'running',
          metadata: null,
          inputPreview: null,
        }),
      ]);
    });

    it('lists traces without touching any trace-query endpoint when composed like the platform page', async () => {
      const forbidden = vi.fn();
      const fail = (path: string) => () => {
        forbidden(path);
        throw new Error(`${path} must not be called when withQueryTrace is false`);
      };
      server.use(
        http.post(QUERY_URL, fail('query')),
        http.post(FIELDS_URL, fail('fields')),
        http.post(VALUES_URL, fail('values')),
        http.get(LEGACY_URL, () => HttpResponse.json(lastLegacyTracePage)),
      );
      const withQueryTrace = false;
      const { result } = renderHook(
        () => ({
          traces: useTraceQuery({ query, withQueryTrace, legacyFilters }),
          metadata: useTraceMetadataFilterFields({
            timeRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z' },
            enabled: withQueryTrace,
          }),
        }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.traces.data).toHaveLength(1));
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.metadata.fields).toEqual([]);
      expect(forbidden).not.toHaveBeenCalled();
    });

    it('requests ascending order when the query asks for it', async () => {
      const orders: unknown[] = [];
      server.use(
        http.get(LEGACY_URL, ({ request }) => {
          const params = new URL(request.url).searchParams;
          orders.push({ field: params.get('field'), direction: params.get('direction') });
          return HttpResponse.json(lastLegacyTracePage);
        }),
      );
      const { result } = renderHook(
        () =>
          useTraceQuery({
            query: { ...query, orderBy: [{ field: 'startedAt', direction: 'asc' }] },
            withQueryTrace: false,
          }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(orders.length).toBeGreaterThan(0);
      for (const order of orders) expect(order).toEqual({ field: 'startedAt', direction: 'ASC' });
    });
  });
});
