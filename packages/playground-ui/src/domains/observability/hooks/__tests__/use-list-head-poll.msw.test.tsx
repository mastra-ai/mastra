// @vitest-environment jsdom
import type { QuerySpansResult } from '@mastra/client-js';
import { MastraReactProvider, useMastraClient } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OBSERVABILITY_LIST_HEAD_LIMIT, OBSERVABILITY_LIST_POLL_INTERVAL_MS } from '../../list-polling';
import { useListHeadPoll } from '../use-list-head-poll';
import type { UseListHeadPollArgs } from '../use-list-head-poll';
import { endedSpan, fullSpanHeadPage, spanHeadPage } from '@/domains/spans/__tests__/fixtures/spans';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SPANS_QUERY_URL = `${BASE_URL}/api/observability/spans/query`;
const WINDOW_FROM = '2026-10-15T00:00:00.000Z';
/** When the list rows were loaded: the overflow check compares head rows with it. */
const LIST_LOADED_AT = Date.parse('2026-10-21T08:30:00.000Z');

type Span = QuerySpansResult['spans'][number];
type HeadBody = { timeRange: { from: string; to: string }; orderBy: unknown; page: { limit: number } };

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

/** Answers head polls with `pages` in order, then repeats the last one. */
function headHandlers(pages: Array<QuerySpansResult | { status: number }>) {
  const bodies: HeadBody[] = [];
  server.use(
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      bodies.push((await request.json()) as HeadBody);
      const page = pages[Math.min(bodies.length, pages.length) - 1];
      if ('status' in page) return HttpResponse.json({ message: 'nope' }, { status: page.status });
      return HttpResponse.json(page);
    }),
  );
  return bodies;
}

type Props = Partial<Pick<UseListHeadPollArgs<Span>, 'enabled' | 'onOverflow'>> & { key?: string };

function renderHeadPoll(initialProps: Props = {}) {
  return renderHook(
    ({ enabled = true, onOverflow, key = 'spans' }: Props) => {
      const client = useMastraClient();
      return useListHeadPoll<Span>({
        queryKey: [key],
        fetchHead: async to => {
          const result = await client.querySpans({
            timeRange: { from: WINDOW_FROM, to },
            orderBy: [{ field: 'endedAt', direction: 'desc' }],
            page: { limit: OBSERVABILITY_LIST_HEAD_LIMIT },
          });
          return result.spans;
        },
        getId: span => `${span.traceId}:${span.spanId}`,
        getEndedAt: span => span.endedAt,
        since: LIST_LOADED_AT,
        enabled,
        onOverflow,
      });
    },
    { wrapper: Wrapper, initialProps },
  );
}

const nextTick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_POLL_INTERVAL_MS);
  });

const headIds = (rows: Span[]) => rows.map(span => span.spanId);

describe('useListHeadPoll', () => {
  describe('when polling is enabled', () => {
    it('asks for the newest rows once per interval and never on mount', async () => {
      const bodies = headHandlers([spanHeadPage]);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const mountedAt = Date.now();
      const { result } = renderHeadPoll();
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      expect(bodies).toHaveLength(0);
      expect(result.current.headRows).toEqual([]);

      await nextTick();

      await waitFor(() => expect(headIds(result.current.headRows)).toEqual(['span-9', 'span-1']));
      expect(bodies).toHaveLength(1);
      expect(bodies[0].timeRange.from).toBe(WINDOW_FROM);
      expect(Date.parse(bodies[0].timeRange.to)).toBeGreaterThanOrEqual(mountedAt);
    });

    it('keeps rows across polls, with the latest version of each', async () => {
      const renamed = { ...endedSpan, name: 'agent run: renamed' };
      headHandlers([spanHeadPage, { spans: [renamed], page: { next: null } }]);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const { result } = renderHeadPoll();

      await nextTick();
      await waitFor(() => expect(result.current.headRows).toHaveLength(2));
      await nextTick();

      await waitFor(() =>
        expect(result.current.headRows.find(span => span.spanId === 'span-9')?.name).toBe('agent run: renamed'),
      );
      expect(result.current.headRows).toHaveLength(2);
    });
  });

  describe('when polling is disabled', () => {
    it('does not ask for the head', async () => {
      const bodies = headHandlers([spanHeadPage]);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      renderHeadPoll({ enabled: false });

      await nextTick();
      await nextTick();

      expect(bodies).toHaveLength(0);
    });
  });

  describe('when a full page ended after the list loaded', () => {
    it('reports an overflow and drops its head rows', async () => {
      headHandlers([spanHeadPage, fullSpanHeadPage(OBSERVABILITY_LIST_HEAD_LIMIT, '2026-10-21T10:00:00.000Z')]);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const onOverflow = vi.fn();
      const { result } = renderHeadPoll({ onOverflow });

      await nextTick();
      await waitFor(() => expect(result.current.headRows).toHaveLength(2));
      expect(onOverflow).not.toHaveBeenCalled();
      await nextTick();

      await waitFor(() => expect(onOverflow).toHaveBeenCalledTimes(1));
      expect(result.current.headRows).toEqual([]);
    });
  });

  describe('when a full page overlaps rows already seen', () => {
    it('merges it without reporting an overflow', async () => {
      headHandlers([fullSpanHeadPage(OBSERVABILITY_LIST_HEAD_LIMIT, '2026-10-21T08:00:00.000Z')]);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const onOverflow = vi.fn();
      const { result } = renderHeadPoll({ onOverflow });

      await nextTick();

      await waitFor(() => expect(result.current.headRows).toHaveLength(OBSERVABILITY_LIST_HEAD_LIMIT));
      expect(onOverflow).not.toHaveBeenCalled();
    });
  });

  describe('when the server rejects the head request', () => {
    it('stops polling', async () => {
      const bodies = headHandlers([{ status: 422 }]);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      renderHeadPoll();

      await nextTick();
      await waitFor(() => expect(bodies).toHaveLength(1));
      await nextTick();
      await nextTick();

      expect(bodies).toHaveLength(1);
    });
  });

  describe('when the head request fails transiently', () => {
    it('tries again on the next interval and keeps earlier rows', async () => {
      // The client retries a 500 itself, so the handler answers whatever the test currently sets.
      const renamed = { ...endedSpan, name: 'agent run: renamed' };
      let respond = () => HttpResponse.json(spanHeadPage);
      server.use(http.post(SPANS_QUERY_URL, () => respond()));
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const { result } = renderHeadPoll();

      await nextTick();
      await waitFor(() => expect(result.current.headRows).toHaveLength(2));
      respond = () => HttpResponse.json({ message: 'unavailable' }, { status: 500 });
      await nextTick();
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1_000));
      });
      expect(result.current.headRows).toHaveLength(2);
      respond = () => HttpResponse.json({ spans: [renamed], page: { next: null } });
      await nextTick();

      await waitFor(() =>
        expect(result.current.headRows.find(span => span.spanId === 'span-9')?.name).toBe('agent run: renamed'),
      );
    });
  });

  describe('when the list query changes', () => {
    it('starts over with no head rows', async () => {
      headHandlers([spanHeadPage]);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
      const { result, rerender } = renderHeadPoll({ key: 'before' });

      await nextTick();
      await waitFor(() => expect(result.current.headRows).toHaveLength(2));
      rerender({ key: 'after' });

      expect(result.current.headRows).toEqual([]);
    });
  });
});
