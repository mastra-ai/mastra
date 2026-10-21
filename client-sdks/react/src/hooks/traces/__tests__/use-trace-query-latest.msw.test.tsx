// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import type { TraceQueryKeysetTraceResponse, TraceQueryResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import type { TraceQueryArgs } from '../use-trace-query';
import { useTraceQuery, useTraceQueryLatest } from '../use-trace-query';
import {
  deltaTraceFresh,
  deltaTraceLongRun,
  deltaTraceOldestFailed,
  queriedTraceNewest,
  queriedTraceOldest,
  traceQueryDeltaBatch,
  traceQueryFirstPage,
  traceQueryOnlyPage,
} from './fixtures/traces';

type TraceQueryBody = Record<string, unknown> & {
  mode?: string;
  after?: string;
  orderBy?: TraceQueryArgs['orderBy'];
  page?: { after?: string | null };
};
type ListReply = TraceQueryKeysetTraceResponse | ((body: TraceQueryBody) => Promise<TraceQueryKeysetTraceResponse>);
type DeltaReply = Extract<TraceQueryResponse, { delta: unknown }> | Response;

const BASE_URL = 'http://localhost:4111';
const QUERY_URL = `${BASE_URL}/api/observability/traces/query`;
const POLL_MS = 10_000;

const query: TraceQueryArgs = {
  timeRange: { from: '2026-06-10T00:00:00.000Z', to: '2026-06-11T00:00:00.000Z' },
  where: { op: 'eq', left: { path: 'entityType' }, right: { literal: 'agent' } },
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

/** Serves the list pages and answers delta polls in order; polls past the script get an empty batch. */
function serveTraceQuery({ list, deltas }: { list: ListReply; deltas: DeltaReply[] }) {
  const listRequests: TraceQueryBody[] = [];
  const deltaRequests: TraceQueryBody[] = [];
  server.use(
    http.post(QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as TraceQueryBody;
      if (body.mode !== 'delta') {
        listRequests.push(body);
        return HttpResponse.json(typeof list === 'function' ? await list(body) : list);
      }
      deltaRequests.push(body);
      const reply = deltas[deltaRequests.length - 1] ?? traceQueryDeltaBatch('delta-cursor-idle');
      return reply instanceof Response ? reply : HttpResponse.json(reply);
    }),
  );
  return { listRequests, deltaRequests };
}

function renderLiveList({ enabled = true }: { enabled?: boolean } = {}) {
  const renderedRows: { traceId: string }[][] = [];
  const view = renderHook(
    ({ query }: { query: TraceQueryArgs }) => {
      const list = useTraceQuery({ query });
      const latest = useTraceQueryLatest({
        query,
        enabled,
        refetchInterval: POLL_MS,
        // Assertions read cursor and status fields that a render never reads.
        queryOptions: { notifyOnChangeProps: 'all' },
      });
      if (list.data && renderedRows.at(-1) !== list.data) renderedRows.push(list.data);
      return { list, latest };
    },
    { wrapper: makeWrapper(), initialProps: { query } },
  );
  return { ...view, renderedRows };
}

async function renderLoadedLiveList() {
  const view = renderLiveList();
  await waitFor(() => {
    expect(view.result.current.list.data).toBeDefined();
    expect(view.result.current.latest.isSuccess).toBe(true);
  });
  return view;
}

