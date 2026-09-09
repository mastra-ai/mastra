import { SpanType, TracingEventType } from '@mastra/core/observability';
import { DefaultObservabilityInstance } from '@mastra/observability';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LangfuseExporter } from './tracing';

const processed: ReadableSpan[] = [];
vi.mock('@langfuse/otel', () => ({
  LangfuseSpanProcessor: class {
    onStart() {}
    onEnd(span: ReadableSpan) {
      processed.push(span);
    }
    async forceFlush() {}
    async shutdown() {}
  },
}));

afterEach(() => {
  processed.length = 0;
});

describe.each(['root-first', 'child-first'] as const)('real session conversion: %s', order => {
  it.each([
    ['implicit caller session', 'caller-thread'],
    ['explicit caller session', 'custom-session'],
    ['empty session suppression', ''],
  ])('%s survives isolated OM execution threads', async (_label, sessionId) => {
    const observability = new DefaultObservabilityInstance({
      name: 'session-test',
      serviceName: 'session-test',
      exporters: [],
    });
    const instance = observability;
    const exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
    const root = instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'caller',
      metadata: { threadId: 'caller-thread', ...(sessionId !== 'caller-thread' ? { sessionId } : {}) },
    });
    const wrapper = root.createChildSpan({
      type: SpanType.MEMORY_OPERATION,
      name: 'memory: observe',
      metadata: { sessionId },
      attributes: { operationType: 'observe' },
    });
    const agent = wrapper.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'observer',
      metadata: { threadId: 'isolated-observer-thread' },
    });
    const model = agent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: 'model',
      attributes: { model: 'gpt-4.1-mini', provider: 'openai' },
    });
    const spans = [root, wrapper, agent, model];
    for (const span of [...spans].reverse()) span.end();
    expect(agent.metadata?.threadId).toBe('isolated-observer-thread');
    expect(agent.metadata?.sessionId).toBe(sessionId);
    expect(root.metadata?.threadId).toBe('caller-thread');
    for (const span of order === 'root-first' ? spans : [...spans].reverse()) {
      await exporter.onTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span.exportSpan() });
    }
    expect(processed).toHaveLength(4);
    for (const span of processed) {
      expect(span.spanContext().traceId).toBe(root.traceId);
      expect(span.attributes['session.id']).toBe(sessionId || undefined);
      if (sessionId) {
        expect(span.attributes).not.toHaveProperty('mastra.metadata.sessionId');
        expect(span.attributes).not.toHaveProperty('mastra.metadata.threadId');
      }
    }
    const convertedAgent = processed.find(span => span.spanContext().spanId === agent.id)!;
    expect(convertedAgent.parentSpanContext?.spanId).toBe(wrapper.id);
    expect(processed.find(span => span.spanContext().spanId === model.id)?.parentSpanContext?.spanId).toBe(agent.id);
    if (!sessionId) {
      expect(convertedAgent.attributes['mastra.metadata.sessionId']).toBe('');
      expect(convertedAgent.attributes['mastra.metadata.threadId']).toBe('isolated-observer-thread');
    }
    await exporter.shutdown();
    await observability.shutdown();
  });

  it('does not invent a session from an external parent', async () => {
    const observability = new DefaultObservabilityInstance({
      name: 'session-test',
      serviceName: 'session-test',
      exporters: [],
    });
    const root = observability.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'external caller',
      tracingOptions: { traceId: '1234567890abcdef1234567890abcdef', parentSpanId: 'abcdef1234567890' },
    });
    const child = root.createChildSpan({
      type: SpanType.MEMORY_OPERATION,
      name: 'memory: reflect',
      attributes: { operationType: 'reflect' },
    });
    child.end();
    root.end();
    const exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
    for (const span of order === 'root-first' ? [root, child] : [child, root]) {
      await exporter.onTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span.exportSpan() });
    }
    expect(processed).toHaveLength(2);
    for (const span of processed) expect(span.attributes['session.id']).toBeUndefined();
    expect(processed.find(span => span.spanContext().spanId === root.id)?.parentSpanContext?.spanId).toBe(
      'abcdef1234567890',
    );
    expect(processed.find(span => span.spanContext().spanId === child.id)?.parentSpanContext?.spanId).toBe(root.id);
    await exporter.shutdown();
    await observability.shutdown();
  });

  it('keeps generic nested-agent grouping under a threadless workflow root', async () => {
    const observability = new DefaultObservabilityInstance({
      name: 'session-test',
      serviceName: 'session-test',
      exporters: [],
    });
    const root = observability.startSpan({ type: SpanType.WORKFLOW_RUN, name: 'workflow' });
    const caller = root.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'nested caller',
      metadata: { threadId: 'nested-thread' },
    });
    const exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
    caller.end();
    root.end();
    for (const span of order === 'root-first' ? [root, caller] : [caller, root]) {
      await exporter.onTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span.exportSpan() });
    }
    expect(processed.find(span => span.spanContext().spanId === root.id)?.attributes['session.id']).toBeUndefined();
    const child = processed.find(span => span.spanContext().spanId === caller.id)!;
    expect(child.attributes['session.id']).toBe('nested-thread');
    expect(child.parentSpanContext?.spanId).toBe(root.id);
    await exporter.shutdown();
    await observability.shutdown();
  });
});
