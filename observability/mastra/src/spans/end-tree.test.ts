import type { ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { SpanType, SamplingStrategyType, InternalSpans, TracingEventType } from '@mastra/core/observability';
import { beforeEach, describe, expect, it } from 'vitest';

import { DefaultObservabilityInstance } from '../instances';

class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  events: TracingEvent[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    this.events = [];
  }
}

describe('Span.endTree', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    testExporter = new TestExporter();
  });

  const createInstance = (options = {}) =>
    new DefaultObservabilityInstance({
      serviceName: 'test-tracing',
      name: 'test-instance',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [testExporter],
      ...options,
    });

  const endedIds = () =>
    testExporter.events.filter(event => event.type === TracingEventType.SPAN_ENDED).map(event => event.exportedSpan.id);

  it('ends every still-open descendant', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'step' });
    const nestedRun = step.createChildSpan({ type: SpanType.WORKFLOW_RUN, name: 'nested-run' });
    const nestedStep = nestedRun.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'nested-step' });

    root.endTree();

    expect(endedIds().sort()).toEqual([root.id, step.id, nestedRun.id, nestedStep.id].sort());
    for (const span of [root, step, nestedRun, nestedStep]) {
      expect(span.endTime).toBeInstanceOf(Date);
    }
  });

  it('ends descendants before their ancestors', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'step' });
    const tool = step.createChildSpan({ type: SpanType.TOOL_CALL, name: 'tool' });

    root.endTree();

    expect(endedIds()).toEqual([tool.id, step.id, root.id]);
  });

  it('applies the given options to the span it is called on only', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'step' });

    root.endTree({ attributes: { status: 'canceled' } });

    expect(root.attributes?.status).toBe('canceled');
    expect(step.attributes?.status).toBeUndefined();
  });

  it('leaves already-ended descendants untouched', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const done = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'done' });
    const open = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'open' });

    done.end({ attributes: { status: 'success' } });
    const doneEndTime = done.endTime;

    root.endTree();

    expect(done.endTime).toBe(doneEndTime);
    expect(done.attributes?.status).toBe('success');
    expect(endedIds().filter(id => id === done.id)).toHaveLength(1);
    expect(open.endTime).toBeInstanceOf(Date);
  });

  it('does not re-end the span it is called on', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    root.end({ attributes: { status: 'success' } });

    root.endTree({ attributes: { status: 'canceled' } });

    expect(root.attributes?.status).toBe('success');
    expect(endedIds()).toEqual([root.id]);
  });

  it('emits a single SPAN_ENDED when a force-closed span is ended again', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'step' });

    root.endTree({ attributes: { status: 'canceled' } });
    const endTime = step.endTime;

    step.end({ attributes: { status: 'success' } });
    step.error({ error: new Error('late failure') });

    expect(step.endTime).toBe(endTime);
    expect(step.attributes?.status).toBeUndefined();
    expect(endedIds().filter(id => id === step.id)).toHaveLength(1);
  });

  it('closes descendants of spans dropped by excludeSpanTypes', () => {
    const tracing = createInstance({ excludeSpanTypes: [SpanType.WORKFLOW_STEP] });

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'step' });
    const tool = step.createChildSpan({ type: SpanType.TOOL_CALL, name: 'tool' });

    root.endTree();

    expect(step.endTime).toBeInstanceOf(Date);
    expect(tool.endTime).toBeInstanceOf(Date);
    expect(endedIds()).toEqual([tool.id, root.id]);
  });

  it('closes internal spans that are filtered from export, and their children', () => {
    const tracing = createInstance();
    const tracingPolicy = { internal: InternalSpans.WORKFLOW };

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root', tracingPolicy });
    const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'step', tracingPolicy });
    const tool = step.createChildSpan({ type: SpanType.TOOL_CALL, name: 'tool' });

    root.endTree();

    expect(root.endTime).toBeInstanceOf(Date);
    expect(step.endTime).toBeInstanceOf(Date);
    expect(endedIds()).toEqual([tool.id]);
  });

  it('stops tracking children once they end normally', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const completed = [0, 1, 2].map(i => {
      const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: `step-${i}` });
      step.end();
      return step.id;
    });
    const trailing = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'trailing' });

    root.endTree();

    expect(endedIds()).toEqual([...completed, trailing.id, root.id]);
  });

  it('ignores event spans, which are already emitted at creation', () => {
    const tracing = createInstance();

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const event = root.createEventSpan({ type: SpanType.GENERIC, name: 'event' });

    root.endTree();

    expect(event.endTime).toBeUndefined();
    expect(endedIds()).toEqual([event.id, root.id]);
  });

  it('is a no-op on unsampled spans', () => {
    const tracing = createInstance({ sampling: { type: SamplingStrategyType.NEVER } });

    const root = tracing.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'root' });
    const step = root.createChildSpan({ type: SpanType.WORKFLOW_STEP, name: 'step' });

    expect(() => root.endTree()).not.toThrow();
    expect(step.endTime).toBeUndefined();
    expect(testExporter.events).toHaveLength(0);
  });
});
