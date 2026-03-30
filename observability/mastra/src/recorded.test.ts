import { Mastra } from '@mastra/core';
import type { ObservabilityExporter } from '@mastra/core/observability';
import { EntityType, SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { Observability } from './default';
import { DefaultExporter } from './exporters/default';

describe('RecordedTrace', () => {
  it('hydrates persisted traces and routes recorded annotations through exporters', async () => {
    const storage = new MockStore();
    const onScoreEvent = vi.fn().mockResolvedValue(undefined);
    const onFeedbackEvent = vi.fn().mockResolvedValue(undefined);

    const mirrorExporter: ObservabilityExporter = {
      name: 'mirror-exporter',
      exportTracingEvent: vi.fn().mockResolvedValue(undefined),
      onScoreEvent,
      onFeedbackEvent,
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    const mastra = new Mastra({
      logger: false,
      storage,
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'test-service',
            exporters: [new DefaultExporter(), mirrorExporter],
          },
        },
      }),
    });

    const observabilityStore = await storage.getStore('observability');
    expect(observabilityStore).toBeTruthy();

    await observabilityStore!.batchCreateSpans({
      records: [
        {
          traceId: 'trace-1',
          spanId: 'root-span',
          parentSpanId: null,
          name: 'workflow-root',
          spanType: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityId: 'workflow-1',
          entityName: 'workflow-root',
          userId: 'trace-user',
          environment: 'production',
          source: 'cloud',
          serviceName: 'test-service',
          experimentId: 'exp-1',
          metadata: { inherited: true },
          tags: ['prod', 'review'],
          isEvent: false,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
        {
          traceId: 'trace-1',
          spanId: 'child-span',
          parentSpanId: 'root-span',
          name: 'tool-call',
          spanType: SpanType.TOOL_CALL,
          entityType: EntityType.TOOL,
          entityId: 'tool-1',
          entityName: 'tool-call',
          userId: 'trace-user',
          environment: 'production',
          source: 'cloud',
          serviceName: 'test-service',
          experimentId: 'exp-1',
          metadata: { inherited: true, tool: 'weather' },
          isEvent: false,
          startedAt: new Date('2026-01-01T00:00:00.250Z'),
          endedAt: new Date('2026-01-01T00:00:00.750Z'),
        },
      ],
    });

    const trace = await mastra.observability.getRecordedTrace({ traceId: 'trace-1' });

    expect(trace).not.toBeNull();
    expect(trace!.traceId).toBe('trace-1');
    expect(trace!.rootSpan.id).toBe('root-span');
    expect(trace!.rootSpan.children).toHaveLength(1);

    const childSpan = trace!.getSpan('child-span');
    expect(childSpan).not.toBeNull();
    expect(childSpan!.parent?.id).toBe('root-span');

    await childSpan!.addScore({
      scorerId: 'manual-review',
      source: 'manual',
      score: 0.75,
      reason: 'Helpful tool use',
      metadata: { reviewer: 'qa' },
    });

    await trace!.addFeedback({
      source: 'user',
      feedbackType: 'thumbs',
      value: 1,
      feedbackUserId: 'user-123',
      comment: 'Great answer',
      metadata: { channel: 'chat' },
    });

    await mastra.observability.getDefaultInstance()?.flush();

    const scores = await observabilityStore!.listScores({
      filters: { traceId: 'trace-1' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    const feedback = await observabilityStore!.listFeedback({
      filters: { traceId: 'trace-1' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });

    expect(scores.scores[0]).toMatchObject({
      traceId: 'trace-1',
      spanId: 'child-span',
      scorerId: 'manual-review',
      scoreSource: 'manual',
      entityName: 'tool-call',
      parentEntityName: 'workflow-root',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
      experimentId: 'exp-1',
    });

    expect(feedback.feedback[0]).toMatchObject({
      traceId: 'trace-1',
      spanId: null,
      feedbackSource: 'user',
      feedbackType: 'thumbs',
      value: 1,
      feedbackUserId: 'user-123',
      entityName: 'workflow-root',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
      experimentId: 'exp-1',
    });

    expect(onScoreEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          traceId: 'trace-1',
          spanId: 'child-span',
          correlationContext: expect.objectContaining({
            parentEntityName: 'workflow-root',
            rootEntityName: 'workflow-root',
            experimentId: 'exp-1',
          }),
        }),
      }),
    );

    expect(onFeedbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: expect.objectContaining({
          traceId: 'trace-1',
          correlationContext: expect.objectContaining({
            entityName: 'workflow-root',
            rootEntityName: 'workflow-root',
            experimentId: 'exp-1',
          }),
        }),
      }),
    );
  });
});
