import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { ObservabilityInMemory } from './inmemory';

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
});
