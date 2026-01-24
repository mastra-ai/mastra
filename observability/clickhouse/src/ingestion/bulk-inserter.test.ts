import type { ClickHouseClient } from '@clickhouse/client';

import { describe, it, expect, beforeEach } from 'vitest';

import { TABLE_NAMES } from '../schema/tables.js';
import type { ObservabilityEvent, ObservabilityEventType } from '../types.js';

import { bulkInsert } from './bulk-inserter.js';

// Mock ClickHouse client
function createMockClickHouseClient() {
  const insertCalls: Array<{
    table: string;
    values: Record<string, unknown>[];
    format: string;
  }> = [];

  return {
    insertCalls,
    async insert(options: { table: string; values: Record<string, unknown>[]; format: string }) {
      insertCalls.push(options);
    },
  };
}

describe('bulkInsert', () => {
  let client: ReturnType<typeof createMockClickHouseClient>;

  beforeEach(() => {
    client = createMockClickHouseClient();
  });

  describe('basic functionality', () => {
    it('should insert a single trace event', async () => {
      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          deploymentId: 'd1',
          name: 'test-trace',
          status: 'ok',
          startTime: new Date('2025-01-23T12:00:00.000Z'),
          endTime: new Date('2025-01-23T12:00:01.000Z'),
          durationMs: 1000,
          metadata: { key: 'value' },
        },
      };

      const result = await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'trace', data: event }]);

      expect(client.insertCalls).toHaveLength(1);
      expect(client.insertCalls[0]?.table).toBe(TABLE_NAMES.TRACES);
      expect(client.insertCalls[0]?.format).toBe('JSONEachRow');
      expect(result.insertedByType).toEqual({ trace: 1 });

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.trace_id).toBe('t1');
      expect(insertedRow?.project_id).toBe('p1');
      expect(insertedRow?.deployment_id).toBe('d1');
      expect(insertedRow?.name).toBe('test-trace');
      expect(insertedRow?.status).toBe('ok');
    });

    it('should insert a single span event', async () => {
      const event: ObservabilityEvent = {
        type: 'span',
        data: {
          spanId: 's1',
          traceId: 't1',
          parentSpanId: null,
          projectId: 'p1',
          deploymentId: 'd1',
          name: 'test-span',
          kind: 'server',
          status: 'ok',
          startTime: new Date('2025-01-23T12:00:00.000Z'),
          endTime: new Date('2025-01-23T12:00:01.000Z'),
          durationMs: 1000,
          attributes: { http_method: 'GET' },
          events: [],
        },
      };

      const result = await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'span', data: event }]);

      expect(client.insertCalls).toHaveLength(1);
      expect(client.insertCalls[0]?.table).toBe(TABLE_NAMES.SPANS);
      expect(result.insertedByType).toEqual({ span: 1 });

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.span_id).toBe('s1');
      expect(insertedRow?.trace_id).toBe('t1');
      expect(insertedRow?.kind).toBe('server');
      expect(insertedRow?.attributes).toBe('{"http_method":"GET"}');
    });

    it('should insert a single log event', async () => {
      const event: ObservabilityEvent = {
        type: 'log',
        data: {
          id: 'l1',
          projectId: 'p1',
          deploymentId: 'd1',
          traceId: 't1',
          spanId: 's1',
          level: 'error',
          message: 'Something went wrong',
          timestamp: new Date('2025-01-23T12:00:00.000Z'),
          attributes: { error_code: 500 },
        },
      };

      const result = await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'log', data: event }]);

      expect(client.insertCalls).toHaveLength(1);
      expect(client.insertCalls[0]?.table).toBe(TABLE_NAMES.LOGS);
      expect(result.insertedByType).toEqual({ log: 1 });

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.id).toBe('l1');
      expect(insertedRow?.level).toBe('error');
      expect(insertedRow?.message).toBe('Something went wrong');
    });

    it('should insert a single metric event', async () => {
      const event: ObservabilityEvent = {
        type: 'metric',
        data: {
          id: 'm1',
          projectId: 'p1',
          deploymentId: 'd1',
          name: 'cpu_usage',
          type: 'gauge',
          value: 0.75,
          unit: 'percent',
          timestamp: new Date('2025-01-23T12:00:00.000Z'),
          labels: { host: 'server-1' },
        },
      };

      const result = await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'metric', data: event }]);

      expect(client.insertCalls).toHaveLength(1);
      expect(client.insertCalls[0]?.table).toBe(TABLE_NAMES.METRICS);
      expect(result.insertedByType).toEqual({ metric: 1 });

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.id).toBe('m1');
      expect(insertedRow?.name).toBe('cpu_usage');
      expect(insertedRow?.type).toBe('gauge');
      expect(insertedRow?.value).toBe(0.75);
      expect(insertedRow?.unit).toBe('percent');
    });

    it('should insert a single score event', async () => {
      const event: ObservabilityEvent = {
        type: 'score',
        data: {
          id: 'sc1',
          projectId: 'p1',
          deploymentId: 'd1',
          traceId: 't1',
          name: 'quality_score',
          value: 0.95,
          normalizedValue: 95,
          comment: 'High quality',
          timestamp: new Date('2025-01-23T12:00:00.000Z'),
          metadata: { evaluator: 'gpt-4' },
        },
      };

      const result = await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'score', data: event }]);

      expect(client.insertCalls).toHaveLength(1);
      expect(client.insertCalls[0]?.table).toBe(TABLE_NAMES.SCORES);
      expect(result.insertedByType).toEqual({ score: 1 });

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.id).toBe('sc1');
      expect(insertedRow?.name).toBe('quality_score');
      expect(insertedRow?.value).toBe(0.95);
      expect(insertedRow?.normalized_value).toBe(95);
      expect(insertedRow?.comment).toBe('High quality');
    });
  });

  describe('grouping by type', () => {
    it('should group events by type and insert into correct tables', async () => {
      const events: Array<{ type: ObservabilityEventType; data: ObservabilityEvent }> = [
        {
          type: 'trace',
          data: {
            type: 'trace',
            data: {
              traceId: 't1',
              projectId: 'p1',
              name: 'trace1',
              status: 'ok',
              startTime: new Date(),
              endTime: null,
              durationMs: null,
              metadata: {},
            },
          },
        },
        {
          type: 'trace',
          data: {
            type: 'trace',
            data: {
              traceId: 't2',
              projectId: 'p1',
              name: 'trace2',
              status: 'ok',
              startTime: new Date(),
              endTime: null,
              durationMs: null,
              metadata: {},
            },
          },
        },
        {
          type: 'span',
          data: {
            type: 'span',
            data: {
              spanId: 's1',
              traceId: 't1',
              projectId: 'p1',
              name: 'span1',
              kind: 'internal',
              status: 'ok',
              startTime: new Date(),
              endTime: null,
              durationMs: null,
              attributes: {},
              events: [],
            },
          },
        },
        {
          type: 'log',
          data: {
            type: 'log',
            data: {
              id: 'l1',
              projectId: 'p1',
              level: 'info',
              message: 'test',
              timestamp: new Date(),
              attributes: {},
            },
          },
        },
      ];

      const result = await bulkInsert(client as unknown as ClickHouseClient, events);

      expect(client.insertCalls).toHaveLength(3);

      const traceInsert = client.insertCalls.find(c => c.table === TABLE_NAMES.TRACES);
      const spanInsert = client.insertCalls.find(c => c.table === TABLE_NAMES.SPANS);
      const logInsert = client.insertCalls.find(c => c.table === TABLE_NAMES.LOGS);

      expect(traceInsert?.values).toHaveLength(2);
      expect(spanInsert?.values).toHaveLength(1);
      expect(logInsert?.values).toHaveLength(1);

      expect(result.insertedByType).toEqual({
        trace: 2,
        span: 1,
        log: 1,
      });
    });

    it('should handle empty events array', async () => {
      const result = await bulkInsert(client as unknown as ClickHouseClient, []);

      expect(client.insertCalls).toHaveLength(0);
      expect(result.insertedByType).toEqual({});
    });
  });

  describe('data transformation', () => {
    it('should serialize JSON fields correctly', async () => {
      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date('2025-01-23T12:00:00.000Z'),
          endTime: null,
          durationMs: null,
          metadata: {
            nested: {
              value: 123,
              array: [1, 2, 3],
            },
          },
        },
      };

      await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'trace', data: event }]);

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.metadata).toBe('{"nested":{"value":123,"array":[1,2,3]}}');
    });

    it('should handle null optional fields', async () => {
      const event: ObservabilityEvent = {
        type: 'span',
        data: {
          spanId: 's1',
          traceId: 't1',
          parentSpanId: null,
          projectId: 'p1',
          name: 'test',
          kind: 'internal',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          attributes: {},
          events: [],
        },
      };

      await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'span', data: event }]);

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.parent_span_id).toBeNull();
      expect(insertedRow?.end_time).toBeNull();
      expect(insertedRow?.duration_ms).toBeNull();
    });

    it('should use default values for missing optional fields', async () => {
      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };

      await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'trace', data: event }]);

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.deployment_id).toBe('');
      expect(insertedRow?.metadata).toBe('{}');
    });

    it('should add recorded_at timestamp', async () => {
      const beforeInsert = new Date();

      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };

      await bulkInsert(client as unknown as ClickHouseClient, [{ type: 'trace', data: event }]);

      const insertedRow = client.insertCalls[0]?.values[0];
      expect(insertedRow?.recorded_at).toBeDefined();

      const recordedAt = new Date(insertedRow?.recorded_at as string);
      expect(recordedAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown event type', async () => {
      const event = {
        type: 'unknown_type' as ObservabilityEventType,
        data: { type: 'unknown_type', data: {} } as ObservabilityEvent,
      };

      await expect(bulkInsert(client as unknown as ClickHouseClient, [event])).rejects.toThrow(
        'Unknown event type: unknown_type',
      );
    });
  });
});
