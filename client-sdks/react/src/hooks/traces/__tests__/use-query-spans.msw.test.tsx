// @vitest-environment jsdom
import type { QuerySpansInput } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useQuerySpans } from '../use-query-spans';
import type { SpanQueryArgs } from '../use-query-spans';
import { SPAN_PAGE_ONE_CURSOR, spanQueryFirstPage, spanQueryLastPage } from './fixtures/span-query';

const BASE_URL = 'http://localhost:4111';
const SPANS_QUERY_URL = `${BASE_URL}/api/observability/spans/query`;

const query: SpanQueryArgs = {
  timeRange: { from: '2026-10-20T08:00:00.000Z', to: '2026-10-21T08:00:00.000Z' },
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

function createGate() {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

/** Serves the first page without a cursor and the last page for SPAN_PAGE_ONE_CURSOR. */
function serveSpanPages(options: { beforeLastPage?: Promise<void> } = {}) {
  const requests: QuerySpansInput[] = [];
  server.use(
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as QuerySpansInput;
      requests.push(body);
      if (body.page?.after === SPAN_PAGE_ONE_CURSOR) {
        await options.beforeLastPage;
        return HttpResponse.json(spanQueryLastPage);
      }
      return HttpResponse.json(spanQueryFirstPage);
    }),
  );
  return requests;
}

afterEach(() => {
  cleanup();
});

describe('useQuerySpans', () => {
  describe('when no cursor is given', () => {
    it('requests the first page without an after key and exposes its next cursor', async () => {
      const requests = serveSpanPages();

      const { result } = renderHook(() => useQuerySpans({ query }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.spans).toEqual(spanQueryFirstPage.spans));
      expect(requests).toEqual([{ ...query, page: { limit: 25 } }]);
      expect(result.current.nextCursor).toBe(SPAN_PAGE_ONE_CURSOR);
    });
  });

  describe('when rerendered with a cursor', () => {
    it('requests that page and replaces the previous rows', async () => {
      const requests = serveSpanPages();

      const { result, rerender } = renderHook(({ after }: { after?: string }) => useQuerySpans({ query, after }), {
        wrapper: makeWrapper(),
        initialProps: {},
      });
      await waitFor(() => expect(result.current.spans).toEqual(spanQueryFirstPage.spans));

      rerender({ after: SPAN_PAGE_ONE_CURSOR });

      await waitFor(() => expect(result.current.spans).toEqual(spanQueryLastPage.spans));
      expect(requests.at(-1)).toEqual({ ...query, page: { limit: 25, after: SPAN_PAGE_ONE_CURSOR } });
      expect(result.current.nextCursor).toBeNull();
    });
  });

  describe('when the next page is still loading', () => {
    it('keeps the current rows visible as placeholder data', async () => {
      const gate = createGate();
      serveSpanPages({ beforeLastPage: gate.promise });

      const { result, rerender } = renderHook(({ after }: { after?: string }) => useQuerySpans({ query, after }), {
        wrapper: makeWrapper(),
        initialProps: {},
      });
      await waitFor(() => expect(result.current.spans).toEqual(spanQueryFirstPage.spans));

      rerender({ after: SPAN_PAGE_ONE_CURSOR });

      await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
      expect(result.current.spans).toEqual(spanQueryFirstPage.spans);

      gate.release();
      await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
      expect(result.current.spans).toEqual(spanQueryLastPage.spans);
    });
  });

  describe('when disabled', () => {
    it('does not send a request', async () => {
      const requests = serveSpanPages();

      const { result } = renderHook(() => useQuerySpans({ query, enabled: false }), { wrapper: makeWrapper() });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests).toEqual([]);
      expect(result.current.spans).toBeUndefined();
    });
  });
});
