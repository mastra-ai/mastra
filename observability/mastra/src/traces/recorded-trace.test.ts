/**
 * Unit tests for RecordedSpanImpl, RecordedTraceImpl, and buildRecordedTrace
 */

import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan, ScoreEvent, FeedbackEvent } from '@mastra/core/observability';
import { describe, it, expect, afterEach } from 'vitest';
import { ObservabilityBus } from '../bus';
import { RecordedSpanImpl } from './recorded-span';
import { buildRecordedTrace } from './recorded-trace';

function createMockExportedSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'test-span',
    type: SpanType.AGENT_RUN,
    isRootSpan: true,
    isEvent: false,
    startTime: new Date('2026-01-01T00:00:00Z'),
    endTime: new Date('2026-01-01T00:00:01Z'),
    metadata: { environment: 'test' },
    ...overrides,
  } as AnyExportedSpan;
}

describe('RecordedSpanImpl', () => {
  let bus: ObservabilityBus;
  const emittedEvents: (ScoreEvent | FeedbackEvent)[] = [];

  function setup() {
    bus = new ObservabilityBus();
    bus.emit = (event: any) => {
      if (event.type === 'score' || event.type === 'feedback') {
        emittedEvents.push(event);
      }
    };
  }

  afterEach(async () => {
    emittedEvents.length = 0;
    await bus?.shutdown();
  });

  it('should expose all span data properties', () => {
    setup();
    const exported = createMockExportedSpan({
      id: 'span-abc',
      traceId: 'trace-xyz',
      name: 'agent run',
      type: SpanType.AGENT_RUN,
      entityName: 'my-agent',
      entityId: 'agent-1',
      isEvent: false,
      isRootSpan: true,
      tags: ['prod'],
    });

    const span = new RecordedSpanImpl(exported, bus);
    expect(span.id).toBe('span-abc');
    expect(span.traceId).toBe('trace-xyz');
    expect(span.name).toBe('agent run');
    expect(span.type).toBe(SpanType.AGENT_RUN);
    expect(span.entityName).toBe('my-agent');
    expect(span.isRootSpan).toBe(true);
    expect(span.tags).toEqual(['prod']);
  });

  it('should emit ScoreEvent via bus on addScore', () => {
    setup();
    const span = new RecordedSpanImpl(
      createMockExportedSpan({ id: 'span-1', traceId: 'trace-1', metadata: { env: 'test' } }),
      bus,
    );

    span.addScore({
      scorerName: 'relevance',
      score: 0.95,
      reason: 'Very relevant',
      experimentId: 'exp-1',
      metadata: { custom: 'data' },
    });

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0]! as ScoreEvent;
    expect(event.type).toBe('score');
    expect(event.score.traceId).toBe('trace-1');
    expect(event.score.spanId).toBe('span-1');
    expect(event.score.scorerName).toBe('relevance');
    expect(event.score.score).toBe(0.95);
    expect(event.score.reason).toBe('Very relevant');
    expect(event.score.experimentId).toBe('exp-1');
    // Metadata merged: span metadata + score metadata
    expect(event.score.metadata).toEqual({ env: 'test', custom: 'data' });
  });

  it('should emit FeedbackEvent via bus on addFeedback', () => {
    setup();
    const span = new RecordedSpanImpl(
      createMockExportedSpan({ id: 'span-2', traceId: 'trace-2', metadata: { env: 'prod' } }),
      bus,
    );

    span.addFeedback({
      source: 'user',
      feedbackType: 'thumbs',
      value: 1,
      comment: 'Great response!',
      userId: 'user-123',
    });

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0]! as FeedbackEvent;
    expect(event.type).toBe('feedback');
    expect(event.feedback.traceId).toBe('trace-2');
    expect(event.feedback.spanId).toBe('span-2');
    expect(event.feedback.source).toBe('user');
    expect(event.feedback.feedbackType).toBe('thumbs');
    expect(event.feedback.value).toBe(1);
    expect(event.feedback.comment).toBe('Great response!');
    expect(event.feedback.metadata).toEqual({ env: 'prod', userId: 'user-123' });
  });
});

