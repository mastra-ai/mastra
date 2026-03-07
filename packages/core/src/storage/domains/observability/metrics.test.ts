import { describe, expect, it } from 'vitest';
import {
  aggregationIntervalSchema,
  aggregationTypeSchema,
  batchRecordMetricsArgsSchema,
  createMetricRecordSchema,
  getMetricAggregateArgsSchema,
  getMetricAggregateResponseSchema,
  getMetricBreakdownArgsSchema,
  getMetricTimeSeriesArgsSchema,
  getMetricHistogramArgsSchema,
  getMetricPercentilesArgsSchema,
  getUsageReportArgsSchema,
  getMetricNamesArgsSchema,
  getMetricLabelKeysArgsSchema,
  getLabelValuesArgsSchema,
  getEntityTypesArgsSchema,
  getEntityNamesArgsSchema,
  getTraceTagsArgsSchema,
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

    it('accepts context fields', () => {
      const record = metricRecordSchema.parse({
        id: 'metric-3',
        timestamp: now,
        name: 'test',
        metricType: 'counter',
        value: 1,
        traceId: 'trace-1',
        spanId: 'span-1',
        entityType: 'agent',
        entityName: 'myAgent',
        parentEntityType: 'workflow_run',
        parentEntityName: 'myWorkflow',
        rootEntityType: 'workflow_run',
        rootEntityName: 'rootWorkflow',
        userId: 'user-1',
        experimentId: 'exp-1',
        createdAt: now,
        updatedAt: null,
      });
      expect(record.traceId).toBe('trace-1');
      expect(record.parentEntityType).toBe('workflow_run');
      expect(record.experimentId).toBe('exp-1');
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
    it('accepts valid aggregation types including last and rate', () => {
      for (const type of ['sum', 'avg', 'min', 'max', 'count', 'last', 'rate'] as const) {
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
        traceId: 'trace-1',
        entityType: 'agent',
        experimentId: 'exp-1',
      });
      expect(filter.name).toHaveLength(2);
      expect(filter.metricType).toBe('histogram');
      expect(filter.traceId).toBe('trace-1');
      expect(filter.experimentId).toBe('exp-1');
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

  describe('OLAP query schemas', () => {
    it('getMetricAggregateArgsSchema validates', () => {
      const args = getMetricAggregateArgsSchema.parse({
        name: 'test',
        aggregation: 'sum',
        comparePeriod: 'previous_period',
      });
      expect(args.aggregation).toBe('sum');
      expect(args.comparePeriod).toBe('previous_period');
    });

    it('getMetricAggregateResponseSchema validates', () => {
      const response = getMetricAggregateResponseSchema.parse({
        value: 42,
        previousValue: 35,
        changePercent: 20,
      });
      expect(response.value).toBe(42);
    });

    it('getMetricBreakdownArgsSchema validates', () => {
      const args = getMetricBreakdownArgsSchema.parse({
        name: 'test',
        groupBy: ['entityType'],
        aggregation: 'avg',
      });
      expect(args.groupBy).toEqual(['entityType']);
    });

    it('getMetricTimeSeriesArgsSchema validates', () => {
      const args = getMetricTimeSeriesArgsSchema.parse({
        name: ['test1', 'test2'],
        interval: '1h',
        aggregation: 'sum',
        groupBy: ['entityType'],
      });
      expect(args.interval).toBe('1h');
    });

    it('getMetricHistogramArgsSchema validates', () => {
      const args = getMetricHistogramArgsSchema.parse({
        name: 'test',
        bucketBoundaries: [0, 100, 500, 1000],
      });
      expect(args.bucketBoundaries).toHaveLength(4);
    });

    it('getMetricPercentilesArgsSchema validates', () => {
      const args = getMetricPercentilesArgsSchema.parse({
        name: 'test',
        percentiles: [0.5, 0.95, 0.99],
        interval: '1h',
      });
      expect(args.percentiles).toHaveLength(3);
    });

    it('getUsageReportArgsSchema validates', () => {
      const args = getUsageReportArgsSchema.parse({
        name: 'test',
        groupBy: ['userId'],
        aggregation: 'sum',
      });
      expect(args.groupBy).toEqual(['userId']);
    });
  });

  describe('Discovery schemas', () => {
    it('getMetricNamesArgsSchema validates', () => {
      const args = getMetricNamesArgsSchema.parse({ prefix: 'mastra_', limit: 100 });
      expect(args.prefix).toBe('mastra_');
    });

    it('getMetricLabelKeysArgsSchema validates', () => {
      const args = getMetricLabelKeysArgsSchema.parse({ metricName: 'test' });
      expect(args.metricName).toBe('test');
    });

    it('getLabelValuesArgsSchema validates', () => {
      const args = getLabelValuesArgsSchema.parse({ metricName: 'test', labelKey: 'agent' });
      expect(args.labelKey).toBe('agent');
    });

    it('getEntityTypesArgsSchema validates', () => {
      const args = getEntityTypesArgsSchema.parse({});
      expect(args).toEqual({});
    });

    it('getEntityNamesArgsSchema validates', () => {
      const args = getEntityNamesArgsSchema.parse({ entityType: 'agent' });
      expect(args.entityType).toBe('agent');
    });

    it('getTraceTagsArgsSchema validates', () => {
      const args = getTraceTagsArgsSchema.parse({ entityType: 'agent' });
      expect(args.entityType).toBe('agent');
    });
  });
});
