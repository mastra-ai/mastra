import { coreFeatures } from '@mastra/core/features';
import { EntityType, SpanType } from '@mastra/core/observability';
import type { CreateSpanRecord, ObservabilityStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VNEXT_BASE_DATE, makeSpan } from './data';

export interface ObservabilityVNextCapabilities {
  /**
   * Adapter label used in the describe title (e.g. "InMemoryStore", "DuckDB",
   * "ClickHouse vNext"). Lets each adapter's shared-suite output be greppable.
   */
  label: string;
  /**
   * Preferred tracing strategy this adapter reports through
   * `observabilityStrategy.preferred`. Currently informational — strategy-specific
   * tests live in adapter test files until they are lifted into this suite.
   */
  preferredStrategy: 'event-sourced' | 'insert-only' | 'batch-with-updates';
}

export interface CreateObservabilityVNextTestsOptions {
  /**
   * Factory called once per test (after the previous run's storage has been
   * cleaned up) that returns a fresh ObservabilityStorage instance.
   */
  getStorage: () => Promise<ObservabilityStorage> | ObservabilityStorage;
  capabilities: ObservabilityVNextCapabilities;
  /**
   * Optional teardown hook called after each test. Defaults to
   * `storage.dangerouslyClearAll()`.
   */
  cleanup?: (storage: ObservabilityStorage) => Promise<void> | void;
  /**
   * Optional hook for adapters whose discovery surface is fed by asynchronous
   * helper tables (e.g. ClickHouse vNext's refreshable materialized views).
   * Called after the discovery test fixtures are written but before any
   * discovery assertion runs. Adapters with synchronous discovery (InMemory,
   * DuckDB) can omit this — discovery reads will already reflect the writes.
   */
  refreshDiscovery?: (storage: ObservabilityStorage) => Promise<void> | void;
  /**
   * Optional hook for adapters whose signal-table dedup happens via background
   * merges instead of inline on insert (ClickHouse's `ReplacingMergeTree`).
   * Called inside retry-idempotency tests between the duplicate insert and the
   * read assertion so the duplicate is collapsed in time. Adapters that dedupe
   * inline (InMemory upsert-by-id, DuckDB `INSERT OR IGNORE`) can omit this.
   */
  flushPendingMerges?: (storage: ObservabilityStorage) => Promise<void> | void;
}

/**
 * Shared observability vNext test suite. Captures behaviour every adapter that
 * implements the vNext ObservabilityStorage contract must satisfy: score and
 * feedback OLAP queries, logs, metrics aggregates/breakdowns/time-series/
 * percentiles, delta polling, listBranches, getBranch, getStructure /
 * getTraceLight.
 *
 * Adapter-specific behaviour (strategy-specific reconstruction, migration,
 * retention, retry idempotency on persistent storage, internal helpers like
 * `extractBranchSpans`) stays in the adapter's own test file.
 */
/**
 * Polls `fn` until `predicate` returns true. Used in tests that read through
 * adapter components with eventual visibility (e.g. ClickHouse incremental
 * materialized views) so the assertion isn't racey. Adapters with synchronous
 * reads (InMemory, DuckDB) satisfy the predicate on the first call.
 */
async function waitFor<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const intervalMs = opts.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    lastValue = await fn();
    if (predicate(lastValue)) return lastValue;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return lastValue as T;
}

