// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/msw-server';
import { useBranch } from '../use-branch';
import { useTraceOrBranchSpans } from '../use-trace-or-branch-spans';
import { useTraceSpans, useTraceSpansQueries } from '../use-trace-spans';
import { emptyTrace, otherTrace, resumedTrace, runningTrace, suspendedTrace } from './fixtures/trace-spans';

const BASE_URL = 'http://localhost:4111';
const traceId = suspendedTrace.traceId;
let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

function serveTrace(initial = suspendedTrace) {
  let response = initial;
  const requested = vi.fn();
  server.use(
    http.get(`${BASE_URL}/api/observability/traces/${traceId}`, () => {
      requested();
      return HttpResponse.json(response);
    }),
  );
  return { requested, resume: () => (response = resumedTrace) };
}

const expireCache = () => act(() => vi.advanceTimersByTimeAsync(10_000));
const refocus = () =>
  act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(1);
  });
const reconnect = () =>
  act(async () => {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(1);
  });
const waitFor = (assertion: () => void) =>
  vi.waitFor(async () => {
    await act(() => vi.advanceTimersByTimeAsync(1));
    assertion();
  });

describe('Trace span refresh', () => {
  describe.each([
    ['running', runningTrace],
    ['suspended', suspendedTrace],
    ['empty', emptyTrace],
  ] as const)('when a %s trace gains spans before ten seconds have passed', (_, initial) => {
    it('refreshes immediately on reopening', async () => {
      const api = serveTrace(initial);
      const first = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
      first.unmount();
      api.resume();
      const reopened = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(reopened.result.current.data?.spans).toHaveLength(2));
      expect(api.requested).toHaveBeenCalledTimes(2);
    });

    it('refreshes immediately on focus', async () => {
      const api = serveTrace(initial);
      const { result } = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(initial.spans.length));
      api.resume();
      await refocus();
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(2));
    });
  });

  describe('when a trace resumes after all known spans have ended', () => {
    it('updates the open trace when Studio regains focus', async () => {
      const api = serveTrace();
      const { result } = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(1));
      api.resume();
      await expireCache();
      await refocus();
      await waitFor(() => expect(result.current.data?.spans.map(s => s.spanId)).toEqual(['root', 'resumed']));
    });

    it('refreshes an expired snapshot when a trace is reopened', async () => {
      const api = serveTrace();
      const first = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(first.result.current.data?.spans).toHaveLength(1));
      first.unmount();
      api.resume();
      await expireCache();
      const second = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(second.result.current.data?.spans).toHaveLength(2));
    });
  });

  describe('when a trace initially has no exported spans', () => {
    it('discovers spans arriving later', async () => {
      const api = serveTrace(emptyTrace);
      const { result } = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(0));
      api.resume();
      await expireCache();
      await refocus();
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(2));
    });
  });

  describe('when the thread rail already observes the trace', () => {
    it('shows cached data immediately and refreshes it for both the panel and rail', async () => {
      const api = serveTrace();
      const rail = renderHook(
        () =>
          useTraceSpansQueries(
            [traceId],
            (_, data) => data.spans.length,
            () => 0,
          ),
        {
          wrapper: Wrapper,
        },
      );
      await waitFor(() => expect(rail.result.current).toEqual([1]));
      api.resume();
      const panel = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      expect(panel.result.current.data?.spans).toHaveLength(1);
      await waitFor(() => expect(panel.result.current.data?.spans).toHaveLength(2));
      await waitFor(() => expect(rail.result.current).toEqual([2]));
      expect(api.requested).toHaveBeenCalledTimes(2);
    });

    it('does not poll every trace in the rail', async () => {
      const api = serveTrace();
      const rail = renderHook(
        () =>
          useTraceSpansQueries(
            [traceId],
            (_, data) => data.spans.length,
            () => 0,
          ),
        {
          wrapper: Wrapper,
        },
      );
      await waitFor(() => expect(rail.result.current).toEqual([1]));
      await expireCache();
      expect(api.requested).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the trace detail panel is open', () => {
    it('refreshes expired data on focus through the panel data source', async () => {
      const api = serveTrace();
      const { result } = renderHook(() => useTraceOrBranchSpans({ traceId, listMode: 'traces' }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.spans).toHaveLength(1));
      api.resume();
      await expireCache();
      await refocus();
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
    });

    it('refreshes immediately when connectivity returns', async () => {
      const api = serveTrace();
      const { result } = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(1));
      api.resume();
      await reconnect();
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(2));
    });

    it('does not poll while the panel remains open', async () => {
      const api = serveTrace();
      const { result } = renderHook(() => useTraceOrBranchSpans({ traceId, listMode: 'traces' }), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(result.current.spans).toHaveLength(1));
      api.resume();
      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(api.requested).toHaveBeenCalledTimes(1);
      expect(result.current.spans).toHaveLength(1);
    });
  });

  describe('when a history row reads a trace', () => {
    it('does not refetch on focus, remount, or a timer', async () => {
      const api = serveTrace();
      const first = renderHook(() => useTraceSpans(traceId, { passive: true }), { wrapper: Wrapper });
      await waitFor(() => expect(first.result.current.data?.spans).toHaveLength(1));
      await expireCache();
      await refocus();
      await reconnect();
      first.unmount();
      const second = renderHook(() => useTraceSpans(traceId, { passive: true }), { wrapper: Wrapper });
      await expireCache();
      expect(second.result.current.data?.spans).toHaveLength(1);
      expect(api.requested).toHaveBeenCalledTimes(1);
    });

    it('receives updates from the active detail without scheduling its own requests', async () => {
      const api = serveTrace();
      const history = renderHook(() => useTraceSpans(traceId, { passive: true }), { wrapper: Wrapper });
      await waitFor(() => expect(history.result.current.data?.spans).toHaveLength(1));
      const detail = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(api.requested).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(detail.result.current.isFetching).toBe(false));
      api.resume();
      await refocus();
      await waitFor(() => expect(history.result.current.data?.spans).toHaveLength(2));
      expect(api.requested).toHaveBeenCalledTimes(3);
      detail.unmount();
      await refocus();
      expect(api.requested).toHaveBeenCalledTimes(3);
    });
  });

  describe('when cached trace data is invalidated', () => {
    it('refreshes the shared trace query', async () => {
      const api = serveTrace();
      const { result } = renderHook(() => useTraceSpans(traceId), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(1));
      api.resume();
      await act(() => queryClient.invalidateQueries({ queryKey: ['trace-spans', traceId] }));
      await waitFor(() => expect(result.current.data?.spans).toHaveLength(2));
    });
  });

  describe('when a long thread rail is mounted', () => {
    it('does not download historical traces on focus', async () => {
      const ids = Array.from({ length: 100 }, (_, index) => `history-${index}`);
      const requested = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/:traceId`, ({ params }) => {
          requested(params.traceId);
          return HttpResponse.json({ ...suspendedTrace, traceId: String(params.traceId) });
        }),
      );
      const rail = renderHook(
        () =>
          useTraceSpansQueries(
            ids,
            (_, data) => data.spans.length,
            () => 0,
          ),
        { wrapper: Wrapper },
      );
      await waitFor(() => expect(rail.result.current.every(count => count === 1)).toBe(true));
      expect(requested).toHaveBeenCalledTimes(100);
      await expireCache();
      await refocus();
      await reconnect();
      rail.unmount();
      renderHook(
        () =>
          useTraceSpansQueries(
            ids,
            (_, data) => data.spans.length,
            () => 0,
          ),
        { wrapper: Wrapper },
      );
      await expireCache();
      expect(requested).toHaveBeenCalledTimes(100);
    });
  });

  describe('when the rail observes multiple traces', () => {
    it('preserves trace order and per-trace loading fallbacks', async () => {
      serveTrace();
      server.use(http.get(`${BASE_URL}/api/observability/traces/other`, () => HttpResponse.json(otherTrace)));
      const { result } = renderHook(
        () =>
          useTraceSpansQueries(
            ['other', traceId],
            (id, data) => `${id}:${data.spans.length}`,
            id => `loading:${id}`,
          ),
        { wrapper: Wrapper },
      );
      expect(result.current).toEqual(['loading:other', `loading:${traceId}`]);
      await waitFor(() => expect(result.current).toEqual(['other:0', `${traceId}:1`]));
    });
  });

  describe('when the detail panel displays a branch', () => {
    it('loads only the requested branch and retains its anchor', async () => {
      const api = serveTrace();
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/${traceId}/branches/root`, () =>
          HttpResponse.json(suspendedTrace),
        ),
      );
      const { result } = renderHook(
        () => useTraceOrBranchSpans({ traceId, anchorSpanId: 'root', listMode: 'branches' }),
        {
          wrapper: Wrapper,
        },
      );
      expect(result.current.isLoading).toBe(true);
      expect(result.current.spans).toBeUndefined();
      await waitFor(() => expect(result.current.spans).toHaveLength(1));
      expect(result.current.anchorSpanId).toBe('root');
      expect(result.current.isError).toBe(false);
      expect(api.requested).not.toHaveBeenCalled();
    });
  });

  describe('when a finished branch gains late spans', () => {
    it('refreshes immediately on focus', async () => {
      let response = suspendedTrace;
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/${traceId}/branches/root`, () => HttpResponse.json(response)),
      );
      const { result } = renderHook(
        () => useTraceOrBranchSpans({ traceId, anchorSpanId: 'root', listMode: 'branches' }),
        { wrapper: Wrapper },
      );
      await waitFor(() => expect(result.current.spans).toHaveLength(1));
      response = resumedTrace;
      await refocus();
      await waitFor(() => expect(result.current.spans).toHaveLength(2));
    });

    it('refreshes immediately on reopening', async () => {
      let response = suspendedTrace;
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/${traceId}/branches/root`, () => HttpResponse.json(response)),
      );
      const first = renderHook(() => useTraceOrBranchSpans({ traceId, anchorSpanId: 'root', listMode: 'branches' }), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(first.result.current.spans).toHaveLength(1));
      first.unmount();
      response = resumedTrace;
      const second = renderHook(() => useTraceOrBranchSpans({ traceId, anchorSpanId: 'root', listMode: 'branches' }), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(second.result.current.spans).toHaveLength(2));
    });
  });

  describe.each([
    { traceId: null, spanId: 'root' },
    { traceId, spanId: null },
    { traceId: null, spanId: null },
  ])('when branch identifiers are incomplete ($traceId, $spanId)', args => {
    it('does not start a request on mount or focus', async () => {
      const { result } = renderHook(() => useBranch(args), { wrapper: Wrapper });
      await refocus();
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('reports the missing identifiers on explicit refetch', async () => {
      const { result } = renderHook(() => useBranch(args), { wrapper: Wrapper });
      await act(async () => {
        const refreshed = await result.current.refetch();
        expect(refreshed.error?.message).toBe('traceId and spanId are required');
      });
    });
  });

  describe('when the same branch is requested at different depths', () => {
    it('keeps independent results and supports targeted invalidation', async () => {
      const requested = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/observability/traces/${traceId}/branches/root`, ({ request }) => {
          const depth = new URL(request.url).searchParams.get('depth');
          requested(depth);
          return HttpResponse.json(depth === '1' ? suspendedTrace : resumedTrace);
        }),
      );
      const { result } = renderHook(
        () => ({
          shallow: useBranch({ traceId, spanId: 'root', depth: 1 }),
          deep: useBranch({ traceId, spanId: 'root', depth: 2 }),
        }),
        { wrapper: Wrapper },
      );
      await waitFor(() => {
        expect(result.current.shallow.data?.spans).toHaveLength(1);
        expect(result.current.deep.data?.spans).toHaveLength(2);
      });
      requested.mockClear();
      await act(() => queryClient.invalidateQueries({ queryKey: ['branch', traceId, 'root', 1] }));
      expect(requested.mock.calls).toEqual([['1']]);
    });
  });

  describe('when a branch has no anchor', () => {
    it('disables fetching and returns no anchor', async () => {
      const { result } = renderHook(
        () => useTraceOrBranchSpans({ traceId, anchorSpanId: null, listMode: 'branches' }),
        {
          wrapper: Wrapper,
        },
      );
      await expireCache();
      expect(result.current.anchorSpanId).toBeUndefined();
      expect(result.current.spans).toBeUndefined();
    });
  });

  describe('when a disabled trace is manually refetched', () => {
    it('reports the missing trace ID', async () => {
      const { result } = renderHook(() => useTraceSpans(undefined), { wrapper: Wrapper });
      await act(async () => {
        const refreshed = await result.current.refetch();
        expect(refreshed.error?.message).toBe('Trace ID is required');
      });
    });
  });

  describe('when no trace is selected', () => {
    it('does not fetch or poll', async () => {
      const api = serveTrace();
      const { result } = renderHook(() => useTraceSpans(undefined), { wrapper: Wrapper });
      await expireCache();
      expect(result.current.fetchStatus).toBe('idle');
      expect(api.requested).not.toHaveBeenCalled();
    });
  });
});
