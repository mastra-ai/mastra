import { describe, expect, it } from 'vitest';
import {
  aggregationIntervalSchema,
  aggregationTypeSchema,
  batchRecordMetricsArgsSchema,
  createMetricRecordSchema,
  listMetricsArgsSchema,
  listMetricsResponseSchema,
  metricInputSchema,
  metricRecordSchema,
  metricTypeSchema,
  metricsAggregationSchema,
  metricsFilterSchema,
} from './metrics';

describe('Metric Schemas', () => {
  const now = new Date();

  describe('metricTypeSchema', () => {
    it('accepts valid metric types', () => {
      for (const type of ['counter', 'gauge', 'histogram'] as const) {
        expect(metricTypeSchema.parse(type)).toBe(type);
      }
    });

    it('rejects invalid metric types', () => {
      expect(() => metricTypeSchema.parse('timer')).toThrow();
    });
  });

  describe('metricRecordSchema', () => {
    it('accepts a complete metric record', () => {
      const record = metricRecordSchema.parse({
        id: 'metric-1',
        timestamp: now,
        name: 'mastra_agent_duration_ms',
        metricType: 'histogram',
        value: 150.5,
        labels: { agent: 'weatherAgent', status: 'success' },
        metadata: { environment: 'production' },
        createdAt: now,
        updatedAt: now,
      });
      expect(record.name).toBe('mastra_agent_duration_ms');
      expect(record.value).toBe(150.5);
    });

    it('defaults labels to empty object', () => {
      const record = metricRecordSchema.parse({
        id: 'metric-2',
        timestamp: now,
        name: 'mastra_tool_calls_started',
        metricType: 'counter',
        value: 1,
        createdAt: now,
        updatedAt: null,
      });
      expect(record.labels).toEqual({});
    });

    it('rejects missing required fields', () => {
      expect(() => metricRecordSchema.parse({ id: 'metric-3' })).toThrow();
    });
  });

  describe('metricInputSchema', () => {
    it('accepts valid user input', () => {
      const input = metricInputSchema.parse({
        name: 'mastra_agent_runs_started',
        metricType: 'counter',
        value: 1,
        labels: { agent: 'testAgent' },
      });
      expect(input.name).toBe('mastra_agent_runs_started');
    });

    it('accepts minimal input without labels', () => {
      const input = metricInputSchema.parse({
        name: 'queue_depth',
        metricType: 'gauge',
        value: 42,
      });
      expect(input.labels).toBeUndefined();
    });
  });

  describe('createMetricRecordSchema', () => {
    it('omits db timestamps', () => {
      const record = createMetricRecordSchema.parse({
        id: 'metric-1',
        timestamp: now,
        name: 'test',
        metricType: 'counter',
        value: 1,
      });
      expect(record).not.toHaveProperty('createdAt');
      expect(record).not.toHaveProperty('updatedAt');
    });
  });

  describe('batchRecordMetricsArgsSchema', () => {
    it('accepts an array of metric records', () => {
      const args = batchRecordMetricsArgsSchema.parse({
        metrics: [
          { id: 'm1', timestamp: now, name: 'test', metricType: 'counter', value: 1 },
          { id: 'm2', timestamp: now, name: 'test', metricType: 'counter', value: 2 },
        ],
      });
      expect(args.metrics).toHaveLength(2);
    });
  });

  describe('aggregation schemas', () => {
    it('accepts valid aggregation types', () => {
      for (const type of ['sum', 'avg', 'min', 'max', 'count'] as const) {
        expect(aggregationTypeSchema.parse(type)).toBe(type);
      }
    });

    it('accepts valid aggregation intervals', () => {
      for (const interval of ['1m', '5m', '15m', '1h', '1d'] as const) {
        expect(aggregationIntervalSchema.parse(interval)).toBe(interval);
      }
    });

    it('accepts a full aggregation config', () => {
      const config = metricsAggregationSchema.parse({
        type: 'avg',
        interval: '1h',
        groupBy: ['agent', 'status'],
      });
      expect(config.type).toBe('avg');
      expect(config.groupBy).toEqual(['agent', 'status']);
    });

    it('accepts minimal aggregation config', () => {
      const config = metricsAggregationSchema.parse({ type: 'sum' });
      expect(config.interval).toBeUndefined();
      expect(config.groupBy).toBeUndefined();
    });
  });

  describe('metricsFilterSchema', () => {
    it('accepts all filter options', () => {
      const filter = metricsFilterSchema.parse({
        timestamp: { start: now },
        name: ['mastra_agent_duration_ms', 'mastra_tool_duration_ms'],
        metricType: 'histogram',
        labels: { agent: 'weatherAgent' },
        environment: 'production',
      });
      expect(filter.name).toHaveLength(2);
      expect(filter.metricType).toBe('histogram');
    });

    it('accepts single name as string', () => {
      const filter = metricsFilterSchema.parse({ name: 'mastra_agent_runs_started' });
      expect(filter.name).toBe('mastra_agent_runs_started');
    });

    it('accepts empty filter', () => {
      const filter = metricsFilterSchema.parse({});
      expect(filter).toEqual({});
    });
  });

  describe('listMetricsArgsSchema', () => {
    it('applies defaults', () => {
      const args = listMetricsArgsSchema.parse({});
      expect(args.pagination).toEqual({ page: 0, perPage: 10 });
      expect(args.orderBy).toEqual({ field: 'timestamp', direction: 'DESC' });
    });

    it('accepts aggregation config', () => {
      const args = listMetricsArgsSchema.parse({
        aggregation: { type: 'avg', interval: '1h' },
      });
      expect(args.aggregation!.type).toBe('avg');
    });
  });

  describe('listMetricsResponseSchema', () => {
    it('validates a response', () => {
      const response = listMetricsResponseSchema.parse({
        pagination: { total: 50, page: 0, perPage: 10, hasMore: true },
        metrics: [
          {
            id: 'metric-1',
            timestamp: now,
            name: 'test',
            metricType: 'counter',
            value: 1,
            labels: {},
            createdAt: now,
            updatedAt: null,
          },
        ],
      });
      expect(response.metrics).toHaveLength(1);
    });
  });
});
