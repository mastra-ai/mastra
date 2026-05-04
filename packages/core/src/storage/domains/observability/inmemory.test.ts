import { beforeEach, describe, expect, it } from 'vitest';
import { EntityType, SpanType } from '../../../observability';
import { InMemoryDB } from '../inmemory-db';
import { ObservabilityInMemory } from './inmemory';
import { extractBranchSpans } from './tracing';
import type { CreateSpanRecord } from './tracing';

describe('ObservabilityInMemory', () => {
  let db: InMemoryDB;
  let storage: ObservabilityInMemory;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new ObservabilityInMemory({ db });
  });

  it('listLogs applies shared observability context filters', async () => {
    const now = new Date('2026-01-02T00:00:00.000Z');

    await storage.batchCreateLogs({
      logs: [
        {
          timestamp: now,
          level: 'info',
          message: 'kept',
          traceId: 'trace-1',
          spanId: 'span-1',
          entityType: 'agent',
          entityName: 'my-agent',
          parentEntityType: 'workflow_run',
          parentEntityName: 'my-workflow',
          rootEntityType: 'workflow_run',
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
          timestamp: now,
          level: 'info',
          message: 'filtered-out',
          traceId: 'trace-2',
          spanId: 'span-2',
          entityType: 'agent',
          entityName: 'other-agent',
          parentEntityType: 'workflow_run',
          parentEntityName: 'other-workflow',
          rootEntityType: 'workflow_run',
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
        entityType: 'agent',
        entityName: 'my-agent',
        parentEntityType: 'workflow_run',
        parentEntityName: 'my-workflow',
        rootEntityType: 'workflow_run',
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
          timestamp: new Date('2026-01-02T12:00:00.000Z'),
          name: 'mastra_model_total_input_tokens',
          value: 100,
          traceId: 'trace-1',
          spanId: 'span-1',
          entityType: 'agent',
          entityName: 'my-agent',
          parentEntityType: 'workflow_run',
          parentEntityName: 'my-workflow',
          rootEntityType: 'workflow_run',
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
          timestamp: new Date('2026-01-02T13:00:00.000Z'),
          name: 'mastra_model_total_input_tokens',
          value: 50,
          traceId: 'trace-1',
          spanId: 'span-2',
          entityType: 'agent',
          entityName: 'my-agent',
          parentEntityType: 'workflow_run',
          parentEntityName: 'my-workflow',
          rootEntityType: 'workflow_run',
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
          timestamp: new Date('2026-01-01T12:00:00.000Z'),
          name: 'mastra_model_total_input_tokens',
          value: 80,
          traceId: 'trace-1',
          spanId: 'span-0',
          entityType: 'agent',
          entityName: 'my-agent',
          parentEntityType: 'workflow_run',
          parentEntityName: 'my-workflow',
          rootEntityType: 'workflow_run',
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
        entityType: 'agent',
        entityName: 'my-agent',
        parentEntityType: 'workflow_run',
        parentEntityName: 'my-workflow',
        rootEntityType: 'workflow_run',
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
          timestamp: new Date('2026-01-02T12:10:00.000Z'),
          name: 'mastra_model_total_input_tokens',
          value: 10,
          serviceName: 'api',
          tags: ['prod'],
          estimatedCost: 0.01,
          costUnit: 'usd',
        },
        {
          timestamp: new Date('2026-01-02T12:20:00.000Z'),
          name: 'mastra_model_total_input_tokens',
          value: 15,
          serviceName: 'api',
          tags: ['prod'],
          estimatedCost: 0.015,
          costUnit: 'usd',
        },
        {
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
    await storage.batchCreateMetrics({
      metrics: [
        {
          timestamp: new Date('2026-01-02T12:10:00.000Z'),
          name: 'mastra_tool_duration_ms',
          value: 10,
          threadId: 'thread-1',
          tags: ['prod'],
        },
        {
          timestamp: new Date('2026-01-02T12:20:00.000Z'),
          name: 'mastra_tool_duration_ms',
          value: 20,
          threadId: 'thread-1',
          tags: ['prod'],
        },
        {
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
            value: 20,
          },
        ],
      },
    ]);
  });

  it('score OLAP queries key by scorerId', async () => {
    await storage.batchCreateScores({
      scores: [
        {
          timestamp: new Date('2026-01-02T12:00:00.000Z'),
          traceId: 'trace-1',
          scorerId: 'relevance',
          scoreSource: 'manual',
          score: 0.8,
          experimentId: 'exp-1',
          entityName: 'agent-a',
        },
        {
          timestamp: new Date('2026-01-02T12:30:00.000Z'),
          traceId: 'trace-2',
          scorerId: 'relevance',
          scoreSource: 'manual',
          score: 0.6,
          experimentId: 'exp-2',
          entityName: 'agent-b',
        },
        {
          timestamp: new Date('2026-01-02T12:45:00.000Z'),
          traceId: 'trace-3',
          scorerId: 'toxicity',
          scoreSource: 'manual',
          score: 0.1,
          experimentId: 'exp-1',
          entityName: 'agent-a',
        },
        {
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
          timestamp: new Date('2026-01-02T12:30:00.000Z'),
          traceId: 'trace-last-1',
          scorerId: 'relevance',
          score: 0.3,
        },
        {
          timestamp: new Date('2026-01-02T12:45:00.000Z'),
          traceId: 'trace-last-2',
          scorerId: 'relevance',
          score: 0.9,
        },
        {
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
          timestamp: new Date('2026-01-02T12:00:00.000Z'),
          traceId: 'trace-1',
          feedbackType: 'rating',
          feedbackSource: 'user',
          value: 5,
          entityName: 'agent-a',
        },
        {
          timestamp: new Date('2026-01-02T12:15:00.000Z'),
          traceId: 'trace-2',
          feedbackType: 'rating',
          feedbackSource: 'user',
          value: '4',
          entityName: 'agent-b',
        },
        {
          timestamp: new Date('2026-01-02T12:30:00.000Z'),
          traceId: 'trace-3',
          feedbackType: 'rating',
          feedbackSource: 'system',
          value: 1,
          entityName: 'agent-a',
        },
        {
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

  describe('listBranches', () => {
    function makeSpan(
      overrides: Partial<CreateSpanRecord> & Pick<CreateSpanRecord, 'traceId' | 'spanId'>,
    ): CreateSpanRecord {
      const startedAt = overrides.startedAt ?? new Date('2026-01-02T12:00:00.000Z');
      return {
        traceId: overrides.traceId,
        spanId: overrides.spanId,
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
      expect(result.pagination.total).toBe(3);
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
      expect(page1.pagination.hasMore).toBe(false);
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

  describe('extractBranchSpans (helper)', () => {
    type Span = { spanId: string; parentSpanId: string | null; startedAt: Date };

    it('keeps the anchor at index 0 even when a descendant has earlier startedAt', async () => {
      // Anchor 'A' starts AFTER its child 'B' -- can happen with isEvent
      // spans, clock skew, or out-of-order ingestion.
      const spans: Span[] = [
        { spanId: 'A', parentSpanId: 'root', startedAt: new Date('2026-01-02T12:00:05.000Z') },
        { spanId: 'B', parentSpanId: 'A', startedAt: new Date('2026-01-02T12:00:01.000Z') },
        { spanId: 'C', parentSpanId: 'A', startedAt: new Date('2026-01-02T12:00:09.000Z') },
      ];
      const branch = extractBranchSpans(spans, 'A');
      expect(branch.map(s => s.spanId)).toEqual(['A', 'B', 'C']);
    });

    it('does not loop forever on a parentSpanId cycle', async () => {
      // Cycle: A → B → C → B (corrupted data)
      const spans: Span[] = [
        { spanId: 'A', parentSpanId: null, startedAt: new Date('2026-01-02T12:00:00.000Z') },
        { spanId: 'B', parentSpanId: 'A', startedAt: new Date('2026-01-02T12:00:01.000Z') },
        { spanId: 'C', parentSpanId: 'B', startedAt: new Date('2026-01-02T12:00:02.000Z') },
        // Reintroduces B as a child of C
        { spanId: 'B-dup', parentSpanId: 'C', startedAt: new Date('2026-01-02T12:00:03.000Z') },
      ];
      // Even more pathological: C lists itself as its own parent.
      spans.push({ spanId: 'C', parentSpanId: 'C', startedAt: new Date('2026-01-02T12:00:04.000Z') });

      const branch = extractBranchSpans(spans, 'A');
      // Anchor first; each spanId visited at most once.
      const visited = new Set(branch.map(s => s.spanId));
      expect(visited.size).toBe(branch.length);
      expect(branch[0]!.spanId).toBe('A');
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
});
