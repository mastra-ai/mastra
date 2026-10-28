import { Mastra } from '@mastra/core';
import type { SpanStopReasonContext, TracingEvent } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { Observability } from '../default';
import { MastraStorageExporter } from '../exporters/mastra-storage';
import { DefaultObservabilityInstance } from '../instances';

function setup() {
  const events: TracingEvent[] = [];
  const tracing = new DefaultObservabilityInstance({
    name: 'outcomes',
    serviceName: 'test',
    exporters: [
      {
        name: 'capture',
        exportTracingEvent: async event => void events.push(event),
        flush: async () => {},
        shutdown: async () => {},
      },
    ],
  });
  return { tracing, events };
}

describe('native execution outcomes (OBS-724)', () => {
  it('distinguishes an opted-in ongoing execution from an unavailable legacy outcome', () => {
    const { tracing, events } = setup();
    tracing.startSpan({ name: 'ongoing', type: SpanType.AGENT_RUN, outcome: null });
    const legacy = tracing.startSpan({ name: 'legacy', type: SpanType.AGENT_RUN });
    legacy.end();
    expect(events.find(e => e.exportedSpan.name === 'ongoing')?.exportedSpan).toMatchObject({ outcome: null });
    expect(legacy.exportSpan()).not.toHaveProperty('outcome');
  });

  it.each(['success', 'error', 'abort', 'interrupted', 'suspend', 'limit', 'blocked', 'unknown'] as const)(
    'exports an explicitly reported %s outcome',
    outcome => {
      const { tracing, events } = setup();
      const span = tracing.startSpan({ name: 'execution', type: SpanType.AGENT_RUN, outcome: null });
      span.end({ outcome });
      expect(events.find(e => e.type === TracingEventType.SPAN_ENDED)?.exportedSpan).toMatchObject({ outcome });
    },
  );

  it('preserves the observer cause across durable serialization without assigning it to the primary agent', () => {
    const { tracing, events } = setup();
    const primary = tracing.startSpan({ name: 'primary', type: SpanType.AGENT_RUN, outcome: null });
    const observer = primary.createChildSpan({ name: 'observer', type: SpanType.AGENT_RUN, outcome: null });
    observer.end({ outcome: 'limit', stopReason: 'context_window_exceeded' });
    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(primary.snapshot())));
    expect(rebuilt.exportSpan()).toMatchObject({ outcome: null });
    const stopReasonContext = {
      reason: 'observer_failed',
      cause: { outcome: 'limit', stopReason: 'context_window_exceeded' },
      observerSpanId: observer.id,
      signals: [
        {
          id: 'observer-signal',
          type: 'reactive',
          contents: 'Observer stopped',
          createdAt: '2026-10-27T12:00:00.000Z',
          attributes: { source: 'observer' },
        },
      ],
    } satisfies SpanStopReasonContext;
    rebuilt.end({ outcome: 'interrupted', stopReason: 'observer_failed', stopReasonContext });
    expect(events.filter(e => e.type === TracingEventType.SPAN_ENDED).map(e => e.exportedSpan)).toMatchObject([
      { outcome: 'limit', stopReason: 'context_window_exceeded' },
      { outcome: 'interrupted', stopReason: 'observer_failed', stopReasonContext },
    ]);
    expect(tracing.rebuildSpan(JSON.parse(JSON.stringify(rebuilt.snapshot()))).exportSpan()).toMatchObject({
      outcome: 'interrupted',
      stopReason: 'observer_failed',
      stopReasonContext,
    });
  });

  it('does not infer a terminal failure from a recoverable error', () => {
    const { tracing } = setup();
    const span = tracing.startSpan({ name: 'retry', type: SpanType.AGENT_RUN, outcome: null });
    span.error({ error: new Error('retryable'), endSpan: false });
    expect(span.exportSpan()).toMatchObject({ outcome: null });
    span.end({ outcome: 'success', stopReason: null, stopReasonContext: null });
    expect(span.exportSpan()).toMatchObject({ outcome: 'success', stopReason: null, stopReasonContext: null });
  });

  it('keeps a supplied model failure when error() ends the span', () => {
    const { tracing, events } = setup();
    const span = tracing.startSpan({ name: 'model', type: SpanType.MODEL_GENERATION, outcome: null });
    span.error({
      error: new Error('unavailable'),
      outcome: 'error',
      stopReason: 'model_error',
      stopReasonContext: { reason: 'model_error', retryable: true, message: 'unavailable' },
    });
    expect(events.find(e => e.type === TracingEventType.SPAN_ENDED)?.exportedSpan).toMatchObject({
      outcome: 'error',
      stopReason: 'model_error',
      stopReasonContext: { reason: 'model_error', retryable: true },
    });
  });

  it('does not copy a primary cancellation onto children closed for cleanup', () => {
    const { tracing } = setup();
    const primary = tracing.startSpan({ name: 'primary', type: SpanType.AGENT_RUN, outcome: null });
    const child = primary.createChildSpan({ name: 'child', type: SpanType.TOOL_CALL });
    primary.end({ outcome: 'abort', stopReason: 'caller_cancelled', endTree: true });
    expect(primary.exportSpan()).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
    expect(child.exportSpan()).not.toHaveProperty('outcome');
  });

  it.each([false, true])('does not rewrite a completed suspension after late events (rebuilt=%s)', rebuild => {
    const { tracing } = setup();
    let span = tracing.startSpan({ name: 'approval', type: SpanType.AGENT_RUN, outcome: null });
    span.end({ outcome: 'suspend', stopReason: 'approval_required' });
    if (rebuild) span = tracing.rebuildSpan(JSON.parse(JSON.stringify(span.snapshot())));
    span.update({ outcome: null, stopReason: null });
    span.error({ error: new Error('late'), outcome: 'error', stopReason: 'runtime_error' });
    span.end({ outcome: 'success', stopReason: null });
    expect(span.exportSpan()).toMatchObject({ outcome: 'suspend', stopReason: 'approval_required' });
  });
});

