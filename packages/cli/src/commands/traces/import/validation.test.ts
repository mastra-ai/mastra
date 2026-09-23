import { describe, expect, it } from 'vitest';
import type { TraceImportTrace } from './types.js';
import { validateTraceImportTrace } from './validation.js';

function validTrace(): TraceImportTrace {
  return {
    sourceTraceId: 'source-trace',
    spans: [
      {
        traceId: '11111111111111111111111111111111',
        spanId: '1111111111111111',
        parentSpanId: null,
        name: 'root',
        spanType: 'generic',
        startedAt: '2026-09-10T12:00:00.000Z',
        endedAt: '2026-09-10T12:00:02.000Z',
        isEvent: false,
        metadata: {},
      },
      {
        traceId: '11111111111111111111111111111111',
        spanId: '2222222222222222',
        parentSpanId: '1111111111111111',
        name: 'child',
        spanType: 'tool_call',
        startedAt: '2026-09-10T12:00:00.500Z',
        endedAt: '2026-09-10T12:00:01.000Z',
        isEvent: false,
        metadata: {},
      },
    ],
  };
}

describe('validateTraceImportTrace', () => {
  it('accepts one complete Mastra trace tree', () => {
    expect(validateTraceImportTrace(validTrace())).toEqual(validTrace());
  });

  it.each([
    ['duplicate span IDs', (trace: TraceImportTrace) => (trace.spans[1]!.spanId = trace.spans[0]!.spanId)],
    ['multiple roots', (trace: TraceImportTrace) => (trace.spans[1]!.parentSpanId = null)],
    ['a missing parent', (trace: TraceImportTrace) => (trace.spans[1]!.parentSpanId = 'missing')],
    ['mixed trace IDs', (trace: TraceImportTrace) => (trace.spans[1]!.traceId = '22222222222222222222222222222222')],
    ['an invalid duration', (trace: TraceImportTrace) => (trace.spans[1]!.endedAt = '2026-09-10T11:59:59.000Z')],
    ['an invalid destination ID', (trace: TraceImportTrace) => (trace.spans[1]!.spanId = 'not-an-otel-id')],
    [
      'an all-zero trace ID',
      (trace: TraceImportTrace) => trace.spans.forEach(span => (span.traceId = '00000000000000000000000000000000')),
    ],
    ['an all-zero span ID', (trace: TraceImportTrace) => (trace.spans[1]!.spanId = '0000000000000000')],
  ])('rejects a trace with %s', (_name, mutate) => {
    const trace = validTrace();
    mutate(trace);
    expect(() => validateTraceImportTrace(trace)).toThrow();
  });

  it('rejects disconnected cycles', () => {
    const trace = validTrace();
    trace.spans.push(
      {
        ...trace.spans[1]!,
        spanId: '3333333333333333',
        parentSpanId: '4444444444444444',
      },
      {
        ...trace.spans[1]!,
        spanId: '4444444444444444',
        parentSpanId: '3333333333333333',
      },
    );
    expect(() => validateTraceImportTrace(trace)).toThrow('cycle');
  });

  it('rejects values that cannot be preserved in JSONL', () => {
    const trace = validTrace();
    trace.spans[0]!.metadata.invalid = Number.NaN;
    expect(() => validateTraceImportTrace(trace)).toThrow();
  });
});
