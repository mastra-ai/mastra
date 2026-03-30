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
});
