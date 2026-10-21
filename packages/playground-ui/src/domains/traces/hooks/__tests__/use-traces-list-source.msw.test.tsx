// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TRACES_LIST_DELTA_HORIZON_MS,
  TRACES_LIST_DELTA_POLL_INTERVAL_MS,
  TRACES_LIST_REFETCH_INTERVAL_MS,
  useTracesListSource,
} from '../use-traces-list-source';
import { freshTrace, lastTraceQueryPage, traceQueryDeltaBatch } from './fixtures/trace-query';
import { lastLegacyTracePage } from './fixtures/trace-query-legacy';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const OBSERVABILITY_URL = `${BASE_URL}/api/observability`;
const query = (now: Date) => ({ timeRange: { from: '2026-09-01T00:00:00Z', to: now.toISOString() } });

function Wrapper({ children }: { children: ReactNode }) {
  // One client per mount, so `rerender` keeps the cache.
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
  focusManager.setFocused(undefined);
});

function handlers() {
  const post = vi.fn();
  const list = vi.fn();
  server.use(
    http.post(`${OBSERVABILITY_URL}/traces/query`, async ({ request }) => {
      post(await request.json());
      return HttpResponse.json(lastTraceQueryPage);
    }),
    http.get(`${OBSERVABILITY_URL}/traces/light`, () => {
      list();
      return HttpResponse.json(lastLegacyTracePage);
    }),
  );
  return { post, list };
}

