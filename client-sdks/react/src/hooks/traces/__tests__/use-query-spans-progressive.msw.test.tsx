// @vitest-environment jsdom
import type { QuerySpansInput, QuerySpansResult } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { useMockIntersectionObserver } from '../../../test/intersection-observer';
import { server } from '../../../test/msw-server';
import { useQuerySpans } from '../use-query-spans';
import type { SpanQueryArgs } from '../use-query-spans';
import { spanQueryFirstPage, spanQueryLastPage } from './fixtures/span-query';

const BASE_URL = 'http://localhost:4111';
const SPANS_QUERY_URL = `${BASE_URL}/api/observability/spans/query`;

const FROM = '2026-09-21T00:00:00.000Z';
const TO = '2026-10-21T00:00:00.000Z';

const query: SpanQueryArgs = {
  timeRange: { from: FROM, to: TO },
  where: { op: 'hasAllTokens', left: { path: 'all' }, right: { literal: 'weather' } },
  orderBy: [{ field: 'startedAt', direction: 'desc' }],
  progressive: true,
};

/** A 30-day search, newest chunk first: two rows, then an empty chunk, then one row and the end. */
const chunks: Record<string, QuerySpansResult> = {
  first: {
    spans: spanQueryFirstPage.spans,
    page: { next: null },
    searchedRange: { from: '2026-10-14T00:00:00.000Z', to: TO },
    continuation: 'chunk-2',
  },
  'chunk-2': {
    spans: [],
    page: { next: null },
    searchedRange: { from: '2026-10-07T00:00:00.000Z', to: TO },
    continuation: 'chunk-3',
  },
  'chunk-3': {
    spans: spanQueryLastPage.spans,
    page: { next: null },
    searchedRange: { from: FROM, to: TO },
    continuation: null,
  },
};

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

type Recorded = { body: QuerySpansInput; signal: AbortSignal };

/** Serves `chunks` by continuation, recording requests and how many were in flight at once. */
function serveChunks(override: (body: QuerySpansInput) => Response | Promise<Response> | undefined = () => undefined) {
  const requests: Recorded[] = [];
  const stats = { inFlight: 0, maxInFlight: 0 };
  server.use(
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as QuerySpansInput;
      requests.push({ body, signal: request.signal });
      stats.inFlight++;
      stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
      try {
        await delay(5);
        const overridden = await override(body);
        if (overridden) return overridden;
        return HttpResponse.json(chunks[body.continuation ?? 'first']);
      } finally {
        stats.inFlight--;
      }
    }),
  );
  return { requests, stats };
}

afterEach(() => {
  cleanup();
});

describe('useQuerySpans with a progressive word search', () => {
  const { intersect } = useMockIntersectionObserver();

  describe('when the search starts', () => {
    it('requests the newest chunk first with the opt-in and no page cursor', async () => {
      const { requests } = serveChunks();

      const { result } = renderHook(() => useQuerySpans({ query }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.spans).toEqual(spanQueryFirstPage.spans));
      expect(requests.map(r => r.body)).toEqual([{ ...query, page: { limit: 25 } }]);
      expect(result.current.searchedRange).toEqual({ from: '2026-10-14T00:00:00.000Z', to: TO });
      expect(result.current.searching).toBe(true);
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('when the end of the list stays in view', () => {
    it('keeps requesting chunks one at a time while the end of the list stays in view, across an empty chunk', async () => {
      const { requests, stats } = serveChunks();
      const { result } = renderHook(() => useQuerySpans({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));

      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await waitFor(() => expect(result.current.searching).toBe(false));
      expect(result.current.spans).toEqual([...spanQueryFirstPage.spans, ...spanQueryLastPage.spans]);
      expect(requests.map(r => r.body.continuation)).toEqual([undefined, 'chunk-2', 'chunk-3']);
      expect(requests.every(r => r.body.page?.after === undefined && r.body.progressive === true)).toBe(true);
      expect(stats.maxInFlight).toBe(1);
      expect(result.current.searchedRange).toEqual({ from: FROM, to: TO });
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('when the search is stopped', () => {
    it('stops requesting chunks after stop() until the next page is asked for again', async () => {
      const { requests } = serveChunks(body =>
        body.continuation === 'chunk-2' ? delay(50).then(() => HttpResponse.json(chunks['chunk-2'])) : undefined,
      );
      const { result } = renderHook(() => useQuerySpans({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));
      await waitFor(() => expect(requests).toHaveLength(2));

      act(() => result.current.stop());

      await waitFor(() => expect(result.current.isFetching).toBe(false));
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests).toHaveLength(2);
      expect(result.current.stopped).toBe(true);
      expect(result.current.searching).toBe(true);
      expect(result.current.searchedRange).toEqual({ from: '2026-10-07T00:00:00.000Z', to: TO });

      act(() => result.current.fetchNextPage());

      await waitFor(() => expect(result.current.searching).toBe(false));
      expect(requests.map(r => r.body.continuation)).toEqual([undefined, 'chunk-2', 'chunk-3']);
      expect(result.current.stopped).toBe(false);
    });
  });

  describe('when a later chunk is too expensive', () => {
    it('keeps the rows loaded so far when a later chunk is too expensive, and reports it as a chunk error', async () => {
      serveChunks(body =>
        body.continuation === 'chunk-2'
          ? HttpResponse.json({ name: 'search_too_expensive', message: 'Search took too long.' }, { status: 504 })
          : undefined,
      );
      const { result } = renderHook(() => useQuerySpans({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await waitFor(() => expect(result.current.chunkError).not.toBeNull());
      expect(result.current.spans).toEqual(spanQueryFirstPage.spans);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.searchedRange).toEqual({ from: '2026-10-14T00:00:00.000Z', to: TO });
    });
  });

  describe('when the server rejects a continuation', () => {
    it('starts the search again once when the server rejects a continuation', async () => {
      let rejected = 0;
      const { requests } = serveChunks(body => {
        if (body.continuation !== 'chunk-2' || rejected > 0) return undefined;
        rejected++;
        return HttpResponse.json({ code: 'SEARCH_CONTINUATION_INVALID', message: 'Start again.' }, { status: 409 });
      });
      const { result } = renderHook(() => useQuerySpans({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await waitFor(() => expect(result.current.searching).toBe(false));
      expect(requests.map(r => r.body.continuation)).toEqual([undefined, 'chunk-2', undefined, 'chunk-2', 'chunk-3']);
      expect(result.current.spans).toEqual([...spanQueryFirstPage.spans, ...spanQueryLastPage.spans]);
      expect(result.current.isError).toBe(false);
    });
  });

  describe('when the search changes mid-chunk', () => {
    it('cancels the chunk in flight when the search changes', async () => {
      const { requests } = serveChunks(body =>
        body.continuation === 'chunk-2' ? delay(1000).then(() => HttpResponse.json(chunks['chunk-2'])) : undefined,
      );
      const { result, rerender } = renderHook(({ q }: { q: SpanQueryArgs }) => useQuerySpans({ query: q }), {
        wrapper: makeWrapper(),
        initialProps: { q: query },
      });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));
      await waitFor(() => expect(requests).toHaveLength(2));

      rerender({ q: { ...query, where: { op: 'hasAllTokens', left: { path: 'all' }, right: { literal: 'rain' } } } });

      await waitFor(() => expect(requests[1]!.signal.aborted).toBe(true));
      await waitFor(() => expect(requests).toHaveLength(3));
      expect(requests[2]!.body.continuation).toBeUndefined();
    });
  });
});