describe('buildRecordedTrace', () => {
  let bus: ObservabilityBus;
  const emittedEvents: (ScoreEvent | FeedbackEvent)[] = [];

  function setup() {
    bus = new ObservabilityBus();
    bus.emit = (event: any) => {
      if (event.type === 'score' || event.type === 'feedback') {
        emittedEvents.push(event);
      }
    };
  }

  afterEach(async () => {
    emittedEvents.length = 0;
    await bus?.shutdown();
  });

  it('should build a tree from flat exported spans', () => {
    setup();
    const spans: AnyExportedSpan[] = [
      createMockExportedSpan({
        id: 'root',
        traceId: 'trace-1',
        name: 'root span',
        isRootSpan: true,
        parentSpanId: undefined,
      }),
      createMockExportedSpan({
        id: 'child-1',
        traceId: 'trace-1',
        name: 'child 1',
        isRootSpan: false,
        parentSpanId: 'root',
      }),
      createMockExportedSpan({
        id: 'child-2',
        traceId: 'trace-1',
        name: 'child 2',
        isRootSpan: false,
        parentSpanId: 'root',
      }),
      createMockExportedSpan({
        id: 'grandchild',
        traceId: 'trace-1',
        name: 'grandchild',
        isRootSpan: false,
        parentSpanId: 'child-1',
      }),
    ];

    const trace = buildRecordedTrace('trace-1', spans, bus);

    expect(trace.traceId).toBe('trace-1');
    expect(trace.rootSpan.id).toBe('root');
    expect(trace.rootSpan.children).toHaveLength(2);
    expect(trace.spans).toHaveLength(4);

    // Tree structure
    const child1 = trace.rootSpan.children[0]!;
    expect(child1.id).toBe('child-1');
    expect(child1.parent?.id).toBe('root');
    expect(child1.children).toHaveLength(1);
    expect(child1.children[0]!.id).toBe('grandchild');

    const child2 = trace.rootSpan.children[1]!;
    expect(child2.id).toBe('child-2');
    expect(child2.parent?.id).toBe('root');
    expect(child2.children).toHaveLength(0);
  });

  it('should provide O(1) span lookup via getSpan', () => {
    setup();
    const spans: AnyExportedSpan[] = [
      createMockExportedSpan({ id: 'root', isRootSpan: true }),
      createMockExportedSpan({ id: 'child', isRootSpan: false, parentSpanId: 'root' }),
    ];

    const trace = buildRecordedTrace('trace-1', spans, bus);

    expect(trace.getSpan('root')?.id).toBe('root');
    expect(trace.getSpan('child')?.id).toBe('child');
    expect(trace.getSpan('nonexistent')).toBeNull();
  });

  it('should share objects between tree and flat access', () => {
    setup();
    const spans: AnyExportedSpan[] = [
      createMockExportedSpan({ id: 'root', isRootSpan: true }),
      createMockExportedSpan({ id: 'child', isRootSpan: false, parentSpanId: 'root' }),
    ];

    const trace = buildRecordedTrace('trace-1', spans, bus);

    // rootSpan and spans[0] should be the same object
    const rootFromTree = trace.rootSpan;
    const rootFromFlat = trace.spans.find(s => s.id === 'root');
    const rootFromGet = trace.getSpan('root');
    expect(rootFromTree).toBe(rootFromFlat);
    expect(rootFromTree).toBe(rootFromGet);
  });

  it('should emit trace-level score (no spanId)', () => {
    setup();
    const spans: AnyExportedSpan[] = [
      createMockExportedSpan({ id: 'root', isRootSpan: true, metadata: { service: 'api' } }),
    ];

    const trace = buildRecordedTrace('trace-1', spans, bus);
    trace.addScore({ scorerName: 'quality', score: 0.8 });

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0]! as ScoreEvent;
    expect(event.score.traceId).toBe('trace-1');
    expect(event.score.spanId).toBeUndefined();
    expect(event.score.scorerName).toBe('quality');
    expect(event.score.metadata).toEqual({ service: 'api' });
  });

  it('should emit trace-level feedback (no spanId)', () => {
    setup();
    const spans: AnyExportedSpan[] = [
      createMockExportedSpan({ id: 'root', isRootSpan: true, metadata: { service: 'api' } }),
    ];

    const trace = buildRecordedTrace('trace-1', spans, bus);
    trace.addFeedback({
      source: 'human',
      feedbackType: 'rating',
      value: 5,
      userId: 'reviewer-1',
    });

    expect(emittedEvents).toHaveLength(1);
    const event = emittedEvents[0]! as FeedbackEvent;
    expect(event.feedback.traceId).toBe('trace-1');
    expect(event.feedback.spanId).toBeUndefined();
    expect(event.feedback.source).toBe('human');
    expect(event.feedback.metadata).toEqual({ service: 'api', userId: 'reviewer-1' });
  });

  it('should throw when no root span found', () => {
    setup();
    const spans: AnyExportedSpan[] = [
      createMockExportedSpan({ id: 'orphan', isRootSpan: false, parentSpanId: 'missing' }),
    ];

    expect(() => buildRecordedTrace('trace-1', spans, bus)).toThrow('No root span found for trace trace-1');
  });
});
