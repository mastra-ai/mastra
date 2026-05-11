import { describe, expect, it } from 'vitest';
import {
  getMetricNamesArgsSchema,
  getMetricLabelKeysArgsSchema,
  getMetricLabelValuesArgsSchema,
  getEntityTypesArgsSchema,
  getEntityNamesArgsSchema,
  getTagsArgsSchema,
} from './discovery';
import {
  aggregationIntervalSchema,
  aggregationTypeSchema,
  batchCreateMetricsArgsSchema,
  createMetricRecordSchema,
  listMetricsArgsSchema,
  listMetricsResponseSchema,
  getMetricAggregateArgsSchema,
  getMetricAggregateResponseSchema,
  getMetricBreakdownArgsSchema,
  getMetricBreakdownResponseSchema,
  getMetricTimeSeriesArgsSchema,
  getMetricTimeSeriesResponseSchema,
  getMetricPercentilesArgsSchema,
  metricInputSchema,
  metricRecordSchema,
  metricsAggregationSchema,
  metricsFilterSchema,
} from './metrics';

describe('Metric Schemas', () => {
  const now = new Date();

  describe('metricRecordSchema', () => {
    it('accepts a complete metric record', () => {
      const record = metricRecordSchema.parse({
        id: 'metric-1',
        timestamp: now,
        name: 'mastra_agent_duration_ms',
        value: 150.5,
        labels: { agent: 'weatherAgent', status: 'success' },
        provider: 'openai',
        model: 'gpt-4o-mini',
        estimatedCost: 0.00123,
        costUnit: 'usd',
        costMetadata: { source: 'snapshot' },
        metadata: { environment: 'production' },
        createdAt: now,
        updatedAt: now,
      });
      expect(record.name).toBe('mastra_agent_duration_ms');
      expect(record.value).toBe(150.5);
      expect(record.provider).toBe('openai');
      expect(record.estimatedCost).toBe(0.00123);
      expect(record.costMetadata).toEqual({ source: 'snapshot' });
    });

    it('defaults labels to empty object', () => {
      const record = metricRecordSchema.parse({
        id: 'metric-2',
        timestamp: now,
        name: 'mastra_tool_duration_ms',
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
        value: 1,
        traceId: 'trace-1',
        spanId: 'span-1',
        tags: ['prod', 'agent'],
        scope: { pkg: 'core', version: '1.0.0' },
        provider: 'anthropic',
        model: 'claude-3-7-sonnet',
        estimatedCost: 0,
        costUnit: 'usd',
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
      expect(record.tags).toEqual(['prod', 'agent']);
      expect(record.scope).toEqual({ pkg: 'core', version: '1.0.0' });
      expect(record.provider).toBe('anthropic');
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
        name: 'mastra_agent_duration_ms',
        value: 1,
        labels: { agent: 'testAgent' },
      });
      expect(input.name).toBe('mastra_agent_duration_ms');
    });

    it('accepts minimal input without labels', () => {
      const input = metricInputSchema.parse({
        name: 'queue_depth',
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
        value: 1,
      });
      expect(record).not.toHaveProperty('createdAt');
      expect(record).not.toHaveProperty('updatedAt');
    });
  });

  describe('batchCreateMetricsArgsSchema', () => {
    it('accepts an array of metric records', () => {
      const args = batchCreateMetricsArgsSchema.parse({
        metrics: [
          { id: 'm1', timestamp: now, name: 'test', value: 1 },
          { id: 'm2', timestamp: now, name: 'test', value: 2 },
        ],
      });
      expect(args.metrics).toHaveLength(2);
    });
  });

  describe('listMetrics schemas', () => {
    it('listMetricsArgsSchema applies defaults', () => {
      const args = listMetricsArgsSchema.parse({});
      expect(args.pagination).toEqual({ page: 0, perPage: 10 });
      expect(args.orderBy).toEqual({ field: 'timestamp', direction: 'DESC' });
    });

    it('listMetricsResponseSchema validates', () => {
      const response = listMetricsResponseSchema.parse({
        pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
        metrics: [{ timestamp: now, name: 'test', value: 1 }],
      });
      expect(response.metrics).toHaveLength(1);
    });
  });

  describe('aggregation schemas', () => {
    it('accepts valid aggregation types', () => {
      for (const type of ['sum', 'avg', 'min', 'max', 'count', 'last'] as const) {
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
        labels: { agent: 'weatherAgent' },
        tags: ['prod'],
        environment: 'production',
        traceId: 'trace-1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        costUnit: 'usd',
        entityType: 'agent',
        experimentId: 'exp-1',
      });
      expect(filter.name).toHaveLength(2);
      expect(filter.tags).toEqual(['prod']);
      expect(filter.traceId).toBe('trace-1');
      expect(filter.provider).toBe('openai');
      expect(filter.experimentId).toBe('exp-1');
    });

    it('accepts single-element name array', () => {
      const filter = metricsFilterSchema.parse({ name: ['mastra_agent_duration_ms'] });
      expect(filter.name).toEqual(['mastra_agent_duration_ms']);
    });

    it('accepts empty filter', () => {
      const filter = metricsFilterSchema.parse({});
      expect(filter).toEqual({});
    });
  });

  describe('OLAP query schemas', () => {
    it('getMetricAggregateArgsSchema validates', () => {
      const args = getMetricAggregateArgsSchema.parse({
        name: ['test'],
        aggregation: 'sum',
        comparePeriod: 'previous_period',
      });
      expect(args.aggregation).toBe('sum');
      expect(args.comparePeriod).toBe('previous_period');
    });

    it('getMetricAggregateResponseSchema validates', () => {
      const response = getMetricAggregateResponseSchema.parse({
        value: 42,
        estimatedCost: 1.23,
        costUnit: 'usd',
        previousValue: 35,
        previousEstimatedCost: 1.0,
        changePercent: 20,
        costChangePercent: 23,
      });
      expect(response.value).toBe(42);
      expect(response.estimatedCost).toBe(1.23);
    });

    it('getMetricBreakdownArgsSchema validates', () => {
      const args = getMetricBreakdownArgsSchema.parse({
        name: ['test'],
        groupBy: ['entityType'],
        aggregation: 'avg',
      });
      expect(args.groupBy).toEqual(['entityType']);
    });

    it('getMetricBreakdownResponseSchema validates cost-bearing groups', () => {
      const response = getMetricBreakdownResponseSchema.parse({
        groups: [
          {
            dimensions: { entityType: 'agent' },
            value: 42,
            estimatedCost: 1.23,
            costUnit: 'usd',
          },
        ],
      });
      expect(response.groups[0]!.estimatedCost).toBe(1.23);
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

    it('getMetricTimeSeriesResponseSchema validates cost-bearing points', () => {
      const response = getMetricTimeSeriesResponseSchema.parse({
        series: [
          {
            name: 'test',
            costUnit: 'usd',
            points: [{ timestamp: now, value: 42, estimatedCost: 1.23 }],
          },
        ],
      });
      expect(response.series[0]!.points[0]!.estimatedCost).toBe(1.23);
    });

    it('getMetricPercentilesArgsSchema validates', () => {
      const args = getMetricPercentilesArgsSchema.parse({
        name: 'test',
        percentiles: [0.5, 0.95, 0.99],
        interval: '1h',
      });
      expect(args.percentiles).toHaveLength(3);
    });

    it('getMetricPercentilesArgsSchema rejects empty percentile arrays', () => {
      expect(() =>
        getMetricPercentilesArgsSchema.parse({
          name: 'test',
          percentiles: [],
          interval: '1h',
        }),
      ).toThrow();
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

    it('getMetricLabelValuesArgsSchema validates', () => {
      const args = getMetricLabelValuesArgsSchema.parse({ metricName: 'test', labelKey: 'agent' });
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

    it('getTagsArgsSchema validates', () => {
      const args = getTagsArgsSchema.parse({ entityType: 'agent' });
      expect(args.entityType).toBe('agent');
    });
  });
});
