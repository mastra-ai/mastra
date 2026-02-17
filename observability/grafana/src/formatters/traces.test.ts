import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';

import { formatSpansForTempo } from './traces';

function makeSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span-1',
    traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
    name: 'test-agent-run',
    type: SpanType.AGENT_RUN,
    startTime: new Date('2026-01-15T10:00:00.000Z'),
    endTime: new Date('2026-01-15T10:00:01.500Z'),
    isRootSpan: true,
    isEvent: false,
    ...overrides,
  } as AnyExportedSpan;
}

describe('formatSpansForTempo', () => {
  it('should produce valid OTLP JSON structure', () => {
    const spans = [makeSpan()];
    const result = formatSpansForTempo(spans, 'my-service');

    expect(result.resourceSpans).toHaveLength(1);
    const rs = result.resourceSpans[0]!;

    // Check resource attributes
    const serviceNameAttr = rs.resource.attributes.find(a => a.key === 'service.name');
    expect(serviceNameAttr?.value.stringValue).toBe('my-service');

    // Check scope
    expect(rs.scopeSpans).toHaveLength(1);
    expect(rs.scopeSpans[0]!.scope.name).toBe('@mastra/grafana');

    // Check spans
    expect(rs.scopeSpans[0]!.spans).toHaveLength(1);
  });

  it('should correctly convert span fields', () => {
    const span = makeSpan({
      id: 'abc123',
      traceId: 'trace-xyz',
      parentSpanId: 'parent-1',
      name: 'my-span',
    });

    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    expect(otlpSpan.traceId).toBe('trace-xyz');
    expect(otlpSpan.spanId).toBe('abc123');
    expect(otlpSpan.parentSpanId).toBe('parent-1');
    expect(otlpSpan.name).toBe('my-span');
  });

  it('should convert timestamps to nanosecond strings', () => {
    const span = makeSpan({
      startTime: new Date('2026-01-15T10:00:00.000Z'),
      endTime: new Date('2026-01-15T10:00:01.000Z'),
    });

    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    const startMs = new Date('2026-01-15T10:00:00.000Z').getTime();
    const endMs = new Date('2026-01-15T10:00:01.000Z').getTime();

    expect(otlpSpan.startTimeUnixNano).toBe(`${BigInt(startMs) * 1_000_000n}`);
    expect(otlpSpan.endTimeUnixNano).toBe(`${BigInt(endMs) * 1_000_000n}`);
  });

  it('should set span kind CLIENT for MODEL_GENERATION', () => {
    const span = makeSpan({ type: SpanType.MODEL_GENERATION });
    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    expect(otlpSpan.kind).toBe(3); // SPAN_KIND_CLIENT
  });

  it('should set span kind INTERNAL for AGENT_RUN', () => {
    const span = makeSpan({ type: SpanType.AGENT_RUN });
    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    expect(otlpSpan.kind).toBe(1); // SPAN_KIND_INTERNAL
  });

  it('should include mastra.span.type attribute', () => {
    const span = makeSpan({ type: SpanType.TOOL_CALL });
    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    const typeAttr = otlpSpan.attributes.find(a => a.key === 'mastra.span.type');
    expect(typeAttr?.value.stringValue).toBe('tool_call');
  });

  it('should include model generation attributes', () => {
    const span = makeSpan({
      type: SpanType.MODEL_GENERATION,
      attributes: {
        model: 'gpt-4',
        provider: 'openai',
        usage: { inputTokens: 100, outputTokens: 50 },
        parameters: { temperature: 0.7 },
      },
    });

    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    const modelAttr = otlpSpan.attributes.find(a => a.key === 'gen_ai.request.model');
    expect(modelAttr?.value.stringValue).toBe('gpt-4');

    const inputTokensAttr = otlpSpan.attributes.find(a => a.key === 'gen_ai.usage.input_tokens');
    expect(inputTokensAttr?.value.intValue).toBe('100');
  });

  it('should include metadata as custom attributes', () => {
    const span = makeSpan({
      metadata: { userId: 'user-123', custom: { nested: true } },
    });

    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    const userIdAttr = otlpSpan.attributes.find(a => a.key === 'mastra.metadata.userId');
    expect(userIdAttr?.value.stringValue).toBe('user-123');

    const customAttr = otlpSpan.attributes.find(a => a.key === 'mastra.metadata.custom');
    expect(customAttr?.value.stringValue).toBe('{"nested":true}');
  });

  it('should include tags for root spans', () => {
    const span = makeSpan({
      isRootSpan: true,
      tags: ['production', 'experiment-v2'],
    });

    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    const tagsAttr = otlpSpan.attributes.find(a => a.key === 'mastra.tags');
    expect(tagsAttr?.value.stringValue).toBe('["production","experiment-v2"]');
  });

  it('should set error status and exception event for error spans', () => {
    const span = makeSpan({
      errorInfo: {
        message: 'Something went wrong',
        id: 'ERR_001',
        details: { stack: 'Error: Something went wrong\n    at ...' },
      },
    });

    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    expect(otlpSpan.status.code).toBe(2); // STATUS_ERROR
    expect(otlpSpan.status.message).toBe('Something went wrong');
    expect(otlpSpan.events).toHaveLength(1);
    expect(otlpSpan.events[0]!.name).toBe('exception');

    const msgAttr = otlpSpan.events[0]!.attributes.find(a => a.key === 'exception.message');
    expect(msgAttr?.value.stringValue).toBe('Something went wrong');
  });

  it('should set OK status for completed spans without errors', () => {
    const span = makeSpan({ endTime: new Date() });
    const result = formatSpansForTempo([span], 'svc');
    const otlpSpan = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;

    expect(otlpSpan.status.code).toBe(1); // STATUS_OK
  });

  it('should handle multiple spans in a batch', () => {
    const spans = [
      makeSpan({ id: 'span-1', name: 'first' }),
      makeSpan({ id: 'span-2', name: 'second' }),
      makeSpan({ id: 'span-3', name: 'third' }),
    ];

    const result = formatSpansForTempo(spans, 'svc');
    expect(result.resourceSpans[0]!.scopeSpans[0]!.spans).toHaveLength(3);
  });
});
