import { MastraStorage, TABLE_TRACES } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createRootSpan,
  createChildSpan,
  setupMultiSpanTestData,
  setupSingleSpanTestData,
  setupNestedTestData,
  findRootSpan,
  findSpansByParentId,
  findSpanByName,
} from './data';

export function createTraceTests({ storage }: { storage: MastraStorage }) {
  // Constants to make test data sizes clear
  const TEST_DATA_SIZES = {
    PAGINATION_TRACES: 18,
    PROD_TRACES: 8,
    DEV_TRACES: 5,
  } as const;
  describe('traces', () => {
    describe('trace retrieval', () => {
      let testSpans: any[];
      let testTraceId: string;
      let singleSpanTraceId: string;
      let singleSpan: any;
      let nestedTraceId: string;
      let nestedSpans: any[];

      beforeAll(async () => {
        if (!storage.stores?.traces) {
          throw new Error('Traces storage not available');
        }
        await storage.clearTable({ tableName: TABLE_TRACES });

        const multiSpanData = setupMultiSpanTestData();
        testTraceId = multiSpanData.traceId;
        testSpans = multiSpanData.spans;

        const singleSpanData = setupSingleSpanTestData();
        singleSpanTraceId = singleSpanData.traceId;
        singleSpan = singleSpanData.span;

        const nestedData = setupNestedTestData();
        nestedTraceId = nestedData.traceId;
        nestedSpans = nestedData.spans;

        await storage.batchInsert({
          tableName: TABLE_TRACES,
          records: [...testSpans, singleSpan, ...nestedSpans].map(r => r as any),
        });
      });

      it('should return all spans for a given trace ID', async () => {
        const traceRecord = await storage.getTrace(testTraceId);

        expect(traceRecord.id).toBe(testTraceId);
        expect(traceRecord.spans).toHaveLength(testSpans.length);
        expect(traceRecord.spans.map(s => s.traceId)).toEqual(Array(testSpans.length).fill(testTraceId));

        const rootSpan = findRootSpan(traceRecord.spans);
        const childSpans = findSpansByParentId(traceRecord.spans, rootSpan?.id);

        expect(rootSpan).toBeDefined();
        expect(childSpans).toHaveLength(2);
        expect(childSpans.every(s => s.parentSpanId === rootSpan?.id)).toBe(true);
      });

      it('should throw error when trace ID is not found', async () => {
        const nonExistentTraceId = 'non-existent-trace-123';
        await expect(storage.getTrace(nonExistentTraceId)).rejects.toThrow();
      });

      it('should return trace with single span when trace has only one span', async () => {
        const traceRecord = await storage.getTrace(singleSpanTraceId);

        expect(traceRecord.id).toBe(singleSpanTraceId);
        expect(traceRecord.spans).toHaveLength(1);
        expect(traceRecord.spans[0]?.traceId).toBe(singleSpanTraceId);
        expect(traceRecord.spans[0]?.name).toBe('single-span');
      });

      it('should work with deeply nested span hierarchies', async () => {
        const traceRecord = await storage.getTrace(nestedTraceId);

        expect(traceRecord.id).toBe(nestedTraceId);
        expect(traceRecord.spans).toHaveLength(nestedSpans.length);

        const rootSpan = findRootSpan(traceRecord.spans);
        const directChildren = findSpansByParentId(traceRecord.spans, rootSpan?.id);

        expect(rootSpan).toBeDefined();
        expect(directChildren).toHaveLength(2);

        // Find the specific child span that has grandchildren (database-query)
        const dbQuerySpan = findSpanByName(traceRecord.spans, 'database-query');
        const externalApiSpan = findSpanByName(traceRecord.spans, 'external-api-call');

        expect(dbQuerySpan).toBeDefined();
        expect(externalApiSpan).toBeDefined();

        // Verify that database-query span has grandchildren
        const grandchildren = findSpansByParentId(traceRecord.spans, dbQuerySpan?.id);
        expect(grandchildren).toHaveLength(1);
      });
    });

    describe('pagination', () => {
      let paginationSpans: any[];
      const PAGINATION_SCOPE = 'libsql-test-scope-traces';

      beforeAll(async () => {
        if (!storage.stores?.traces) {
          throw new Error('Traces storage not available');
        }

        await storage.clearTable({ tableName: TABLE_TRACES });

        // Create pagination test data with both parent and child spans
        const parentSpans = Array.from({ length: TEST_DATA_SIZES.PAGINATION_TRACES }, (_, i) =>
          createRootSpan(`test-trace-${i}`, `trace-${i}`, PAGINATION_SCOPE),
        );

        // Create some child spans for a few of the parent spans
        const childSpans = [
          createChildSpan('child-operation-1', 'trace-0', parentSpans[0]?.id!, PAGINATION_SCOPE),
          createChildSpan('child-operation-2', 'trace-0', parentSpans[0]?.id!, PAGINATION_SCOPE),
          createChildSpan('child-operation-3', 'trace-5', parentSpans[5]?.id!, PAGINATION_SCOPE),
          createChildSpan('child-operation-4', 'trace-10', parentSpans[10]?.id!, PAGINATION_SCOPE),
          createChildSpan('child-operation-5', 'trace-15', parentSpans[15]?.id!, PAGINATION_SCOPE),
        ];

        paginationSpans = [...parentSpans, ...childSpans];

        await storage.batchInsert({
          tableName: TABLE_TRACES,
          records: paginationSpans.map(r => r as any),
        });
      });

      it('should return paginated traces with correct metadata', async () => {
        const page1 = await storage.getTracesPaginated({
          scope: PAGINATION_SCOPE,
          page: 0,
          perPage: 8,
        });

        expect(page1.traces).toHaveLength(8);
        expect(page1.total).toBe(TEST_DATA_SIZES.PAGINATION_TRACES);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(8);
        expect(page1.hasMore).toBe(true);
      });

      it('should handle last page correctly', async () => {
        const lastPage = await storage.getTracesPaginated({
          scope: PAGINATION_SCOPE,
          page: 2,
          perPage: 8,
        });

        expect(lastPage.traces).toHaveLength(2); // 18 - (2 * 8) = 2
        expect(lastPage.total).toBe(TEST_DATA_SIZES.PAGINATION_TRACES);
        expect(lastPage.hasMore).toBe(false);
      });

      it('should return only parent spans in pagination results', async () => {
        const result = await storage.getTracesPaginated({
          scope: PAGINATION_SCOPE,
          page: 0,
          perPage: 100,
        });

        console.log(JSON.stringify(result.traces, null, 2));
        expect(result.traces.every(trace => trace.parentSpanId === null)).toBe(true);
      });

      // Pagination edge cases
      describe('pagination edge cases', () => {
        it('should handle page beyond available data', async () => {
          const result = await storage.getTracesPaginated({
            scope: PAGINATION_SCOPE,
            page: 999,
            perPage: 8,
          });

          expect(result.traces).toHaveLength(0);
          expect(result.total).toBe(TEST_DATA_SIZES.PAGINATION_TRACES);
          expect(result.hasMore).toBe(false);
        });

        it('should handle very large perPage values', async () => {
          const result = await storage.getTracesPaginated({
            scope: PAGINATION_SCOPE,
            page: 0,
            perPage: 1000,
          });

          expect(result.traces).toHaveLength(TEST_DATA_SIZES.PAGINATION_TRACES);
          expect(result.hasMore).toBe(false);
        });

        it('should handle perPage of 1', async () => {
          const result = await storage.getTracesPaginated({
            scope: PAGINATION_SCOPE,
            page: 0,
            perPage: 1,
          });

          expect(result.traces).toHaveLength(1);
          expect(result.total).toBe(TEST_DATA_SIZES.PAGINATION_TRACES);
          expect(result.hasMore).toBe(true);
        });
      });
    });

    describe('attribute filtering', () => {
      const ATTRIBUTE_SCOPE = 'libsql-attr-traces';

      beforeAll(async () => {
        await storage.clearTable({ tableName: TABLE_TRACES });

        const prodTraces = Array.from({ length: TEST_DATA_SIZES.PROD_TRACES }, (_, i) =>
          createRootSpan(`trace-prod-${i}`, `trace-prod-${i}`, ATTRIBUTE_SCOPE, { environment: 'prod' }),
        );

        const devTraces = Array.from({ length: TEST_DATA_SIZES.DEV_TRACES }, (_, i) =>
          createRootSpan(`trace-dev-${i}`, `trace-dev-${i}`, ATTRIBUTE_SCOPE, { environment: 'dev' }),
        );

        await storage.batchInsert({
          tableName: TABLE_TRACES,
          records: [...prodTraces, ...devTraces].map(r => r as any),
        });
      });

      it('should filter by attributes with pagination', async () => {
        const prodTraces = await storage.getTracesPaginated({
          scope: ATTRIBUTE_SCOPE,
          attributes: { environment: 'prod' },
          page: 0,
          perPage: 5,
        });

        expect(prodTraces.traces).toHaveLength(5);
        expect(prodTraces.total).toBe(TEST_DATA_SIZES.PROD_TRACES);
        expect(prodTraces.hasMore).toBe(true);

        // Verify all returned traces have the correct attribute
        prodTraces.traces.forEach(trace => {
          expect(trace.attributes?.environment).toBe('prod');
        });
      });

      it('should return empty results for non-existent attribute values', async () => {
        const result = await storage.getTracesPaginated({
          scope: ATTRIBUTE_SCOPE,
          attributes: { environment: 'staging' },
          page: 0,
          perPage: 10,
        });

        expect(result.traces).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
      });
    });

    describe('date filtering', () => {
      const DATE_SCOPE = 'libsql-date-traces';
      let testDates: {
        now: Date;
        yesterday: Date;
        dayBeforeYesterday: Date;
      };

      beforeAll(async () => {
        await storage.clearTable({ tableName: TABLE_TRACES });

        // Use fixed dates to avoid time-related test flakiness
        const baseDate = new Date('2024-01-15T12:00:00.000Z');
        testDates = {
          now: baseDate,
          yesterday: new Date(baseDate.getTime() - 24 * 60 * 60 * 1000),
          dayBeforeYesterday: new Date(baseDate.getTime() - 48 * 60 * 60 * 1000),
        };

        const dateSpans = [
          createRootSpan('t_old_1', 'trace-old-1', DATE_SCOPE, undefined, testDates.dayBeforeYesterday),
          createRootSpan('t_old_2', 'trace-old-2', DATE_SCOPE, undefined, testDates.dayBeforeYesterday),
          createRootSpan('t_yesterday_1', 'trace-yesterday-1', DATE_SCOPE, undefined, testDates.yesterday),
          createRootSpan('t_yesterday_2', 'trace-yesterday-2', DATE_SCOPE, undefined, testDates.yesterday),
          createRootSpan('t_now_1', 'trace-now-1', DATE_SCOPE, undefined, testDates.now),
          createRootSpan('t_now_2', 'trace-now-2', DATE_SCOPE, undefined, testDates.now),
        ];

        await storage.batchInsert({
          tableName: TABLE_TRACES,
          records: dateSpans.map(r => r as any),
        });
      });

      it('should filter traces from a start date', async () => {
        const fromYesterday = await storage.getTracesPaginated({
          scope: DATE_SCOPE,
          dateRange: { start: testDates.yesterday },
          page: 0,
          perPage: 10,
        });

        expect(fromYesterday.total).toBe(4); // yesterday + now traces
        fromYesterday.traces.forEach(trace => {
          expect(new Date(trace.createdAt).getTime()).toBeGreaterThanOrEqual(testDates.yesterday.getTime());
        });
      });

      it('should filter traces within a specific date range', async () => {
        const onlyNow = await storage.getTracesPaginated({
          scope: DATE_SCOPE,
          dateRange: { start: testDates.now, end: testDates.now },
          page: 0,
          perPage: 10,
        });

        expect(onlyNow.total).toBe(2);
        onlyNow.traces.forEach(trace => {
          const traceDate = new Date(trace.createdAt);
          expect(traceDate.toDateString()).toBe(testDates.now.toDateString());
        });
      });

      it('should return empty results for future date ranges', async () => {
        const futureDate = new Date(testDates.now.getTime() + 24 * 60 * 60 * 1000);

        const result = await storage.getTracesPaginated({
          scope: DATE_SCOPE,
          dateRange: { start: futureDate },
          page: 0,
          perPage: 10,
        });

        expect(result.total).toBe(0);
        expect(result.traces).toHaveLength(0);
      });
    });
  });
}
