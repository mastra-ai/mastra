/**
 * Integration tests for the ClickHouse v-next observability storage domain.
 *
 * Mirrors the DuckDB observability test suite but adapted for v-next semantics:
 * - Insert-only model (no span updates)
 * - ReplacingMergeTree for tracing, append-only MergeTree for signals
 * - Discovery via helper tables (discovery_values / discovery_pairs)
 * - Label-key exclusion in grouped queries
 *
 * Requires a running ClickHouse instance. Use `docker compose up -d` in the
 * clickhouse store directory, or set CLICKHOUSE_URL/CLICKHOUSE_USERNAME/CLICKHOUSE_PASSWORD.
 */
import { createClient } from '@clickhouse/client';
import { EntityType, SpanType } from '@mastra/core/observability';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRetentionDDL } from './ddl';
import { ObservabilityStorageClickhouseVNext } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('ObservabilityStorageClickhouseVNext', () => {
  let storage: ObservabilityStorageClickhouseVNext;

  beforeAll(async () => {
    storage = new ObservabilityStorageClickhouseVNext({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || 'password',
    });
    await storage.init();
  });

  beforeEach(async () => {
    await storage.dangerouslyClearAll();
  });

  afterAll(async () => {
    await storage.dangerouslyClearAll();
  });

  // ==========================================================================
  // Strategy
  // ==========================================================================

  it('reports insert-only as preferred strategy', () => {
    expect(storage.observabilityStrategy).toEqual({
      preferred: 'insert-only',
      supported: ['insert-only'],
    });
  });

  // ==========================================================================
  // Span Events
  // ==========================================================================

  describe('span events', () => {
    const now = new Date();

    it('creates and reconstructs a completed span', async () => {
      await storage.createSpan({
        span: {
          traceId: 'trace-1',
          spanId: 'span-1',
          parentSpanId: null,
          name: 'agent-run',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: 'agent-1',
          entityName: 'myAgent',
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: 'test',
          source: null,
          serviceName: 'test-service',
          scope: null,
          attributes: { model: 'gpt-4' },
          metadata: { foo: 'bar' },
          tags: ['tag1', 'tag2'],
          links: null,
          input: { prompt: 'hello' },
          output: { answer: 'world' },
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const result = await storage.getSpan({ traceId: 'trace-1', spanId: 'span-1' });
      expect(result).not.toBeNull();
      const span = result!.span;
      expect(span.name).toBe('agent-run');
      expect(span.traceId).toBe('trace-1');
      expect(span.spanId).toBe('span-1');
      expect(span.spanType).toBe('agent_run');
      expect(span.entityType).toBe('agent');
      expect(span.entityName).toBe('myAgent');
      expect(span.environment).toBe('test');
      expect(span.serviceName).toBe('test-service');
      expect(span.attributes).toEqual({ model: 'gpt-4' });
      expect(span.metadata).toEqual({ foo: 'bar' });
      expect(span.tags).toEqual(expect.arrayContaining(['tag1', 'tag2']));
      expect(span.input).toEqual({ prompt: 'hello' });
      expect(span.output).toEqual({ answer: 'world' });
      expect(span.endedAt).toBeInstanceOf(Date);
    });

    it('does not support span updates (insert-only model)', async () => {
      await expect(
        storage.updateSpan({
          traceId: 'trace-1',
          spanId: 'span-1',
          updates: {
            output: { temp: 72 },
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
        }),
      ).rejects.toThrow('does not support updating spans');
    });

    it('batch creates spans and retrieves trace', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'trace-3',
            spanId: 'root-span',
            parentSpanId: null,
            name: 'workflow-run',
            spanType: SpanType.WORKFLOW_RUN,
            isEvent: false,
            entityType: EntityType.WORKFLOW_RUN,
            entityId: 'wf-1',
            entityName: 'myWorkflow',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'svc',
            scope: null,
            attributes: null,
            metadata: null,
            tags: ['v1'],
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:02Z'),
          },
          {
            traceId: 'trace-3',
            spanId: 'child-span',
            parentSpanId: 'root-span',
            name: 'agent-step',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'myAgent',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'svc',
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:01Z'),
            endedAt: new Date('2026-01-01T00:00:02Z'),
          },
        ],
      });

      const trace = await storage.getTrace({ traceId: 'trace-3' });
      expect(trace).not.toBeNull();
      expect(trace!.spans).toHaveLength(2);

      const rootResult = await storage.getRootSpan({ traceId: 'trace-3' });
      expect(rootResult).not.toBeNull();
      expect(rootResult!.span.name).toBe('workflow-run');
      expect(rootResult!.span.parentSpanId).toBeNull();

      const traces = await storage.listTraces({});
      expect(traces.spans.length).toBeGreaterThanOrEqual(1);
    });

    it('batch deletes traces (eventual disappearance)', async () => {
      await storage.createSpan({
        span: {
          traceId: 'trace-del',
          spanId: 'span-del',
          parentSpanId: null,
          name: 'delete-me',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: now,
          endedAt: new Date(now.getTime() + 1000),
        },
      });

      // Verify it exists first
      const before = await storage.getSpan({ traceId: 'trace-del', spanId: 'span-del' });
      expect(before).not.toBeNull();

      // Delete should succeed without throwing (design doc: verify successful execution)
      await expect(storage.batchDeleteTraces({ traceIds: ['trace-del'] })).resolves.toBeUndefined();

      // Design doc (shared.md:271): verify eventual disappearance semantics.
      // ClickHouse lightweight deletes are immediately visible in practice,
      // but the contract is eventual consistency — poll rather than assume.
      const disappeared = await eventuallyNull(() => storage.getSpan({ traceId: 'trace-del', spanId: 'span-del' }), {
        maxAttempts: 10,
        intervalMs: 100,
      });
      expect(disappeared).toBe(true);
    });
  });

  // ==========================================================================
  // Logs
  // ==========================================================================

  describe('logs', () => {
    it('creates and lists logs', async () => {
      await storage.batchCreateLogs({
        logs: [
          {
            logId: 'log-test-1',
            timestamp: new Date(),
            level: 'info',
            message: 'Test log message',
            data: { key: 'value' },
            traceId: 'trace-1',
            spanId: 'span-1',
            tags: ['test'],
            entityType: EntityType.AGENT,
            entityId: 'agent-1',
            entityName: 'myAgent',
            metadata: null,
          },
          {
            logId: 'log-test-2',
            timestamp: new Date(),
            level: 'error',
            message: 'Error occurred',
            data: null,
            traceId: 'trace-1',
            spanId: null,
            tags: null,
            metadata: null,
          },
        ],
      });

      const result = await storage.listLogs({});
      expect(result.logs).toHaveLength(2);

      const filtered = await storage.listLogs({
        filters: { level: 'error' },
      });
      expect(filtered.logs).toHaveLength(1);
      expect(filtered.logs[0]!.message).toBe('Error occurred');
    });
  });

  // ==========================================================================
  // Metrics + OLAP
  // ==========================================================================

  describe('metrics', () => {
    beforeEach(async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            name: 'mastra_agent_duration_ms',
            value: 100,
            labels: { status: 'ok' },
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.1,
            costUnit: 'usd',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
          {
            metricId: 'metric-test-2',
            timestamp: new Date('2026-01-01T00:00:05Z'),
            name: 'mastra_agent_duration_ms',
            value: 200,
            labels: { status: 'ok' },
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.2,
            costUnit: 'usd',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
          {
            metricId: 'metric-test-3',
            timestamp: new Date('2026-01-01T00:00:10Z'),
            name: 'mastra_agent_duration_ms',
            value: 500,
            labels: { status: 'error' },
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            estimatedCost: 0.5,
            costUnit: 'usd',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'codeAgent',
          },
          {
            metricId: 'metric-test-4',
            timestamp: new Date('2026-01-01T01:00:00Z'),
            name: 'mastra_tool_calls_started',
            value: 1,
            labels: {},
            tags: ['prod'],
            entityType: EntityType.TOOL,
            entityName: 'search',
          },
        ],
      });
    });

    it('getMetricAggregate returns sum', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'sum',
      });
      expect(result.value).toBe(800); // 100 + 200 + 500
      expect(result.estimatedCost).toBeCloseTo(0.8);
      expect(result.costUnit).toBe('usd');
    });

    it('listMetrics returns paginated metric records with shared filters', async () => {
      const result = await storage.listMetrics({
        filters: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          tags: ['prod'],
        },
        pagination: { page: 0, perPage: 1 },
        orderBy: { field: 'timestamp', direction: 'ASC' },
      });

      expect(result.pagination.total).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0]!.provider).toBe('openai');
      expect(result.metrics[0]!.model).toBe('gpt-4o-mini');
      expect(result.metrics[0]!.estimatedCost).toBeCloseTo(0.1);
      expect(result.metrics[0]!.costUnit).toBe('usd');
      expect(result.metrics[0]!.tags).toEqual(['prod']);
      expect(result.metrics[0]!.labels).toEqual({ status: 'ok' });
    });

    it('getMetricAggregate returns avg', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'avg',
      });
      expect(result.value).toBeCloseTo(266.67, 0);
    });

    it('getMetricAggregate returns count', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count',
      });
      expect(result.value).toBe(3);
    });

    it('getMetricBreakdown groups by entityName', async () => {
      const result = await storage.getMetricBreakdown({
        name: ['mastra_agent_duration_ms'],
        groupBy: ['entityName'],
        aggregation: 'avg',
      });
      expect(result.groups).toHaveLength(2);
      const weather = result.groups.find(g => g.dimensions.entityName === 'weatherAgent');
      const code = result.groups.find(g => g.dimensions.entityName === 'codeAgent');
      expect(weather).toBeDefined();
      expect(weather!.value).toBe(150); // (100+200)/2
      expect(weather!.estimatedCost).toBeCloseTo(0.3);
      expect(weather!.costUnit).toBe('usd');
      expect(code).toBeDefined();
      expect(code!.value).toBe(500);
      expect(code!.estimatedCost).toBeCloseTo(0.5);
      expect(code!.costUnit).toBe('usd');
    });

    it('getMetricBreakdown groups by label keys', async () => {
      const result = await storage.getMetricBreakdown({
        name: ['mastra_agent_duration_ms'],
        groupBy: ['status'],
        aggregation: 'count',
      });

      expect(result.groups).toHaveLength(2);
      const ok = result.groups.find(g => g.dimensions.status === 'ok');
      const error = result.groups.find(g => g.dimensions.status === 'error');

      expect(ok?.value).toBe(2);
      expect(ok?.estimatedCost).toBeCloseTo(0.3);
      expect(error?.value).toBe(1);
      expect(error?.estimatedCost).toBeCloseTo(0.5);
    });

    it('getMetricBreakdown excludes rows missing label keys (v-next design)', async () => {
      // The beforeEach inserts 3 mastra_agent_duration_ms rows with 'status' label.
      // Insert 2 more rows with a different label key ('foo-bar'), but NOT 'status'.
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-5',
            timestamp: new Date('2026-01-01T00:00:20Z'),
            name: 'mastra_agent_duration_ms',
            value: 300,
            labels: { 'foo-bar': 'alpha' },
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
          {
            metricId: 'metric-test-6',
            timestamp: new Date('2026-01-01T00:00:25Z'),
            name: 'mastra_agent_duration_ms',
            value: 400,
            labels: { 'foo-bar': 'beta' },
            entityType: EntityType.AGENT,
            entityName: 'codeAgent',
          },
        ],
      });

      // Group by 'foo-bar' — only the 2 rows with 'foo-bar' label should appear.
      // The 3 original rows with 'status' label (but no 'foo-bar') are excluded.
      const result = await storage.getMetricBreakdown({
        name: ['mastra_agent_duration_ms'],
        groupBy: ['foo-bar'],
        aggregation: 'count',
      });

      const alpha = result.groups.find(group => group.dimensions['foo-bar'] === 'alpha');
      const beta = result.groups.find(group => group.dimensions['foo-bar'] === 'beta');
      const missing = result.groups.find(group => group.dimensions['foo-bar'] === null);

      expect(alpha?.value).toBe(1);
      expect(beta?.value).toBe(1);
      // v-next design: rows missing the requested label key are excluded
      expect(missing).toBeUndefined();
    });

    it('getMetricTimeSeries returns bucketed data', async () => {
      const result = await storage.getMetricTimeSeries({
        name: ['mastra_agent_duration_ms'],
        interval: '1h',
        aggregation: 'sum',
      });
      expect(result.series.length).toBeGreaterThanOrEqual(1);
      const mainSeries = result.series[0]!;
      expect(mainSeries.points.length).toBeGreaterThanOrEqual(1);
      expect(mainSeries.costUnit).toBe('usd');
      expect(mainSeries.points[0]!.estimatedCost).toBeCloseTo(0.8);
    });

    it('getMetricTimeSeries keeps colliding display names as separate grouped series', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-5',
            timestamp: new Date('2026-01-01T02:00:00Z'),
            name: 'mastra_collision_metric',
            value: 10,
            labels: { segmentA: 'a', segmentB: 'b|c' },
            entityType: EntityType.TOOL,
            entityName: 'search',
          },
          {
            metricId: 'metric-test-6',
            timestamp: new Date('2026-01-01T02:00:00Z'),
            name: 'mastra_collision_metric',
            value: 20,
            labels: { segmentA: 'a|b', segmentB: 'c' },
            entityType: EntityType.TOOL,
            entityName: 'search',
          },
        ],
      });

      const result = await storage.getMetricTimeSeries({
        name: ['mastra_collision_metric'],
        interval: '1h',
        aggregation: 'sum',
        groupBy: ['segmentA', 'segmentB'],
      });

      expect(result.series).toHaveLength(2);
      expect(result.series.every(series => series.name === 'a|b|c')).toBe(true);
      expect(result.series.map(series => series.points.length)).toEqual([1, 1]);
      expect(result.series.map(series => series.points[0]!.value).sort((left, right) => left - right)).toEqual([
        10, 20,
      ]);
    });

    it('getMetricAggregate returns costUnit: null when costUnits are mixed', async () => {
      // Add a metric with a different costUnit (the beforeEach already inserts 'usd' metrics)
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-5',
            timestamp: new Date('2026-01-01T00:00:15Z'),
            name: 'mastra_agent_duration_ms',
            value: 50,
            labels: { status: 'ok' },
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.05,
            costUnit: 'eur',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
        ],
      });

      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'sum',
      });
      // All metrics sum: 100 + 200 + 500 + 50 = 850
      expect(result.value).toBe(850);
      // costUnit should be null because we have both 'usd' and 'eur'
      expect(result.costUnit).toBeNull();
    });

    it('getMetricBreakdown returns costUnit: null for mixed-unit groups', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-5',
            timestamp: new Date('2026-01-01T00:00:15Z'),
            name: 'mastra_agent_duration_ms',
            value: 50,
            labels: { status: 'ok' },
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.05,
            costUnit: 'eur',
            tags: ['prod'],
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
          },
        ],
      });

      const result = await storage.getMetricBreakdown({
        name: ['mastra_agent_duration_ms'],
        groupBy: ['entityName'],
        aggregation: 'sum',
      });

      const weather = result.groups.find(g => g.dimensions.entityName === 'weatherAgent');
      expect(weather).toBeDefined();
      // weatherAgent has both 'usd' and 'eur' → mixed → null
      expect(weather!.costUnit).toBeNull();

      const code = result.groups.find(g => g.dimensions.entityName === 'codeAgent');
      expect(code).toBeDefined();
      // codeAgent has only 'usd' → consistent → 'usd'
      expect(code!.costUnit).toBe('usd');
    });

    it('filters metrics by canonical cost fields', async () => {
      const result = await storage.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'sum',
        filters: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          costUnit: 'usd',
        },
      });

      expect(result.value).toBe(300);
      expect(result.estimatedCost).toBeCloseTo(0.3);
    });

    it('getMetricPercentiles returns percentile series', async () => {
      const result = await storage.getMetricPercentiles({
        name: 'mastra_agent_duration_ms',
        percentiles: [0.5, 0.99],
        interval: '1h',
      });
      expect(result.series).toHaveLength(2);
      const p50 = result.series.find(s => s.percentile === 0.5);
      expect(p50).toBeDefined();
    });
  });

  // ==========================================================================
  // Default ORDER BY
  // ==========================================================================

  describe('default ORDER BY', () => {
    it('listLogs defaults to timestamp DESC', async () => {
      await storage.batchCreateLogs({
        logs: [
          {
            logId: 'log-test-1',
            timestamp: new Date('2026-01-01T00:00:01Z'),
            level: 'info',
            message: 'first',
            data: null,
            metadata: null,
          },
          {
            logId: 'log-test-2',
            timestamp: new Date('2026-01-01T00:00:03Z'),
            level: 'info',
            message: 'third',
            data: null,
            metadata: null,
          },
          {
            logId: 'log-test-3',
            timestamp: new Date('2026-01-01T00:00:02Z'),
            level: 'info',
            message: 'second',
            data: null,
            metadata: null,
          },
        ],
      });

      const result = await storage.listLogs({});
      expect(result.logs).toHaveLength(3);
      // Default: timestamp DESC → third, second, first
      expect(result.logs[0]!.message).toBe('third');
      expect(result.logs[1]!.message).toBe('second');
      expect(result.logs[2]!.message).toBe('first');
    });

    it('listMetrics defaults to timestamp DESC', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-1',
            timestamp: new Date('2026-01-01T00:00:01Z'),
            name: 'order_test',
            value: 1,
            labels: {},
          },
          {
            metricId: 'metric-test-2',
            timestamp: new Date('2026-01-01T00:00:03Z'),
            name: 'order_test',
            value: 3,
            labels: {},
          },
          {
            metricId: 'metric-test-3',
            timestamp: new Date('2026-01-01T00:00:02Z'),
            name: 'order_test',
            value: 2,
            labels: {},
          },
        ],
      });

      const result = await storage.listMetrics({ filters: { name: ['order_test'] } });
      expect(result.metrics).toHaveLength(3);
      expect(result.metrics[0]!.value).toBe(3);
      expect(result.metrics[1]!.value).toBe(2);
      expect(result.metrics[2]!.value).toBe(1);
    });

    it('listScores defaults to timestamp DESC', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date('2026-01-01T00:00:01Z'),
          traceId: 'ord-1',
          spanId: null,
          scorerId: 'q',
          score: 0.1,
          reason: null,
          experimentId: null,
          metadata: null,
        },
      });
      await storage.createScore({
        score: {
          scoreId: 'score-test-2',
          timestamp: new Date('2026-01-01T00:00:03Z'),
          traceId: 'ord-3',
          spanId: null,
          scorerId: 'q',
          score: 0.3,
          reason: null,
          experimentId: null,
          metadata: null,
        },
      });
      await storage.createScore({
        score: {
          scoreId: 'score-test-3',
          timestamp: new Date('2026-01-01T00:00:02Z'),
          traceId: 'ord-2',
          spanId: null,
          scorerId: 'q',
          score: 0.2,
          reason: null,
          experimentId: null,
          metadata: null,
        },
      });

      const result = await storage.listScores({});
      expect(result.scores).toHaveLength(3);
      expect(result.scores[0]!.traceId).toBe('ord-3');
      expect(result.scores[1]!.traceId).toBe('ord-2');
      expect(result.scores[2]!.traceId).toBe('ord-1');
    });

    it('listFeedback defaults to timestamp DESC', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date('2026-01-01T00:00:01Z'),
          traceId: 'fb-ord-1',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        },
      });
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-2',
          timestamp: new Date('2026-01-01T00:00:03Z'),
          traceId: 'fb-ord-3',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 3,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        },
      });
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-3',
          timestamp: new Date('2026-01-01T00:00:02Z'),
          traceId: 'fb-ord-2',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 2,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        },
      });

      const result = await storage.listFeedback({});
      expect(result.feedback).toHaveLength(3);
      expect(result.feedback[0]!.traceId).toBe('fb-ord-3');
      expect(result.feedback[1]!.traceId).toBe('fb-ord-2');
      expect(result.feedback[2]!.traceId).toBe('fb-ord-1');
    });

    it('listTraces defaults to startedAt DESC', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'tr-ord-1',
            spanId: 'root-1',
            parentSpanId: null,
            name: 'first',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:01Z'),
            endedAt: new Date('2026-01-01T00:00:02Z'),
          },
          {
            traceId: 'tr-ord-3',
            spanId: 'root-3',
            parentSpanId: null,
            name: 'third',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:03Z'),
            endedAt: new Date('2026-01-01T00:00:04Z'),
          },
          {
            traceId: 'tr-ord-2',
            spanId: 'root-2',
            parentSpanId: null,
            name: 'second',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:02Z'),
            endedAt: new Date('2026-01-01T00:00:03Z'),
          },
        ],
      });

      const result = await storage.listTraces({});
      expect(result.spans).toHaveLength(3);
      expect(result.spans[0]!.traceId).toBe('tr-ord-3');
      expect(result.spans[1]!.traceId).toBe('tr-ord-2');
      expect(result.spans[2]!.traceId).toBe('tr-ord-1');
    });
  });

  // ==========================================================================
  // Filter Surface Coverage
  // ==========================================================================

  describe('filter surface coverage', () => {
    describe('logs filters', () => {
      beforeEach(async () => {
        await storage.batchCreateLogs({
          logs: [
            {
              logId: 'log-test-1',
              timestamp: new Date('2026-01-01T00:00:00Z'),
              level: 'info',
              message: 'log-A',
              data: null,
              traceId: 'ft-trace-1',
              spanId: 'ft-span-1',
              entityType: EntityType.AGENT,
              entityName: 'agentA',
              parentEntityType: EntityType.WORKFLOW_RUN,
              parentEntityName: 'wfA',
              rootEntityType: EntityType.WORKFLOW_RUN,
              rootEntityName: 'rootWfA',
              userId: 'user-A',
              organizationId: 'org-A',
              sessionId: 'sess-A',
              threadId: 'thread-A',
              requestId: 'req-A',
              environment: 'staging',
              executionSource: 'cloud',
              serviceName: 'svc-A',
              experimentId: 'exp-A',
              tags: ['alpha'],
              metadata: null,
            },
            {
              logId: 'log-test-2',
              timestamp: new Date('2026-01-01T00:00:05Z'),
              level: 'error',
              message: 'log-B',
              data: null,
              traceId: 'ft-trace-2',
              spanId: 'ft-span-2',
              entityType: EntityType.TOOL,
              entityName: 'toolB',
              userId: 'user-B',
              environment: 'production',
              executionSource: 'local',
              serviceName: 'svc-B',
              tags: ['beta'],
              metadata: null,
            },
          ],
        });
      });

      it('filters by entityType', async () => {
        const result = await storage.listLogs({ filters: { entityType: 'agent' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by entityName', async () => {
        const result = await storage.listLogs({ filters: { entityName: 'toolB' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-B');
      });

      it('filters by parentEntityType', async () => {
        const result = await storage.listLogs({ filters: { parentEntityType: 'workflow_run' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by rootEntityType and rootEntityName', async () => {
        const result = await storage.listLogs({
          filters: { rootEntityType: 'workflow_run', rootEntityName: 'rootWfA' },
        });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by userId', async () => {
        const result = await storage.listLogs({ filters: { userId: 'user-A' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by sessionId', async () => {
        const result = await storage.listLogs({ filters: { sessionId: 'sess-A' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by threadId', async () => {
        const result = await storage.listLogs({ filters: { threadId: 'thread-A' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by requestId', async () => {
        const result = await storage.listLogs({ filters: { requestId: 'req-A' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by environment', async () => {
        const result = await storage.listLogs({ filters: { environment: 'production' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-B');
      });

      it('filters by executionSource', async () => {
        const result = await storage.listLogs({ filters: { executionSource: 'cloud' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('rejects deprecated source filter', async () => {
        await expect(storage.listLogs({ filters: { source: 'cloud' } as any })).rejects.toThrow(
          'Deprecated `source` filter is not supported for logs; use `executionSource` instead.',
        );
      });

      it('filters by serviceName', async () => {
        const result = await storage.listLogs({ filters: { serviceName: 'svc-A' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by traceId', async () => {
        const result = await storage.listLogs({ filters: { traceId: 'ft-trace-1' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by spanId', async () => {
        const result = await storage.listLogs({ filters: { spanId: 'ft-span-2' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-B');
      });

      it('filters by experimentId', async () => {
        const result = await storage.listLogs({ filters: { experimentId: 'exp-A' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-A');
      });

      it('filters by timestamp range', async () => {
        const result = await storage.listLogs({
          filters: {
            timestamp: {
              start: new Date('2026-01-01T00:00:03Z'),
              end: new Date('2026-01-01T00:00:10Z'),
            },
          },
        });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.message).toBe('log-B');
      });

      it('filters by array-form level', async () => {
        const result = await storage.listLogs({ filters: { level: ['info', 'warn'] } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.level).toBe('info');
      });
    });

    describe('metrics filters', () => {
      beforeEach(async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-test-1',
              timestamp: new Date('2026-01-01T00:00:00Z'),
              name: 'ft_metric',
              value: 100,
              labels: {},
              traceId: 'mt-trace-1',
              spanId: 'mt-span-1',
              entityType: EntityType.AGENT,
              entityName: 'agentA',
              parentEntityType: EntityType.WORKFLOW_RUN,
              parentEntityName: 'wfA',
              rootEntityType: EntityType.WORKFLOW_RUN,
              rootEntityName: 'rootWfA',
              userId: 'user-A',
              organizationId: 'org-A',
              sessionId: 'sess-A',
              threadId: 'thread-A',
              requestId: 'req-A',
              environment: 'staging',
              executionSource: 'cloud',
              serviceName: 'svc-A',
              experimentId: 'exp-A',
              tags: ['alpha'],
            },
            {
              metricId: 'metric-test-2',
              timestamp: new Date('2026-01-01T00:00:05Z'),
              name: 'ft_metric',
              value: 200,
              labels: {},
              traceId: 'mt-trace-2',
              spanId: 'mt-span-2',
              entityType: EntityType.TOOL,
              entityName: 'toolB',
              userId: 'user-B',
              environment: 'production',
              executionSource: 'local',
              serviceName: 'svc-B',
              tags: ['beta'],
            },
          ],
        });
      });

      it('filters by entityType', async () => {
        const result = await storage.listMetrics({ filters: { name: ['ft_metric'], entityType: 'agent' } });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(100);
      });

      it('filters by entityName', async () => {
        const result = await storage.listMetrics({ filters: { name: ['ft_metric'], entityName: 'toolB' } });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(200);
      });

      it('filters by userId', async () => {
        const result = await storage.listMetrics({ filters: { name: ['ft_metric'], userId: 'user-A' } });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(100);
      });

      it('filters by environment', async () => {
        const result = await storage.listMetrics({ filters: { name: ['ft_metric'], environment: 'production' } });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(200);
      });

      it('filters by executionSource', async () => {
        const result = await storage.listMetrics({
          filters: { name: ['ft_metric'], executionSource: 'cloud' },
        });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(100);
      });

      it('rejects deprecated source filter', async () => {
        await expect(storage.listMetrics({ filters: { name: ['ft_metric'], source: 'cloud' } as any })).rejects.toThrow(
          'Deprecated `source` filter is not supported for metrics; use `executionSource` instead.',
        );
      });

      it('filters by traceId', async () => {
        const result = await storage.listMetrics({ filters: { name: ['ft_metric'], traceId: 'mt-trace-1' } });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(100);
      });

      it('filters by experimentId', async () => {
        const result = await storage.listMetrics({ filters: { name: ['ft_metric'], experimentId: 'exp-A' } });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(100);
      });

      it('filters by timestamp range', async () => {
        const result = await storage.listMetrics({
          filters: {
            name: ['ft_metric'],
            timestamp: {
              start: new Date('2026-01-01T00:00:03Z'),
              end: new Date('2026-01-01T00:00:10Z'),
            },
          },
        });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.value).toBe(200);
      });
    });

    describe('scores filters', () => {
      beforeEach(async () => {
        await storage.createScore({
          score: {
            scoreId: 'score-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'sf-trace-1',
            spanId: 'sf-span-1',
            scorerId: 'quality',
            score: 0.8,
            reason: null,
            experimentId: 'exp-A',
            organizationId: 'org-A',
            metadata: null,
          },
        });
        await storage.createScore({
          score: {
            scoreId: 'score-test-2',
            timestamp: new Date('2026-01-01T00:00:05Z'),
            traceId: 'sf-trace-2',
            spanId: null,
            scorerId: 'factuality',
            score: 0.6,
            reason: null,
            experimentId: null,
            organizationId: 'org-B',
            metadata: null,
          },
        });
      });

      it('filters by organizationId', async () => {
        const result = await storage.listScores({ filters: { organizationId: 'org-A' } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBe('sf-trace-1');
      });

      it('filters by experimentId', async () => {
        const result = await storage.listScores({ filters: { experimentId: 'exp-A' } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBe('sf-trace-1');
      });

      it('filters by traceId', async () => {
        const result = await storage.listScores({ filters: { traceId: 'sf-trace-2' } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.scorerId).toBe('factuality');
      });

      it('filters by spanId', async () => {
        const result = await storage.listScores({ filters: { spanId: 'sf-span-1' } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBe('sf-trace-1');
      });

      it('filters by array-form scorerId', async () => {
        const result = await storage.listScores({ filters: { scorerId: ['quality', 'other'] } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBe('sf-trace-1');
      });

      it('filters by timestamp range', async () => {
        const result = await storage.listScores({
          filters: {
            timestamp: {
              start: new Date('2026-01-01T00:00:03Z'),
              end: new Date('2026-01-01T00:00:10Z'),
            },
          },
        });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBe('sf-trace-2');
      });

      it('rejects deprecated source filter', async () => {
        await expect(storage.listScores({ filters: { source: 'manual' } as any })).rejects.toThrow(
          'Deprecated `source` filter is not supported for scores; use `scoreSource or executionSource` instead.',
        );
      });
    });

    describe('feedback filters', () => {
      beforeEach(async () => {
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'ff-trace-1',
            spanId: 'ff-span-1',
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: null,
            experimentId: 'exp-A',
            userId: 'user-A',
            sourceId: null,
            organizationId: 'org-A',
            metadata: null,
          },
        });
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-test-2',
            timestamp: new Date('2026-01-01T00:00:05Z'),
            traceId: 'ff-trace-2',
            spanId: null,
            feedbackSource: 'reviewer',
            feedbackType: 'rating',
            value: 4,
            comment: null,
            experimentId: null,
            userId: 'user-B',
            sourceId: null,
            organizationId: 'org-B',
            metadata: null,
          },
        });
      });

      it('filters by organizationId', async () => {
        const result = await storage.listFeedback({ filters: { organizationId: 'org-A' } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBe('ff-trace-1');
      });

      it('filters by experimentId', async () => {
        const result = await storage.listFeedback({ filters: { experimentId: 'exp-A' } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBe('ff-trace-1');
      });

      it('filters by traceId', async () => {
        const result = await storage.listFeedback({ filters: { traceId: 'ff-trace-2' } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.feedbackType).toBe('rating');
      });

      it('filters by spanId', async () => {
        const result = await storage.listFeedback({ filters: { spanId: 'ff-span-1' } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBe('ff-trace-1');
      });

      it('filters by array-form feedbackType', async () => {
        const result = await storage.listFeedback({ filters: { feedbackType: ['rating', 'other'] } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBe('ff-trace-2');
      });

      it('filters by timestamp range', async () => {
        const result = await storage.listFeedback({
          filters: {
            timestamp: {
              start: new Date('2026-01-01T00:00:03Z'),
              end: new Date('2026-01-01T00:00:10Z'),
            },
          },
        });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBe('ff-trace-2');
      });

      it('rejects deprecated source filter', async () => {
        await expect(storage.listFeedback({ filters: { source: 'user' } as any })).rejects.toThrow(
          'Deprecated `source` filter is not supported for feedback; use `feedbackSource or executionSource` instead.',
        );
      });
    });
  });

  // ==========================================================================
  // Discovery
  // ==========================================================================

  describe('discovery', () => {
    beforeEach(async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-1',
            timestamp: new Date(),
            name: 'mastra_agent_duration_ms',
            value: 100,
            labels: { agent: 'weatherAgent', status: 'ok' },
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
            serviceName: 'metric-service',
            environment: 'metric-env',
            tags: ['metric-tag'],
          },
          {
            metricId: 'metric-test-2',
            timestamp: new Date(),
            name: 'mastra_tool_calls_started',
            value: 1,
            labels: { tool: 'search' },
            entityType: EntityType.TOOL,
            entityName: 'metricTool',
            serviceName: 'metric-service',
            environment: 'metric-env',
            tags: ['metric-tag'],
          },
        ],
      });

      await storage.batchCreateLogs({
        logs: [
          {
            logId: 'log-test-1',
            timestamp: new Date(),
            level: 'info',
            message: 'discovery-log',
            data: null,
            entityType: EntityType.INPUT_PROCESSOR,
            entityName: 'logProcessor',
            serviceName: 'log-service',
            environment: 'log-env',
            tags: ['log-tag'],
            metadata: null,
          },
        ],
      });

      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'disc-trace',
            spanId: 'disc-span',
            parentSpanId: null,
            name: 'test',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'a-1',
            entityName: 'weatherAgent',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'my-service',
            scope: null,
            attributes: null,
            metadata: null,
            tags: ['v1', 'experiment'],
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date(),
            endedAt: new Date(Date.now() + 1000),
          },
        ],
      });

      // Trigger discovery refresh so helper tables are populated.
      // In production, discovery MVs refresh automatically on a schedule.
      // In tests, we trigger an immediate refresh after inserting data.
      await triggerDiscoveryRefresh();
    });

    it('getMetricNames returns distinct names', async () => {
      const result = await storage.getMetricNames({});
      expect(result.names).toContain('mastra_agent_duration_ms');
      expect(result.names).toContain('mastra_tool_calls_started');
    });

    it('getMetricNames filters by prefix', async () => {
      const result = await storage.getMetricNames({ prefix: 'mastra_agent' });
      expect(result.names).toContain('mastra_agent_duration_ms');
      expect(result.names).not.toContain('mastra_tool_calls_started');
    });

    it('getMetricLabelKeys returns label keys', async () => {
      const result = await storage.getMetricLabelKeys({ metricName: 'mastra_agent_duration_ms' });
      expect(result.keys).toContain('agent');
      expect(result.keys).toContain('status');
    });

    it('getMetricLabelValues returns values for a label key', async () => {
      const result = await storage.getMetricLabelValues({
        metricName: 'mastra_agent_duration_ms',
        labelKey: 'status',
      });
      expect(result.values).toContain('ok');
    });

    it('getEntityTypes returns distinct entity types', async () => {
      const result = await storage.getEntityTypes({});
      expect(result.entityTypes).toContain('agent');
      expect(result.entityTypes).toContain('tool');
      expect(result.entityTypes).toContain('input_processor');
    });

    it('getEntityNames returns entity names', async () => {
      const result = await storage.getEntityNames({ entityType: EntityType.AGENT });
      expect(result.names).toContain('weatherAgent');

      const toolNames = await storage.getEntityNames({ entityType: EntityType.TOOL });
      expect(toolNames.names).toContain('metricTool');

      const processorNames = await storage.getEntityNames({ entityType: EntityType.INPUT_PROCESSOR });
      expect(processorNames.names).toContain('logProcessor');
    });

    it('getServiceNames returns service names', async () => {
      const result = await storage.getServiceNames({});
      expect(result.serviceNames).toContain('my-service');
      expect(result.serviceNames).toContain('metric-service');
      expect(result.serviceNames).toContain('log-service');
    });

    it('getEnvironments returns environments', async () => {
      const result = await storage.getEnvironments({});
      expect(result.environments).toContain('production');
      expect(result.environments).toContain('metric-env');
      expect(result.environments).toContain('log-env');
    });

    it('getTags returns distinct tags', async () => {
      const result = await storage.getTags({});
      expect(result.tags).toContain('v1');
      expect(result.tags).toContain('experiment');
      expect(result.tags).toContain('metric-tag');
      expect(result.tags).toContain('log-tag');
    });
  });

  // ==========================================================================
  // Scores
  // ==========================================================================

  describe('scores', () => {
    it('creates and lists scores', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date(),
          traceId: 'trace-1',
          spanId: null,
          scorerId: 'relevance',
          score: 0.85,
          reason: 'Good answer',
          experimentId: 'exp-1',
          metadata: { entityType: 'agent' },
        },
      });

      await storage.createScore({
        score: {
          scoreId: 'score-test-2',
          timestamp: new Date(),
          traceId: 'trace-1',
          spanId: 'span-1',
          scorerId: 'factuality',
          score: 0.9,
          reason: null,
          experimentId: null,
          metadata: null,
        },
      });

      const result = await storage.listScores({});
      expect(result.scores).toHaveLength(2);

      const filtered = await storage.listScores({
        filters: { scorerId: 'relevance' },
      });
      expect(filtered.scores).toHaveLength(1);
      expect(filtered.scores[0]!.score).toBe(0.85);
    });

    it('scoreSource round-trips through CH scoreSource column', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date(),
          traceId: 'trace-score-src',
          spanId: null,
          scorerId: 'quality',
          score: 0.9,
          reason: null,
          experimentId: null,
          scoreSource: 'automated',
          metadata: null,
        },
      });

      const result = await storage.listScores({});
      const match = result.scores.find(s => s.traceId === 'trace-score-src');
      expect(match).toBeDefined();
      expect(match!.scoreSource).toBe('automated');
    });

    it('supports nullable traceId for scores at the storage boundary', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date(),
          traceId: null,
          spanId: null,
          scorerId: 'quality',
          score: 0.9,
          reason: null,
          experimentId: null,
          scoreSource: 'automated',
          metadata: null,
        } as any,
      });

      const result = await storage.listScores({});
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0]!.traceId).toBeNull();
      expect(result.scores[0]!.scoreSource).toBe('automated');
    });

    it('filters scores by scoreSource', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date(),
          traceId: 'trace-ss-1',
          spanId: null,
          scorerId: 'relevance',
          score: 0.8,
          reason: null,
          experimentId: null,
          scoreSource: 'automated',
          metadata: null,
        },
      });
      await storage.createScore({
        score: {
          scoreId: 'score-test-2',
          timestamp: new Date(),
          traceId: 'trace-ss-2',
          spanId: null,
          scorerId: 'relevance',
          score: 0.7,
          reason: null,
          experimentId: null,
          scoreSource: 'manual',
          metadata: null,
        },
      });

      const result = await storage.listScores({
        filters: { scoreSource: 'automated' },
      });
      expect(result.scores).toHaveLength(1);
      expect(result.scores[0]!.traceId).toBe('trace-ss-1');
    });
  });

  // ==========================================================================
  // Feedback
  // ==========================================================================

  describe('feedback', () => {
    it('creates and lists feedback', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: 'trace-1',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
          comment: 'Great!',
          experimentId: null,
          userId: 'user-1',
          sourceId: 'source-1',
          metadata: null,
        },
      });

      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-2',
          timestamp: new Date(),
          traceId: 'trace-2',
          spanId: null,
          feedbackSource: 'reviewer',
          feedbackType: 'rating',
          value: 4,
          comment: null,
          experimentId: 'exp-1',
          userId: 'user-2',
          sourceId: 'source-2',
          metadata: null,
        },
      });

      const result = await storage.listFeedback({});
      expect(result.feedback).toHaveLength(2);

      const filtered = await storage.listFeedback({
        filters: { feedbackSource: 'user' },
      });
      expect(filtered.feedback).toHaveLength(1);
      expect(filtered.feedback[0]!.value).toBe(1);
      expect(filtered.feedback[0]!.userId).toBe('user-1');
      expect(filtered.feedback[0]!.sourceId).toBe('source-1');
    });

    it('feedbackUserId round-trips through CH userId column', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: 'trace-fbu',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
          comment: null,
          experimentId: null,
          feedbackUserId: 'reviewer-1',
          sourceId: null,
          metadata: null,
        },
      });

      const result = await storage.listFeedback({});
      const match = result.feedback.find(f => f.traceId === 'trace-fbu');
      expect(match).toBeDefined();
      expect(match!.feedbackUserId).toBe('reviewer-1');
    });

    it('filters feedback by feedbackUserId', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: 'trace-fbu-f1',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 1,
          comment: null,
          experimentId: null,
          feedbackUserId: 'reviewer-1',
          sourceId: null,
          metadata: null,
        },
      });
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-2',
          timestamp: new Date(),
          traceId: 'trace-fbu-f2',
          spanId: null,
          feedbackSource: 'user',
          feedbackType: 'thumbs',
          value: 0,
          comment: null,
          experimentId: null,
          feedbackUserId: 'reviewer-2',
          sourceId: null,
          metadata: null,
        },
      });

      const result = await storage.listFeedback({
        filters: { feedbackUserId: 'reviewer-1' },
      });
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0]!.traceId).toBe('trace-fbu-f1');
    });

    it('feedbackSource round-trips through CH feedbackSource column', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: 'trace-fbs',
          spanId: null,
          feedbackSource: 'manual',
          feedbackType: 'rating',
          value: 5,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        },
      });

      const result = await storage.listFeedback({});
      const match = result.feedback.find(f => f.traceId === 'trace-fbs');
      expect(match).toBeDefined();
      expect(match!.feedbackSource).toBe('manual');
    });

    it('supports nullable traceId for feedback at the storage boundary', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: null,
          spanId: null,
          feedbackSource: 'manual',
          feedbackType: 'rating',
          value: 5,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        } as any,
      });

      const result = await storage.listFeedback({});
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0]!.traceId).toBeNull();
      expect(result.feedback[0]!.feedbackSource).toBe('manual');
    });

    it('deprecated feedback source alias still writes to feedbackSource column', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: 'trace-fbs-compat',
          spanId: null,
          source: 'legacy-user',
          feedbackType: 'thumbs',
          value: 1,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        },
      });

      const result = await storage.listFeedback({});
      const match = result.feedback.find(f => f.traceId === 'trace-fbs-compat');
      expect(match).toBeDefined();
      expect(match!.feedbackSource).toBe('legacy-user');
    });

    it('filters feedback by feedbackSource', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date(),
          traceId: 'trace-fbs-f1',
          spanId: null,
          feedbackSource: 'manual',
          feedbackType: 'rating',
          value: 5,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        },
      });
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-2',
          timestamp: new Date(),
          traceId: 'trace-fbs-f2',
          spanId: null,
          feedbackSource: 'automated',
          feedbackType: 'rating',
          value: 3,
          comment: null,
          experimentId: null,
          userId: null,
          sourceId: null,
          metadata: null,
        },
      });

      const result = await storage.listFeedback({
        filters: { feedbackSource: 'manual' },
      });
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0]!.traceId).toBe('trace-fbs-f1');
    });

    it('batch creates feedback with mixed value types', async () => {
      await storage.batchCreateFeedback({
        feedbacks: [
          {
            feedbackId: 'feedback-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'batch-trace-1',
            spanId: null,
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: 'Helpful',
            experimentId: null,
            userId: 'user-1',
            sourceId: 'source-1',
            metadata: null,
          },
          {
            feedbackId: 'feedback-test-2',
            timestamp: new Date('2026-01-01T00:00:01Z'),
            traceId: 'batch-trace-2',
            spanId: 'span-2',
            feedbackSource: 'reviewer',
            feedbackType: 'rating',
            value: 4,
            comment: null,
            experimentId: 'exp-1',
            userId: 'user-2',
            sourceId: 'source-2',
            metadata: { category: 'quality' },
          },
          {
            feedbackId: 'feedback-test-3',
            timestamp: new Date('2026-01-01T00:00:02Z'),
            traceId: 'batch-trace-3',
            spanId: null,
            feedbackSource: 'system',
            feedbackType: 'flag',
            value: 'needs-review',
            comment: 'Escalated',
            experimentId: null,
            userId: null,
            sourceId: 'source-3',
            metadata: { severity: 'high' },
          },
        ],
      });

      const result = await storage.listFeedback({
        orderBy: { field: 'timestamp', direction: 'ASC' },
      });

      expect(result.feedback).toHaveLength(3);
      expect(result.feedback).toEqual([
        expect.objectContaining({
          traceId: 'batch-trace-1',
          value: 1,
          comment: 'Helpful',
        }),
        expect.objectContaining({
          traceId: 'batch-trace-2',
          value: 4,
          comment: null,
        }),
        expect.objectContaining({
          traceId: 'batch-trace-3',
          value: 'needs-review',
          comment: 'Escalated',
        }),
      ]);
    });
  });

  // ==========================================================================
  // Retry-Idempotency via dedupeKey
  // ==========================================================================

  describe('retry-idempotency via dedupeKey', () => {
    it('duplicate span inserts produce one logical row in getTrace', async () => {
      const span = {
        traceId: 'dedup-trace',
        spanId: 'dedup-span',
        parentSpanId: null,
        name: 'idempotent-span',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        entityType: EntityType.AGENT,
        entityId: 'a-1',
        entityName: 'myAgent',
        userId: null,
        organizationId: null,
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: 'test',
        source: null,
        serviceName: null,
        scope: null,
        attributes: null,
        metadata: null,
        tags: null,
        links: null,
        input: null,
        output: null,
        error: null,
        startedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-01-01T00:00:01Z'),
      } as const;

      // Insert same span twice (simulates retry)
      await storage.createSpan({ span });
      await storage.createSpan({ span });

      // getTrace uses LIMIT 1 BY dedupeKey — should return exactly one span
      const trace = await storage.getTrace({ traceId: 'dedup-trace' });
      expect(trace).not.toBeNull();
      expect(trace!.spans).toHaveLength(1);
      expect(trace!.spans[0]!.spanId).toBe('dedup-span');
    });

    it('duplicate root span inserts produce one logical row in listTraces', async () => {
      const span = {
        traceId: 'dedup-root-trace',
        spanId: 'dedup-root-span',
        parentSpanId: null,
        name: 'root-span',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        entityType: EntityType.AGENT,
        entityId: 'a-1',
        entityName: 'myAgent',
        userId: null,
        organizationId: null,
        resourceId: null,
        runId: null,
        sessionId: null,
        threadId: null,
        requestId: null,
        environment: 'test',
        source: null,
        serviceName: null,
        scope: null,
        attributes: null,
        metadata: null,
        tags: null,
        links: null,
        input: null,
        output: null,
        error: null,
        startedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-01-01T00:00:01Z'),
      } as const;

      // Insert same root span twice
      await storage.createSpan({ span });
      await storage.createSpan({ span });

      // listTraces uses LIMIT 1 BY dedupeKey on trace_roots — should show one trace
      const result = await storage.listTraces({});
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]!.traceId).toBe('dedup-root-trace');
    });
  });

  // ==========================================================================
  // trace_roots MV Population
  // ==========================================================================

  describe('trace_roots materialized view', () => {
    it('root spans (parentSpanId = null) appear in trace_roots via MV', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'mv-trace',
            spanId: 'root-span',
            parentSpanId: null,
            name: 'root',
            spanType: SpanType.WORKFLOW_RUN,
            isEvent: false,
            entityType: EntityType.WORKFLOW_RUN,
            entityId: 'wf-1',
            entityName: 'myWorkflow',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'svc',
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:02Z'),
          },
          {
            traceId: 'mv-trace',
            spanId: 'child-span',
            parentSpanId: 'root-span',
            name: 'child',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: EntityType.AGENT,
            entityId: 'a-1',
            entityName: 'myAgent',
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: 'production',
            source: null,
            serviceName: 'svc',
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
        ],
      });

      // getRootSpan reads from trace_roots — only root span should appear
      const root = await storage.getRootSpan({ traceId: 'mv-trace' });
      expect(root).not.toBeNull();
      expect(root!.span.spanId).toBe('root-span');
      expect(root!.span.name).toBe('root');

      // listTraces should show exactly 1 trace (the root span)
      const traces = await storage.listTraces({});
      expect(traces.spans).toHaveLength(1);
      expect(traces.spans[0]!.traceId).toBe('mv-trace');
      expect(traces.spans[0]!.spanId).toBe('root-span');
    });

    it('child spans do NOT appear in trace_roots', async () => {
      await storage.createSpan({
        span: {
          traceId: 'child-only-trace',
          spanId: 'child-only',
          parentSpanId: 'nonexistent-parent',
          name: 'orphan-child',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      // Child span exists in span_events
      const span = await storage.getSpan({ traceId: 'child-only-trace', spanId: 'child-only' });
      expect(span).not.toBeNull();

      // But NOT in trace_roots — getRootSpan should return null
      const root = await storage.getRootSpan({ traceId: 'child-only-trace' });
      expect(root).toBeNull();

      // listTraces reads from trace_roots — should be empty
      const traces = await storage.listTraces({});
      expect(traces.spans).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Status Derivation
  // ==========================================================================

  describe('status derivation', () => {
    it('derives ERROR status when root span has error', async () => {
      await storage.createSpan({
        span: {
          traceId: 'error-trace',
          spanId: 'error-root',
          parentSpanId: null,
          name: 'failed-run',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: 'a-1',
          entityName: 'myAgent',
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: { message: 'Something failed', stack: 'Error: ...' },
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const traces = await storage.listTraces({});
      expect(traces.spans).toHaveLength(1);
      expect(traces.spans[0]!.status).toBe('error');
    });

    it('derives SUCCESS status when root span has no error', async () => {
      await storage.createSpan({
        span: {
          traceId: 'success-trace',
          spanId: 'success-root',
          parentSpanId: null,
          name: 'good-run',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: 'a-1',
          entityName: 'myAgent',
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const traces = await storage.listTraces({});
      expect(traces.spans).toHaveLength(1);
      expect(traces.spans[0]!.status).toBe('success');
    });

    it('RUNNING status filter returns no rows (v-next stores only completed spans)', async () => {
      await storage.createSpan({
        span: {
          traceId: 'running-trace',
          spanId: 'running-root',
          parentSpanId: null,
          name: 'running-run',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      // Filtering by RUNNING status should return no rows — v-next never stores running traces
      const result = await storage.listTraces({ filters: { status: 'running' as any } });
      expect(result.spans).toHaveLength(0);
    });

    it('filters traces by ERROR status', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'status-filter-ok',
            spanId: 'ok-root',
            parentSpanId: null,
            name: 'ok-run',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
          {
            traceId: 'status-filter-err',
            spanId: 'err-root',
            parentSpanId: null,
            name: 'err-run',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: { message: 'boom' },
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
        ],
      });

      const errors = await storage.listTraces({ filters: { status: 'error' as any } });
      expect(errors.spans).toHaveLength(1);
      expect(errors.spans[0]!.traceId).toBe('status-filter-err');

      const successes = await storage.listTraces({ filters: { status: 'success' as any } });
      expect(successes.spans).toHaveLength(1);
      expect(successes.spans[0]!.traceId).toBe('status-filter-ok');
    });

    it('hasChildError filter finds traces with errored child spans', async () => {
      // Trace with error child
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'hce-trace',
            spanId: 'hce-root',
            parentSpanId: null,
            name: 'root',
            spanType: SpanType.WORKFLOW_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:02Z'),
          },
          {
            traceId: 'hce-trace',
            spanId: 'hce-child',
            parentSpanId: 'hce-root',
            name: 'child-with-error',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: { message: 'child failed' },
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
        ],
      });

      // Trace without error child
      await storage.createSpan({
        span: {
          traceId: 'clean-trace',
          spanId: 'clean-root',
          parentSpanId: null,
          name: 'clean-root',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const withErrors = await storage.listTraces({ filters: { hasChildError: true } });
      expect(withErrors.spans).toHaveLength(1);
      expect(withErrors.spans[0]!.traceId).toBe('hce-trace');

      const withoutErrors = await storage.listTraces({ filters: { hasChildError: false } });
      expect(withoutErrors.spans).toHaveLength(1);
      expect(withoutErrors.spans[0]!.traceId).toBe('clean-trace');
    });

    it('maps trace source filter to executionSource column', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'trace-source-cloud',
            spanId: 'root-cloud',
            parentSpanId: null,
            name: 'cloud-trace',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: 'cloud',
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
          {
            traceId: 'trace-source-local',
            spanId: 'root-local',
            parentSpanId: null,
            name: 'local-trace',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: 'local',
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: null,
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:02Z'),
            endedAt: new Date('2026-01-01T00:00:03Z'),
          },
        ],
      });

      const filtered = await storage.listTraces({ filters: { source: 'cloud' } });
      expect(filtered.spans).toHaveLength(1);
      expect(filtered.spans[0]!.traceId).toBe('trace-source-cloud');
    });
  });

  // ==========================================================================
  // metadataRaw vs metadataSearch Split
  // ==========================================================================

  describe('metadata split (metadataRaw vs metadataSearch)', () => {
    it('reconstructs full metadata from metadataRaw on read', async () => {
      const metadata = {
        customKey: 'customValue',
        nested: { deep: 'object' },
        number: 42,
        nullVal: null,
        array: [1, 2, 3],
      };

      await storage.createSpan({
        span: {
          traceId: 'meta-trace',
          spanId: 'meta-span',
          parentSpanId: null,
          name: 'meta-test',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const result = await storage.getSpan({ traceId: 'meta-trace', spanId: 'meta-span' });
      expect(result).not.toBeNull();
      // Full metadata preserved via metadataRaw, including nested objects and non-string values
      expect(result!.span.metadata).toEqual(metadata);
    });

    it('filters traces by top-level string metadata (metadataSearch)', async () => {
      await storage.batchCreateSpans({
        records: [
          {
            traceId: 'meta-filter-1',
            spanId: 'mf1',
            parentSpanId: null,
            name: 'with-custom',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: { customTag: 'alpha', nested: { deep: 'val' } },
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
          {
            traceId: 'meta-filter-2',
            spanId: 'mf2',
            parentSpanId: null,
            name: 'without-custom',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityType: null,
            entityId: null,
            entityName: null,
            userId: null,
            organizationId: null,
            resourceId: null,
            runId: null,
            sessionId: null,
            threadId: null,
            requestId: null,
            environment: null,
            source: null,
            serviceName: null,
            scope: null,
            attributes: null,
            metadata: { otherKey: 'beta' },
            tags: null,
            links: null,
            input: null,
            output: null,
            error: null,
            startedAt: new Date('2026-01-01T00:00:01Z'),
            endedAt: new Date('2026-01-01T00:00:02Z'),
          },
        ],
      });

      // Filter by metadata key=value — only top-level string values are indexed in metadataSearch
      const result = await storage.listTraces({ filters: { metadata: { customTag: 'alpha' } } });
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]!.traceId).toBe('meta-filter-1');
    });

    it('non-string metadata values are not searchable', async () => {
      await storage.createSpan({
        span: {
          traceId: 'meta-nonstring',
          spanId: 'mns1',
          parentSpanId: null,
          name: 'non-string-meta',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: { numericVal: 42, boolVal: true, searchable: 'yes' },
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      // Can find by string metadata
      const found = await storage.listTraces({ filters: { metadata: { searchable: 'yes' } } });
      expect(found.spans).toHaveLength(1);

      // Cannot find by numeric metadata (not indexed in metadataSearch)
      const notFound = await storage.listTraces({ filters: { metadata: { numericVal: '42' } } });
      expect(notFound.spans).toHaveLength(0);
    });

    it('PROMOTED_KEYS are excluded from metadataSearch', async () => {
      // If metadata contains a promoted key (e.g. entityType or executionSource), it should NOT be searchable
      // via metadata filter — promoted keys live in typed columns instead
      await storage.createSpan({
        span: {
          traceId: 'meta-promoted',
          spanId: 'mp1',
          parentSpanId: null,
          name: 'promoted-key-test',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: EntityType.AGENT,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: { entityType: 'agent', executionSource: 'cloud', customKey: 'findme' },
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      // customKey IS in metadataSearch — should be found
      const found = await storage.listTraces({ filters: { metadata: { customKey: 'findme' } } });
      expect(found.spans).toHaveLength(1);

      // entityType is a PROMOTED_KEY — should NOT be in metadataSearch, so metadata filter won't find it
      const notFound = await storage.listTraces({ filters: { metadata: { entityType: 'agent' } } });
      expect(notFound.spans).toHaveLength(0);

      const sourceNotFound = await storage.listTraces({ filters: { metadata: { executionSource: 'cloud' } } });
      expect(sourceNotFound.spans).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Shared Normalization Rules
  // ==========================================================================

  describe('shared normalization rules', () => {
    it('tags are trimmed, deduplicated, and empty/null values dropped', async () => {
      await storage.createSpan({
        span: {
          traceId: 'norm-tags',
          spanId: 'nt1',
          parentSpanId: null,
          name: 'tag-normalization',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: ['  alpha ', 'beta', 'alpha', '', '  beta  ', 'gamma'],
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const result = await storage.getSpan({ traceId: 'norm-tags', spanId: 'nt1' });
      expect(result).not.toBeNull();
      const tags = result!.span.tags;
      // Should be trimmed and deduplicated, empty strings dropped
      expect(tags).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('labels are trimmed and empty keys/values dropped', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            name: 'norm_labels_metric',
            value: 1,
            labels: { '  key1  ': '  val1  ', '': 'empty-key', key2: '', goodKey: 'goodVal' },
            entityType: null,
          },
        ],
      });

      const result = await storage.listMetrics({ filters: { name: ['norm_labels_metric'] } });
      expect(result.metrics).toHaveLength(1);
      const labels = result.metrics[0]!.labels;
      // Trimmed keys/values; empty key and empty value dropped
      expect(labels).toEqual({ key1: 'val1', goodKey: 'goodVal' });
    });

    it('event spans are stored with endedAt = startedAt (zero-duration)', async () => {
      const startedAt = new Date('2026-01-01T00:00:00Z');

      await storage.createSpan({
        span: {
          traceId: 'event-trace',
          spanId: 'event-span',
          parentSpanId: null,
          name: 'my-event',
          spanType: SpanType.AGENT_RUN,
          isEvent: true,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt,
          endedAt: new Date('2026-01-01T12:00:00Z'), // should be overridden to startedAt
        },
      });

      const result = await storage.getSpan({ traceId: 'event-trace', spanId: 'event-span' });
      expect(result).not.toBeNull();
      expect(result!.span.isEvent).toBe(true);
      // For event spans, endedAt should equal startedAt regardless of what was passed in
      expect(result!.span.startedAt.getTime()).toBe(startedAt.getTime());
      expect(result!.span.endedAt?.getTime()).toBe(startedAt.getTime());
    });

    it('log executionSource round-trips through CH executionSource column', async () => {
      await storage.batchCreateLogs({
        logs: [
          {
            logId: 'log-test-1',
            timestamp: new Date(),
            level: 'info',
            message: 'exec-source-test',
            data: null,
            executionSource: 'cloud',
            metadata: null,
          },
        ],
      });

      const result = await storage.listLogs({});
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.executionSource).toBe('cloud');
    });

    it('metric executionSource round-trips through CH executionSource column', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-test-1',
            timestamp: new Date(),
            name: 'exec_source_metric',
            value: 1,
            labels: {},
            executionSource: 'ci',
          },
        ],
      });

      const result = await storage.listMetrics({ filters: { name: ['exec_source_metric'] } });
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0]!.executionSource).toBe('ci');
    });

    it('createdAt equals startedAt and updatedAt is null', async () => {
      const startedAt = new Date('2026-01-01T00:00:00Z');

      await storage.createSpan({
        span: {
          traceId: 'ts-trace',
          spanId: 'ts-span',
          parentSpanId: null,
          name: 'timestamp-test',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          attributes: null,
          metadata: null,
          tags: null,
          links: null,
          input: null,
          output: null,
          error: null,
          startedAt,
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      });

      const result = await storage.getSpan({ traceId: 'ts-trace', spanId: 'ts-span' });
      expect(result).not.toBeNull();
      expect(result!.span.createdAt.getTime()).toBe(startedAt.getTime());
      expect(result!.span.updatedAt).toBeNull();
    });
  });

  // ==========================================================================
  // Scores — OLAP
  // ==========================================================================

  describe('scores OLAP', () => {
    beforeEach(async () => {
      await storage.batchCreateScores({
        scores: [
          {
            scoreId: 'score-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'olap-s-1',
            spanId: null,
            scorerId: 'quality',
            score: 0.8,
            reason: null,
            experimentId: null,
            scoreSource: 'automated',
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
            environment: 'production',
            metadata: null,
          },
          {
            scoreId: 'score-test-2',
            timestamp: new Date('2026-01-01T00:00:05Z'),
            traceId: 'olap-s-2',
            spanId: null,
            scorerId: 'quality',
            score: 0.6,
            reason: null,
            experimentId: null,
            scoreSource: 'automated',
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
            environment: 'production',
            metadata: null,
          },
          {
            scoreId: 'score-test-3',
            timestamp: new Date('2026-01-01T00:00:10Z'),
            traceId: 'olap-s-3',
            spanId: null,
            scorerId: 'quality',
            score: 0.9,
            reason: null,
            experimentId: null,
            scoreSource: 'automated',
            entityType: EntityType.AGENT,
            entityName: 'codeAgent',
            environment: 'staging',
            metadata: null,
          },
          {
            scoreId: 'score-test-4',
            timestamp: new Date('2026-01-01T01:00:00Z'),
            traceId: 'olap-s-4',
            spanId: null,
            scorerId: 'factuality',
            score: 0.5,
            reason: null,
            experimentId: null,
            scoreSource: 'manual',
            metadata: null,
          },
        ],
      });
    });

    it('getScoreAggregate returns avg', async () => {
      const result = await storage.getScoreAggregate({
        scorerId: 'quality',
        aggregation: 'avg',
      });
      expect(result.value).toBeCloseTo(0.7667, 2); // (0.8 + 0.6 + 0.9) / 3
    });

    it('getScoreAggregate returns sum', async () => {
      const result = await storage.getScoreAggregate({
        scorerId: 'quality',
        aggregation: 'sum',
      });
      expect(result.value).toBeCloseTo(2.3); // 0.8 + 0.6 + 0.9
    });

    it('getScoreAggregate returns count', async () => {
      const result = await storage.getScoreAggregate({
        scorerId: 'quality',
        aggregation: 'count',
      });
      expect(result.value).toBe(3);
    });

    it('getScoreAggregate filters by scoreSource', async () => {
      const result = await storage.getScoreAggregate({
        scorerId: 'quality',
        scoreSource: 'automated',
        aggregation: 'count',
      });
      expect(result.value).toBe(3);

      const manualResult = await storage.getScoreAggregate({
        scorerId: 'factuality',
        scoreSource: 'manual',
        aggregation: 'count',
      });
      expect(manualResult.value).toBe(1);
    });

    it('getScoreAggregate supports signal filters', async () => {
      const result = await storage.getScoreAggregate({
        scorerId: 'quality',
        aggregation: 'count',
        filters: { environment: 'production' },
      });
      expect(result.value).toBe(2);
    });

    it('getScoreBreakdown groups by entityName', async () => {
      const result = await storage.getScoreBreakdown({
        scorerId: 'quality',
        groupBy: ['entityName'],
        aggregation: 'avg',
      });
      expect(result.groups).toHaveLength(2);
      const weather = result.groups.find(g => g.dimensions.entityName === 'weatherAgent');
      const code = result.groups.find(g => g.dimensions.entityName === 'codeAgent');
      expect(weather).toBeDefined();
      expect(weather!.value).toBeCloseTo(0.7); // (0.8 + 0.6) / 2
      expect(code).toBeDefined();
      expect(code!.value).toBeCloseTo(0.9);
    });

    it('getScoreTimeSeries returns bucketed data', async () => {
      const result = await storage.getScoreTimeSeries({
        scorerId: 'quality',
        interval: '1h',
        aggregation: 'avg',
      });
      expect(result.series.length).toBeGreaterThanOrEqual(1);
      expect(result.series[0]!.points.length).toBeGreaterThanOrEqual(1);
    });

    it('getScoreTimeSeries with groupBy returns multi-series', async () => {
      const result = await storage.getScoreTimeSeries({
        scorerId: 'quality',
        interval: '1h',
        aggregation: 'avg',
        groupBy: ['entityName'],
      });
      expect(result.series.length).toBeGreaterThanOrEqual(2);
    });

    it('getScorePercentiles returns percentile series', async () => {
      const result = await storage.getScorePercentiles({
        scorerId: 'quality',
        percentiles: [0.5, 0.99],
        interval: '1h',
      });
      expect(result.series).toHaveLength(2);
      const p50 = result.series.find(s => s.percentile === 0.5);
      expect(p50).toBeDefined();
      expect(p50!.points.length).toBeGreaterThanOrEqual(1);
    });

    it('getScorePercentiles rejects out-of-range values', async () => {
      await expect(
        storage.getScorePercentiles({
          scorerId: 'quality',
          percentiles: [1.5],
          interval: '1h',
        }),
      ).rejects.toThrow('Percentile value must be a finite number between 0 and 1');
    });
  });

  // ==========================================================================
  // Feedback — OLAP
  // ==========================================================================

  describe('feedback OLAP', () => {
    beforeEach(async () => {
      await storage.batchCreateFeedback({
        feedbacks: [
          {
            feedbackId: 'feedback-test-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'olap-f-1',
            spanId: null,
            feedbackType: 'thumbs',
            feedbackSource: 'user',
            value: 1,
            comment: null,
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
            environment: 'production',
            metadata: null,
          },
          {
            feedbackId: 'feedback-test-2',
            timestamp: new Date('2026-01-01T00:00:05Z'),
            traceId: 'olap-f-2',
            spanId: null,
            feedbackType: 'thumbs',
            feedbackSource: 'user',
            value: 0,
            comment: null,
            entityType: EntityType.AGENT,
            entityName: 'weatherAgent',
            environment: 'production',
            metadata: null,
          },
          {
            feedbackId: 'feedback-test-3',
            timestamp: new Date('2026-01-01T00:00:10Z'),
            traceId: 'olap-f-3',
            spanId: null,
            feedbackType: 'thumbs',
            feedbackSource: 'user',
            value: 1,
            comment: null,
            entityType: EntityType.AGENT,
            entityName: 'codeAgent',
            environment: 'staging',
            metadata: null,
          },
          {
            feedbackId: 'feedback-test-4',
            timestamp: new Date('2026-01-01T01:00:00Z'),
            traceId: 'olap-f-4',
            spanId: null,
            feedbackType: 'rating',
            feedbackSource: 'reviewer',
            value: 4,
            comment: null,
            metadata: null,
          },
          {
            feedbackId: 'feedback-test-5',
            timestamp: new Date('2026-01-01T01:00:05Z'),
            traceId: 'olap-f-5',
            spanId: null,
            feedbackType: 'flag',
            feedbackSource: 'system',
            value: 'needs-review',
            comment: null,
            metadata: null,
          },
        ],
      });
    });

    it('getFeedbackAggregate returns sum of numeric values', async () => {
      const result = await storage.getFeedbackAggregate({
        feedbackType: 'thumbs',
        aggregation: 'sum',
      });
      expect(result.value).toBe(2); // 1 + 0 + 1
    });

    it('getFeedbackAggregate returns count', async () => {
      const result = await storage.getFeedbackAggregate({
        feedbackType: 'thumbs',
        aggregation: 'count',
      });
      expect(result.value).toBe(3);
    });

    it('getFeedbackAggregate returns avg', async () => {
      const result = await storage.getFeedbackAggregate({
        feedbackType: 'thumbs',
        aggregation: 'avg',
      });
      expect(result.value).toBeCloseTo(0.6667, 2); // (1 + 0 + 1) / 3
    });

    it('getFeedbackAggregate filters by feedbackSource', async () => {
      const result = await storage.getFeedbackAggregate({
        feedbackType: 'rating',
        feedbackSource: 'reviewer',
        aggregation: 'count',
      });
      expect(result.value).toBe(1);
    });

    it('getFeedbackAggregate supports signal filters', async () => {
      const result = await storage.getFeedbackAggregate({
        feedbackType: 'thumbs',
        aggregation: 'count',
        filters: { environment: 'production' },
      });
      expect(result.value).toBe(2);
    });

    it('getFeedbackAggregate excludes string-valued feedback from aggregation', async () => {
      // The 'flag' feedback with value 'needs-review' should not appear in numeric aggregation
      const result = await storage.getFeedbackAggregate({
        feedbackType: 'flag',
        aggregation: 'count',
      });
      // String-valued feedback has valueNumber = NULL, so it's excluded by the identity filter
      expect(result.value).toBe(0);
    });

    it('getFeedbackBreakdown groups by entityName', async () => {
      const result = await storage.getFeedbackBreakdown({
        feedbackType: 'thumbs',
        groupBy: ['entityName'],
        aggregation: 'avg',
      });
      expect(result.groups.length).toBeGreaterThanOrEqual(2);
      const weather = result.groups.find(g => g.dimensions.entityName === 'weatherAgent');
      const code = result.groups.find(g => g.dimensions.entityName === 'codeAgent');
      expect(weather).toBeDefined();
      expect(weather!.value).toBeCloseTo(0.5); // (1 + 0) / 2
      expect(code).toBeDefined();
      expect(code!.value).toBeCloseTo(1.0);
    });

    it('getFeedbackTimeSeries returns bucketed data', async () => {
      const result = await storage.getFeedbackTimeSeries({
        feedbackType: 'thumbs',
        interval: '1h',
        aggregation: 'sum',
      });
      expect(result.series.length).toBeGreaterThanOrEqual(1);
      expect(result.series[0]!.points.length).toBeGreaterThanOrEqual(1);
    });

    it('getFeedbackTimeSeries with groupBy returns multi-series', async () => {
      const result = await storage.getFeedbackTimeSeries({
        feedbackType: 'thumbs',
        interval: '1h',
        aggregation: 'avg',
        groupBy: ['entityName'],
      });
      expect(result.series.length).toBeGreaterThanOrEqual(2);
    });

    it('getFeedbackPercentiles returns percentile series', async () => {
      const result = await storage.getFeedbackPercentiles({
        feedbackType: 'thumbs',
        percentiles: [0.5, 0.99],
        interval: '1h',
      });
      expect(result.series).toHaveLength(2);
      const p50 = result.series.find(s => s.percentile === 0.5);
      expect(p50).toBeDefined();
      expect(p50!.points.length).toBeGreaterThanOrEqual(1);
    });

    it('getFeedbackPercentiles rejects out-of-range values', async () => {
      await expect(
        storage.getFeedbackPercentiles({
          feedbackType: 'thumbs',
          percentiles: [-0.1],
          interval: '1h',
        }),
      ).rejects.toThrow('Percentile value must be a finite number between 0 and 1');
    });
  });

  // ==========================================================================
  // Broadened Context Fields — Round-trip
  // ==========================================================================

  describe('broadened context fields round-trip', () => {
    it('score with full context fields round-trips', async () => {
      await storage.createScore({
        score: {
          scoreId: 'score-test-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'ctx-score-1',
          spanId: 'ctx-span-1',
          scorerId: 'quality',
          score: 0.95,
          reason: 'excellent',
          experimentId: 'exp-1',
          scoreSource: 'automated',
          entityType: EntityType.AGENT,
          entityId: 'a-1',
          entityName: 'myAgent',
          parentEntityType: EntityType.WORKFLOW_RUN,
          parentEntityId: 'wf-1',
          parentEntityName: 'myWorkflow',
          rootEntityType: EntityType.WORKFLOW_RUN,
          rootEntityId: 'root-1',
          rootEntityName: 'rootWorkflow',
          userId: 'user-1',
          organizationId: 'org-1',
          resourceId: 'res-1',
          runId: 'run-1',
          sessionId: 'sess-1',
          threadId: 'thread-1',
          requestId: 'req-1',
          environment: 'production',
          executionSource: 'cloud',
          serviceName: 'my-service',
          tags: ['tag1', 'tag2'],
          metadata: { custom: 'data' },
          scope: { tenant: 'acme' },
        },
      });

      const result = await storage.listScores({});
      expect(result.scores).toHaveLength(1);
      const s = result.scores[0]!;
      expect(s.traceId).toBe('ctx-score-1');
      expect(s.spanId).toBe('ctx-span-1');
      expect(s.scorerId).toBe('quality');
      expect(s.score).toBe(0.95);
      expect(s.reason).toBe('excellent');
      expect(s.scoreSource).toBe('automated');
      expect(s.entityType).toBe('agent');
      expect(s.entityId).toBe('a-1');
      expect(s.entityName).toBe('myAgent');
      expect(s.parentEntityType).toBe('workflow_run');
      expect(s.parentEntityId).toBe('wf-1');
      expect(s.parentEntityName).toBe('myWorkflow');
      expect(s.rootEntityType).toBe('workflow_run');
      expect(s.rootEntityId).toBe('root-1');
      expect(s.rootEntityName).toBe('rootWorkflow');
      expect(s.userId).toBe('user-1');
      expect(s.organizationId).toBe('org-1');
      expect(s.resourceId).toBe('res-1');
      expect(s.runId).toBe('run-1');
      expect(s.sessionId).toBe('sess-1');
      expect(s.threadId).toBe('thread-1');
      expect(s.requestId).toBe('req-1');
      expect(s.environment).toBe('production');
      expect(s.executionSource).toBe('cloud');
      expect(s.serviceName).toBe('my-service');
      expect(s.tags).toEqual(expect.arrayContaining(['tag1', 'tag2']));
      expect(s.metadata).toEqual({ custom: 'data' });
      expect(s.scope).toEqual({ tenant: 'acme' });
    });

    it('feedback with full context fields round-trips', async () => {
      await storage.createFeedback({
        feedback: {
          feedbackId: 'feedback-test-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'ctx-fb-1',
          spanId: 'ctx-fb-span-1',
          feedbackType: 'rating',
          feedbackSource: 'manual',
          feedbackUserId: 'reviewer-1',
          value: 5,
          comment: 'great job',
          experimentId: 'exp-1',
          entityType: EntityType.AGENT,
          entityId: 'a-1',
          entityName: 'myAgent',
          parentEntityType: EntityType.WORKFLOW_RUN,
          parentEntityId: 'wf-1',
          parentEntityName: 'myWorkflow',
          rootEntityType: EntityType.WORKFLOW_RUN,
          rootEntityId: 'root-1',
          rootEntityName: 'rootWorkflow',
          userId: 'reviewer-1',
          organizationId: 'org-1',
          resourceId: 'res-1',
          runId: 'run-1',
          sessionId: 'sess-1',
          threadId: 'thread-1',
          requestId: 'req-1',
          environment: 'production',
          executionSource: 'cloud',
          serviceName: 'my-service',
          sourceId: 'src-1',
          tags: ['feedback-tag'],
          metadata: { category: 'quality' },
          scope: { org: 'acme' },
        },
      });

      const result = await storage.listFeedback({});
      expect(result.feedback).toHaveLength(1);
      const f = result.feedback[0]!;
      expect(f.traceId).toBe('ctx-fb-1');
      expect(f.spanId).toBe('ctx-fb-span-1');
      expect(f.feedbackType).toBe('rating');
      expect(f.feedbackSource).toBe('manual');
      expect(f.feedbackUserId).toBe('reviewer-1');
      expect(f.value).toBe(5);
      expect(f.comment).toBe('great job');
      expect(f.entityType).toBe('agent');
      expect(f.entityId).toBe('a-1');
      expect(f.entityName).toBe('myAgent');
      expect(f.parentEntityType).toBe('workflow_run');
      expect(f.parentEntityId).toBe('wf-1');
      expect(f.parentEntityName).toBe('myWorkflow');
      expect(f.rootEntityType).toBe('workflow_run');
      expect(f.rootEntityId).toBe('root-1');
      expect(f.rootEntityName).toBe('rootWorkflow');
      expect(f.organizationId).toBe('org-1');
      expect(f.resourceId).toBe('res-1');
      expect(f.runId).toBe('run-1');
      expect(f.sessionId).toBe('sess-1');
      expect(f.threadId).toBe('thread-1');
      expect(f.requestId).toBe('req-1');
      expect(f.environment).toBe('production');
      expect(f.executionSource).toBe('cloud');
      expect(f.serviceName).toBe('my-service');
      expect(f.sourceId).toBe('src-1');
      expect(f.tags).toEqual(expect.arrayContaining(['feedback-tag']));
      expect(f.metadata).toEqual({ category: 'quality' });
      expect(f.scope).toEqual({ org: 'acme' });
    });
  });

  // ==========================================================================
  // Retention / TTL
  // ==========================================================================

  describe('retention / TTL', () => {
    // --- Unit tests for buildRetentionDDL ---

    it('buildRetentionDDL generates no statements when config is empty', () => {
      expect(buildRetentionDDL({})).toEqual([]);
    });

    it('buildRetentionDDL generates tracing TTL for both span_events and trace_roots', () => {
      const stmts = buildRetentionDDL({ tracing: 30 });
      expect(stmts).toHaveLength(2);
      expect(stmts[0]).toBe('ALTER TABLE mastra_span_events MODIFY TTL endedAt + INTERVAL 30 DAY');
      expect(stmts[1]).toBe('ALTER TABLE mastra_trace_roots MODIFY TTL endedAt + INTERVAL 30 DAY');
    });

    it('buildRetentionDDL generates per-signal TTL statements', () => {
      const stmts = buildRetentionDDL({ logs: 7, metrics: 14, scores: 90, feedback: 60 });
      expect(stmts).toHaveLength(4);
      expect(stmts).toContain('ALTER TABLE mastra_log_events MODIFY TTL timestamp + INTERVAL 7 DAY');
      expect(stmts).toContain('ALTER TABLE mastra_metric_events MODIFY TTL timestamp + INTERVAL 14 DAY');
      expect(stmts).toContain('ALTER TABLE mastra_score_events MODIFY TTL timestamp + INTERVAL 90 DAY');
      expect(stmts).toContain('ALTER TABLE mastra_feedback_events MODIFY TTL timestamp + INTERVAL 60 DAY');
    });

    it('buildRetentionDDL skips zero, negative, and non-numeric values', () => {
      const stmts = buildRetentionDDL({
        tracing: 0,
        logs: -5,
        metrics: NaN,
        scores: undefined,
        feedback: 10,
      } as any);
      expect(stmts).toHaveLength(1);
      expect(stmts[0]).toBe('ALTER TABLE mastra_feedback_events MODIFY TTL timestamp + INTERVAL 10 DAY');
    });

    it('buildRetentionDDL floors fractional days', () => {
      const stmts = buildRetentionDDL({ logs: 7.9 });
      expect(stmts).toHaveLength(1);
      expect(stmts[0]).toBe('ALTER TABLE mastra_log_events MODIFY TTL timestamp + INTERVAL 7 DAY');
    });

    // --- Integration test: retention is applied during init ---

    it('init applies retention TTL to tables', async () => {
      const client = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USERNAME || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || 'password',
      });

      const signalTables = [
        'mastra_span_events',
        'mastra_trace_roots',
        'mastra_log_events',
        'mastra_metric_events',
        'mastra_score_events',
        'mastra_feedback_events',
      ];

      try {
        // Create a fresh storage instance with retention config
        const retentionStorage = new ObservabilityStorageClickhouseVNext({
          client,
          retention: { tracing: 30, logs: 7, metrics: 14, scores: 90, feedback: 60 },
        });
        await retentionStorage.init();

        // Verify TTL was applied by checking SHOW CREATE TABLE output
        const expectedTTLs: Record<string, string> = {
          mastra_span_events: 'endedAt + toIntervalDay(30)',
          mastra_trace_roots: 'endedAt + toIntervalDay(30)',
          mastra_log_events: 'timestamp + toIntervalDay(7)',
          mastra_metric_events: 'timestamp + toIntervalDay(14)',
          mastra_score_events: 'timestamp + toIntervalDay(90)',
          mastra_feedback_events: 'timestamp + toIntervalDay(60)',
        };

        for (const name of signalTables) {
          const result = await client.query({
            query: `SHOW CREATE TABLE ${name}`,
            format: 'TabSeparatedRaw',
          });
          const createDDL = await result.text();
          expect(createDDL, `${name} should have TTL clause`).toContain('TTL');
          expect(createDDL, `${name} should have correct TTL expression`).toContain(expectedTTLs[name]!);
        }
      } finally {
        // Clean up: remove TTL from all signal tables so subsequent test runs
        // start from a clean state. ALTER TABLE ... MODIFY TTL with persistent
        // TTL can cause background mutations that interfere with other tests.
        for (const table of signalTables) {
          await client.command({ query: `ALTER TABLE ${table} REMOVE TTL` });
        }
        await client.close();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Trigger an immediate refresh of discovery materialized views.
 * In production these refresh on a schedule; in tests we need to trigger manually.
 * Uses a standalone client connection since the adapter's client is private.
 */
async function triggerDiscoveryRefresh(): Promise<void> {
  const { createClient } = await import('@clickhouse/client');
  const { MV_DISCOVERY_VALUES, MV_DISCOVERY_PAIRS } = await import('./ddl');

  const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'password',
  });

  try {
    await client.command({ query: `SYSTEM REFRESH VIEW ${MV_DISCOVERY_VALUES}` });
    await client.command({ query: `SYSTEM WAIT VIEW ${MV_DISCOVERY_VALUES}` });
    await client.command({ query: `SYSTEM REFRESH VIEW ${MV_DISCOVERY_PAIRS}` });
    await client.command({ query: `SYSTEM WAIT VIEW ${MV_DISCOVERY_PAIRS}` });
  } finally {
    await client.close();
  }
}

/**
 * Poll until a query returns null, modeling eventual-disappearance semantics.
 * Design doc (shared.md:271): delete-path tests should verify eventual
 * disappearance rather than immediate absence.
 */
async function eventuallyNull<T>(
  fn: () => Promise<T | null>,
  opts: { maxAttempts: number; intervalMs: number },
): Promise<boolean> {
  for (let i = 0; i < opts.maxAttempts; i++) {
    const result = await fn();
    if (result === null) return true;
    await new Promise(resolve => setTimeout(resolve, opts.intervalMs));
  }
  return false;
}
