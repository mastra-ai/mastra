import type { TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import type { InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { mergeTraceQueryDelta } from '../use-trace-query';
import { queriedTrace, queriedTraceNewest, traceQueryFirstPage, traceQueryOnlyPage } from './fixtures/traces';

type Page = TraceQueryKeysetTraceResponse;

const pagesOf = (...pages: Page[]): InfiniteData<Page, string | undefined> => ({
  pages,
  pageParams: pages.map((_, index) => (index === 0 ? undefined : `page-cursor-${index}`)),
});
const page = (traces: Page['traces'], next: string | null): Page => ({ traces, page: { next } });
const ids = (data: InfiniteData<Page>) => data.pages.map(p => p.traces.map(trace => trace.traceId));

const at = (minute: number) => `2026-06-10T10:0${minute}:00.000Z`;
const ttfc = (traceId: string, timeToFirstChunkMs: number | null) =>
  queriedTrace(traceId, at(0), { timeToFirstChunkMs });

describe('mergeTraceQueryDelta', () => {
  describe('when the batch brings nothing new', () => {
    it('returns the same data when the batch changes nothing', () => {
      const data = pagesOf(traceQueryFirstPage);

      expect(mergeTraceQueryDelta(data, [])).toBe(data);
      expect(mergeTraceQueryDelta(data, [queriedTrace('trace-long-run', at(0))])).toBe(data);
    });
  });

  describe('when a new trace arrives', () => {
    it('keeps unchanged pages and every page cursor', () => {
      const second = page([queriedTrace('trace-c', at(1))], null);
      const data = pagesOf(traceQueryFirstPage, second);

      const merged = mergeTraceQueryDelta(data, [queriedTrace('trace-fresh', at(9))]);

      expect(merged.pages[1]).toBe(second);
      expect(merged.pages.map(p => p.page.next)).toEqual(['page-cursor-1', null]);
      expect(merged.pageParams).toBe(data.pageParams);
    });

    it('inserts into the first page whose last row sorts after the trace', () => {
      const data = pagesOf(
        page([queriedTrace('trace-a', at(8)), queriedTrace('trace-b', at(6))], 'page-cursor-1'),
        page([queriedTrace('trace-c', at(4)), queriedTrace('trace-d', at(2))], 'page-cursor-2'),
      );

      const merged = mergeTraceQueryDelta(data, [queriedTrace('trace-between', at(5))]);

      expect(ids(merged)).toEqual([
        ['trace-a', 'trace-b'],
        ['trace-between', 'trace-c', 'trace-d'],
      ]);
    });
  });

  describe('when the list is sorted ascending', () => {
    it('follows ascending order', () => {
      const data = pagesOf(page([queriedTrace('trace-a', at(1)), queriedTrace('trace-b', at(3))], null));

      const merged = mergeTraceQueryDelta(
        data,
        [queriedTrace('trace-first', at(0)), queriedTrace('trace-middle', at(2)), queriedTrace('trace-last', at(9))],
        [{ field: 'startedAt', direction: 'asc' }],
      );

      expect(ids(merged)).toEqual([['trace-first', 'trace-a', 'trace-middle', 'trace-b', 'trace-last']]);
    });
  });

  describe('when sorting by time to first chunk', () => {
    it.each(['asc', 'desc'] as const)('sorts traces without a first chunk last when %s', direction => {
      const listed = [ttfc('trace-fast', 100), ttfc('trace-slow', 900)];
      const data = pagesOf(page(direction === 'asc' ? listed : listed.reverse(), null));
      const orderBy = [{ field: 'timeToFirstChunkMs' as const, direction }];

      const merged = mergeTraceQueryDelta(data, [ttfc('trace-no-chunk', null), ttfc('trace-medium', 500)], orderBy);

      expect(ids(merged)[0]).toEqual(
        direction === 'asc'
          ? ['trace-fast', 'trace-medium', 'trace-slow', 'trace-no-chunk']
          : ['trace-slow', 'trace-medium', 'trace-fast', 'trace-no-chunk'],
      );
    });
  });

  describe('when sort values are equal', () => {
    it('breaks ties by ascending traceId', () => {
      const data = pagesOf(page([queriedTrace('trace-a', at(5)), queriedTrace('trace-c', at(5))], null));

      const merged = mergeTraceQueryDelta(data, [queriedTrace('trace-b', at(5))]);

      expect(ids(merged)).toEqual([['trace-a', 'trace-b', 'trace-c']]);
    });
  });

  describe('when a listed trace comes back', () => {
    it('updates a row in place even when its sort value changed', () => {
      const data = pagesOf(traceQueryOnlyPage);
      const moved = { ...queriedTraceNewest, startedAt: at(0), status: 'error' as const };

      const merged = mergeTraceQueryDelta(data, [moved]);

      expect(merged.pages[0]?.traces).toEqual([moved, traceQueryOnlyPage.traces[1]]);
    });
  });
});