export function createObservabilityVNextTests(options: CreateObservabilityVNextTestsOptions) {
  const { capabilities, getStorage, cleanup, refreshDiscovery, flushPendingMerges } = options;

  describe(`observability vNext shared suite — ${capabilities.label}`, () => {
    let storage: ObservabilityStorage;

    beforeEach(async () => {
      storage = await getStorage();
    });

    afterEach(async () => {
      if (cleanup) {
        await cleanup(storage);
      } else {
        await storage.dangerouslyClearAll();
      }
    });

    it('reports observability strategy preference', () => {
      expect(storage.observabilityStrategy?.preferred).toBe(capabilities.preferredStrategy);
    });

    it('gets a score by ID without paginating through list results', async () => {
      const now = new Date('2026-01-02T00:00:00.000Z');

      await storage.batchCreateScores({
        scores: Array.from({ length: 101 }, (_, index) => ({
          id: `score-${index}`,
          scoreId: `score-${index}`,
          timestamp: now,
          scorerId: 'test-scorer',
          score: index,
          createdAt: now,
          updatedAt: null,
        })),
      });

      await expect(storage.getScoreById('score-100')).resolves.toMatchObject({ scoreId: 'score-100' });
      await expect(storage.getScoreById('missing-score')).resolves.toBeNull();
    });

    it('listLogs applies shared observability context filters', async () => {
      const now = new Date('2026-01-02T00:00:00.000Z');

      await storage.batchCreateLogs({
        logs: [
          {
            logId: 'log-ctx-kept',
            timestamp: now,
            level: 'info',
            message: 'kept',
            traceId: 'trace-1',
            spanId: 'span-1',
            entityType: EntityType.AGENT,
            entityName: 'my-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityName: 'my-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityName: 'root-workflow',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            serviceName: 'api',
            environment: 'prod',
            executionSource: 'cloud',
            tags: ['prod', 'alpha'],
          },
          {
            logId: 'log-ctx-filtered',
            timestamp: now,
            level: 'info',
            message: 'filtered-out',
            traceId: 'trace-2',
            spanId: 'span-2',
            entityType: EntityType.AGENT,
            entityName: 'other-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityName: 'other-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityName: 'other-root',
            organizationId: 'org-2',
            resourceId: 'resource-2',
            runId: 'run-2',
            sessionId: 'session-2',
            threadId: 'thread-2',
            requestId: 'request-2',
            serviceName: 'worker',
            environment: 'dev',
            executionSource: 'local',
            tags: ['dev'],
          },
        ],
      });

      const result = await storage.listLogs({
        filters: {
          traceId: 'trace-1',
          spanId: 'span-1',
          entityType: EntityType.AGENT,
          entityName: 'my-agent',
          parentEntityType: EntityType.WORKFLOW_RUN,
          parentEntityName: 'my-workflow',
          rootEntityType: EntityType.WORKFLOW_RUN,
          rootEntityName: 'root-workflow',
          organizationId: 'org-1',
          resourceId: 'resource-1',
          runId: 'run-1',
          sessionId: 'session-1',
          threadId: 'thread-1',
          requestId: 'request-1',
          serviceName: 'api',
          environment: 'prod',
          executionSource: 'cloud',
          tags: ['prod'],
        },
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]!.message).toBe('kept');
    });

    it('listMetrics supports storage-layer inspection with shared filters', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-auto-1',
            labels: {},
            timestamp: new Date('2026-01-02T12:00:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 10,
            traceId: 'trace-1',
            organizationId: 'org-1',
            threadId: 'thread-1',
            tags: ['prod'],
            estimatedCost: 0.01,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-2',
            labels: {},
            timestamp: new Date('2026-01-02T13:00:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 20,
            traceId: 'trace-2',
            organizationId: 'org-2',
            threadId: 'thread-2',
            tags: ['dev'],
            estimatedCost: 0.02,
            costUnit: 'usd',
          },
        ],
      });

      const result = await storage.listMetrics({
        filters: {
          traceId: 'trace-1',
          organizationId: 'org-1',
          threadId: 'thread-1',
          tags: ['prod'],
        },
      });

      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0]!.value).toBe(10);
    });

    it('getMetricAggregate applies shared filters and returns aggregated cost from one filtered scan', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-auto-3',
            labels: {},
            timestamp: new Date('2026-01-02T12:00:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 100,
            traceId: 'trace-1',
            spanId: 'span-1',
            entityType: EntityType.AGENT,
            entityName: 'my-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityName: 'my-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityName: 'root-workflow',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            serviceName: 'api',
            environment: 'prod',
            executionSource: 'cloud',
            tags: ['prod'],
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.1,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-4',
            labels: {},
            timestamp: new Date('2026-01-02T13:00:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 50,
            traceId: 'trace-1',
            spanId: 'span-2',
            entityType: EntityType.AGENT,
            entityName: 'my-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityName: 'my-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityName: 'root-workflow',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            serviceName: 'api',
            environment: 'prod',
            executionSource: 'cloud',
            tags: ['prod'],
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.05,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-5',
            labels: {},
            timestamp: new Date('2026-01-01T12:00:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 80,
            traceId: 'trace-1',
            spanId: 'span-0',
            entityType: EntityType.AGENT,
            entityName: 'my-agent',
            parentEntityType: EntityType.WORKFLOW_RUN,
            parentEntityName: 'my-workflow',
            rootEntityType: EntityType.WORKFLOW_RUN,
            rootEntityName: 'root-workflow',
            organizationId: 'org-1',
            resourceId: 'resource-1',
            runId: 'run-1',
            sessionId: 'session-1',
            threadId: 'thread-1',
            requestId: 'request-1',
            serviceName: 'api',
            environment: 'prod',
            executionSource: 'cloud',
            tags: ['prod'],
            provider: 'openai',
            model: 'gpt-4o-mini',
            estimatedCost: 0.08,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-6',
            labels: {},
            timestamp: new Date('2026-01-02T12:00:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 999,
            traceId: 'trace-2',
            spanId: 'span-9',
            organizationId: 'org-2',
            tags: ['other'],
            estimatedCost: 9.99,
            costUnit: 'usd',
          },
        ],
      });

      const result = await storage.getMetricAggregate({
        name: ['mastra_model_total_input_tokens'],
        aggregation: 'sum',
        comparePeriod: 'previous_period',
        filters: {
          timestamp: {
            start: new Date('2026-01-02T00:00:00.000Z'),
            end: new Date('2026-01-03T00:00:00.000Z'),
          },
          traceId: 'trace-1',
          entityType: EntityType.AGENT,
          entityName: 'my-agent',
          parentEntityType: EntityType.WORKFLOW_RUN,
          parentEntityName: 'my-workflow',
          rootEntityType: EntityType.WORKFLOW_RUN,
          rootEntityName: 'root-workflow',
          organizationId: 'org-1',
          resourceId: 'resource-1',
          runId: 'run-1',
          sessionId: 'session-1',
          threadId: 'thread-1',
          requestId: 'request-1',
          serviceName: 'api',
          environment: 'prod',
          executionSource: 'cloud',
          tags: ['prod'],
          provider: 'openai',
          model: 'gpt-4o-mini',
          costUnit: 'usd',
        },
      });

      expect(result.value).toBe(150);
      expect(result.estimatedCost).toBeCloseTo(0.15);
      expect(result.costUnit).toBe('usd');
      expect(result.previousValue).toBe(80);
      expect(result.previousEstimatedCost).toBeCloseTo(0.08);
      expect(result.changePercent).toBe(87.5);
      expect(result.costChangePercent).toBeCloseTo(87.5);
    });

    it('getMetricBreakdown returns grouped cost alongside grouped value', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-auto-7',
            labels: {},
            timestamp: new Date('2026-01-02T12:00:00.000Z'),
            name: 'mastra_model_total_output_tokens',
            value: 40,
            entityName: 'agent-a',
            organizationId: 'org-1',
            tags: ['prod'],
            estimatedCost: 0.04,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-8',
            labels: {},
            timestamp: new Date('2026-01-02T13:00:00.000Z'),
            name: 'mastra_model_total_output_tokens',
            value: 60,
            entityName: 'agent-a',
            organizationId: 'org-1',
            tags: ['prod'],
            estimatedCost: 0.06,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-9',
            labels: {},
            timestamp: new Date('2026-01-02T14:00:00.000Z'),
            name: 'mastra_model_total_output_tokens',
            value: 999,
            entityName: 'agent-b',
            organizationId: 'org-2',
            tags: ['dev'],
            estimatedCost: 9.99,
            costUnit: 'usd',
          },
        ],
      });

      const result = await storage.getMetricBreakdown({
        name: ['mastra_model_total_output_tokens'],
        groupBy: ['entityName'],
        aggregation: 'sum',
        filters: {
          organizationId: 'org-1',
          tags: ['prod'],
        },
      });

      expect(result.groups).toEqual([
        {
          dimensions: { entityName: 'agent-a' },
          value: 100,
          estimatedCost: 0.1,
          costUnit: 'usd',
        },
      ]);
    });

    it('getMetricTimeSeries returns estimatedCost per bucket and series', async () => {
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-auto-10',
            labels: {},
            timestamp: new Date('2026-01-02T12:10:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 10,
            serviceName: 'api',
            tags: ['prod'],
            estimatedCost: 0.01,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-11',
            labels: {},
            timestamp: new Date('2026-01-02T12:20:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 15,
            serviceName: 'api',
            tags: ['prod'],
            estimatedCost: 0.015,
            costUnit: 'usd',
          },
          {
            metricId: 'metric-auto-12',
            labels: {},
            timestamp: new Date('2026-01-02T13:10:00.000Z'),
            name: 'mastra_model_total_input_tokens',
            value: 20,
            serviceName: 'worker',
            tags: ['dev'],
            estimatedCost: 0.02,
            costUnit: 'usd',
          },
        ],
      });

      const result = await storage.getMetricTimeSeries({
        name: ['mastra_model_total_input_tokens'],
        interval: '1h',
        aggregation: 'sum',
        filters: {
          serviceName: 'api',
          tags: ['prod'],
        },
      });

      expect(result.series).toEqual([
        {
          name: 'mastra_model_total_input_tokens',
          costUnit: 'usd',
          points: [
            {
              timestamp: new Date('2026-01-02T12:00:00.000Z'),
              value: 25,
              estimatedCost: 0.025,
            },
          ],
        },
      ]);
    });

    it('getMetricPercentiles still honors shared filters', async () => {
      // Use a single matching point so the percentile is unambiguous across
      // adapters (some use nearest-rank, others linear interpolation).
      await storage.batchCreateMetrics({
        metrics: [
          {
            metricId: 'metric-auto-13',
            labels: {},
            timestamp: new Date('2026-01-02T12:10:00.000Z'),
            name: 'mastra_tool_duration_ms',
            value: 42,
            threadId: 'thread-1',
            tags: ['prod'],
          },
          {
            metricId: 'metric-auto-15',
            labels: {},
            timestamp: new Date('2026-01-02T12:30:00.000Z'),
            name: 'mastra_tool_duration_ms',
            value: 999,
            threadId: 'thread-2',
            tags: ['dev'],
          },
        ],
      });

      const result = await storage.getMetricPercentiles({
        name: 'mastra_tool_duration_ms',
        percentiles: [0.5],
        interval: '1h',
        filters: {
          threadId: 'thread-1',
          tags: ['prod'],
        },
      });

      expect(result.series).toEqual([
        {
          percentile: 0.5,
          points: [
            {
              timestamp: new Date('2026-01-02T12:00:00.000Z'),
              value: 42,
            },
          ],
        },
      ]);
    });

    it('score OLAP queries key by scorerId', async () => {
      await storage.batchCreateScores({
        scores: [
          {
            scoreId: 'score-auto-1',
            timestamp: new Date('2026-01-02T12:00:00.000Z'),
            traceId: 'trace-1',
            scorerId: 'relevance',
            scoreSource: 'manual',
            score: 0.8,
            experimentId: 'exp-1',
            entityName: 'agent-a',
          },
          {
            scoreId: 'score-auto-2',
            timestamp: new Date('2026-01-02T12:30:00.000Z'),
            traceId: 'trace-2',
            scorerId: 'relevance',
            scoreSource: 'manual',
            score: 0.6,
            experimentId: 'exp-2',
            entityName: 'agent-b',
          },
          {
            scoreId: 'score-auto-3',
            timestamp: new Date('2026-01-02T12:45:00.000Z'),
            traceId: 'trace-3',
            scorerId: 'toxicity',
            scoreSource: 'manual',
            score: 0.1,
            experimentId: 'exp-1',
            entityName: 'agent-a',
          },
          {
            scoreId: 'score-auto-4',
            timestamp: new Date('2026-01-02T12:50:00.000Z'),
            traceId: 'trace-4',
            scorerId: 'relevance',
            scoreSource: 'automated',
            score: 0.2,
            experimentId: 'exp-3',
            entityName: 'agent-c',
          },
        ],
      });

      const aggregate = await storage.getScoreAggregate({
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg',
      });
      expect(aggregate.value).toBeCloseTo(0.7);

      const breakdown = await storage.getScoreBreakdown({
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg',
        groupBy: ['experimentId'],
      });
      expect(breakdown.groups).toEqual([
        { dimensions: { experimentId: 'exp-1' }, value: 0.8 },
        { dimensions: { experimentId: 'exp-2' }, value: 0.6 },
      ]);

      const series = await storage.getScoreTimeSeries({
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg',
        interval: '1h',
      });
      expect(series.series).toEqual([
        {
          name: 'relevance|manual',
          points: [{ timestamp: new Date('2026-01-02T12:00:00.000Z'), value: 0.7 }],
        },
      ]);

      const percentiles = await storage.getScorePercentiles({
        scorerId: 'relevance',
        scoreSource: 'manual',
        percentiles: [0.5],
        interval: '1h',
      });
      expect(percentiles.series).toEqual([
        {
          percentile: 0.5,
          points: [{ timestamp: new Date('2026-01-02T12:00:00.000Z'), value: 0.7 }],
        },
      ]);
    });

    it('score last aggregation uses the latest timestamp, not insertion order', async () => {
      await storage.batchCreateScores({
        scores: [
          {
            scoreId: 'score-auto-5',
            timestamp: new Date('2026-01-02T12:30:00.000Z'),
            traceId: 'trace-last-1',
            scorerId: 'relevance',
            score: 0.3,
          },
          {
            scoreId: 'score-auto-6',
            timestamp: new Date('2026-01-02T12:45:00.000Z'),
            traceId: 'trace-last-2',
            scorerId: 'relevance',
            score: 0.9,
          },
          {
            scoreId: 'score-auto-7',
            timestamp: new Date('2026-01-02T12:15:00.000Z'),
            traceId: 'trace-last-3',
            scorerId: 'relevance',
            score: 0.1,
          },
        ],
      });

      expect(
        await storage.getScoreAggregate({
          scorerId: 'relevance',
          aggregation: 'last',
        }),
      ).toEqual({ value: 0.9 });

      expect(
        await storage.getScoreBreakdown({
          scorerId: 'relevance',
          aggregation: 'last',
          groupBy: ['scorerId'],
        }),
      ).toEqual({
        groups: [{ dimensions: { scorerId: 'relevance' }, value: 0.9 }],
      });

      expect(
        await storage.getScoreTimeSeries({
          scorerId: 'relevance',
          aggregation: 'last',
          interval: '1h',
        }),
      ).toEqual({
        series: [
          {
            name: 'relevance',
            points: [{ timestamp: new Date('2026-01-02T12:00:00.000Z'), value: 0.9 }],
          },
        ],
      });
    });

    it('feedback OLAP queries key by feedbackType and optionally feedbackSource, ignoring non-numeric values', async () => {
      await storage.batchCreateFeedback({
        feedbacks: [
          {
            feedbackId: 'feedback-auto-1',
            timestamp: new Date('2026-01-02T12:00:00.000Z'),
            traceId: 'trace-1',
            feedbackType: 'rating',
            feedbackSource: 'user',
            value: 5,
            entityName: 'agent-a',
          },
          {
            feedbackId: 'feedback-auto-2',
            timestamp: new Date('2026-01-02T12:15:00.000Z'),
            traceId: 'trace-2',
            feedbackType: 'rating',
            feedbackSource: 'user',
            value: 4,
            entityName: 'agent-b',
          },
          {
            feedbackId: 'feedback-auto-3',
            timestamp: new Date('2026-01-02T12:30:00.000Z'),
            traceId: 'trace-3',
            feedbackType: 'rating',
            feedbackSource: 'system',
            value: 1,
            entityName: 'agent-a',
          },
          {
            feedbackId: 'feedback-auto-4',
            timestamp: new Date('2026-01-02T12:45:00.000Z'),
            traceId: 'trace-4',
            feedbackType: 'rating',
            feedbackSource: 'user',
            value: 'needs-review',
            entityName: 'agent-a',
          },
        ],
      });

      const aggregate = await storage.getFeedbackAggregate({
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg',
      });
      expect(aggregate.value).toBe(4.5);

      const breakdown = await storage.getFeedbackBreakdown({
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg',
        groupBy: ['entityName'],
      });
      expect(breakdown.groups).toEqual([
        { dimensions: { entityName: 'agent-a' }, value: 5 },
        { dimensions: { entityName: 'agent-b' }, value: 4 },
      ]);

      const series = await storage.getFeedbackTimeSeries({
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg',
        interval: '1h',
      });
      expect(series.series).toEqual([
        {
          name: 'rating|user',
          points: [{ timestamp: new Date('2026-01-02T12:00:00.000Z'), value: 4.5 }],
        },
      ]);

      const percentiles = await storage.getFeedbackPercentiles({
        feedbackType: 'rating',
        feedbackSource: 'user',
        percentiles: [0.5],
        interval: '1h',
      });
      expect(percentiles.series).toEqual([
        {
          percentile: 0.5,
          points: [{ timestamp: new Date('2026-01-02T12:00:00.000Z'), value: 4.5 }],
        },
      ]);
    });

    describe('delta polling', () => {
      let hadDeltaPollingFlag = false;

      beforeEach(() => {
        hadDeltaPollingFlag = coreFeatures.has('observability-delta-polling');
        coreFeatures.add('observability-delta-polling');
      });

      afterEach(() => {
        if (!hadDeltaPollingFlag) {
          coreFeatures.delete('observability-delta-polling');
        }
      });

      function makeSpan(
        overrides: Partial<CreateSpanRecord> & Pick<CreateSpanRecord, 'traceId' | 'spanId'>,
      ): CreateSpanRecord {
        const startedAt = overrides.startedAt ?? new Date('2026-01-02T12:00:00.000Z');
        return {
          parentSpanId: null,
          name: overrides.name ?? overrides.spanId,
          spanType: overrides.spanType ?? SpanType.AGENT_RUN,
          isEvent: false,
          startedAt,
          endedAt: overrides.endedAt ?? new Date(startedAt.getTime() + 1000),
          ...overrides,
        } as CreateSpanRecord;
      }

      it('hides delta behavior when the feature flag is absent', async () => {
        coreFeatures.delete('observability-delta-polling');

        try {
          expect(storage.getFeatures()).toBeUndefined();

          const page = await storage.listLogs({});
          expect(page.deltaCursor).toBeUndefined();

          await expect(storage.listLogs({ mode: 'delta' })).rejects.toThrow(
            'does not support observability delta polling',
          );
        } finally {
          coreFeatures.add('observability-delta-polling');
        }
      });

      it('returns a page deltaCursor for empty trace results and delta without after starts from now', async () => {
        const page = await storage.listTraces({ filters: { entityName: 'Observer' } });
        expect(page.spans).toEqual([]);
        expect(page.deltaCursor).toBeDefined();

        const start = await storage.listTraces({ mode: 'delta', filters: { entityName: 'Observer' } });
        expect(start.spans).toEqual([]);
        expect(start.delta).toEqual({ limit: 10, hasMore: false });
        expect(start.deltaCursor).toBeDefined();

        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'trace-1',
              spanId: 'root-1',
              spanType: SpanType.AGENT_RUN,
              entityType: EntityType.AGENT,
              entityName: 'Observer',
            }),
          ],
        });

        // ClickHouse populates trace_roots through an incremental MV; the row
        // is normally visible immediately but occasionally lags a tick under
        // CI load. Poll briefly so the assertion is not racey.
        const deltaFromPage = await waitFor(
          () =>
            storage.listTraces({
              mode: 'delta',
              filters: { entityName: 'Observer' },
              after: page.deltaCursor!,
            }),
          result => result.spans.length === 1,
        );
        expect(deltaFromPage.spans.map(span => span.traceId)).toEqual(['trace-1']);

        const deltaFromStart = await waitFor(
          () =>
            storage.listTraces({
              mode: 'delta',
              filters: { entityName: 'Observer' },
              after: start.deltaCursor!,
            }),
          result => result.spans.length === 1,
        );
        expect(deltaFromStart.spans.map(span => span.traceId)).toEqual(['trace-1']);
      });

      it('does not re-emit existing traces when later spans update them', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'trace-1',
              spanId: 'root-1',
              spanType: SpanType.WORKFLOW_RUN,
              entityType: EntityType.WORKFLOW_RUN,
              entityName: 'workflow',
            }),
          ],
        });

        const page = await storage.listTraces({ filters: { entityName: 'workflow' } });

        await storage.createSpan({
          span: makeSpan({
            traceId: 'trace-1',
            spanId: 'child-1',
            parentSpanId: 'root-1',
            spanType: SpanType.TOOL_CALL,
            entityType: EntityType.TOOL,
            entityName: 'search',
            startedAt: new Date('2026-01-02T12:00:01.000Z'),
          }),
        });

        const delta = await storage.listTraces({
          mode: 'delta',
          filters: { entityName: 'workflow' },
          after: page.deltaCursor!,
        });

        expect(delta.spans).toEqual([]);
        expect(delta.delta).toEqual({ limit: 10, hasMore: false });
      });

      it('returns only newly listed branch rows in delta mode', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'trace-1',
              spanId: 'root-1',
              spanType: SpanType.WORKFLOW_RUN,
              entityType: EntityType.WORKFLOW_RUN,
              entityName: 'workflow',
            }),
            makeSpan({
              traceId: 'trace-1',
              spanId: 'observer-1',
              parentSpanId: 'root-1',
              spanType: SpanType.AGENT_RUN,
              entityType: EntityType.AGENT,
              entityName: 'Observer',
              startedAt: new Date('2026-01-02T12:00:01.000Z'),
            }),
          ],
        });

        const page = await storage.listBranches({ filters: { entityName: 'Observer' } });

        // updateSpan is unsupported on event-sourced strategies (e.g. DuckDB) by
        // design. The behavior under test — that updates don't re-emit as new
        // branch rows in delta mode — is only meaningful when the adapter can
        // update at all. Skip the update on strategies that reject it.
        try {
          await storage.updateSpan({
            traceId: 'trace-1',
            spanId: 'observer-1',
            updates: { endedAt: new Date('2026-01-02T12:00:09.000Z') },
          });
        } catch (err) {
          if (!(err instanceof Error && /does not support updating spans/i.test(err.message))) {
            throw err;
          }
        }

        await storage.createSpan({
          span: makeSpan({
            traceId: 'trace-1',
            spanId: 'observer-2',
            parentSpanId: 'root-1',
            spanType: SpanType.AGENT_RUN,
            entityType: EntityType.AGENT,
            entityName: 'Observer',
            startedAt: new Date('2026-01-02T12:00:02.000Z'),
          }),
        });

        const delta = await storage.listBranches({
          mode: 'delta',
          filters: { entityName: 'Observer' },
          after: page.deltaCursor!,
        });

        expect(delta.branches.map(branch => branch.spanId)).toEqual(['observer-2']);
      });

      it('returns append-only metric deltas and sets hasMore via limit + 1', async () => {
        const start = await storage.listMetrics({
          mode: 'delta',
          filters: { name: ['latency_ms'], threadId: 'thread-1' },
          limit: 1,
        });

        expect(start.metrics).toEqual([]);
        expect(start.delta).toEqual({ limit: 1, hasMore: false });

        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-auto-16',
              labels: {},
              timestamp: new Date('2026-01-02T12:00:00.000Z'),
              name: 'latency_ms',
              value: 999,
              threadId: 'thread-2',
            },
            {
              metricId: 'metric-auto-17',
              labels: {},
              timestamp: new Date('2026-01-02T12:00:01.000Z'),
              name: 'latency_ms',
              value: 10,
              threadId: 'thread-1',
            },
            {
              metricId: 'metric-auto-18',
              labels: {},
              timestamp: new Date('2026-01-02T12:00:02.000Z'),
              name: 'latency_ms',
              value: 20,
              threadId: 'thread-1',
            },
          ],
        });

        const first = await storage.listMetrics({
          mode: 'delta',
          filters: { name: ['latency_ms'], threadId: 'thread-1' },
          after: start.deltaCursor!,
          limit: 1,
        });
        expect(first.metrics.map(metric => metric.value)).toEqual([10]);
        expect(first.delta).toEqual({ limit: 1, hasMore: true });

        const second = await storage.listMetrics({
          mode: 'delta',
          filters: { name: ['latency_ms'], threadId: 'thread-1' },
          after: first.deltaCursor!,
          limit: 1,
        });
        expect(second.metrics.map(metric => metric.value)).toEqual([20]);
        expect(second.delta).toEqual({ limit: 1, hasMore: false });
      });

      it('returns append-only log deltas after the cursor', async () => {
        const start = await storage.listLogs({ mode: 'delta', filters: { traceId: 'trace-1' } });

        await storage.batchCreateLogs({
          logs: [
            {
              logId: 'log-auto-1',
              timestamp: new Date('2026-01-02T12:00:00.000Z'),
              level: 'info',
              message: 'skip',
              traceId: 'trace-2',
            },
            {
              logId: 'log-auto-2',
              timestamp: new Date('2026-01-02T12:00:01.000Z'),
              level: 'info',
              message: 'keep',
              traceId: 'trace-1',
            },
          ],
        });

        const delta = await storage.listLogs({
          mode: 'delta',
          filters: { traceId: 'trace-1' },
          after: start.deltaCursor!,
        });

        expect(delta.logs.map(log => log.message)).toEqual(['keep']);
      });

      it('returns append-only score deltas after the cursor', async () => {
        const start = await storage.listScores({ mode: 'delta', filters: { scorerId: 'relevance' } });

        await storage.batchCreateScores({
          scores: [
            {
              scoreId: 'score-auto-8',
              timestamp: new Date('2026-01-02T12:00:00.000Z'),
              traceId: 'trace-1',
              scorerId: 'toxicity',
              score: 0.1,
            },
            {
              scoreId: 'score-auto-9',
              timestamp: new Date('2026-01-02T12:00:01.000Z'),
              traceId: 'trace-2',
              scorerId: 'relevance',
              score: 0.9,
            },
          ],
        });

        const delta = await storage.listScores({
          mode: 'delta',
          filters: { scorerId: 'relevance' },
          after: start.deltaCursor!,
        });

        expect(delta.scores.map(score => score.score)).toEqual([0.9]);
      });

      it('returns append-only feedback deltas after the cursor', async () => {
        const start = await storage.listFeedback({ mode: 'delta', filters: { traceId: 'trace-1' } });

        await storage.batchCreateFeedback({
          feedbacks: [
            {
              feedbackId: 'feedback-auto-5',
              timestamp: new Date('2026-01-02T12:00:00.000Z'),
              traceId: 'trace-2',
              feedbackType: 'rating',
              value: 1,
            },
            {
              feedbackId: 'feedback-auto-6',
              timestamp: new Date('2026-01-02T12:00:01.000Z'),
              traceId: 'trace-1',
              feedbackType: 'rating',
              value: 5,
            },
          ],
        });

        const delta = await storage.listFeedback({
          mode: 'delta',
          filters: { traceId: 'trace-1' },
          after: start.deltaCursor!,
        });

        expect(delta.feedback.map(feedback => feedback.value)).toEqual([5]);
      });
    });

    describe('listBranches', () => {
      function makeSpan(
        overrides: Partial<CreateSpanRecord> & Pick<CreateSpanRecord, 'traceId' | 'spanId'>,
      ): CreateSpanRecord {
        const startedAt = overrides.startedAt ?? new Date('2026-01-02T12:00:00.000Z');
        return {
          parentSpanId: null,
          name: overrides.name ?? 'span',
          spanType: overrides.spanType ?? SpanType.AGENT_RUN,
          isEvent: false,
          startedAt,
          endedAt: overrides.endedAt ?? new Date(startedAt.getTime() + 1000),
          ...overrides,
        } as CreateSpanRecord;
      }

      it('returns branch rows for both root and nested anchor spans, excluding sub-operations', async () => {
        // Root: workflow_run. Children: agent_run (Observer, nested), tool_call,
        // and a model_step (sub-operation, must be excluded).
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 't1',
              spanId: 'root',
              spanType: SpanType.WORKFLOW_RUN,
              entityType: EntityType.WORKFLOW_RUN,
              entityName: 'orderWorkflow',
            }),
            makeSpan({
              traceId: 't1',
              spanId: 'observer',
              parentSpanId: 'root',
              spanType: SpanType.AGENT_RUN,
              entityType: EntityType.AGENT,
              entityName: 'Observer',
              startedAt: new Date('2026-01-02T12:00:01.000Z'),
            }),
            makeSpan({
              traceId: 't1',
              spanId: 'search',
              parentSpanId: 'observer',
              spanType: SpanType.TOOL_CALL,
              entityType: EntityType.TOOL,
              entityName: 'web_search',
              startedAt: new Date('2026-01-02T12:00:02.000Z'),
            }),
            makeSpan({
              traceId: 't1',
              spanId: 'model-step',
              parentSpanId: 'observer',
              spanType: SpanType.MODEL_STEP,
              entityName: 'gpt-4',
              startedAt: new Date('2026-01-02T12:00:02.500Z'),
            }),
          ],
        });

        const result = await storage.listBranches({});
        const names = result.branches.map(s => s.entityName).sort();
        expect(names).toEqual(['Observer', 'orderWorkflow', 'web_search']);
        expect(result.pagination?.total).toBe(3);
      });

      it('finds nested-only entities that listTraces would miss', async () => {
        // Observer only ever runs as a child of orderWorkflow. listTraces({entityName:'Observer'}) returns nothing.
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 't1',
              spanId: 'root',
              spanType: SpanType.WORKFLOW_RUN,
              entityType: EntityType.WORKFLOW_RUN,
              entityName: 'orderWorkflow',
            }),
            makeSpan({
              traceId: 't1',
              spanId: 'observer-1',
              parentSpanId: 'root',
              spanType: SpanType.AGENT_RUN,
              entityType: EntityType.AGENT,
              entityName: 'Observer',
              startedAt: new Date('2026-01-02T12:00:01.000Z'),
            }),
            makeSpan({
              traceId: 't1',
              spanId: 'observer-2',
              parentSpanId: 'root',
              spanType: SpanType.AGENT_RUN,
              entityType: EntityType.AGENT,
              entityName: 'Observer',
              startedAt: new Date('2026-01-02T12:00:03.000Z'),
            }),
          ],
        });

        const traces = await storage.listTraces({ filters: { entityName: 'Observer' } });
        expect(traces.spans).toHaveLength(0);

        const branches = await storage.listBranches({ filters: { entityName: 'Observer' } });
        // Two Observer invocations in the same trace surface as two rows.
        expect(branches.branches).toHaveLength(2);
        expect(branches.branches.every(s => s.entityName === 'Observer')).toBe(true);
      });

      it('orders by startedAt DESC by default and supports pagination', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 't1',
              spanId: 's1',
              entityName: 'A',
              startedAt: new Date('2026-01-02T12:00:01.000Z'),
            }),
            makeSpan({
              traceId: 't2',
              spanId: 's2',
              entityName: 'B',
              startedAt: new Date('2026-01-02T12:00:02.000Z'),
            }),
            makeSpan({
              traceId: 't3',
              spanId: 's3',
              entityName: 'C',
              startedAt: new Date('2026-01-02T12:00:03.000Z'),
            }),
          ],
        });

        const page0 = await storage.listBranches({ pagination: { page: 0, perPage: 2 } });
        expect(page0.branches.map(s => s.entityName)).toEqual(['C', 'B']);
        expect(page0.pagination).toEqual({ total: 3, page: 0, perPage: 2, hasMore: true });

        const page1 = await storage.listBranches({ pagination: { page: 1, perPage: 2 } });
        expect(page1.branches.map(s => s.entityName)).toEqual(['A']);
        expect(page1.pagination?.hasMore).toBe(false);
      });

      it('narrows by spanType when filter provided', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 't1',
              spanId: 'agent',
              spanType: SpanType.AGENT_RUN,
              entityName: 'Agent',
            }),
            makeSpan({
              traceId: 't1',
              spanId: 'tool',
              parentSpanId: 'agent',
              spanType: SpanType.TOOL_CALL,
              entityName: 'web_search',
              startedAt: new Date('2026-01-02T12:00:01.000Z'),
            }),
          ],
        });

        const onlyTools = await storage.listBranches({ filters: { spanType: SpanType.TOOL_CALL } });
        expect(onlyTools.branches).toHaveLength(1);
        expect(onlyTools.branches[0]!.entityName).toBe('web_search');

        // Non-branch span types yield no rows even when explicitly requested.
        const noModelSteps = await storage.listBranches({ filters: { spanType: SpanType.MODEL_STEP } });
        expect(noModelSteps.branches).toHaveLength(0);
      });

      it('filters by per-span context fields like threadId and tags', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 't1',
              spanId: 'a',
              entityName: 'A',
              threadId: 'thread-1',
              tags: ['prod'],
            }),
            makeSpan({
              traceId: 't2',
              spanId: 'b',
              entityName: 'B',
              threadId: 'thread-2',
              tags: ['prod', 'beta'],
              startedAt: new Date('2026-01-02T12:00:01.000Z'),
            }),
            makeSpan({
              traceId: 't3',
              spanId: 'c',
              entityName: 'C',
              threadId: 'thread-1',
              tags: ['dev'],
              startedAt: new Date('2026-01-02T12:00:02.000Z'),
            }),
          ],
        });

        const byThread = await storage.listBranches({ filters: { threadId: 'thread-1' } });
        expect(byThread.branches.map(s => s.entityName).sort()).toEqual(['A', 'C']);

        const byTags = await storage.listBranches({ filters: { tags: ['prod', 'beta'] } });
        expect(byTags.branches.map(s => s.entityName)).toEqual(['B']);
      });
    });

    describe('getBranch', () => {
      beforeEach(async () => {
        // root → A (1) → A1
        //              → A2
        //      → B (1) → B1 → B1a
        await storage.batchCreateSpans({
          records: [
            {
              traceId: 't1',
              spanId: 'root',
              parentSpanId: null,
              name: 'root',
              spanType: SpanType.WORKFLOW_RUN,
              isEvent: false,
              startedAt: new Date('2026-01-02T12:00:00.000Z'),
              endedAt: new Date('2026-01-02T12:00:10.000Z'),
            },
            {
              traceId: 't1',
              spanId: 'A',
              parentSpanId: 'root',
              name: 'A',
              spanType: SpanType.AGENT_RUN,
              isEvent: false,
              startedAt: new Date('2026-01-02T12:00:01.000Z'),
              endedAt: new Date('2026-01-02T12:00:05.000Z'),
            },
            {
              traceId: 't1',
              spanId: 'A1',
              parentSpanId: 'A',
              name: 'A1',
              spanType: SpanType.TOOL_CALL,
              isEvent: false,
              startedAt: new Date('2026-01-02T12:00:02.000Z'),
              endedAt: new Date('2026-01-02T12:00:03.000Z'),
            },
            {
              traceId: 't1',
              spanId: 'A2',
              parentSpanId: 'A',
              name: 'A2',
              spanType: SpanType.TOOL_CALL,
              isEvent: false,
              startedAt: new Date('2026-01-02T12:00:03.500Z'),
              endedAt: new Date('2026-01-02T12:00:04.500Z'),
            },
            {
              traceId: 't1',
              spanId: 'B',
              parentSpanId: 'root',
              name: 'B',
              spanType: SpanType.AGENT_RUN,
              isEvent: false,
              startedAt: new Date('2026-01-02T12:00:06.000Z'),
              endedAt: new Date('2026-01-02T12:00:09.000Z'),
            },
            {
              traceId: 't1',
              spanId: 'B1',
              parentSpanId: 'B',
              name: 'B1',
              spanType: SpanType.TOOL_CALL,
              isEvent: false,
              startedAt: new Date('2026-01-02T12:00:07.000Z'),
              endedAt: new Date('2026-01-02T12:00:08.500Z'),
            },
            {
              traceId: 't1',
              spanId: 'B1a',
              parentSpanId: 'B1',
              name: 'B1a',
              spanType: SpanType.MODEL_STEP,
              isEvent: false,
              startedAt: new Date('2026-01-02T12:00:07.500Z'),
              endedAt: new Date('2026-01-02T12:00:08.000Z'),
            },
          ],
        });
      });

      it('returns the full subtree when depth is omitted', async () => {
        const branch = await storage.getBranch({ traceId: 't1', spanId: 'A' });
        expect(branch).not.toBeNull();
        expect(branch!.spans.map(s => s.spanId)).toEqual(['A', 'A1', 'A2']);
      });

      it('depth=0 returns just the anchor span', async () => {
        const branch = await storage.getBranch({ traceId: 't1', spanId: 'A', depth: 0 });
        expect(branch!.spans.map(s => s.spanId)).toEqual(['A']);
      });

      it('depth=1 returns anchor + immediate children only', async () => {
        const branch = await storage.getBranch({ traceId: 't1', spanId: 'B', depth: 1 });
        expect(branch!.spans.map(s => s.spanId)).toEqual(['B', 'B1']);
      });

      it('depth=2 returns anchor + two levels', async () => {
        const branch = await storage.getBranch({ traceId: 't1', spanId: 'B', depth: 2 });
        expect(branch!.spans.map(s => s.spanId)).toEqual(['B', 'B1', 'B1a']);
      });

      it('returns null for missing trace', async () => {
        const branch = await storage.getBranch({ traceId: 'missing', spanId: 'A' });
        expect(branch).toBeNull();
      });

      it('returns null when the anchor span is not in the trace', async () => {
        const branch = await storage.getBranch({ traceId: 't1', spanId: 'nonexistent' });
        expect(branch).toBeNull();
      });

      it('rooted at the trace root returns every span in the trace', async () => {
        const branch = await storage.getBranch({ traceId: 't1', spanId: 'root' });
        expect(branch!.spans).toHaveLength(7);
      });
    });

    describe('getStructure / getTraceLight', () => {
      beforeEach(async () => {
        await storage.createSpan({
          span: {
            traceId: 't1',
            spanId: 'root',
            parentSpanId: null,
            name: 'root',
            spanType: SpanType.AGENT_RUN,
            isEvent: false,
            entityName: 'agent',
            startedAt: new Date('2026-01-02T12:00:00.000Z'),
            endedAt: new Date('2026-01-02T12:00:01.000Z'),
            // Heavy fields that getStructure must drop:
            input: { prompt: 'hello' },
            output: { answer: 'world' },
            attributes: { model: 'gpt-4' },
            metadata: { foo: 'bar' },
            tags: ['prod'],
          },
        });
      });

      it('getStructure returns lightweight spans without heavy fields', async () => {
        const result = await storage.getStructure({ traceId: 't1' });
        expect(result).not.toBeNull();
        expect(result!.spans).toHaveLength(1);
        const span = result!.spans[0]!;
        expect(span.spanId).toBe('root');
        expect(span.entityName).toBe('agent');
        // Heavy fields are not present on the lightweight schema.
        expect((span as Record<string, unknown>).input).toBeUndefined();
        expect((span as Record<string, unknown>).output).toBeUndefined();
        expect((span as Record<string, unknown>).attributes).toBeUndefined();
      });

      it('getTraceLight forwards to getStructure (deprecated alias)', async () => {
        const fromAlias = await storage.getTraceLight({ traceId: 't1' });
        const fromCanonical = await storage.getStructure({ traceId: 't1' });
        expect(fromAlias).toEqual(fromCanonical);
      });
    });

    describe('listTraces', () => {
      it('batch creates and lists traces', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'trace-3',
              spanId: 'root-span',
              name: 'workflow-run',
              spanType: SpanType.WORKFLOW_RUN,
              entityType: EntityType.WORKFLOW_RUN,
              entityId: 'wf-1',
              entityName: 'myWorkflow',
              environment: 'production',
              serviceName: 'svc',
              tags: ['v1'],
              startedAt: new Date('2026-01-01T00:00:00Z'),
              endedAt: null,
            }),
            makeSpan({
              traceId: 'trace-3',
              spanId: 'child-span',
              parentSpanId: 'root-span',
              name: 'agent-step',
              entityType: EntityType.AGENT,
              entityId: 'agent-1',
              entityName: 'myAgent',
              environment: 'production',
              serviceName: 'svc',
              startedAt: new Date('2026-01-01T00:00:01Z'),
              endedAt: null,
            }),
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

      it('applies scalar prefilter and tag post-filter correctly', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'trace-scalar-a',
              spanId: 'root-a',
              name: 'agent-run',
              entityType: EntityType.AGENT,
              entityId: 'agent-a',
              entityName: 'agentA',
              environment: 'production',
              serviceName: 'svc-a',
              tags: ['keep'],
              startedAt: new Date('2026-01-02T00:00:00Z'),
              endedAt: new Date('2026-01-02T00:00:02Z'),
            }),
            makeSpan({
              traceId: 'trace-scalar-b',
              spanId: 'root-b',
              name: 'agent-run',
              entityType: EntityType.AGENT,
              entityId: 'agent-b',
              entityName: 'agentB',
              environment: 'staging',
              serviceName: 'svc-b',
              tags: ['skip'],
              startedAt: new Date('2026-01-02T00:00:05Z'),
              endedAt: new Date('2026-01-02T00:00:06Z'),
            }),
          ],
        });

        const byEnv = await storage.listTraces({
          filters: { environment: 'production', startedAt: { start: new Date('2026-01-02T00:00:00Z') } },
        });
        const envTraceIds = byEnv.spans.map(s => s.traceId);
        expect(envTraceIds).toContain('trace-scalar-a');
        expect(envTraceIds).not.toContain('trace-scalar-b');

        const byTag = await storage.listTraces({
          filters: { tags: ['keep'], startedAt: { start: new Date('2026-01-02T00:00:00Z') } },
        });
        const tagTraceIds = byTag.spans.map(s => s.traceId);
        expect(tagTraceIds).toContain('trace-scalar-a');
        expect(tagTraceIds).not.toContain('trace-scalar-b');
      });

      it('intersects startedAt and endedAt upper bounds on the prefilter', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'trace-bound-a',
              spanId: 'root-a',
              name: 'within-window',
              entityType: EntityType.AGENT,
              entityId: 'agent-a',
              entityName: 'agentA',
              startedAt: new Date('2026-02-01T12:00:00Z'),
              endedAt: new Date('2026-02-01T12:01:00Z'),
            }),
            makeSpan({
              traceId: 'trace-bound-b',
              spanId: 'root-b',
              name: 'started-after-startedAt-end',
              entityType: EntityType.AGENT,
              entityId: 'agent-b',
              entityName: 'agentB',
              startedAt: new Date('2026-02-01T12:30:00Z'),
              endedAt: new Date('2026-02-01T12:35:00Z'),
            }),
          ],
        });

        const filters = {
          startedAt: { end: new Date('2026-02-01T12:10:00Z') },
          endedAt: { end: new Date('2026-02-01T13:00:00Z') },
        };
        const tightUpperBound = await storage.listTraces({ filters });
        const traceIds = tightUpperBound.spans.map(s => s.traceId);
        expect(traceIds).toContain('trace-bound-a');
        expect(traceIds).not.toContain('trace-bound-b');

        const filtersReversed = {
          endedAt: { end: new Date('2026-02-01T13:00:00Z') },
          startedAt: { end: new Date('2026-02-01T12:10:00Z') },
        };
        const reversed = await storage.listTraces({ filters: filtersReversed });
        const reversedIds = reversed.spans.map(s => s.traceId);
        expect(reversedIds).toContain('trace-bound-a');
        expect(reversedIds).not.toContain('trace-bound-b');
      });

      it('supports page deltaCursor and delta polling for traces', async () => {
        const hadFlag = coreFeatures.has('observability-delta-polling');
        coreFeatures.add('observability-delta-polling');
        try {
          await storage.batchCreateSpans({
            records: [
              makeSpan({
                traceId: 'trace-delta-existing',
                spanId: 'root-existing',
                name: 'existing-root',
                entityType: EntityType.AGENT,
                entityId: 'agent-existing',
                entityName: 'Existing Agent',
                environment: 'production',
                serviceName: 'svc-traces',
                tags: ['keep'],
                startedAt: new Date('2026-02-02T00:00:00Z'),
                endedAt: new Date('2026-02-02T00:00:01Z'),
              }),
            ],
          });

          const page = await storage.listTraces({ filters: { environment: 'production' } });
          expect(page.deltaCursor).toBeTruthy();

          const bootstrap = await storage.listTraces({
            mode: 'delta',
            filters: { environment: 'production' },
          });
          expect(bootstrap.spans).toEqual([]);
          expect(bootstrap.delta).toEqual({ limit: 10, hasMore: false });
          expect(bootstrap.deltaCursor).toBeTruthy();

          await storage.createSpan({
            span: makeSpan({
              traceId: 'trace-delta-existing',
              spanId: 'child-existing',
              parentSpanId: 'root-existing',
              name: 'child',
              spanType: SpanType.TOOL_CALL,
              entityType: EntityType.TOOL,
              entityId: 'tool-existing',
              entityName: 'Tool Existing',
              environment: 'production',
              serviceName: 'svc-traces',
              tags: ['keep'],
              startedAt: new Date('2026-02-02T00:00:02Z'),
              endedAt: new Date('2026-02-02T00:00:03Z'),
            }),
          });

          const afterExistingUpdate = await storage.listTraces({
            mode: 'delta',
            filters: { environment: 'production' },
            after: bootstrap.deltaCursor!,
          });
          expect(afterExistingUpdate.spans).toEqual([]);

          await storage.createSpan({
            span: makeSpan({
              traceId: 'trace-delta-new',
              spanId: 'root-new',
              name: 'new-root',
              entityType: EntityType.AGENT,
              entityId: 'agent-new',
              entityName: 'New Agent',
              environment: 'production',
              serviceName: 'svc-traces',
              tags: ['keep'],
              startedAt: new Date('2026-02-02T00:00:04Z'),
              endedAt: new Date('2026-02-02T00:00:05Z'),
            }),
          });
          await storage.createSpan({
            span: makeSpan({
              traceId: 'trace-delta-ignore',
              spanId: 'root-ignore',
              name: 'ignore-root',
              entityType: EntityType.AGENT,
              entityId: 'agent-ignore',
              entityName: 'Ignore Agent',
              environment: 'staging',
              serviceName: 'svc-traces',
              tags: ['keep'],
              startedAt: new Date('2026-02-02T00:00:06Z'),
              endedAt: new Date('2026-02-02T00:00:07Z'),
            }),
          });

          const delta = await storage.listTraces({
            mode: 'delta',
            filters: { environment: 'production' },
            after: bootstrap.deltaCursor!,
          });
          expect(delta.spans.map(span => span.traceId)).toEqual(['trace-delta-new']);
          expect(delta.deltaCursor).toBeTruthy();

          const afterPageCursor = await storage.listTraces({
            mode: 'delta',
            filters: { environment: 'production' },
            after: page.deltaCursor!,
          });
          expect(afterPageCursor.spans.map(span => span.traceId)).toEqual(['trace-delta-new']);
        } finally {
          if (!hadFlag) coreFeatures.delete('observability-delta-polling');
        }
      });

      it('batch deletes traces', async () => {
        await storage.createSpan({
          span: makeSpan({
            traceId: 'trace-del',
            spanId: 'span-del',
            name: 'delete-me',
            startedAt: new Date('2026-02-03T00:00:00Z'),
            endedAt: null,
          }),
        });

        await storage.batchDeleteTraces({ traceIds: ['trace-del'] });
        const result = await storage.getSpan({ traceId: 'trace-del', spanId: 'span-del' });
        expect(result).toBeNull();
      });
    });

    describe('listBranches (filters + delta) / getSpans', () => {
      it('listBranches applies scalar prefilter and tag post-filter correctly', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'br-scalar-root-a',
              spanId: 'root-a',
              spanType: SpanType.WORKFLOW_RUN,
              entityType: EntityType.WORKFLOW_RUN,
              entityId: 'wf-a',
              entityName: 'wfA',
              environment: 'production',
              startedAt: new Date('2026-04-02T23:59:00Z'),
            }),
            makeSpan({
              traceId: 'br-scalar-root-b',
              spanId: 'root-b',
              spanType: SpanType.WORKFLOW_RUN,
              entityType: EntityType.WORKFLOW_RUN,
              entityId: 'wf-b',
              entityName: 'wfB',
              environment: 'staging',
              startedAt: new Date('2026-04-02T23:59:00Z'),
            }),
            makeSpan({
              traceId: 'br-scalar-root-a',
              spanId: 'agent-a',
              parentSpanId: 'root-a',
              name: 'nested-agent',
              entityType: EntityType.AGENT,
              entityId: 'agent-a',
              entityName: 'agentA',
              environment: 'production',
              serviceName: 'svc-a',
              tags: ['keep'],
              startedAt: new Date('2026-04-03T00:00:00Z'),
              endedAt: new Date('2026-04-03T00:00:02Z'),
            }),
            makeSpan({
              traceId: 'br-scalar-root-b',
              spanId: 'agent-b',
              parentSpanId: 'root-b',
              name: 'nested-agent',
              entityType: EntityType.AGENT,
              entityId: 'agent-b',
              entityName: 'agentB',
              environment: 'staging',
              serviceName: 'svc-b',
              tags: ['skip'],
              startedAt: new Date('2026-04-03T00:00:05Z'),
              endedAt: new Date('2026-04-03T00:00:06Z'),
            }),
          ],
        });

        const byEnv = await storage.listBranches({
          filters: { environment: 'production', startedAt: { start: new Date('2026-04-03T00:00:00Z') } },
        });
        const envSpanIds = byEnv.branches.map(b => b.spanId);
        expect(envSpanIds).toContain('agent-a');
        expect(envSpanIds).not.toContain('agent-b');

        const byTag = await storage.listBranches({
          filters: { tags: ['keep'], startedAt: { start: new Date('2026-04-03T00:00:00Z') } },
        });
        const tagSpanIds = byTag.branches.map(b => b.spanId);
        expect(tagSpanIds).toContain('agent-a');
        expect(tagSpanIds).not.toContain('agent-b');
      });

      it('supports page deltaCursor and delta polling for branches', async () => {
        const hadFlag = coreFeatures.has('observability-delta-polling');
        coreFeatures.add('observability-delta-polling');
        try {
          await storage.batchCreateSpans({
            records: [
              makeSpan({
                traceId: 'branch-delta-trace',
                spanId: 'root',
                name: 'root',
                spanType: SpanType.WORKFLOW_RUN,
                entityType: EntityType.WORKFLOW_RUN,
                entityId: 'wf-branch-delta',
                entityName: 'Workflow Branch Delta',
                environment: 'production',
                startedAt: new Date('2026-04-06T00:00:00Z'),
                endedAt: new Date('2026-04-06T00:00:10Z'),
              }),
              makeSpan({
                traceId: 'branch-delta-trace',
                spanId: 'branch-existing',
                parentSpanId: 'root',
                name: 'existing-branch',
                spanType: SpanType.TOOL_CALL,
                entityType: EntityType.TOOL,
                entityId: 'tool-existing',
                entityName: 'Tool Existing',
                environment: 'production',
                startedAt: new Date('2026-04-06T00:00:01Z'),
                endedAt: new Date('2026-04-06T00:00:02Z'),
              }),
            ],
          });

          const page = await storage.listBranches({ filters: { environment: 'production' } });
          expect(page.deltaCursor).toBeTruthy();

          const bootstrap = await storage.listBranches({
            mode: 'delta',
            filters: { environment: 'production' },
          });
          expect(bootstrap.branches).toEqual([]);
          expect(bootstrap.delta).toEqual({ limit: 10, hasMore: false });
          expect(bootstrap.deltaCursor).toBeTruthy();

          await storage.createSpan({
            span: makeSpan({
              traceId: 'branch-delta-trace',
              spanId: 'leaf-existing',
              parentSpanId: 'branch-existing',
              name: 'leaf-existing',
              spanType: SpanType.MODEL_STEP,
              startedAt: new Date('2026-04-06T00:00:03Z'),
              endedAt: new Date('2026-04-06T00:00:04Z'),
            }),
          });

          const afterExistingUpdate = await storage.listBranches({
            mode: 'delta',
            filters: { environment: 'production' },
            after: bootstrap.deltaCursor!,
          });
          expect(afterExistingUpdate.branches).toEqual([]);

          await storage.createSpan({
            span: makeSpan({
              traceId: 'branch-delta-trace',
              spanId: 'branch-new',
              parentSpanId: 'root',
              name: 'branch-new',
              entityType: EntityType.AGENT,
              entityId: 'agent-new',
              entityName: 'Agent New',
              environment: 'production',
              startedAt: new Date('2026-04-06T00:00:05Z'),
              endedAt: new Date('2026-04-06T00:00:06Z'),
            }),
          });
          await storage.createSpan({
            span: makeSpan({
              traceId: 'branch-delta-ignore',
              spanId: 'branch-ignore',
              name: 'branch-ignore',
              spanType: SpanType.TOOL_CALL,
              entityType: EntityType.TOOL,
              entityId: 'tool-ignore',
              entityName: 'Tool Ignore',
              environment: 'staging',
              startedAt: new Date('2026-04-06T00:00:07Z'),
              endedAt: new Date('2026-04-06T00:00:08Z'),
            }),
          });

          const delta = await storage.listBranches({
            mode: 'delta',
            filters: { environment: 'production' },
            after: bootstrap.deltaCursor!,
          });
          expect(delta.branches.map(branch => branch.spanId)).toEqual(['branch-new']);

          const afterPageCursor = await storage.listBranches({
            mode: 'delta',
            filters: { environment: 'production' },
            after: page.deltaCursor!,
          });
          expect(afterPageCursor.branches.map(branch => branch.spanId)).toEqual(['branch-new']);
        } finally {
          if (!hadFlag) coreFeatures.delete('observability-delta-polling');
        }
      });

      it('getSpans batch-fetches a subset of spans within a trace', async () => {
        await storage.batchCreateSpans({
          records: [
            makeSpan({
              traceId: 'gs-1',
              spanId: 'a',
              name: 'a',
              input: { prompt: 'hi' },
              startedAt: new Date('2026-04-04T00:00:00Z'),
              endedAt: new Date('2026-04-04T00:00:01Z'),
            }),
            makeSpan({
              traceId: 'gs-1',
              spanId: 'b',
              parentSpanId: 'a',
              name: 'b',
              spanType: SpanType.TOOL_CALL,
              startedAt: new Date('2026-04-04T00:00:02Z'),
              endedAt: new Date('2026-04-04T00:00:03Z'),
            }),
            makeSpan({
              traceId: 'gs-1',
              spanId: 'c',
              parentSpanId: 'a',
              name: 'c',
              spanType: SpanType.TOOL_CALL,
              startedAt: new Date('2026-04-04T00:00:04Z'),
              endedAt: new Date('2026-04-04T00:00:05Z'),
            }),
          ],
        });

        const result = await storage.getSpans({ traceId: 'gs-1', spanIds: ['a', 'c'] });
        expect(result.traceId).toBe('gs-1');
        expect(result.spans.map(s => s.spanId).sort()).toEqual(['a', 'c']);
        const a = result.spans.find(s => s.spanId === 'a')!;
        expect(a.input).toEqual({ prompt: 'hi' });

        const empty = await storage.getSpans({ traceId: 'no-such', spanIds: ['x'] });
        expect(empty.spans).toEqual([]);
      });
    });

    describe('logs (create + list)', () => {
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

    describe('logs (resumable cursor)', () => {
      it('returns a resumable page deltaCursor for empty filtered logs', async () => {
        const hadFlag = coreFeatures.has('observability-delta-polling');
        coreFeatures.add('observability-delta-polling');
        try {
          const page = await storage.listLogs({ filters: { environment: 'production' } });
          expect(page.logs).toEqual([]);
          expect(page.deltaCursor).toBeTruthy();

          await storage.batchCreateLogs({
            logs: [
              {
                logId: 'log-delta-empty-page',
                timestamp: new Date('2026-05-01T00:00:03Z'),
                level: 'info',
                message: 'new-log-after-empty-page',
                data: null,
                traceId: 'trace-log',
                spanId: null,
                tags: ['prod'],
                entityType: EntityType.AGENT,
                entityId: 'agent-log',
                entityName: 'Agent Log',
                environment: 'production',
                metadata: null,
              },
            ],
          });

          const delta = await storage.listLogs({
            mode: 'delta',
            filters: { environment: 'production' },
            after: page.deltaCursor!,
          });
          expect(delta.logs.map(log => log.logId)).toEqual(['log-delta-empty-page']);
        } finally {
          if (!hadFlag) coreFeatures.delete('observability-delta-polling');
        }
      });
    });

    describe('metrics (basic OLAP)', () => {
      beforeEach(async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-basic-1',
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
              metricId: 'metric-basic-2',
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
              metricId: 'metric-basic-3',
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
              metricId: 'metric-basic-4',
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
        expect(result.value).toBe(800);
        expect(result.estimatedCost).toBeCloseTo(0.8);
        expect(result.costUnit).toBe('usd');
      });

      it('getMetricAggregate returns count_distinct for the requested dimension', async () => {
        const result = await storage.getMetricAggregate({
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count_distinct',
          distinctColumn: 'entityName',
        });

        expect(result.value).toBe(2);
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

        expect(result.pagination!.total).toBe(2);
        expect(result.pagination!.hasMore).toBe(true);
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.provider).toBe('openai');
        expect(result.metrics[0]!.model).toBe('gpt-4o-mini');
        expect(result.metrics[0]!.estimatedCost).toBeCloseTo(0.1);
        expect(result.metrics[0]!.costUnit).toBe('usd');
        expect(result.metrics[0]!.tags).toEqual(['prod']);
        expect(result.metrics[0]!.labels).toEqual({ status: 'ok' });
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
        expect(weather!.value).toBe(150);
        expect(weather!.estimatedCost).toBeCloseTo(0.3);
        expect(weather!.costUnit).toBe('usd');
        expect(code).toBeDefined();
        expect(code!.value).toBe(500);
        expect(code!.estimatedCost).toBeCloseTo(0.5);
        expect(code!.costUnit).toBe('usd');
      });

      it('getMetricBreakdown honors limit and ascending order direction', async () => {
        const result = await storage.getMetricBreakdown({
          name: ['mastra_agent_duration_ms'],
          groupBy: ['entityName'],
          aggregation: 'sum',
          orderDirection: 'ASC',
          limit: 1,
        });

        expect(result.groups).toHaveLength(1);
        expect(result.groups[0]!.dimensions.entityName).toBe('weatherAgent');
        expect(result.groups[0]!.value).toBe(300);
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
      });
    });

    describe('metrics (extended)', () => {
      it('getMetricBreakdown accepts discovered label keys with non-identifier characters', async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-test-1',
              timestamp: new Date('2026-01-01T00:00:00Z'),
              name: 'mastra_agent_duration_ms',
              value: 100,
              labels: { status: 'ok' },
              entityType: EntityType.AGENT,
              entityName: 'weatherAgent',
            },
            {
              metricId: 'metric-test-2',
              timestamp: new Date('2026-01-01T00:00:05Z'),
              name: 'mastra_agent_duration_ms',
              value: 200,
              labels: { status: 'ok' },
              entityType: EntityType.AGENT,
              entityName: 'weatherAgent',
            },
            {
              metricId: 'metric-test-3',
              timestamp: new Date('2026-01-01T00:00:10Z'),
              name: 'mastra_agent_duration_ms',
              value: 500,
              labels: { status: 'error' },
              entityType: EntityType.AGENT,
              entityName: 'codeAgent',
            },
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

        if (refreshDiscovery) {
          await refreshDiscovery(storage);
        }

        const keys = await storage.getMetricLabelKeys({ metricName: 'mastra_agent_duration_ms' });
        expect(keys.keys).toContain('foo-bar');

        const result = await storage.getMetricBreakdown({
          name: ['mastra_agent_duration_ms'],
          groupBy: ['foo-bar'],
          aggregation: 'count',
        });

        const alpha = result.groups.find(group => group.dimensions['foo-bar'] === 'alpha');
        const beta = result.groups.find(group => group.dimensions['foo-bar'] === 'beta');

        expect(alpha?.value).toBe(1);
        expect(beta?.value).toBe(1);
        // Note: rows missing the 'foo-bar' label key are surfaced differently per
        // adapter — InMemory/DuckDB include them with a null dimension, while
        // ClickHouse vNext excludes them by design. Those adapter-specific
        // expectations live in each adapter's bespoke suite.
      });

      it('getMetricTimeSeries keeps colliding display names as separate grouped series', async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-collide-1',
              timestamp: new Date('2026-01-01T02:00:00Z'),
              name: 'mastra_collision_metric',
              value: 10,
              labels: { segmentA: 'a', segmentB: 'b|c' },
              entityType: EntityType.TOOL,
              entityName: 'search',
            },
            {
              metricId: 'metric-collide-2',
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

      it('filters metrics by canonical cost fields', async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-cost-1',
              timestamp: new Date('2026-01-01T00:00:00Z'),
              name: 'mastra_agent_duration_ms',
              value: 100,
              labels: {},
              provider: 'openai',
              model: 'gpt-4o-mini',
              estimatedCost: 0.1,
              costUnit: 'usd',
            },
            {
              metricId: 'metric-cost-2',
              timestamp: new Date('2026-01-01T00:00:05Z'),
              name: 'mastra_agent_duration_ms',
              value: 200,
              labels: {},
              provider: 'openai',
              model: 'gpt-4o-mini',
              estimatedCost: 0.2,
              costUnit: 'usd',
            },
            {
              metricId: 'metric-cost-3',
              timestamp: new Date('2026-01-01T00:00:10Z'),
              name: 'mastra_agent_duration_ms',
              value: 500,
              labels: {},
              provider: 'anthropic',
              model: 'claude-3-7-sonnet',
              estimatedCost: 0.5,
              costUnit: 'usd',
            },
          ],
        });

        const result = await storage.getMetricAggregate({
          name: ['mastra_agent_duration_ms'],
          aggregation: 'sum',
          filters: {
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        });

        expect(result.value).toBe(300);
        expect(result.estimatedCost).toBeCloseTo(0.3);
      });

      it('getMetricAggregate returns avg', async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-avg-1',
              timestamp: new Date('2026-01-01T00:00:00Z'),
              name: 'mastra_agent_duration_ms',
              value: 100,
              labels: {},
            },
            {
              metricId: 'metric-avg-2',
              timestamp: new Date('2026-01-01T00:00:05Z'),
              name: 'mastra_agent_duration_ms',
              value: 200,
              labels: {},
            },
            {
              metricId: 'metric-avg-3',
              timestamp: new Date('2026-01-01T00:00:10Z'),
              name: 'mastra_agent_duration_ms',
              value: 500,
              labels: {},
            },
          ],
        });

        const result = await storage.getMetricAggregate({
          name: ['mastra_agent_duration_ms'],
          aggregation: 'avg',
        });
        expect(result.value).toBeCloseTo(266.67, 0);
      });

      it('getMetricAggregate returns count', async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-count-1',
              timestamp: new Date('2026-01-01T00:00:00Z'),
              name: 'mastra_agent_duration_ms',
              value: 100,
              labels: {},
            },
            {
              metricId: 'metric-count-2',
              timestamp: new Date('2026-01-01T00:00:05Z'),
              name: 'mastra_agent_duration_ms',
              value: 200,
              labels: {},
            },
            {
              metricId: 'metric-count-3',
              timestamp: new Date('2026-01-01T00:00:10Z'),
              name: 'mastra_agent_duration_ms',
              value: 500,
              labels: {},
            },
          ],
        });

        const result = await storage.getMetricAggregate({
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count',
        });
        expect(result.value).toBe(3);
      });
    });

    describe('default ORDER BY', () => {
      it('listLogs defaults to timestamp DESC', async () => {
        await storage.batchCreateLogs({
          logs: [
            {
              logId: 'log-order-1',
              timestamp: new Date('2026-01-01T00:00:01Z'),
              level: 'info',
              message: 'first',
              data: null,
              metadata: null,
            },
            {
              logId: 'log-order-2',
              timestamp: new Date('2026-01-01T00:00:03Z'),
              level: 'info',
              message: 'third',
              data: null,
              metadata: null,
            },
            {
              logId: 'log-order-3',
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
        expect(result.logs[0]!.message).toBe('third');
        expect(result.logs[1]!.message).toBe('second');
        expect(result.logs[2]!.message).toBe('first');
      });

      it('listMetrics defaults to timestamp DESC', async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-order-1',
              timestamp: new Date('2026-01-01T00:00:01Z'),
              name: 'order_test',
              value: 1,
              labels: {},
            },
            {
              metricId: 'metric-order-2',
              timestamp: new Date('2026-01-01T00:00:03Z'),
              name: 'order_test',
              value: 3,
              labels: {},
            },
            {
              metricId: 'metric-order-3',
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
            scoreId: 'score-order-1',
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
            scoreId: 'score-order-2',
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
            scoreId: 'score-order-3',
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
            feedbackId: 'feedback-order-1',
            timestamp: new Date('2026-01-01T00:00:01Z'),
            traceId: 'fb-ord-1',
            spanId: null,
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: null,
            experimentId: null,
            feedbackUserId: null,
            sourceId: null,
            metadata: null,
          },
        });
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-order-2',
            timestamp: new Date('2026-01-01T00:00:03Z'),
            traceId: 'fb-ord-3',
            spanId: null,
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 3,
            comment: null,
            experimentId: null,
            feedbackUserId: null,
            sourceId: null,
            metadata: null,
          },
        });
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-order-3',
            timestamp: new Date('2026-01-01T00:00:02Z'),
            traceId: 'fb-ord-2',
            spanId: null,
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 2,
            comment: null,
            experimentId: null,
            feedbackUserId: null,
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
            makeSpan({
              traceId: 'tr-ord-1',
              spanId: 'root-1',
              name: 'first',
              startedAt: new Date('2026-01-01T00:00:01Z'),
              endedAt: new Date('2026-01-01T00:00:02Z'),
            }),
            makeSpan({
              traceId: 'tr-ord-3',
              spanId: 'root-3',
              name: 'third',
              startedAt: new Date('2026-01-01T00:00:03Z'),
              endedAt: new Date('2026-01-01T00:00:04Z'),
            }),
            makeSpan({
              traceId: 'tr-ord-2',
              spanId: 'root-2',
              name: 'second',
              startedAt: new Date('2026-01-01T00:00:02Z'),
              endedAt: new Date('2026-01-01T00:00:03Z'),
            }),
          ],
        });

        const result = await storage.listTraces({});
        expect(result.spans).toHaveLength(3);
        expect(result.spans[0]!.traceId).toBe('tr-ord-3');
        expect(result.spans[1]!.traceId).toBe('tr-ord-2');
        expect(result.spans[2]!.traceId).toBe('tr-ord-1');
      });
    });

    describe('discovery', () => {
      beforeEach(async () => {
        await storage.batchCreateMetrics({
          metrics: [
            {
              metricId: 'metric-disc-1',
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
              metricId: 'metric-disc-2',
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
              logId: 'log-disc-1',
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
            makeSpan({
              traceId: 'disc-trace',
              spanId: 'disc-span',
              name: 'test',
              entityType: EntityType.AGENT,
              entityId: 'a-1',
              entityName: 'weatherAgent',
              environment: 'production',
              serviceName: 'my-service',
              tags: ['v1', 'experiment'],
              startedAt: new Date(),
              endedAt: null,
            }),
          ],
        });

        if (refreshDiscovery) {
          await refreshDiscovery(storage);
        }
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

    describe('scores (create + list)', () => {
      it('creates and lists scores', async () => {
        await storage.createScore({
          score: {
            scoreId: 'score-basic-1',
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
            scoreId: 'score-basic-2',
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

      it('gets a score by id', async () => {
        await storage.createScore({
          score: {
            scoreId: 'score-lookup-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'trace-lookup-1',
            spanId: null,
            scorerId: 'relevance',
            score: 0.85,
            reason: 'Good answer',
            experimentId: 'exp-lookup',
            metadata: { entityType: 'agent' },
          },
        });
        await storage.createScore({
          score: {
            scoreId: 'score-lookup-2',
            timestamp: new Date('2026-01-01T00:01:00Z'),
            traceId: 'trace-lookup-2',
            spanId: 'span-lookup-2',
            scorerId: 'factuality',
            score: 0.9,
            reason: null,
            experimentId: null,
            metadata: null,
          },
        });

        const score = await storage.getScoreById('score-lookup-1');
        expect(score).toEqual(
          expect.objectContaining({
            scoreId: 'score-lookup-1',
            traceId: 'trace-lookup-1',
            scorerId: 'relevance',
            score: 0.85,
          }),
        );
        expect(await storage.getScoreById('missing-score')).toBeNull();
      });

      it('supports nullable traceId for scores at the storage boundary', async () => {
        await storage.createScore({
          score: {
            scoreId: 'score-null-trace-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: null,
            spanId: null,
            scorerId: 'quality',
            scoreSource: 'automated',
            score: 0.9,
            reason: null,
            experimentId: null,
            metadata: null,
          } as any,
        });

        const result = await storage.listScores({});
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBeNull();
        expect(result.scores[0]!.scoreSource).toBe('automated');
      });

      it('accepts deprecated `source` alias on score input and writes it to scoreSource', async () => {
        await storage.createScore({
          score: {
            scoreId: 'score-legacy-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'trace-legacy-score',
            spanId: null,
            scorerId: 'legacy',
            source: 'manual',
            score: 1,
            reason: null,
            experimentId: null,
            metadata: null,
          } as any,
        });

        const result = await storage.listScores({ filters: { scorerId: 'legacy' } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBe('trace-legacy-score');
        expect(result.scores[0]!.scoreSource).toBe('manual');
      });
    });

    describe('feedback (create + list)', () => {
      it('creates and lists feedback', async () => {
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-basic-1',
            timestamp: new Date(),
            traceId: 'trace-1',
            spanId: null,
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: 'Great!',
            experimentId: null,
            feedbackUserId: 'user-1',
            sourceId: 'source-1',
            metadata: null,
          },
        });

        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-basic-2',
            timestamp: new Date(),
            traceId: 'trace-2',
            spanId: null,
            feedbackSource: 'reviewer',
            feedbackType: 'rating',
            value: 4,
            comment: null,
            experimentId: 'exp-1',
            feedbackUserId: 'user-2',
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
        expect(filtered.feedback[0]!.sourceId).toBe('source-1');
      });

      it('supports nullable traceId for feedback at the storage boundary', async () => {
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-null-trace-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: null,
            spanId: null,
            feedbackSource: 'manual',
            feedbackType: 'rating',
            value: 5,
            comment: null,
            experimentId: null,
            sourceId: null,
            metadata: null,
          } as any,
        });

        const result = await storage.listFeedback({});
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBeNull();
        expect(result.feedback[0]!.feedbackSource).toBe('manual');
      });

      it('accepts deprecated `source` alias on feedback input and writes it to feedbackSource', async () => {
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-legacy-1',
            timestamp: new Date('2026-01-01T00:00:00Z'),
            traceId: 'trace-legacy-feedback',
            spanId: null,
            source: 'manual',
            feedbackType: 'rating',
            value: 5,
            comment: null,
            experimentId: null,
            sourceId: null,
            metadata: null,
          } as any,
        });

        const result = await storage.listFeedback({ filters: { feedbackSource: 'manual' } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBe('trace-legacy-feedback');
        expect(result.feedback[0]!.feedbackSource).toBe('manual');
      });
    });

    describe('feedback (batch)', () => {
      it('batch creates and lists feedback', async () => {
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
              feedbackUserId: 'user-1',
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
              feedbackUserId: 'user-2',
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
              feedbackUserId: null,
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
            spanId: null,
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 1,
            comment: 'Helpful',
          }),
          expect.objectContaining({
            traceId: 'batch-trace-2',
            spanId: 'span-2',
            feedbackSource: 'reviewer',
            feedbackType: 'rating',
            value: 4,
            comment: null,
            metadata: { category: 'quality' },
          }),
          expect.objectContaining({
            traceId: 'batch-trace-3',
            spanId: null,
            feedbackSource: 'system',
            feedbackType: 'flag',
            value: 'needs-review',
            comment: 'Escalated',
            metadata: { severity: 'high' },
          }),
        ]);
      });
    });

    describe('retry idempotency', () => {
      it('re-inserting the same logId does not throw or duplicate', async () => {
        const log = {
          logId: 'log-retry-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          level: 'info' as const,
          message: 'retry-test',
          data: null,
          traceId: 'trace-retry-log',
          spanId: 'span-1',
          tags: null,
          metadata: null,
        };
        await storage.batchCreateLogs({ logs: [log] });
        await storage.batchCreateLogs({ logs: [log] });
        if (flushPendingMerges) await flushPendingMerges(storage);
        const result = await storage.listLogs({ filters: { traceId: 'trace-retry-log' } });
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]!.logId).toBe('log-retry-1');
      });

      it('re-inserting the same metricId does not throw or duplicate', async () => {
        const metric = {
          metricId: 'metric-retry-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          name: 'mastra_agent_duration_ms',
          value: 100,
          labels: {},
          tags: null,
        };
        await storage.batchCreateMetrics({ metrics: [metric] });
        await storage.batchCreateMetrics({ metrics: [metric] });
        if (flushPendingMerges) await flushPendingMerges(storage);
        const result = await storage.listMetrics({ filters: { name: ['mastra_agent_duration_ms'] } });
        expect(result.metrics).toHaveLength(1);
        expect(result.metrics[0]!.metricId).toBe('metric-retry-1');
      });

      it('re-inserting the same scoreId does not throw or duplicate', async () => {
        const score = {
          scoreId: 'score-retry-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'trace-retry-score',
          spanId: null,
          scorerId: 'scorer-1',
          score: 0.9,
          reason: null,
          experimentId: null,
          metadata: null,
        };
        await storage.createScore({ score });
        await storage.createScore({ score });
        if (flushPendingMerges) await flushPendingMerges(storage);
        const result = await storage.listScores({ filters: { traceId: 'trace-retry-score' } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.scoreId).toBe('score-retry-1');
      });

      it('re-inserting the same feedbackId does not throw or duplicate', async () => {
        const feedback = {
          feedbackId: 'feedback-retry-1',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          traceId: 'trace-retry-feedback',
          spanId: null,
          feedbackType: 'rating',
          feedbackSource: 'user',
          value: 5,
          comment: null,
          experimentId: null,
          feedbackUserId: null,
          sourceId: null,
          metadata: null,
        };
        await storage.createFeedback({ feedback });
        await storage.createFeedback({ feedback });
        if (flushPendingMerges) await flushPendingMerges(storage);
        const result = await storage.listFeedback({ filters: { traceId: 'trace-retry-feedback' } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.feedbackId).toBe('feedback-retry-1');
      });
    });

    // ========================================================================
    // Scores — OLAP expansions
    // ========================================================================

    describe('scores OLAP (expansions)', () => {
      beforeEach(async () => {
        await storage.batchCreateScores({
          scores: [
            {
              scoreId: 'score-olap-1',
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
              scoreId: 'score-olap-2',
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
              scoreId: 'score-olap-3',
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
              scoreId: 'score-olap-4',
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
        expect(result.value).toBeCloseTo(0.7667, 2);
      });

      it('getScoreAggregate returns sum', async () => {
        const result = await storage.getScoreAggregate({
          scorerId: 'quality',
          aggregation: 'sum',
        });
        expect(result.value).toBeCloseTo(2.3);
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
        expect(weather!.value).toBeCloseTo(0.7);
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

      it('supports nullable traceId for scores at the storage boundary', async () => {
        await storage.createScore({
          score: {
            scoreId: 'score-nullable-trace',
            timestamp: new Date(),
            traceId: null,
            spanId: null,
            scorerId: 'quality-null',
            score: 0.9,
            reason: null,
            experimentId: null,
            scoreSource: 'automated',
            metadata: null,
          } as any,
        });

        const result = await storage.listScores({ filters: { scorerId: 'quality-null' } });
        expect(result.scores).toHaveLength(1);
        expect(result.scores[0]!.traceId).toBeNull();
        expect(result.scores[0]!.scoreSource).toBe('automated');
      });
    });

    // ========================================================================
    // Feedback — OLAP expansions
    // ========================================================================

    describe('feedback OLAP (expansions)', () => {
      beforeEach(async () => {
        await storage.batchCreateFeedback({
          feedbacks: [
            {
              feedbackId: 'feedback-olap-1',
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
              feedbackId: 'feedback-olap-2',
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
              feedbackId: 'feedback-olap-3',
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
              feedbackId: 'feedback-olap-4',
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
              feedbackId: 'feedback-olap-5',
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
        expect(result.value).toBe(2);
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
        expect(result.value).toBeCloseTo(0.6667, 2);
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
        expect(weather!.value).toBeCloseTo(0.5);
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

      it('supports nullable traceId for feedback at the storage boundary', async () => {
        await storage.createFeedback({
          feedback: {
            feedbackId: 'feedback-nullable-trace',
            timestamp: new Date(),
            traceId: null,
            spanId: null,
            feedbackSource: 'manual',
            feedbackType: 'nullable-rating',
            value: 5,
            comment: null,
            experimentId: null,
            feedbackUserId: null,
            sourceId: null,
            metadata: null,
          } as any,
        });

        const result = await storage.listFeedback({ filters: { feedbackType: 'nullable-rating' } });
        expect(result.feedback).toHaveLength(1);
        expect(result.feedback[0]!.traceId).toBeNull();
        expect(result.feedback[0]!.feedbackSource).toBe('manual');
      });
    });
  });
}

export { EntityType, SpanType, VNEXT_BASE_DATE, makeSpan };
