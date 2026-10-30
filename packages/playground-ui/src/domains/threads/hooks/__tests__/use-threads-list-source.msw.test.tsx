// @vitest-environment jsdom
import type { QueryTraceThreadsResult } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import type { ThreadQueryArgs } from '@mastra/react/hooks/traces';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fullThreadHeadPage,
  startedThread,
  statusAndRunTokens,
  threadHeadPage,
  threadRowsPage,
  threadTimeRange,
} from '../../__tests__/fixtures/threads';
import { buildThreadQueryWhere } from '../../thread-filters';
import { useThreadsListSource } from '../use-threads-list-source';
import type { UseThreadsListSourceArgs } from '../use-threads-list-source';
import {
  OBSERVABILITY_LIST_HEAD_LIMIT,
  OBSERVABILITY_LIST_POLL_INTERVAL_MS,
} from '@/domains/observability/list-polling';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const THREADS_QUERY_URL = `${BASE_URL}/api/observability/threads/query`;

type Body = {
  timeRange: { traces: { from: string; to: string } };
  orderBy: Array<{ field: string; direction: string }>;
  page: { limit: number; after?: string };
};

const rollingQuery: ThreadQueryArgs = {
  timeRange: { traces: threadTimeRange },
  orderBy: [{ field: 'startedAt', direction: 'desc' }],
};

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

/** The list always serves `threadRowsPage`; head polls get `headPages` in order, then the last one again. */
function setHandlers(headPages: Array<QueryTraceThreadsResult | { status: number }>) {
  const listBodies: Body[] = [];
  const headBodies: Body[] = [];
  server.use(
    http.post(THREADS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as Body;
      if (!isHeadRequest(body)) {
        listBodies.push(body);
        return HttpResponse.json(threadRowsPage);
      }
      headBodies.push(body);
      const page = headPages[Math.min(headBodies.length, headPages.length) - 1];
      if ('status' in page) return HttpResponse.json({ message: 'nope' }, { status: page.status });
      return HttpResponse.json(page);
    }),
  );
  return { listBodies, headBodies };
}

function renderSource(initialProps: UseThreadsListSourceArgs) {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
  return renderHook((props: UseThreadsListSourceArgs) => useThreadsListSource(props), {
    wrapper: Wrapper,
    initialProps,
  });
}

const nextTick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_POLL_INTERVAL_MS);
  });

const threadIds = (threads: QueryTraceThreadsResult['threads'] | undefined) => threads?.map(thread => thread.threadId);

describe('useThreadsListSource', () => {
  describe('when the window is rolling and threads change while the list is open', () => {
    it('shows the new thread at the top after one poll, without reloading the list', async () => {
      const { listBodies, headBodies } = setHandlers([threadHeadPage]);
      const { result } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(threadIds(result.current.threads)).toEqual(['thread-1', 'thread-2']));
      const polledAfter = Date.now();

      await nextTick();

      await waitFor(() =>
        expect(threadIds(result.current.threads)).toEqual([startedThread.threadId, 'thread-1', 'thread-2']),
      );
      expect(headBodies).toHaveLength(1);
      expect(headBodies[0].orderBy).toEqual([{ field: 'endedAt', direction: 'desc' }]);
      expect(headBodies[0].page).toEqual({ limit: OBSERVABILITY_LIST_HEAD_LIMIT });
      expect(headBodies[0].timeRange.traces.from).toBe(threadTimeRange.from);
      expect(Date.parse(headBodies[0].timeRange.traces.to)).toBeGreaterThanOrEqual(polledAfter);
      expect(listBodies).toHaveLength(1);
    });

    it('updates a thread that got a new trace in place, since its start did not move', async () => {
      setHandlers([threadHeadPage]);
      const { result } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(result.current.threads).toHaveLength(2));

      await nextTick();

      await waitFor(() => expect(result.current.threads).toHaveLength(3));
      const continued = result.current.threads?.find(thread => thread.threadId === 'thread-1');
      expect(continued?.traceCount).toBe(3);
      expect(continued?.lastTraceId).toBe('trace-1c');
      expect(threadIds(result.current.threads)?.slice(1)).toEqual(['thread-1', 'thread-2']);
    });
  });

  describe('when the window is a custom range', () => {
    it('never polls', async () => {
      const { headBodies } = setHandlers([threadHeadPage]);
      const { result } = renderSource({ query: rollingQuery, rolling: false });
      await waitFor(() => expect(result.current.threads).toHaveLength(2));

      await nextTick();
      await nextTick();

      expect(headBodies).toHaveLength(0);
    });
  });

  describe('when auto refresh is off', () => {
    it('never polls', async () => {
      const { headBodies } = setHandlers([threadHeadPage]);
      const { result } = renderSource({ query: rollingQuery, rolling: true, autoRefetch: false });
      await waitFor(() => expect(result.current.threads).toHaveLength(2));

      await nextTick();

      expect(headBodies).toHaveLength(0);
    });
  });

  describe('when more threads changed than one poll can bring', () => {
    it('reloads the first page with a window ending now and drops the polled threads', async () => {
      const { listBodies } = setHandlers([fullThreadHeadPage(OBSERVABILITY_LIST_HEAD_LIMIT, threadTimeRange.to)]);
      const { result } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(result.current.threads).toHaveLength(2));
      const reloadedAfter = Date.now();

      await nextTick();

      await waitFor(() => expect(listBodies).toHaveLength(2));
      expect(listBodies[1].timeRange.traces.from).toBe(threadTimeRange.from);
      expect(Date.parse(listBodies[1].timeRange.traces.to)).toBeGreaterThanOrEqual(reloadedAfter);
      expect(listBodies[1].page.after).toBeUndefined();
      await waitFor(() => expect(threadIds(result.current.threads)).toEqual(['thread-1', 'thread-2']));
    });
  });

  describe('when the server rejects the poll', () => {
    it('stops polling', async () => {
      const { headBodies } = setHandlers([{ status: 422 }]);
      const { result } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(result.current.threads).toHaveLength(2));

      await nextTick();
      await waitFor(() => expect(headBodies).toHaveLength(1));
      await nextTick();
      await nextTick();

      expect(headBodies).toHaveLength(1);
      expect(threadIds(result.current.threads)).toEqual(['thread-1', 'thread-2']);
    });
  });

  describe('when the filters change', () => {
    it('drops the threads polled for the previous filters', async () => {
      setHandlers([threadHeadPage, { threads: [], page: { next: null } }]);
      const { result, rerender } = renderSource({ query: rollingQuery, rolling: true });
      await waitFor(() => expect(result.current.threads).toHaveLength(2));
      await nextTick();
      await waitFor(() => expect(threadIds(result.current.threads)).toContain(startedThread.threadId));

      const where = buildThreadQueryWhere(statusAndRunTokens, []);
      rerender({ query: { ...rollingQuery, ...(where ? { where } : {}) }, rolling: true });

      await waitFor(() => expect(threadIds(result.current.threads)).toEqual(['thread-1', 'thread-2']));
    });
  });
});