const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(POLL_MS));
const traceIds = (rows: { traceId: string }[] | undefined) => rows?.map(row => row.traceId);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useTraceQueryLatest', () => {
  describe('when the list mounts', () => {
    it('establishes a cursor for the same selection without changing the rows', async () => {
      const { deltaRequests } = serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [traceQueryDeltaBatch('delta-cursor-0')],
      });

      const { result } = await renderLoadedLiveList();

      expect(deltaRequests).toEqual([{ timeRange: query.timeRange, where: query.where, mode: 'delta' }]);
      expect(result.current.latest.data).toEqual({ deltaCursor: 'delta-cursor-0' });
      expect(traceIds(result.current.list.data)).toEqual(['trace-newest', 'trace-oldest']);
    });
  });

  describe('when the poll interval elapses', () => {
    it('asks for traces since the previous cursor and shows a new trace at the top', async () => {
      const { deltaRequests, listRequests } = serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [traceQueryDeltaBatch('delta-cursor-0'), traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh])],
      });
      const { result } = await renderLoadedLiveList();

      await nextPoll();

      await waitFor(() =>
        expect(traceIds(result.current.list.data)).toEqual(['trace-fresh', 'trace-newest', 'trace-oldest']),
      );
      expect(deltaRequests[1]).toEqual({
        timeRange: query.timeRange,
        where: query.where,
        mode: 'delta',
        after: 'delta-cursor-0',
        limit: 100,
      });
      expect(result.current.latest.data).toEqual({ deltaCursor: 'delta-cursor-1' });
      expect(listRequests).toHaveLength(1);
    });

    it('updates a listed trace in place instead of adding it twice', async () => {
      serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [
          traceQueryDeltaBatch('delta-cursor-0'),
          traceQueryDeltaBatch('delta-cursor-1', [deltaTraceOldestFailed]),
        ],
      });
      const { result } = await renderLoadedLiveList();

      await nextPoll();

      await waitFor(() => expect(result.current.list.data).toEqual([queriedTraceNewest, deltaTraceOldestFailed]));
    });

    it('drains every batch the server has before showing them', async () => {
      const { deltaRequests } = serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [
          traceQueryDeltaBatch('delta-cursor-0'),
          traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh], true),
          traceQueryDeltaBatch('delta-cursor-2', [deltaTraceOldestFailed]),
        ],
      });
      const { result, renderedRows } = await renderLoadedLiveList();

      await nextPoll();
      await waitFor(() => expect(result.current.latest.data).toEqual({ deltaCursor: 'delta-cursor-2' }));

      expect(deltaRequests.map(body => body.after)).toEqual([undefined, 'delta-cursor-0', 'delta-cursor-1']);
      expect(renderedRows.map(traceIds)).toEqual([
        ['trace-newest', 'trace-oldest'],
        ['trace-fresh', 'trace-newest', 'trace-oldest'],
      ]);
      expect(result.current.list.data).toEqual([deltaTraceFresh, queriedTraceNewest, deltaTraceOldestFailed]);
    });
  });

  describe('when a new trace sorts after the last loaded row', () => {
    it('leaves it to pagination while more pages remain', async () => {
      serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [
          traceQueryDeltaBatch('delta-cursor-0'),
          traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh, deltaTraceLongRun]),
        ],
      });
      const { result } = await renderLoadedLiveList();

      await nextPoll();

      await waitFor(() =>
        expect(traceIds(result.current.list.data)).toEqual(['trace-fresh', 'trace-newest', 'trace-oldest']),
      );
      expect(result.current.list.hasNextPage).toBe(true);
    });

    it('appends it when the list is fully loaded', async () => {
      serveTraceQuery({
        list: traceQueryOnlyPage,
        deltas: [traceQueryDeltaBatch('delta-cursor-0'), traceQueryDeltaBatch('delta-cursor-1', [deltaTraceLongRun])],
      });
      const { result } = await renderLoadedLiveList();

      await nextPoll();

      await waitFor(() =>
        expect(result.current.list.data).toEqual([queriedTraceNewest, queriedTraceOldest, deltaTraceLongRun]),
      );
    });
  });

  describe('when the list is re-sorted', () => {
    it('keeps the cursor and merges into the re-sorted list', async () => {
      const ascending: TraceQueryArgs = { ...query, orderBy: [{ field: 'startedAt', direction: 'asc' }] };
      const { deltaRequests, listRequests } = serveTraceQuery({
        list: async body =>
          body.orderBy?.[0]?.direction === 'asc'
            ? { ...traceQueryOnlyPage, traces: [...traceQueryOnlyPage.traces].reverse() }
            : traceQueryOnlyPage,
        deltas: [traceQueryDeltaBatch('delta-cursor-0'), traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh])],
      });
      const { result, rerender } = await renderLoadedLiveList();

      rerender({ query: ascending });
      await waitFor(() => expect(traceIds(result.current.list.data)).toEqual(['trace-oldest', 'trace-newest']));
      await nextPoll();

      await waitFor(() =>
        expect(traceIds(result.current.list.data)).toEqual(['trace-oldest', 'trace-newest', 'trace-fresh']),
      );
      expect(listRequests).toHaveLength(2);
      expect(deltaRequests.map(body => body.after)).toEqual([undefined, 'delta-cursor-0']);
    });
  });

  describe('when two lists show the same query with different page sizes', () => {
    it('merges a new trace into both lists', async () => {
      server.use(
        http.post(QUERY_URL, async ({ request }) => {
          const body = (await request.json()) as TraceQueryBody;
          if (body.mode !== 'delta') return HttpResponse.json(traceQueryOnlyPage);
          if (body.after === undefined) return HttpResponse.json(traceQueryDeltaBatch('delta-cursor-0'));
          if (body.after === 'delta-cursor-0') {
            return HttpResponse.json(traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh]));
          }
          return HttpResponse.json(traceQueryDeltaBatch('delta-cursor-idle'));
        }),
      );
      const live = (limit: number) => {
        const list = useTraceQuery({ query, limit });
        useTraceQueryLatest({ query, limit, refetchInterval: POLL_MS });
        return list;
      };
      const { result } = renderHook(() => ({ wide: live(25), narrow: live(10) }), { wrapper: makeWrapper() });
      await waitFor(() => {
        expect(result.current.wide.data).toBeDefined();
        expect(result.current.narrow.data).toBeDefined();
      });

      await nextPoll();

      await waitFor(() => {
        expect(traceIds(result.current.wide.data)?.[0]).toBe('trace-fresh');
        expect(traceIds(result.current.narrow.data)?.[0]).toBe('trace-fresh');
      });
    });
  });

  describe('when a poll lands while the next page is loading', () => {
    it('asks again from the same cursor once the page arrives, without losing the trace', async () => {
      let releaseNextPage = () => {};
      const nextPageHeld = new Promise<void>(resolve => (releaseNextPage = resolve));
      const { deltaRequests } = serveTraceQuery({
        list: async body => {
          if (!body.page?.after) return traceQueryFirstPage;
          await nextPageHeld;
          return { traces: [deltaTraceLongRun], page: { next: null } };
        },
        // The server answers the same cursor with the same traces.
        deltas: [
          traceQueryDeltaBatch('delta-cursor-0'),
          traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh]),
          traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh]),
        ],
      });
      const { result } = await renderLoadedLiveList();

      act(() => {
        result.current.list.fetchNextPage();
      });
      await waitFor(() => expect(result.current.list.isFetchingNextPage).toBe(true));
      await nextPoll();
      await waitFor(() => expect(deltaRequests).toHaveLength(2));
      await waitFor(() => expect(result.current.latest.isFetching).toBe(false));
      expect(result.current.latest.data).toEqual({ deltaCursor: 'delta-cursor-0' });

      releaseNextPage();
      await waitFor(() =>
        expect(traceIds(result.current.list.data)).toEqual(['trace-newest', 'trace-oldest', 'trace-long-run']),
      );
      await nextPoll();

      await waitFor(() =>
        expect(traceIds(result.current.list.data)).toEqual([
          'trace-fresh',
          'trace-newest',
          'trace-oldest',
          'trace-long-run',
        ]),
      );
      expect(deltaRequests.map(body => body.after)).toEqual([undefined, 'delta-cursor-0', 'delta-cursor-0']);
      expect(result.current.latest.data).toEqual({ deltaCursor: 'delta-cursor-1' });
    });
  });

  describe('when the server no longer accepts the cursor', () => {
    it('starts over with a fresh cursor', async () => {
      const { deltaRequests } = serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [
          traceQueryDeltaBatch('delta-cursor-0'),
          HttpResponse.json({ error: 'Cursor no longer matches the query' }, { status: 409 }),
          traceQueryDeltaBatch('delta-cursor-restart'),
          traceQueryDeltaBatch('delta-cursor-after-restart', [deltaTraceFresh]),
        ],
      });
      const { result } = await renderLoadedLiveList();

      await nextPoll();
      await waitFor(() => expect(result.current.latest.data).toEqual({ deltaCursor: 'delta-cursor-restart' }));
      expect(result.current.latest.isError).toBe(false);

      await nextPoll();
      await waitFor(() => expect(traceIds(result.current.list.data)?.[0]).toBe('trace-fresh'));
      expect(deltaRequests.map(body => body.after)).toEqual([
        undefined,
        'delta-cursor-0',
        undefined,
        'delta-cursor-restart',
      ]);
    });
  });

  describe('when the server refuses the poll', () => {
    it.each([
      { status: 501, reason: 'does not support delta polling' },
      { status: 422, reason: 'rejects the query' },
    ])('stops polling and keeps the rows when it $reason', async ({ status }) => {
      const { deltaRequests } = serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [traceQueryDeltaBatch('delta-cursor-0'), HttpResponse.json({ error: 'refused' }, { status })],
      });
      const { result } = await renderLoadedLiveList();

      await nextPoll();
      await waitFor(() => expect(result.current.latest.isError).toBe(true));
      await nextPoll();
      await nextPoll();

      expect(deltaRequests).toHaveLength(2);
      expect(traceIds(result.current.list.data)).toEqual(['trace-newest', 'trace-oldest']);
    });
  });

  describe('when the server fails transiently', () => {
    it('keeps polling from the last good cursor', async () => {
      const { deltaRequests } = serveTraceQuery({
        list: traceQueryFirstPage,
        deltas: [
          traceQueryDeltaBatch('delta-cursor-0'),
          HttpResponse.json({ error: 'unavailable' }, { status: 503 }),
          traceQueryDeltaBatch('delta-cursor-1', [deltaTraceFresh]),
        ],
      });
      const { result } = await renderLoadedLiveList();

      await nextPoll();
      await waitFor(() => expect(result.current.latest.isError).toBe(true));
      await nextPoll();

      await waitFor(() => expect(traceIds(result.current.list.data)?.[0]).toBe('trace-fresh'));
      expect(deltaRequests.map(body => body.after)).toEqual([undefined, 'delta-cursor-0', 'delta-cursor-0']);
    });
  });

  describe('when disabled', () => {
    it('never polls', async () => {
      const { deltaRequests } = serveTraceQuery({ list: traceQueryFirstPage, deltas: [] });
      const { result } = renderLiveList({ enabled: false });
      await waitFor(() => expect(result.current.list.data).toBeDefined());

      await nextPoll();
      await nextPoll();

      expect(deltaRequests).toHaveLength(0);
      expect(result.current.latest.fetchStatus).toBe('idle');
    });
  });
});