describe.each(['batch-with-updates', 'realtime', 'insert-only'] as const)(
  'native outcomes through storage export (%s)',
  strategy => {
    it('persists observer causes and signals, and clears provisional failures after recovery', async () => {
      const storage = new InMemoryStore();
      const exporter = new MastraStorageExporter({ strategy, maxBatchWaitMs: 60_000 });
      const observability = new Observability({
        configs: {
          default: {
            serviceName: 'native-outcomes',
            exporters: [exporter],
          },
        },
      });
      const mastra = new Mastra({ storage, observability, logger: false });
      const tracing = observability.getDefaultInstance()!;
      try {
        const store = (await storage.getStore('observability'))!;
        expect(store.observabilityStrategy.supported).toContain(strategy);
        const primary = tracing.startSpan({ name: 'primary', type: SpanType.AGENT_RUN, outcome: null });
        const delayedStart = structuredClone(primary.exportSpan());
        const recovered = tracing.startSpan({
          name: 'recovered',
          type: SpanType.AGENT_RUN,
          outcome: null,
          stopReason: 'model_error',
          stopReasonContext: { reason: 'model_error', retryable: true },
        });
        await tracing.flush();
        const context: SpanStopReasonContext = {
          reason: 'observer_failed',
          cause: {
            outcome: 'limit',
            stopReason: 'context_window_exceeded',
            stopReasonContext: { reason: 'context_window_exceeded', errorCode: 'context_length_exceeded' },
          },
          signals: [
            {
              id: 'observer-stop',
              type: 'reactive',
              contents: 'Observer stopped',
              createdAt: new Date().toISOString(),
            },
          ],
        };
        primary.end({ outcome: 'interrupted', stopReason: 'observer_failed', stopReasonContext: context });
        recovered.end({ outcome: 'success', stopReason: null, stopReasonContext: null });
        await tracing.flush();
        // Replay a real exported start after the terminal event was persisted.
        await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: delayedStart });
        await tracing.flush();
        await exporter.exportTracingEvent({ type: TracingEventType.SPAN_UPDATED, exportedSpan: delayedStart });
        await tracing.flush();
        expect((await store.getSpan({ traceId: primary.traceId, spanId: primary.id }))?.span).toMatchObject({
          outcome: 'interrupted',
          stopReason: 'observer_failed',
          stopReasonContext: context,
        });
        expect((await store.getSpan({ traceId: recovered.traceId, spanId: recovered.id }))?.span).toMatchObject({
          outcome: 'success',
          stopReason: null,
          stopReasonContext: null,
        });
      } finally {
        await mastra.shutdown();
      }
    });
  },
);
