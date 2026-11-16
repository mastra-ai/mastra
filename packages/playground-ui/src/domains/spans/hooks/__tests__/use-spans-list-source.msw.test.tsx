// @vitest-environment jsdom
import type { QuerySpansResult } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import type { SpanQueryArgs } from '@mastra/react/hooks/traces';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  endedSpan,
  fullSpanHeadPage,
  spanHeadPage,
  spanRowsPage,
  spanTimeRange,
  statusAndTraceTokens,
} from '../../__tests__/fixtures/spans';
import { buildSpanQueryWhere } from '../../span-filters';
import { useSpansListSource } from '../use-spans-list-source';
import type { UseSpansListSourceArgs } from '../use-spans-list-source';
import {
  OBSERVABILITY_LIST_HEAD_LIMIT,
  OBSERVABILITY_LIST_POLL_INTERVAL_MS,
} from '@/domains/observability/list-polling';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SPANS_QUERY_URL = `${BASE_URL}/api/observability/spans/query`;

type Body = {
  timeRange: { from: string; to: string };
  orderBy: Array<{ field: string; direction: string }>;
  page: { limit: number; after?: string };
};

const rollingQuery: SpanQueryArgs = { timeRange: spanTimeRange, orderBy: [{ field: 'startedAt', direction: 'desc' }] };

function Wrapper({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const isHeadRequest = (body: Body) => body.orderBy[0]?.field === 'endedAt';

/** The list always serves `spanRowsPage`; head polls get `headPages` in order, then the last one again. */
function setHandlers(headPages: Array<QuerySpansResult | { status: number }>) {
  const listBodies: Body[] = [];
  const headBodies: Body[] = [];
  server.use(
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as Body;
      if (!isHeadRequest(body)) {
        listBodies.push(body);
        return HttpResponse.json(spanRowsPage);
      }
      headBodies.push(body);
      const page = headPages[Math.min(headBodies.length, headPages.length) - 1];
      if ('status' in page) return HttpResponse.json({ message: 'nope' }, { status: page.status });
      return HttpResponse.json(page);
    }),
  );
  return { listBodies, headBodies };
}

function renderSource(initialProps: UseSpansListSourceArgs) {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
  return renderHook((props: UseSpansListSourceArgs) => useSpansListSource(props), {
    wrapper: Wrapper,
    initialProps,
  });
}

const nextTick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_POLL_INTERVAL_MS);
  });

const spanIds = (spans: QuerySpansResult['spans'] | undefined) => spans?.map(span => span.spanId);

describe('useSpansListSource', () => {
  describe('when the window is rolling and a span ends while the list is open', () => {
    it('shows the new span at the top after one poll, without reloading the list', async () => {
      const { listBodies, headBodies } = setHandlers([spanHeadPage]);
      const { result } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(spanIds(result.current.spans)).toEqual(['span-1', 'span-2']));
      const polledAfter = Date.now();

      await nextTick();

      await waitFor(() => expect(spanIds(result.current.spans)).toEqual(['span-9', 'span-1', 'span-2']));
      expect(headBodies).toHaveLength(1);
      expect(headBodies[0].orderBy).toEqual([{ field: 'endedAt', direction: 'desc' }]);
      expect(headBodies[0].page).toEqual({ limit: OBSERVABILITY_LIST_HEAD_LIMIT });
      expect(headBodies[0].timeRange.from).toBe(spanTimeRange.from);
      expect(Date.parse(headBodies[0].timeRange.to)).toBeGreaterThanOrEqual(polledAfter);
      expect(listBodies).toHaveLength(1);
    });

    it('lists the new span last when the list is sorted oldest first and fully loaded', async () => {
      setHandlers([spanHeadPage]);
      const { result } = renderSource({
        query: { ...rollingQuery, orderBy: [{ field: 'startedAt', direction: 'asc' }] },
        rolling: true,
      });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));

      await nextTick();

      await waitFor(() => expect(spanIds(result.current.spans)?.at(-1)).toBe('span-9'));
    });
  });

  describe('when the window is a custom range', () => {
    it('never polls', async () => {
      const { headBodies } = setHandlers([spanHeadPage]);
      const { result } = renderSource({ query: rollingQuery, rolling: false });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));

      await nextTick();
      await nextTick();

      expect(headBodies).toHaveLength(0);
    });
  });

  describe('when auto refresh is off', () => {
    it('never polls', async () => {
      const { headBodies } = setHandlers([spanHeadPage]);
      const { result } = renderSource({ query: rollingQuery, rolling: true, autoRefetch: false });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));

      await nextTick();

      expect(headBodies).toHaveLength(0);
    });
  });

  describe('when more spans ended than one poll can bring', () => {
    it('reloads the first page with a window ending now and drops the polled spans', async () => {
      const { listBodies } = setHandlers([fullSpanHeadPage(OBSERVABILITY_LIST_HEAD_LIMIT, spanTimeRange.to)]);
      const { result } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
      const reloadedAfter = Date.now();

      await nextTick();

      await waitFor(() => expect(listBodies).toHaveLength(2));
      expect(listBodies[1].timeRange.from).toBe(spanTimeRange.from);
      expect(Date.parse(listBodies[1].timeRange.to)).toBeGreaterThanOrEqual(reloadedAfter);
      expect(listBodies[1].page.after).toBeUndefined();
      await waitFor(() => expect(spanIds(result.current.spans)).toEqual(['span-1', 'span-2']));
    });
  });

  describe('when the server rejects the poll', () => {
    it('stops polling', async () => {
      const { headBodies } = setHandlers([{ status: 422 }]);
      const { result } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));

      await nextTick();
      await waitFor(() => expect(headBodies).toHaveLength(1));
      await nextTick();
      await nextTick();

      expect(headBodies).toHaveLength(1);
      expect(spanIds(result.current.spans)).toEqual(['span-1', 'span-2']);
    });
  });

  describe('when the filters change', () => {
    it('drops the spans polled for the previous filters', async () => {
      setHandlers([spanHeadPage, { spans: [], page: { next: null } }]);
      const { result, rerender } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
      await nextTick();
      await waitFor(() => expect(spanIds(result.current.spans)).toContain(endedSpan.spanId));

      const where = buildSpanQueryWhere(statusAndTraceTokens, [], { withContextFields: true });
      rerender({ query: { ...rollingQuery, ...(where ? { where } : {}) }, rolling: true });

      await waitFor(() => expect(spanIds(result.current.spans)).toEqual(['span-1', 'span-2']));
    });
  });
});
