import { Mastra } from '@mastra/core';
import type { SpanStopReasonContext, TracingEvent } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { Observability } from '../default';
import { MastraStorageExporter } from '../exporters/mastra-storage';
import { DefaultObservabilityInstance } from '../instances';
import { SensitiveDataFilter } from '../span_processors/sensitive-data-filter';

function setup(filter = false) {
  const events: TracingEvent[] = [];
  const tracing = new DefaultObservabilityInstance({
    name: 'outcomes',
    serviceName: 'test',
    spanOutputProcessors: filter ? [new SensitiveDataFilter({ sensitiveFields: ['processorId'] })] : [],
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
  it.each(['start', 'update', 'end', 'error'] as const)(
    'serializes and copies custom context supplied through %s',
    async method => {
      const { tracing, events } = setup();
      const context = { counter: 12n, failure: new Error('diagnostic'), nested: { value: 'original' } };
      const fields = { outcome: 'custom', stopReason: 'custom_reason', stopReasonContext: context };
      const span = tracing.startSpan({
        name: 'custom-context',
        type: SpanType.GENERIC,
        ...(method === 'start' ? fields : {}),
      });
      if (method === 'update') span.update(fields);
      if (method === 'end') span.end(fields);
      if (method === 'error') span.error({ ...fields, error: new Error('failed') });
      context.nested.value = 'mutated';
      span.end();
      await tracing.flush();
      const exported = events.find(event => event.type === TracingEventType.SPAN_ENDED)!.exportedSpan;
      const serialized = JSON.parse(JSON.stringify(exported));
      expect(serialized.stopReasonContext).toMatchObject({
        counter: '12n',
        failure: { message: 'diagnostic' },
        nested: { value: 'original' },
      });
    },
  );

  it('filters compact context before it reaches exporters', async () => {
    const { tracing, events } = setup(true);
    const span = tracing.startSpan({ name: 'private-policy', type: SpanType.AGENT_RUN });
    span.end({ outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { processorId: 'private-processor' } });
    await tracing.flush();
    const exported = events.find(event => event.type === TracingEventType.SPAN_ENDED)!.exportedSpan;
    expect(exported.stopReasonContext).toEqual({ processorId: '[REDACTED]' });
    expect(JSON.stringify(exported)).not.toContain('private-processor');
  });

  it('preserves explicit null and omitted outcomes on newly created spans', () => {
    const { tracing, events } = setup();
    tracing.startSpan({ name: 'ongoing', type: SpanType.AGENT_RUN, outcome: null });
    const legacy = tracing.startSpan({ name: 'legacy', type: SpanType.AGENT_RUN });
    legacy.end();
    expect(events.find(e => e.exportedSpan.name === 'ongoing')?.exportedSpan).toMatchObject({ outcome: null });
    expect(legacy.exportSpan()).not.toHaveProperty('outcome');
  });

  it.each(['method', 'option'] as const)(
    '%s: marks unfinished executions unknown when a parent cleans them up',
    api => {
      const { tracing } = setup();
      const root = tracing.startSpan({ name: 'root', type: SpanType.AGENT_RUN, outcome: null });
      const child = root.createChildSpan({ name: 'unfinished', type: SpanType.TOOL_CALL, outcome: null });
      if (api === 'method') root.endTree({ outcome: 'success' });
      else root.end({ outcome: 'success', endTree: true });
      expect(child.exportSpan()).toMatchObject({ outcome: 'unknown' });
    },
  );

  it.each(['method', 'option'] as const)('%s: distinguishes cancellation from consequential interruption', api => {
    const { tracing } = setup();
    const root = tracing.startSpan({ name: 'agent', type: SpanType.AGENT_RUN, outcome: null });
    const open = root.createChildSpan({ name: 'tool', type: SpanType.TOOL_CALL, outcome: null });
    const done = root.createChildSpan({ name: 'done', type: SpanType.TOOL_CALL, outcome: null });
    done.end({ outcome: 'success' });
    const termination = { outcome: 'abort' as const, stopReason: 'caller_cancelled' as const };
    if (api === 'method') root.endTree(termination);
    else root.end({ ...termination, endTree: true });
    expect(root.exportSpan()).toMatchObject(termination);
    expect(open.exportSpan()).toMatchObject({ outcome: 'interrupted', stopReason: 'caller_cancelled' });
    expect(done.exportSpan()).toMatchObject({ outcome: 'success' });
  });

  it('records an ancestor deadline as interruption on its unfinished descendants', () => {
    const { tracing } = setup();
    const root = tracing.startSpan({ name: 'agent', type: SpanType.AGENT_RUN, outcome: null });
    const child = root.createChildSpan({ name: 'tool', type: SpanType.TOOL_CALL, outcome: null });
    root.end({ outcome: 'limit', stopReason: 'timeout', stopReasonContext: { timeoutMs: 100 }, endTree: true });
    expect(child.exportSpan()).toMatchObject({
      outcome: 'interrupted',
      stopReason: 'timeout',
      stopReasonContext: { timeoutMs: 100 },
    });
  });

  it('retains known stop details when an ongoing span is bare-ended', () => {
    const { tracing } = setup();
    const span = tracing.startSpan({ name: 'stopped', type: SpanType.AGENT_RUN, outcome: null });
    span.update({ stopReason: 'runtime_error', stopReasonContext: { errorCode: 'recorded_before_cleanup' } });
    span.end();
    expect(span.exportSpan()).toMatchObject({
      outcome: 'unknown',
      stopReason: 'runtime_error',
      stopReasonContext: { errorCode: 'recorded_before_cleanup' },
    });
  });

  it('replaces provisional stop details when the execution recovers', () => {
    const { tracing } = setup();
    const span = tracing.startSpan({ name: 'retry', type: SpanType.MODEL_GENERATION, outcome: null });
    span.update({ outcome: 'error', stopReason: 'model_error', stopReasonContext: { retryable: true } });
    span.end({ outcome: 'success' });
    expect(span.exportSpan()).toMatchObject({ outcome: 'success', stopReason: null, stopReasonContext: null });
  });

  it('does not attach a late error to an already successful execution', () => {
    const { tracing } = setup();
    const span = tracing.startSpan({ name: 'completed', type: SpanType.TOOL_CALL, outcome: null });
    span.end({ outcome: 'success' });
    span.error({ error: new Error('sibling failed'), outcome: 'error' });
    expect(span.exportSpan().errorInfo).toBeUndefined();
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
      causeOutcome: 'limit',
      causeStopReason: 'context_window_exceeded',
      observerSpanId: observer.id,
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
      stopReasonContext: { retryable: true },
    });
    expect(events.find(e => e.type === TracingEventType.SPAN_ENDED)?.exportedSpan).toMatchObject({
      outcome: 'error',
      stopReason: 'model_error',
      stopReasonContext: { retryable: true },
    });
  });

  it('records primary cancellation as interruption on children closed for cleanup', () => {
    const { tracing } = setup();
    const primary = tracing.startSpan({ name: 'primary', type: SpanType.AGENT_RUN, outcome: null });
    const child = primary.createChildSpan({ name: 'child', type: SpanType.TOOL_CALL });
    primary.end({ outcome: 'abort', stopReason: 'caller_cancelled', endTree: true });
    expect(primary.exportSpan()).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
    expect(child.exportSpan()).toMatchObject({ outcome: 'interrupted', stopReason: 'caller_cancelled' });
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
    it('persists compact observer references, and clears provisional failures after recovery', async () => {
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
        const recovered = tracing.startSpan({
          name: 'recovered',
          type: SpanType.AGENT_RUN,
          outcome: null,
          stopReason: 'model_error',
          stopReasonContext: { retryable: true },
        });
        await tracing.flush();
        const context: SpanStopReasonContext = {
          causeOutcome: 'limit',
          causeStopReason: 'context_window_exceeded',
          observerSpanId: 'observer-span',
        };
        primary.end({ outcome: 'interrupted', stopReason: 'observer_failed', stopReasonContext: context });
        recovered.end({ outcome: 'success', stopReason: null, stopReasonContext: null });
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
