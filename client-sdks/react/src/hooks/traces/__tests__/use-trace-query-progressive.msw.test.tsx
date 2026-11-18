// @vitest-environment jsdom
import type { QueryTracesKeysetInput, TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { useMockIntersectionObserver } from '../../../test/intersection-observer';
import { server } from '../../../test/msw-server';
import { useTraceQuery } from '../use-trace-query';
import type { TraceQueryArgs } from '../use-trace-query';
import { queriedTrace } from './fixtures/traces';

const BASE_URL = 'http://localhost:4111';
const TRACES_QUERY_URL = `${BASE_URL}/api/observability/traces/query`;

const FROM = '2026-09-21T00:00:00.000Z';
const TO = '2026-10-21T00:00:00.000Z';

const query: TraceQueryArgs = {
  timeRange: { from: FROM, to: TO },
  where: { op: 'hasAllTokens', left: { path: 'all' }, right: { literal: 'weather' } },
  orderBy: [{ field: 'startedAt', direction: 'asc' }],
  progressive: true,
};

const oldest = queriedTrace('trace-oldest', '2026-09-22T00:00:00.000Z');
const newer = queriedTrace('trace-newer', '2026-10-01T00:00:00.000Z');

/** Ascending, so the oldest chunk comes first. */
const chunks: Record<string, TraceQueryKeysetTraceResponse> = {
  first: {
    traces: [oldest],
    page: { next: null },
    searchedRange: { from: FROM, to: '2026-09-28T00:00:00.000Z' },
    continuation: 'chunk-2',
  },
  'chunk-2': {
    traces: [newer],
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

function serveChunks(override: (body: QueryTracesKeysetInput) => Response | undefined = () => undefined) {
  const requests: QueryTracesKeysetInput[] = [];
  server.use(
    http.post(TRACES_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as QueryTracesKeysetInput;
      requests.push(body);
      await delay(5);
      return override(body) ?? HttpResponse.json(chunks[body.continuation ?? 'first']);
    }),
  );
  return requests;
}

afterEach(() => {
  cleanup();
});

describe('useTraceQuery with a progressive word search', () => {
  const { intersect } = useMockIntersectionObserver();

  describe('when the end of the list stays in view', () => {
    it('pages through the chunks by continuation, in sort order, without a page cursor', async () => {
      const requests = serveChunks();
      const { result } = renderHook(() => useTraceQuery({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.data).toEqual([oldest]));
      expect(result.current.searchedRange).toEqual({ from: FROM, to: '2026-09-28T00:00:00.000Z' });
      expect(result.current.searching).toBe(true);

      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await waitFor(() => expect(result.current.searching).toBe(false));
      expect(result.current.data).toEqual([oldest, newer]);
      expect(requests).toEqual([
        { ...query, page: { limit: 25 } },
        { ...query, page: { limit: 25 }, continuation: 'chunk-2' },
      ]);
      expect(result.current.searchedRange).toEqual({ from: FROM, to: TO });
    });
  });

  describe('when a later chunk is too expensive', () => {
    it('keeps the traces loaded so far when a later chunk is too expensive', async () => {
      serveChunks(body =>
        body.continuation === 'chunk-2'
          ? HttpResponse.json({ name: 'search_too_expensive', message: 'Search took too long.' }, { status: 422 })
          : undefined,
      );
      const { result } = renderHook(() => useTraceQuery({ query }), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.data).toEqual([oldest]));
      act(() => result.current.setEndOfListElement(document.createElement('div')));
      act(() => intersect(true));

      await waitFor(() => expect(result.current.chunkError).not.toBeNull());
      expect(result.current.data).toEqual([oldest]);
      expect(result.current.isError).toBe(false);
    });
  });

  describe('when the query does not opt in', () => {
    it('pages a search without the opt-in by page cursor, as before', async () => {
      const { progressive: _progressive, ...plain } = query;
      const requests = serveChunks(() =>
        HttpResponse.json({ traces: [oldest], page: { next: null } } satisfies TraceQueryKeysetTraceResponse),
      );
      const { result } = renderHook(() => useTraceQuery({ query: plain }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data).toEqual([oldest]));
      expect(requests).toEqual([{ ...plain, page: { limit: 25, after: null } }]);
      expect(result.current.searching).toBe(false);
      expect(result.current.searchedRange).toBeUndefined();
    });
  });
});
