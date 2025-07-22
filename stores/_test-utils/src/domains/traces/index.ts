import { MastraStorage, TABLE_TRACES } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSampleTraceForDB } from './data';

export function createTraceTests({ storage }: { storage: MastraStorage }) {
  describe('getTraces with pagination', () => {
    beforeEach(async () => {
      await storage.clearTable({ tableName: TABLE_TRACES });
    });

    it('should return paginated traces with total count when returnPaginationResults is true', async () => {
      const scope = 'libsql-test-scope-traces';
      const traceRecords = Array.from({ length: 18 }, (_, i) => createSampleTraceForDB(`test-trace-${i}`, scope));

      await storage.batchInsert({ tableName: TABLE_TRACES, records: traceRecords.map(r => r as any) });

      const page1 = await storage.getTracesPaginated({
        scope,
        page: 0,
        perPage: 8,
      });
      expect(page1.traces).toHaveLength(8);
      expect(page1.total).toBe(18);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(8);
      expect(page1.hasMore).toBe(true);

      const page3 = await storage.getTracesPaginated({
        scope,
        page: 2,
        perPage: 8,
      });
      expect(page3.traces).toHaveLength(2);
      expect(page3.total).toBe(18);
      expect(page3.hasMore).toBe(false);
    });

    it('should return an array of traces when returnPaginationResults is undefined', async () => {
      const scope = 'libsql-array-traces';
      const traceRecords = [createSampleTraceForDB('trace-arr-1', scope), createSampleTraceForDB('trace-arr-2', scope)];
      await storage.batchInsert({ tableName: TABLE_TRACES, records: traceRecords.map(r => r as any) });

      const tracesUndefined = await storage.getTraces({
        scope,
        page: 0,
        perPage: 5,
      });
      expect(Array.isArray(tracesUndefined)).toBe(true);
      expect(tracesUndefined.length).toBe(2);
      // @ts-expect-error
      expect(tracesUndefined.total).toBeUndefined();
    });

    it('should filter by attributes with pagination for getTraces', async () => {
      const scope = 'libsql-attr-traces';
      const tracesWithAttr = Array.from({ length: 8 }, (_, i) =>
        createSampleTraceForDB(`trace-prod-${i}`, scope, { environment: 'prod' }),
      );
      const tracesWithoutAttr = Array.from({ length: 5 }, (_, i) =>
        createSampleTraceForDB(`trace-dev-${i}`, scope, { environment: 'dev' }),
      );
      await storage.batchInsert({
        tableName: TABLE_TRACES,
        records: [...tracesWithAttr, ...tracesWithoutAttr].map(r => r as any),
      });

      const prodTraces = await storage.getTracesPaginated({
        scope,
        attributes: { environment: 'prod' },
        page: 0,
        perPage: 5,
      });
      expect(prodTraces.traces).toHaveLength(5);
      expect(prodTraces.total).toBe(8);
      expect(prodTraces.hasMore).toBe(true);
    });

    it('should filter by date with pagination for getTraces', async () => {
      const scope = 'libsql-date-traces';
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const recordsToInsert = [
        createSampleTraceForDB('t_dbf1', scope, undefined, dayBeforeYesterday),
        createSampleTraceForDB('t_dbf2', scope, undefined, dayBeforeYesterday),
        createSampleTraceForDB('t_y1', scope, undefined, yesterday),
        createSampleTraceForDB('t_y3', scope, undefined, yesterday),
        createSampleTraceForDB('t_n1', scope, undefined, now),
        createSampleTraceForDB('t_n2', scope, undefined, now),
      ];

      await storage.batchInsert({ tableName: TABLE_TRACES, records: recordsToInsert.map(r => r as any) });

      for (let i = 0; i < 5; i++) {
        const res = await storage.getTracesPaginated({
          page: 0,
          perPage: 10,
        });
        if (res.total < recordsToInsert.length) {
          await new Promise(resolve => {
            setTimeout(() => {
              resolve(true);
            }, 1000);
          });
          await storage.batchInsert({
            tableName: TABLE_TRACES,
            records: recordsToInsert
              .filter((r, i) => {
                return !res.traces.some(t => t.id === r.id);
              })
              .map(r => r as any),
          });
          continue;
        } else {
          break;
        }
      }

      const fromYesterday = await storage.getTracesPaginated({
        scope,
        dateRange: { start: yesterday },
        page: 0,
        perPage: 3,
      });
      expect(fromYesterday.total).toBe(4);
      expect(fromYesterday.traces).toHaveLength(3);
      fromYesterday.traces.forEach(t =>
        expect(new Date(t.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime()),
      );
      if (fromYesterday.traces.length > 0 && fromYesterday.traces[0]!.createdAt === now.toISOString()) {
        expect(new Date(fromYesterday.traces[0]!.createdAt).toISOString().slice(0, 10)).toEqual(
          now.toISOString().slice(0, 10),
        );
      }

      const onlyNow = await storage.getTracesPaginated({
        scope,
        dateRange: { start: now, end: now },
        page: 0,
        perPage: 5,
      });
      expect(onlyNow.total).toBe(2);
      expect(onlyNow.traces).toHaveLength(2);
      onlyNow.traces.forEach(t =>
        expect(new Date(t.createdAt).toISOString().slice(0, 10)).toEqual(now.toISOString().slice(0, 10)),
      );
    });
  });
}
