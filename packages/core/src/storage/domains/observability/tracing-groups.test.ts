import { describe, it, expect } from 'vitest';
import { listTraceGroupsArgsSchema, listTraceGroupsResponseSchema, traceGroupByKeySchema } from './tracing';

describe('trace group schemas', () => {
  describe('traceGroupByKeySchema', () => {
    it.each([
      'entityId',
      'entityName',
      'userId',
      'organizationId',
      'resourceId',
      'runId',
      'sessionId',
      'threadId',
      'requestId',
      'environment',
      'serviceName',
      'experimentId',
    ])('accepts the context field key "%s"', key => {
      expect(traceGroupByKeySchema.parse(key)).toBe(key);
    });

    it('rejects an unknown key', () => {
      expect(() => traceGroupByKeySchema.parse('metadata.tenant')).toThrow();
    });
  });

  describe('listTraceGroupsArgsSchema', () => {
    it('requires groupBy', () => {
      expect(() => listTraceGroupsArgsSchema.parse({})).toThrow();
    });

    it('accepts groupBy alone', () => {
      const parsed = listTraceGroupsArgsSchema.parse({ groupBy: 'threadId' });
      expect(parsed.groupBy).toBe('threadId');
    });

    it('rejects unknown top-level properties', () => {
      expect(() => listTraceGroupsArgsSchema.parse({ groupBy: 'threadId', nope: true })).toThrow();
    });

    it('applies orderBy defaults (latestStartedAt DESC)', () => {
      const parsed = listTraceGroupsArgsSchema.parse({ groupBy: 'threadId', orderBy: {} });
      expect(parsed.orderBy).toEqual({ field: 'latestStartedAt', direction: 'DESC' });
    });

    it('accepts ordering by count ascending', () => {
      const parsed = listTraceGroupsArgsSchema.parse({
        groupBy: 'userId',
        orderBy: { field: 'count', direction: 'ASC' },
      });
      expect(parsed.orderBy).toEqual({ field: 'count', direction: 'ASC' });
    });

    it('accepts trace filters and pagination', () => {
      const parsed = listTraceGroupsArgsSchema.parse({
        groupBy: 'threadId',
        filters: { userId: 'u-1', startedAt: { start: new Date('2026-01-01') } },
        pagination: { page: 1, perPage: 25 },
      });
      expect(parsed.filters?.userId).toBe('u-1');
      expect(parsed.pagination).toEqual({ page: 1, perPage: 25 });
    });
  });

  describe('listTraceGroupsResponseSchema', () => {
    it('accepts groups including a null-value group', () => {
      const parsed = listTraceGroupsResponseSchema.parse({
        pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
        groups: [
          {
            value: 'thread-1',
            count: 3,
            errorCount: 1,
            latestStartedAt: new Date(),
            latestTraceId: 'trace-1',
          },
          {
            value: null,
            count: 2,
            errorCount: 0,
            latestStartedAt: new Date(),
            latestTraceId: 'trace-9',
          },
        ],
      });
      expect(parsed.groups).toHaveLength(2);
      expect(parsed.groups[1]?.value).toBeNull();
    });

    it('rejects non-integer counts', () => {
      expect(() =>
        listTraceGroupsResponseSchema.parse({
          pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
          groups: [{ value: 'x', count: 1.5, errorCount: 0, latestStartedAt: new Date(), latestTraceId: 't' }],
        }),
      ).toThrow();
    });
  });
});
