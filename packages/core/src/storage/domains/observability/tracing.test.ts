import { describe, it, expect } from 'vitest';
import { SpanType } from '../../../observability/types';
import {
  extractBranchSpans,
  lightSpanRecordSchema,
  getTraceLightResponseSchema,
  listBranchesArgsSchema,
  listTracesArgsSchema,
} from './tracing';

describe('durationMs orderBy schemas', () => {
  it('allows traces and branches to be ordered by durationMs', () => {
    const traceArgs = listTracesArgsSchema.parse({
      orderBy: { field: 'durationMs', direction: 'DESC' },
    });
    const branchArgs = listBranchesArgsSchema.parse({
      orderBy: { field: 'durationMs', direction: 'ASC' },
    });

    expect(traceArgs.orderBy.field).toBe('durationMs');
    expect(branchArgs.orderBy.field).toBe('durationMs');
  });
});

describe('lightSpanRecordSchema', () => {
  const validLightSpan = {
    traceId: 'trace-123',
    spanId: 'span-456',
    name: 'Test Span',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt: new Date('2024-01-01T00:00:00Z'),
    parentSpanId: 'parent-span-789',
    endedAt: new Date('2024-01-01T00:01:00Z'),
    error: { message: 'something failed' },
    entityType: 'agent',
    entityId: 'agent-1',
    entityName: 'Test Agent',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:01Z'),
  };

  it('should parse a complete light span record with all fields', () => {
    const result = lightSpanRecordSchema.parse(validLightSpan);
    expect(result.traceId).toBe('trace-123');
    expect(result.spanId).toBe('span-456');
    expect(result.name).toBe('Test Span');
    expect(result.spanType).toBe(SpanType.AGENT_RUN);
    expect(result.isEvent).toBe(false);
    expect(result.startedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    expect(result.parentSpanId).toBe('parent-span-789');
    expect(result.endedAt).toEqual(new Date('2024-01-01T00:01:00Z'));
    expect(result.error).toEqual({ message: 'something failed' });
    expect(result.entityType).toBe('agent');
    expect(result.entityId).toBe('agent-1');
    expect(result.entityName).toBe('Test Agent');
    expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    expect(result.updatedAt).toEqual(new Date('2024-01-01T00:00:01Z'));
  });

  it('should parse a minimal light span record (nullish fields omitted)', () => {
    const minimal = {
      traceId: 'trace-123',
      spanId: 'span-456',
      name: 'Minimal Span',
      spanType: SpanType.GENERIC,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: null,
    };
    const result = lightSpanRecordSchema.parse(minimal);
    expect(result.traceId).toBe('trace-123');
    expect(result.name).toBe('Minimal Span');
    expect(result.parentSpanId).toBeUndefined();
    expect(result.endedAt).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(result.entityType).toBeUndefined();
    expect(result.entityId).toBeUndefined();
    expect(result.entityName).toBeUndefined();
  });

  it('should reject records missing required fields', () => {
    // Missing traceId
    expect(() =>
      lightSpanRecordSchema.parse({
        spanId: 's',
        name: 'n',
        spanType: SpanType.GENERIC,
        isEvent: false,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: null,
      }),
    ).toThrow();

    // Missing spanId
    expect(() =>
      lightSpanRecordSchema.parse({
        traceId: 't',
        name: 'n',
        spanType: SpanType.GENERIC,
        isEvent: false,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: null,
      }),
    ).toThrow();

    // Missing name
    expect(() =>
      lightSpanRecordSchema.parse({
        traceId: 't',
        spanId: 's',
        spanType: SpanType.GENERIC,
        isEvent: false,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: null,
      }),
    ).toThrow();

    // Missing spanType
    expect(() =>
      lightSpanRecordSchema.parse({
        traceId: 't',
        spanId: 's',
        name: 'n',
        isEvent: false,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: null,
      }),
    ).toThrow();

    // Missing isEvent
    expect(() =>
      lightSpanRecordSchema.parse({
        traceId: 't',
        spanId: 's',
        name: 'n',
        spanType: SpanType.GENERIC,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: null,
      }),
    ).toThrow();

    // Missing startedAt
    expect(() =>
      lightSpanRecordSchema.parse({
        traceId: 't',
        spanId: 's',
        name: 'n',
        spanType: SpanType.GENERIC,
        isEvent: false,
        createdAt: new Date(),
        updatedAt: null,
      }),
    ).toThrow();
  });

  it('should NOT include input, output, attributes, metadata, tags, links fields in the parsed result', () => {
    const withHeavyFields = {
      ...validLightSpan,
      input: { message: 'hello' },
      output: { result: 'world' },
      attributes: { model: 'gpt-4' },
      metadata: { custom: 'data' },
      tags: ['production'],
      links: [{ traceId: 'other-trace' }],
    };
    const result = lightSpanRecordSchema.parse(withHeavyFields);
    expect('input' in result).toBe(false);
    expect('output' in result).toBe(false);
    expect('attributes' in result).toBe(false);
    expect('metadata' in result).toBe(false);
    expect('tags' in result).toBe(false);
    expect('links' in result).toBe(false);
  });
});

describe('getTraceLightResponseSchema', () => {
  it('should parse a valid response with traceId and spans array', () => {
    const response = {
      traceId: 'trace-123',
      spans: [
        {
          traceId: 'trace-123',
          spanId: 'span-1',
          name: 'Root',
          spanType: SpanType.AGENT_RUN,
          isEvent: false,
          startedAt: new Date('2024-01-01T00:00:00Z'),
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: null,
        },
        {
          traceId: 'trace-123',
          spanId: 'span-2',
          parentSpanId: 'span-1',
          name: 'Child',
          spanType: SpanType.TOOL_CALL,
          isEvent: false,
          startedAt: new Date('2024-01-01T00:00:01Z'),
          endedAt: new Date('2024-01-01T00:00:02Z'),
          createdAt: new Date('2024-01-01T00:00:01Z'),
          updatedAt: null,
        },
      ],
    };
    const result = getTraceLightResponseSchema.parse(response);
    expect(result.traceId).toBe('trace-123');
    expect(result.spans).toHaveLength(2);
    expect(result.spans[0]!.spanId).toBe('span-1');
    expect(result.spans[1]!.parentSpanId).toBe('span-1');
  });

  it('should parse a response with empty spans array', () => {
    const result = getTraceLightResponseSchema.parse({
      traceId: 'trace-empty',
      spans: [],
    });
    expect(result.traceId).toBe('trace-empty');
    expect(result.spans).toHaveLength(0);
  });

  it('should reject response missing traceId', () => {
    expect(() =>
      getTraceLightResponseSchema.parse({
        spans: [],
      }),
    ).toThrow();
  });
});

describe('extractBranchSpans (helper)', () => {
  type Span = { spanId: string; parentSpanId: string | null; startedAt: Date };

  it('keeps the anchor at index 0 even when a descendant has earlier startedAt', () => {
    // Anchor 'A' starts AFTER its child 'B' -- can happen with isEvent
    // spans, clock skew, or out-of-order ingestion.
    const spans: Span[] = [
      { spanId: 'A', parentSpanId: 'root', startedAt: new Date('2026-01-02T12:00:05.000Z') },
      { spanId: 'B', parentSpanId: 'A', startedAt: new Date('2026-01-02T12:00:01.000Z') },
      { spanId: 'C', parentSpanId: 'A', startedAt: new Date('2026-01-02T12:00:09.000Z') },
    ];
    const branch = extractBranchSpans(spans, 'A');
    expect(branch.map(s => s.spanId)).toEqual(['A', 'B', 'C']);
  });

  it('does not loop forever on a parentSpanId cycle', () => {
    // Cycle: A → B → C → B (corrupted data)
    const spans: Span[] = [
      { spanId: 'A', parentSpanId: null, startedAt: new Date('2026-01-02T12:00:00.000Z') },
      { spanId: 'B', parentSpanId: 'A', startedAt: new Date('2026-01-02T12:00:01.000Z') },
      { spanId: 'C', parentSpanId: 'B', startedAt: new Date('2026-01-02T12:00:02.000Z') },
      // Reintroduces B as a child of C (A → B → C → B cycle)
      { spanId: 'B', parentSpanId: 'C', startedAt: new Date('2026-01-02T12:00:03.000Z') },
    ];
    // Even more pathological: C lists itself as its own parent.
    spans.push({ spanId: 'C', parentSpanId: 'C', startedAt: new Date('2026-01-02T12:00:04.000Z') });

    const branch = extractBranchSpans(spans, 'A');
    // Anchor first; each spanId visited at most once.
    const visited = new Set(branch.map(s => s.spanId));
    expect(visited.size).toBe(branch.length);
    expect(branch[0]!.spanId).toBe('A');
  });
});
