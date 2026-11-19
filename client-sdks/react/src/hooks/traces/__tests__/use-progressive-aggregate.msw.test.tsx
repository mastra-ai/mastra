// @vitest-environment jsdom
import type { AggregateSpansArgs, AggregateSpansResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useProgressiveSpanAggregate } from '../use-progressive-aggregate';

const BASE_URL = 'http://localhost:4111';
const URL = `${BASE_URL}/api/observability/spans/aggregate`;

const FROM = '2026-09-21T00:00:00.000Z';
const TO = '2026-10-21T00:00:00.000Z';

const request = {
  timeRange: { from: FROM, to: TO },
  where: { op: 'hasAllTokens', left: { path: 'all' }, right: { literal: 'weather' } },
  interval: '1d',
  measures: ['count', 'errorCount'],
  limit: 1,
  progressive: true,
} satisfies AggregateSpansArgs;

const row = (bucket: string, count: number) => ({
  bucket,
  dimensions: {},
  measures: { count, errorCount: 0 },
  cost: { coverage: null, unit: null },
});

/** Newest chunk first; each appends its own daily buckets. */
const chunks: Record<string, AggregateSpansResponse> = {
  first: {
    rows: [row('2026-10-20T00:00:00.000Z', 4)],
    truncated: false,
    searchedRange: { from: '2026-10-14T00:00:00.000Z', to: TO },
    continuation: 'chunk-2',
    mergeable: true,
  },
  'chunk-2': {
    rows: [row('2026-10-10T00:00:00.000Z', 2)],
    truncated: false,
    searchedRange: { from: '2026-10-07T00:00:00.000Z', to: TO },
    continuation: 'chunk-3',
    mergeable: true,
  },
  'chunk-3': {
    rows: [row('2026-09-25T00:00:00.000Z', 1)],
    truncated: false,
    searchedRange: { from: FROM, to: TO },
    continuation: null,
    mergeable: true,
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

function serveChunks(
  override: (body: AggregateSpansArgs) => Response | Promise<Response> | undefined = () => undefined,
) {
  const requests: AggregateSpansArgs[] = [];
  const stats = { inFlight: 0, maxInFlight: 0 };
  server.use(
    http.post(URL, async ({ request: req }) => {
      const body = (await req.json()) as AggregateSpansArgs;
      requests.push(body);
      stats.inFlight++;
      stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
      try {
        await delay(5);
        return (await override(body)) ?? HttpResponse.json(chunks[body.continuation ?? 'first']);
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

describe('useProgressiveSpanAggregate', () => {
  describe('when the search is progressive', () => {
    it('requests every chunk, one at a time, and appends their bucket rows', async () => {
      const { requests, stats } = serveChunks();

      const { result } = renderHook(() => useProgressiveSpanAggregate({ request }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data?.rows.map(r => r.measures.count)).toEqual([4, 2, 1]));
      expect(result.current.searching).toBe(false);
      expect(requests.map(r => r.continuation)).toEqual([undefined, 'chunk-2', 'chunk-3']);
      expect(stats.maxInFlight).toBe(1);
      expect(result.current.searchedRange).toEqual({ from: FROM, to: TO });
    });
  });

  describe('when the search is stopped', () => {
    it('requests no more chunks until it resumes', async () => {
      const { requests } = serveChunks(body =>
        body.continuation === 'chunk-2' ? delay(50).then(() => HttpResponse.json(chunks['chunk-2'])) : undefined,
      );
      const { result } = renderHook(() => useProgressiveSpanAggregate({ request }), { wrapper: makeWrapper() });
      await waitFor(() => expect(requests).toHaveLength(2));

      act(() => result.current.stop());

      await new Promise(resolve => setTimeout(resolve, 120));
      expect(requests).toHaveLength(2);
      expect(result.current.stopped).toBe(true);
      expect(result.current.data?.rows).toHaveLength(2);
      expect(result.current.searchedRange?.from).toBe('2026-10-07T00:00:00.000Z');

      act(() => result.current.resume());

      await waitFor(() => expect(result.current.data?.rows).toHaveLength(3));
      expect(result.current.searching).toBe(false);
    });
  });

  describe('when a later chunk is too expensive', () => {
    it('keeps the buckets loaded so far and reports a chunk error', async () => {
      serveChunks(body =>
        body.continuation === 'chunk-2'
          ? HttpResponse.json({ name: 'search_too_expensive', message: 'Search took too long.' }, { status: 504 })
          : undefined,
      );
      const { result } = renderHook(() => useProgressiveSpanAggregate({ request }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.chunkError).not.toBeNull());
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.rows.map(r => r.measures.count)).toEqual([4]);
      expect(result.current.searchedRange?.from).toBe('2026-10-14T00:00:00.000Z');
    });
  });

  describe('when the server answers that the results cannot be appended', () => {
    it('does not ask for another chunk', async () => {
      const { requests } = serveChunks(() =>
        HttpResponse.json({ ...chunks.first, mergeable: false } satisfies AggregateSpansResponse),
      );
      const { result } = renderHook(() => useProgressiveSpanAggregate({ request }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data).toBeDefined());
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests).toHaveLength(1);
    });
  });

  describe('when the request does not opt in', () => {
    it('sends one request without progressive fields', async () => {
      const { progressive: _progressive, ...plain } = request;
      const { requests } = serveChunks(() => HttpResponse.json({ rows: [row(TO, 3)], truncated: false }));
      const { result } = renderHook(() => useProgressiveSpanAggregate({ request: plain }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data?.rows).toHaveLength(1));
      expect(requests).toEqual([plain]);
      expect(result.current.searching).toBe(false);
      expect(result.current.searchedRange).toBeUndefined();
    });
  });
});