describe('useTracesListSource', () => {
  describe('when the server supports trace query', () => {
    it('loads query rows without requesting the legacy list', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.rows[0]?.spanId).toBe('span-b'));
      expect(requests.post).toHaveBeenCalledTimes(1);
      expect(requests.list).not.toHaveBeenCalled();
    });
  });

  describe('when the caller opts out of trace query', () => {
    it('loads rows from the legacy list without requesting trace query', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query, withQueryTrace: false }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(lastLegacyTracePage.spans.length));
      expect(requests.list).toHaveBeenCalled();
      expect(requests.post).not.toHaveBeenCalled();
    });
  });

  describe('when the list is disabled', () => {
    it('does not request any endpoint', async () => {
      const requests = handlers();
      renderHook(() => useTracesListSource({ query, enabled: false }), { wrapper: Wrapper });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests.post).not.toHaveBeenCalled();
      expect(requests.list).not.toHaveBeenCalled();
    });
  });

  describe('when auto refresh is enabled', () => {
    it('advances the time window and stops requests when paused', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      act(() => result.current.setAutoRefetch(false));
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      act(() => result.current.setAutoRefetch(true));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
      const [[firstBody], [secondBody]] = requests.post.mock.calls;
      expect(secondBody.timeRange.to).not.toBe(firstBody.timeRange.to);
      act(() => result.current.setAutoRefetch(false));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
      expect(requests.list).not.toHaveBeenCalled();
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('when a rolling tick returns the same data', () => {
    it('keeps the rows reference', async () => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      const rowsBefore = result.current.rows;
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      act(() => result.current.setAutoRefetch(false));
      act(() => result.current.setAutoRefetch(true));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
      expect(result.current.rows).toBe(rowsBefore);
    });
  });

  describe('when automatic refresh starts disabled', () => {
    it.each([true, false])('does not poll or refetch on focus with rolling=%s', async rolling => {
      const requests = handlers();
      const { result } = renderHook(() => useTracesListSource({ query, rolling, initialAutoRefetch: false }), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      expect(requests.post).toHaveBeenCalledTimes(1);
      await act(async () => {
        await result.current.refetch();
      });
      expect(requests.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('when a fixed window fails while auto refresh is on', () => {
    function failingHandlers(status: number) {
      const post = vi.fn();
      server.use(
        http.post(`${OBSERVABILITY_URL}/traces/query`, () => {
          post();
          return HttpResponse.json({ message: 'The trace query is invalid' }, { status });
        }),
      );
      return post;
    }

    it('stops polling once the server rejects the request', async () => {
      const post = failingHandlers(422);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
      const { result } = renderHook(() => useTracesListSource({ query, rolling: false }), { wrapper: Wrapper });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.error).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(post).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeTruthy();
    });

    it('keeps polling through a server failure', async () => {
      const post = failingHandlers(500);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
      renderHook(() => useTracesListSource({ query, rolling: false }), { wrapper: Wrapper });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(post.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('when the server supports delta polling', () => {
    type TraceQueryBody = { mode?: string; after?: string; timeRange: { from: string; to: string } };

    /** Lists answer with one trace; delta polls answer `deltas` in order, then an idle batch. */
    function deltaHandlers(deltas = [traceQueryDeltaBatch('delta-0'), traceQueryDeltaBatch('delta-1', [freshTrace])]) {
      const listRequests: TraceQueryBody[] = [];
      const deltaRequests: TraceQueryBody[] = [];
      server.use(
        http.post(`${OBSERVABILITY_URL}/traces/query`, async ({ request }) => {
          const body = (await request.json()) as TraceQueryBody;
          if (body.mode !== 'delta') {
            listRequests.push(body);
            return HttpResponse.json(lastTraceQueryPage);
          }
          deltaRequests.push(body);
          return HttpResponse.json(deltas[deltaRequests.length - 1] ?? traceQueryDeltaBatch('delta-idle'));
        }),
      );
      return { listRequests, deltaRequests };
    }

    const nextTick = () =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(TRACES_LIST_DELTA_POLL_INTERVAL_MS);
      });

    const refocus = () =>
      act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

    it('merges new traces from delta polls without reloading the list', async () => {
      const requests = deltaHandlers();
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const { result } = renderHook(() => useTracesListSource({ query, withDeltaPolling: true }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.rows.map(row => row.spanId)).toEqual(['span-b']));
      await waitFor(() => expect(requests.deltaRequests).toHaveLength(1));

      await nextTick();

      await waitFor(() => expect(result.current.rows.map(row => row.spanId)).toEqual(['span-fresh', 'span-b']));
      expect(requests.listRequests).toHaveLength(1);
      expect(requests.deltaRequests.map(body => body.after)).toEqual([undefined, 'delta-0']);
    });

    it('keeps one time range for the list and every poll, reaching past the mount time', async () => {
      const requests = deltaHandlers();
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const mountedAt = Date.now();
      renderHook(() => useTracesListSource({ query, withDeltaPolling: true }), { wrapper: Wrapper });
      await waitFor(() => expect(requests.deltaRequests).toHaveLength(1));

      await nextTick();
      await nextTick();

      await waitFor(() => expect(requests.deltaRequests).toHaveLength(3));
      const ranges = [...requests.listRequests, ...requests.deltaRequests].map(body => body.timeRange);
      expect(new Set(ranges.map(range => JSON.stringify(range))).size).toBe(1);
      for (const range of ranges) {
        expect(Date.parse(range.to)).toBeGreaterThan(mountedAt + TRACES_LIST_DELTA_POLL_INTERVAL_MS * 2);
      }
    });

    it('polls deltas on focus instead of reloading the list', async () => {
      const requests = deltaHandlers();
      const { result } = renderHook(() => useTracesListSource({ query, withDeltaPolling: true }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      await waitFor(() => expect(requests.deltaRequests).toHaveLength(1));

      await refocus();

      await waitFor(() => expect(requests.deltaRequests).toHaveLength(2));
      expect(requests.listRequests).toHaveLength(1);
    });

    it('stops polling and ignores focus once auto refresh is paused', async () => {
      const requests = deltaHandlers();
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const { result } = renderHook(() => useTracesListSource({ query, withDeltaPolling: true }), { wrapper: Wrapper });
      await waitFor(() => expect(requests.deltaRequests).toHaveLength(1));

      act(() => result.current.setAutoRefetch(false));
      await nextTick();
      await nextTick();
      await refocus();

      expect(requests.deltaRequests).toHaveLength(1);
      expect(requests.listRequests).toHaveLength(1);
    });

    it('sends the caller time range unchanged when the window is fixed', async () => {
      const requests = deltaHandlers();
      const fixed = () => ({ timeRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z' } });
      renderHook(() => useTracesListSource({ query: fixed, rolling: false, withDeltaPolling: true }), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(requests.deltaRequests).toHaveLength(1));

      expect([...requests.listRequests, ...requests.deltaRequests].map(body => body.timeRange)).toEqual([
        fixed().timeRange,
        fixed().timeRange,
      ]);
    });

    describe('when the list fails to load', () => {
      /** The list answers `status` first, then its page; delta polls answer idle batches. */
      function failingListHandlers(status: number) {
        const listRequests: TraceQueryBody[] = [];
        server.use(
          http.post(`${OBSERVABILITY_URL}/traces/query`, async ({ request }) => {
            const body = (await request.json()) as TraceQueryBody;
            if (body.mode === 'delta') return HttpResponse.json(traceQueryDeltaBatch('delta-idle'));
            listRequests.push(body);
            return listRequests.length === 1
              ? HttpResponse.json({ error: 'failed' }, { status })
              : HttpResponse.json(lastTraceQueryPage);
          }),
        );
        return { listRequests };
      }

      it.each([{ rolling: true }, { rolling: false }])(
        'retries a transient failure until the list loads (rolling: $rolling)',
        async ({ rolling }) => {
          const requests = failingListHandlers(503);
          vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
          const { result } = renderHook(() => useTracesListSource({ query, rolling, withDeltaPolling: true }), {
            wrapper: Wrapper,
          });
          await waitFor(() => expect(result.current.error).toBeTruthy());

          await act(async () => {
            await vi.advanceTimersByTimeAsync(TRACES_LIST_REFETCH_INTERVAL_MS);
          });

          await waitFor(() => expect(result.current.rows.map(row => row.spanId)).toEqual(['span-b']));
          expect(result.current.error).toBeNull();
          expect(requests.listRequests).toHaveLength(2);
        },
      );

      it('stops retrying once the list loads', async () => {
        const requests = failingListHandlers(503);
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
        const { result } = renderHook(() => useTracesListSource({ query, withDeltaPolling: true }), {
          wrapper: Wrapper,
        });
        await waitFor(() => expect(result.current.error).toBeTruthy());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(TRACES_LIST_REFETCH_INTERVAL_MS);
        });
        await waitFor(() => expect(result.current.rows).toHaveLength(1));

        await act(async () => {
          await vi.advanceTimersByTimeAsync(TRACES_LIST_REFETCH_INTERVAL_MS * 3);
        });

        expect(requests.listRequests).toHaveLength(2);
      });

      it('does not retry a request the server refuses', async () => {
        const requests = failingListHandlers(422);
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
        const { result } = renderHook(() => useTracesListSource({ query, withDeltaPolling: true }), {
          wrapper: Wrapper,
        });
        await waitFor(() => expect(result.current.error).toBeTruthy());

        await act(async () => {
          await vi.advanceTimersByTimeAsync(TRACES_LIST_REFETCH_INTERVAL_MS * 3);
        });

        expect(requests.listRequests).toHaveLength(1);
      });
    });

    describe('when the filters change', () => {
      const byEntity = (entityName: string) => (now: Date) => ({
        ...query(now),
        where: { op: 'eq' as const, left: { path: 'entityName' as const }, right: { literal: entityName } },
      });

      it('re-anchors the window on the current time and starts a new cursor', async () => {
        const requests = deltaHandlers();
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], shouldAdvanceTime: true });
        const mountedAt = new Date('2026-09-01T10:00:00.000Z');
        vi.setSystemTime(mountedAt);
        const { rerender } = renderHook(
          ({ entityName }) => useTracesListSource({ query: byEntity(entityName), withDeltaPolling: true }),
          { wrapper: Wrapper, initialProps: { entityName: 'weather-agent' } },
        );
        await waitFor(() => expect(requests.deltaRequests).toHaveLength(1));

        const changedAt = new Date('2026-09-01T12:00:00.000Z');
        vi.setSystemTime(changedAt);
        rerender({ entityName: 'chef-agent' });

        await waitFor(() => expect(requests.deltaRequests).toHaveLength(2));
        await waitFor(() => expect(requests.listRequests).toHaveLength(2));
        const horizon = (at: Date) => new Date(at.getTime() + TRACES_LIST_DELTA_HORIZON_MS).toISOString();
        expect(requests.listRequests.map(body => body.timeRange.to)).toEqual([horizon(mountedAt), horizon(changedAt)]);
        expect(requests.deltaRequests.map(body => [body.after, body.timeRange.to])).toEqual([
          [undefined, horizon(mountedAt)],
          [undefined, horizon(changedAt)],
        ]);
      });

      it('keeps the window and the cursor when only the sort changes', async () => {
        const requests = deltaHandlers();
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], shouldAdvanceTime: true });
        vi.setSystemTime(new Date('2026-09-01T10:00:00.000Z'));
        const { rerender } = renderHook(
          ({ direction }) =>
            useTracesListSource({ query, orderBy: [{ field: 'startedAt', direction }], withDeltaPolling: true }),
          { wrapper: Wrapper, initialProps: { direction: 'desc' as 'asc' | 'desc' } },
        );
        await waitFor(() => expect(requests.deltaRequests).toHaveLength(1));

        vi.setSystemTime(new Date('2026-09-01T12:00:00.000Z'));
        rerender({ direction: 'asc' });
        await waitFor(() => expect(requests.listRequests).toHaveLength(2));
        await nextTick();

        await waitFor(() => expect(requests.deltaRequests).toHaveLength(2));
        expect(requests.deltaRequests[1]?.after).toBe('delta-0');
        expect(new Set(requests.listRequests.map(body => body.timeRange.to)).size).toBe(1);
      });
    });

    it('does not poll deltas when the caller opts out of trace query', async () => {
      const requests = handlers();
      const { result } = renderHook(
        () => useTracesListSource({ query, withQueryTrace: false, withDeltaPolling: true }),
        { wrapper: Wrapper },
      );
      await waitFor(() => expect(result.current.rows).toHaveLength(lastLegacyTracePage.spans.length));

      expect(requests.list).toHaveBeenCalled();
      expect(requests.post).not.toHaveBeenCalled();
    });
  });

  describe('when the store returns 501', () => {
    it('exposes the query error without requesting a legacy endpoint', async () => {
      const requests = handlers();
      const post = vi.fn();
      server.use(
        http.post(`${OBSERVABILITY_URL}/traces/query`, () => {
          post();
          return HttpResponse.json({ code: 'TRACE_QUERY_UNSUPPORTED', error: 'Unsupported' }, { status: 501 });
        }),
      );
      const { result } = renderHook(() => useTracesListSource({ query }), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.rows).toHaveLength(0);
      expect(post).toHaveBeenCalledTimes(1);
      expect(requests.list).not.toHaveBeenCalled();
    });
  });
});
