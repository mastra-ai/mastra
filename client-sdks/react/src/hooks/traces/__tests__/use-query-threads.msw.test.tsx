// @vitest-environment jsdom
import type { QueryTraceThreadsInput, QueryTraceThreadsResult } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { useMockIntersectionObserver } from '../../../test/intersection-observer';
import { server } from '../../../test/msw-server';
import { useQueryThreads } from '../use-query-threads';
import type { ThreadQueryArgs } from '../use-query-threads';
import { THREAD_PAGE_ONE_CURSOR, threadQueryFirstPage, threadQueryLastPage } from './fixtures/thread-query';

const BASE_URL = 'http://localhost:4111';
const THREADS_QUERY_URL = `${BASE_URL}/api/observability/threads/query`;

const query: ThreadQueryArgs = {
  timeRange: { traces: { from: '2026-10-20T08:00:00.000Z', to: '2026-10-21T08:00:00.000Z' } },
  orderBy: [{ field: 'startedAt', direction: 'desc' }],
};

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

/** Serves `firstPage` without a cursor and the last page for THREAD_PAGE_ONE_CURSOR, recording every request. */
function serveThreadPages(firstPage: QueryTraceThreadsResult = threadQueryFirstPage) {
  const requests: QueryTraceThreadsInput[] = [];
  server.use(
    http.post(THREADS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as QueryTraceThreadsInput;
      requests.push(body);
      return HttpResponse.json(body.page?.after === THREAD_PAGE_ONE_CURSOR ? threadQueryLastPage : firstPage);
    }),
  );
  return requests;
}

afterEach(() => {
  cleanup();
});

describe('useQueryThreads', () => {
  const { intersect } = useMockIntersectionObserver();

  describe('when first rendered', () => {
    it('requests the first page without an after key and reports a next page', async () => {
      const requests = serveThreadPages();

      const { result } = renderHook(() => useQueryThreads({ query }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.threads).toEqual(threadQueryFirstPage.threads));
      expect(requests).toEqual([{ ...query, page: { limit: 25 } }]);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('when the end of the list scrolls into view', () => {
    it('requests the next page with the cursor and appends its rows', async () => {
      const requests = serveThreadPages();
      const { result } = renderHook(() => useQueryThreads({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.threads).toEqual(threadQueryFirstPage.threads));

      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await waitFor(() =>
        expect(result.current.threads).toEqual([...threadQueryFirstPage.threads, ...threadQueryLastPage.threads]),
      );
      expect(requests.at(-1)).toEqual({ ...query, page: { limit: 25, after: THREAD_PAGE_ONE_CURSOR } });
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('when the first page is the last one', () => {
    it('does not request another page when the end of the list scrolls into view', async () => {
      const requests = serveThreadPages(threadQueryLastPage);
      const { result } = renderHook(() => useQueryThreads({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.threads).toEqual(threadQueryLastPage.threads));
      expect(result.current.hasNextPage).toBe(false);

      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests).toHaveLength(1);
    });
  });

  describe('when the query changes after loading more pages', () => {
    it('restarts from the first page', async () => {
      const requests = serveThreadPages();
      const { result, rerender } = renderHook(({ q }: { q: ThreadQueryArgs }) => useQueryThreads({ query: q }), {
        wrapper: makeWrapper(),
        initialProps: { q: query },
      });
      await waitFor(() => expect(result.current.threads).toEqual(threadQueryFirstPage.threads));
      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));
      await waitFor(() => expect(result.current.threads).toHaveLength(3));
      act(() => intersect(false));

      const ascending: ThreadQueryArgs = { ...query, orderBy: [{ field: 'startedAt', direction: 'asc' }] };
      rerender({ q: ascending });

      await waitFor(() => expect(requests).toHaveLength(3));
      expect(requests[2]).toEqual({ ...ascending, page: { limit: 25 } });
      await waitFor(() => expect(result.current.threads).toEqual(threadQueryFirstPage.threads));
    });
  });

  describe('when disabled', () => {
    it('does not send a request', async () => {
      const requests = serveThreadPages();

      const { result } = renderHook(() => useQueryThreads({ query, enabled: false }), { wrapper: makeWrapper() });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests).toEqual([]);
      expect(result.current.threads).toBeUndefined();
    });
  });
});
