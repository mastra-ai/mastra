import { describe, it, expect, vi } from 'vitest';
import { seedFromTraces, seedFromTrace } from '../seed-dataset';
import type { ObservabilityStoreLike } from '../seed-dataset';
import type { TraceSpan, TraceFeedback } from '../trace-to-item';

function makeRootSpan(traceId: string, userMessage = 'fix the bug'): TraceSpan {
  return {
    traceId,
    spanId: `span-${traceId}`,
    parentSpanId: null,
    name: 'agent_run',
    spanType: 'agent_run',
    startedAt: new Date('2025-04-20T10:00:00Z'),
    endedAt: new Date('2025-04-20T10:05:00Z'),
    input: { messages: [{ role: 'user', content: userMessage }] },
    output: null,
    error: null,
    attributes: {},
    metadata: {},
    requestContext: {
      mode: 'build',
      modelId: 'test-model',
      projectPath: '/test',
      projectName: 'test',
    },
    threadId: 'thread-1',
    resourceId: 'resource-1',
  };
}

function makeStore(traces: Map<string, TraceSpan[]>, feedback: TraceFeedback[] = []): ObservabilityStoreLike {
  return {
    listTraces: vi.fn().mockResolvedValue({ spans: [...traces.values()].map(spans => spans[0]!) }),
    getTrace: vi.fn().mockImplementation(async ({ traceId }: { traceId: string }) => {
      const spans = traces.get(traceId);
      return spans ? { traceId, spans } : null;
    }),
    listFeedback: vi.fn().mockResolvedValue({ feedback }),
  };
}

describe('seedFromTraces', () => {
  it('converts traces to experiment items', async () => {
    const traces = new Map([
      ['t1', [makeRootSpan('t1', 'fix auth')]],
      ['t2', [makeRootSpan('t2', 'add logging')]],
    ]);
    const store = makeStore(traces);
    const result = await seedFromTraces(store);

    expect(result.itemsCreated).toBe(2);
    expect(result.itemsSkipped).toBe(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.input.userMessage).toBe('fix auth');
    expect(result.items[1]!.input.userMessage).toBe('add logging');
  });

  it('skips traces that fail to convert', async () => {
    const traces = new Map([
      ['t1', [makeRootSpan('t1')]],
      ['t2', [{ ...makeRootSpan('t2'), input: null }]], // will fail — no user message
    ]);
    const store = makeStore(traces);
    const result = await seedFromTraces(store);

    expect(result.itemsCreated).toBe(1);
    expect(result.itemsSkipped).toBe(1);
    expect(result.skipped[0]!.traceId).toBe('t2');
    expect(result.skipped[0]!.reason).toContain('extract user message');
  });

  it('skips traces not found by getTrace', async () => {
    const rootSpan = makeRootSpan('t1');
    const store: ObservabilityStoreLike = {
      listTraces: vi.fn().mockResolvedValue({ spans: [rootSpan] }),
      getTrace: vi.fn().mockResolvedValue(null),
      listFeedback: vi.fn().mockResolvedValue({ feedback: [] }),
    };
    const result = await seedFromTraces(store);

    expect(result.itemsCreated).toBe(0);
    expect(result.itemsSkipped).toBe(1);
    expect(result.skipped[0]!.reason).toBe('trace not found');
  });

  it('filters by feedback when withFeedbackOnly is true', async () => {
    const traces = new Map([
      ['t1', [makeRootSpan('t1')]],
      ['t2', [makeRootSpan('t2')]],
    ]);
    const feedback: TraceFeedback[] = [
      { traceId: 't1', feedbackType: 'thumbs', value: 'up' },
    ];
    const store = makeStore(traces, feedback);
    const result = await seedFromTraces(store, { withFeedbackOnly: true });

    // Only t1 has feedback
    expect(result.itemsCreated).toBe(1);
    expect(result.items[0]!.input.userMessage).toBe('fix the bug');
  });

  it('filters by negative feedback when negativeFeedbackOnly is true', async () => {
    const traces = new Map([
      ['t1', [makeRootSpan('t1', 'good session')]],
      ['t2', [makeRootSpan('t2', 'bad session')]],
    ]);
    const feedback: TraceFeedback[] = [
      { traceId: 't1', feedbackType: 'thumbs', value: 'up' },
      { traceId: 't2', feedbackType: 'thumbs', value: 'down' },
    ];
    const store = makeStore(traces, feedback);
    const result = await seedFromTraces(store, { negativeFeedbackOnly: true });

    expect(result.itemsCreated).toBe(1);
    expect(result.items[0]!.input.userMessage).toBe('bad session');
  });

  it('passes options through to traceToItem', async () => {
    const traces = new Map([['t1', [makeRootSpan('t1')]]]);
    const store = makeStore(traces);
    const result = await seedFromTraces(store, {
      category: 'bugfix',
      difficulty: 'hard',
      tags: ['regression'],
    });

    expect(result.items[0]!.metadata.category).toBe('bugfix');
    expect(result.items[0]!.metadata.difficulty).toBe('hard');
    expect(result.items[0]!.metadata.tags).toEqual(['regression']);
  });

  it('respects limit option', async () => {
    const traces = new Map([
      ['t1', [makeRootSpan('t1')]],
      ['t2', [makeRootSpan('t2')]],
    ]);
    const store = makeStore(traces);
    await seedFromTraces(store, { limit: 10 });

    expect(store.listTraces).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: { page: 0, perPage: 10 },
      }),
    );
  });
});

describe('seedFromTrace', () => {
  it('converts a single trace', async () => {
    const spans = [makeRootSpan('t1')];
    const store: ObservabilityStoreLike = {
      listTraces: vi.fn(),
      getTrace: vi.fn().mockResolvedValue({ traceId: 't1', spans }),
      listFeedback: vi.fn().mockResolvedValue({ feedback: [] }),
    };
    const item = await seedFromTrace(store, 't1');

    expect(item).not.toBeNull();
    expect(item!.input.userMessage).toBe('fix the bug');
  });

  it('returns null when trace not found', async () => {
    const store: ObservabilityStoreLike = {
      listTraces: vi.fn(),
      getTrace: vi.fn().mockResolvedValue(null),
      listFeedback: vi.fn().mockResolvedValue({ feedback: [] }),
    };
    const item = await seedFromTrace(store, 'nonexistent');
    expect(item).toBeNull();
  });

  it('includes feedback from the specific trace', async () => {
    const spans = [makeRootSpan('t1')];
    const store: ObservabilityStoreLike = {
      listTraces: vi.fn(),
      getTrace: vi.fn().mockResolvedValue({ traceId: 't1', spans }),
      listFeedback: vi.fn().mockResolvedValue({
        feedback: [{ traceId: 't1', feedbackType: 'thumbs', value: 'down' }],
      }),
    };
    const item = await seedFromTrace(store, 't1');
    expect(item!.metadata.sourceFeedback).toBe('negative');
  });
});
