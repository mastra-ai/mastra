import { Mastra } from '@mastra/core';
import type { ObservabilityExporter } from '@mastra/core/observability';
import { EntityType, SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { Observability } from './default';
import { DefaultExporter } from './exporters/default';
import { hydrateRecordedTrace } from './recorded';

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
      environment: 'production',
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
      environment: 'production',
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
            environment: 'production',
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
            environment: 'production',
          }),
        }),
      }),
    );
  });

  it('adds annotations through top-level observability APIs using persisted trace data', async () => {
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
          traceId: 'trace-2',
          spanId: 'root-span',
          parentSpanId: null,
          name: 'workflow-root',
          spanType: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityId: 'workflow-2',
          entityName: 'workflow-root',
          userId: 'trace-user',
          environment: 'production',
          source: 'cloud',
          serviceName: 'test-service',
          experimentId: 'exp-2',
          metadata: { inherited: true },
          tags: ['prod', 'review'],
          isEvent: false,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
        {
          traceId: 'trace-2',
          spanId: 'child-span',
          parentSpanId: 'root-span',
          name: 'tool-call',
          spanType: SpanType.TOOL_CALL,
          entityType: EntityType.TOOL,
          entityId: 'tool-2',
          entityName: 'tool-call',
          userId: 'trace-user',
          environment: 'production',
          source: 'cloud',
          serviceName: 'test-service',
          experimentId: 'exp-2',
          metadata: { inherited: true, tool: 'search' },
          isEvent: false,
          startedAt: new Date('2026-01-01T00:00:00.250Z'),
          endedAt: new Date('2026-01-01T00:00:00.750Z'),
        },
      ],
    });

    await mastra.observability.addScore({
      traceId: 'trace-2',
      spanId: 'child-span',
      score: {
        scorerId: 'durable-review',
        scoreSource: 'manual',
        score: 0.9,
        reason: 'Strong answer',
        metadata: { reviewer: 'qa' },
      },
    });

    await mastra.observability.addFeedback({
      traceId: 'trace-2',
      feedback: {
        feedbackSource: 'user',
        feedbackType: 'thumbs',
        value: 1,
        feedbackUserId: 'user-456',
        comment: 'Helpful',
        metadata: { channel: 'workflow' },
      },
    });

    await mastra.observability.getDefaultInstance()?.flush();

    const scores = await observabilityStore!.listScores({
      filters: { traceId: 'trace-2' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    const feedback = await observabilityStore!.listFeedback({
      filters: { traceId: 'trace-2' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });

    expect(scores.scores[0]).toMatchObject({
      traceId: 'trace-2',
      spanId: 'child-span',
      scorerId: 'durable-review',
      scoreSource: 'manual',
      entityName: 'tool-call',
      parentEntityName: 'workflow-root',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
      experimentId: 'exp-2',
    });

    expect(feedback.feedback[0]).toMatchObject({
      traceId: 'trace-2',
      spanId: null,
      feedbackSource: 'user',
      feedbackType: 'thumbs',
      value: 1,
      feedbackUserId: 'user-456',
      entityName: 'workflow-root',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
      experimentId: 'exp-2',
    });

    expect(onScoreEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          traceId: 'trace-2',
          spanId: 'child-span',
          scoreSource: 'manual',
        }),
      }),
    );

    expect(onFeedbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: expect.objectContaining({
          traceId: 'trace-2',
          feedbackSource: 'user',
          feedbackUserId: 'user-456',
        }),
      }),
    );
  });

  it('adds top-level annotations directly from provided correlation context', async () => {
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

    const correlationContext = {
      traceId: 'trace-live',
      spanId: 'span-live',
      entityType: EntityType.TOOL,
      entityId: 'tool-1',
      entityName: 'tool-call',
      parentEntityType: EntityType.AGENT,
      parentEntityId: 'agent-1',
      parentEntityName: 'agent-run',
      rootEntityType: EntityType.WORKFLOW_RUN,
      rootEntityId: 'workflow-1',
      rootEntityName: 'workflow-root',
      source: 'cloud',
      serviceName: 'test-service',
      experimentId: 'exp-live',
      tags: ['prod', 'review'],
    } as const;

    await mastra.observability.addScore({
      traceId: 'trace-live',
      spanId: 'span-live',
      correlationContext,
      score: {
        scorerId: 'content-similarity-scorer',
        scoreSource: 'code',
        score: 0.88,
        reason: 'Fast scorer emitted directly from live span context',
        metadata: { reviewer: 'qa' },
      },
    });

    await mastra.observability.addFeedback({
      traceId: 'trace-live',
      spanId: 'span-live',
      correlationContext,
      feedback: {
        feedbackSource: 'user',
        feedbackType: 'thumbs',
        value: 1,
        feedbackUserId: 'user-123',
        comment: 'Helpful',
        metadata: { channel: 'chat' },
      },
    });

    await mastra.observability.getDefaultInstance()?.flush();

    const scores = await observabilityStore!.listScores({
      filters: { traceId: 'trace-live' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    const feedback = await observabilityStore!.listFeedback({
      filters: { traceId: 'trace-live' },
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });

    expect(scores.scores[0]).toMatchObject({
      traceId: 'trace-live',
      spanId: 'span-live',
      scorerId: 'content-similarity-scorer',
      scoreSource: 'code',
      entityName: 'tool-call',
      parentEntityName: 'agent-run',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
      experimentId: 'exp-live',
      metadata: { reviewer: 'qa' },
    });

    expect(feedback.feedback[0]).toMatchObject({
      traceId: 'trace-live',
      spanId: 'span-live',
      feedbackSource: 'user',
      feedbackType: 'thumbs',
      value: 1,
      feedbackUserId: 'user-123',
      entityName: 'tool-call',
      parentEntityName: 'agent-run',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
      experimentId: 'exp-live',
      metadata: { channel: 'chat' },
    });

    expect(onScoreEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({
          traceId: 'trace-live',
          spanId: 'span-live',
          correlationContext: expect.objectContaining({
            entityName: 'tool-call',
            parentEntityName: 'agent-run',
            rootEntityName: 'workflow-root',
          }),
        }),
      }),
    );

    expect(onFeedbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: expect.objectContaining({
          traceId: 'trace-live',
          spanId: 'span-live',
          correlationContext: expect.objectContaining({
            entityName: 'tool-call',
            parentEntityName: 'agent-run',
            rootEntityName: 'workflow-root',
          }),
        }),
      }),
    );
  });

  it('allows top-level annotations without traceId when correlation context is provided', async () => {
    const storage = new MockStore();

    const mastra = new Mastra({
      logger: false,
      storage,
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'test-service',
            exporters: [new DefaultExporter()],
          },
        },
      }),
    });

    const observabilityStore = await storage.getStore('observability');
    expect(observabilityStore).toBeTruthy();

    const correlationContext = {
      entityType: EntityType.TOOL,
      entityName: 'tool-call',
      rootEntityType: EntityType.WORKFLOW_RUN,
      rootEntityName: 'workflow-root',
      source: 'cloud',
      serviceName: 'test-service',
    } as const;

    await mastra.observability.addScore({
      correlationContext,
      score: {
        scorerId: 'unanchored-scorer',
        score: 0.5,
      },
    });

    await mastra.observability.addFeedback({
      correlationContext,
      feedback: {
        feedbackSource: 'user',
        feedbackType: 'thumbs',
        value: 1,
      },
    });

    await mastra.observability.getDefaultInstance()?.flush();

    const scores = await observabilityStore!.listScores({
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });
    const feedback = await observabilityStore!.listFeedback({
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'ASC' },
    });

    expect(scores.scores[0]).toMatchObject({
      traceId: null,
      scorerId: 'unanchored-scorer',
      entityName: 'tool-call',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
    });

    expect(feedback.feedback[0]).toMatchObject({
      traceId: null,
      feedbackSource: 'user',
      feedbackType: 'thumbs',
      entityName: 'tool-call',
      rootEntityName: 'workflow-root',
      executionSource: 'cloud',
    });
  });

  it('debug-logs and skips annotation when the recorded emit path is no longer wired', async () => {
    const emitRecordedEvent = vi.fn().mockResolvedValue(undefined);
    const debugRecordedAnnotationUnavailable = vi.fn();

    const trace = hydrateRecordedTrace({
      trace: {
        traceId: 'trace-dead',
        spans: [
          {
            traceId: 'trace-dead',
            spanId: 'root-span',
            parentSpanId: null,
            name: 'workflow-root',
            spanType: SpanType.WORKFLOW_RUN,
            entityType: EntityType.WORKFLOW_RUN,
            entityId: 'workflow-dead',
            entityName: 'workflow-root',
            isEvent: false,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            endedAt: new Date('2026-01-01T00:00:01Z'),
          },
        ],
      },
      emitRecordedEvent,
      canEmitRecordedEvent: () => false,
      debugRecordedAnnotationUnavailable,
    });

    expect(trace).not.toBeNull();

    await trace!.addScore({
      scorerId: 'manual-review',
      score: 0.5,
    });

    expect(emitRecordedEvent).not.toHaveBeenCalled();
    expect(debugRecordedAnnotationUnavailable).toHaveBeenCalledWith({
      kind: 'score',
      traceId: 'trace-dead',
    });
  });

  it('debug-logs when a top-level recorded annotation is dropped because no observability instance is registered', async () => {
    const storage = new MockStore();
    const debug = vi.fn();

    const mastra = new Mastra({
      logger: false,
      storage,
      observability: new Observability({}),
    });

    mastra.observability.setLogger({ logger: { debug } as any });

    const observabilityStore = await storage.getStore('observability');
    expect(observabilityStore).toBeTruthy();

    await observabilityStore!.batchCreateSpans({
      records: [
        {
          traceId: 'trace-no-instance',
          spanId: 'root-span',
          parentSpanId: null,
          name: 'workflow-root',
          spanType: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityId: 'workflow-no-instance',
          entityName: 'workflow-root',
          isEvent: false,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
        },
      ],
    });

    await mastra.observability.addScore({
      traceId: 'trace-no-instance',
      score: {
        scorerId: 'manual-review',
        score: 0.5,
      },
    });

    expect(debug).toHaveBeenCalledWith('Score event was dropped because no observability instance is registered', {
      eventType: 'score',
    });
  });
});
