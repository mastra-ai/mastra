import { describe, it, expect } from 'vitest';
import { SpanType } from '../../../observability/types';
import {
  BATCH_DELETE_TRACES_MAX_IDS,
  batchDeleteTracesArgsSchema,
  buildInputPreview,
  buildPreview,
  buildPreviewFromJson,
  buildStoredPreview,
  extractBranchSpans,
  getTraceLightResponseSchema,
  isPreviewTruncated,
  lightSpanRecordSchema,
  PREVIEW_MAX_LENGTH,
  toLightSpanRecord,
} from './tracing';
import type { SpanRecord } from './tracing';

describe('batchDeleteTracesArgsSchema', () => {
  it('limits the number of trace IDs in a batch', () => {
    expect(
      batchDeleteTracesArgsSchema.safeParse({
        traceIds: Array.from({ length: BATCH_DELETE_TRACES_MAX_IDS }, (_, index) => `trace-${index}`),
      }).success,
    ).toBe(true);
    expect(
      batchDeleteTracesArgsSchema.safeParse({
        traceIds: Array.from({ length: BATCH_DELETE_TRACES_MAX_IDS + 1 }, (_, index) => `trace-${index}`),
      }).success,
    ).toBe(false);
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
    status: 'error',
    entityType: 'agent',
    entityId: 'agent-1',
    entityName: 'Test Agent',
    threadId: 'thread-1',
    resourceId: 'user-1',
    metadata: { environment: 'production' },
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
    expect(result.status).toBe('error');
    expect(result.entityType).toBe('agent');
    expect(result.entityId).toBe('agent-1');
    expect(result.entityName).toBe('Test Agent');
    expect(result.threadId).toBe('thread-1');
    expect(result.resourceId).toBe('user-1');
    expect(result.metadata).toEqual({ environment: 'production' });
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
    expect(result.status).toBeUndefined();
    expect(result.entityType).toBeUndefined();
    expect(result.entityId).toBeUndefined();
    expect(result.entityName).toBeUndefined();
    expect(result.threadId).toBeUndefined();
    expect(result.resourceId).toBeUndefined();
    expect(result.metadata).toBeUndefined();
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

  it('should NOT include input, output, attributes, tags, links fields in the parsed result', () => {
    const withHeavyFields = {
      ...validLightSpan,
      input: { message: 'hello' },
      output: { result: 'world' },
      attributes: { model: 'gpt-4' },
      tags: ['production'],
      links: [{ traceId: 'other-trace' }],
    };
    const result = lightSpanRecordSchema.parse(withHeavyFields);
    expect('input' in result).toBe(false);
    expect('output' in result).toBe(false);
    expect('attributes' in result).toBe(false);
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

describe('buildPreview', () => {
  it('previews the last user message of a message list', () => {
    const input = {
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'an answer' },
        { role: 'user', content: 'second question' },
      ],
    };

    expect(buildPreview(input)).toBe('second question');
    expect(buildPreview(input.messages)).toBe('second question');
  });

  it('falls back to the last non-system message when no user message has text', () => {
    expect(
      buildPreview([
        { role: 'system', content: 'be brief' },
        { role: 'user', content: '   ' },
        { role: 'assistant', content: 'the answer' },
        { role: 'tool', content: [] },
      ]),
    ).toBe('the answer');
    expect(buildPreview([{ role: 'system', content: 'only a system prompt' }])).toBeNull();
  });

  it('reads string and text parts out of structured content', () => {
    const input = [{ role: 'user', content: [{ type: 'text', text: 'part one' }, { type: 'image' }, 'part two'] }];

    expect(buildPreview(input)).toBe('part one part two');
  });

  it('previews a text or message field before falling back to compact JSON', () => {
    expect(buildPreview({ text: 'generated text', usage: { tokens: 3 } })).toBe('generated text');
    expect(buildPreview({ message: 'boom', stack: 'Error: boom' })).toBe('boom');
    expect(buildPreview({ text: '  ', message: 'fallback field' })).toBe('fallback field');
    expect(buildPreview({ query: 'lookup' })).toBe('{"query":"lookup"}');
    expect(buildPreview([1, 2, 3])).toBe('[1,2,3]');
    expect(buildPreview(42)).toBe('42');
    expect(buildPreview(false)).toBe('false');
  });

  it('uses the serialized text the caller already has for the compact-JSON case', () => {
    expect(buildPreview({ query: 'lookup' }, '{"query": "as stored"}')).toBe('{"query": "as stored"}');
  });

  it('trims strings and returns null when there is nothing to preview', () => {
    expect(buildPreview('  plain prompt text \n')).toBe('plain prompt text');
    expect(buildPreview(null)).toBeNull();
    expect(buildPreview(undefined)).toBeNull();
    expect(buildPreview('   ')).toBeNull();
    expect(buildPreview({ messages: [{ role: 'user', content: '' }] })).toBeNull();
  });

  it('cuts past the max length with an ellipsis', () => {
    const preview = buildPreview('a'.repeat(400));

    expect(preview).toBe(`${'a'.repeat(PREVIEW_MAX_LENGTH)}…`);
    expect(buildPreview('a'.repeat(PREVIEW_MAX_LENGTH))).toBe('a'.repeat(PREVIEW_MAX_LENGTH));
  });

  it('never cuts a surrogate pair in half', () => {
    const emoji = '\u{1F600}';
    const preview = buildPreview(`${'a'.repeat(PREVIEW_MAX_LENGTH - 1)}${emoji}tail`);

    expect(preview).toBe(`${'a'.repeat(PREVIEW_MAX_LENGTH - 1)}…`);
    expect(buildPreview(`${'a'.repeat(PREVIEW_MAX_LENGTH - 2)}${emoji}tail`)).toBe(
      `${'a'.repeat(PREVIEW_MAX_LENGTH - 2)}${emoji}…`,
    );
  });
});

describe('buildPreviewFromJson', () => {
  it.each([
    'plain string',
    { messages: [{ role: 'user', content: 'x'.repeat(300) }] },
    [{ role: 'assistant', content: [{ type: 'text', text: 'hi' }] }],
    { text: 'out' },
    { message: 'failed' },
    { nested: { value: [1, 2, 3] } },
    12.5,
  ])('matches the preview a writer builds from the same value: %j', value => {
    const json = JSON.stringify(value);

    expect(buildPreviewFromJson(json)).toBe(buildPreview(value, json));
  });

  it('previews malformed JSON as blank, never leaking a guess at a sliced document', () => {
    const json = JSON.stringify({
      messages: [
        { content: 'summarize my medical report', role: 'user' },
        { content: 'assistant text that must not leak', role: 'assistant' },
      ],
    });

    expect(buildPreviewFromJson(json.slice(0, 80))).toBeNull();
    expect(buildPreviewFromJson('{"messages": [{"role"')).toBeNull();
    expect(buildPreviewFromJson(null)).toBeNull();
    expect(buildPreviewFromJson('  ')).toBeNull();
  });
});

describe('buildStoredPreview', () => {
  it('trims supplied previews, caps them like generated ones and regenerates blanks', () => {
    expect(buildStoredPreview(' upstream ', { text: 'built' })).toBe('upstream');
    expect(buildStoredPreview('u'.repeat(300), 'built')).toBe(`${'u'.repeat(PREVIEW_MAX_LENGTH)}…`);
    expect(buildStoredPreview('', 'built')).toBe('built');
    expect(buildStoredPreview(' \n\t ', 'built')).toBe('built');
  });

  it('caps an oversized supplied preview without splitting a surrogate pair', () => {
    const huge = 'p'.repeat(PREVIEW_MAX_LENGTH - 1) + '\u{1F600}'.repeat(1_000_000);
    const preview = buildStoredPreview(huge, 'built');
    expect(preview).toBe(`${'p'.repeat(PREVIEW_MAX_LENGTH - 1)}…`);
    expect(isPreviewTruncated(preview)).toBe(true);
  });

  it('builds from the stored value otherwise, with an empty string for nothing to preview', () => {
    expect(buildStoredPreview(undefined, { text: 'built' })).toBe('built');
    expect(buildStoredPreview(null, { a: 1 }, '{"a":1}')).toBe('{"a":1}');
    expect(buildStoredPreview(undefined, null)).toBe('');
  });
});

describe('isPreviewTruncated', () => {
  it('tells cut previews from whole ones', () => {
    expect(isPreviewTruncated(null)).toBe(false);
    expect(isPreviewTruncated('')).toBe(false);
    expect(isPreviewTruncated(buildPreview('a'.repeat(PREVIEW_MAX_LENGTH)))).toBe(false);
    expect(isPreviewTruncated(buildPreview('a'.repeat(PREVIEW_MAX_LENGTH + 1)))).toBe(true);
    expect(isPreviewTruncated(buildPreview(`${'a'.repeat(PREVIEW_MAX_LENGTH - 1)}\u{1F600}tail`))).toBe(true);
  });
});

describe('buildInputPreview (deprecated)', () => {
  it('uses the shared preview format', () => {
    const input = {
      messages: [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'an answer' },
        { role: 'user', content: 'second question' },
      ],
    };

    expect(buildInputPreview(input)).toBe('second question');
    expect(buildInputPreview(JSON.stringify(input))).toBe('second question');
  });

  it('unwraps a JSON-encoded scalar string instead of keeping its quotes', () => {
    expect(buildInputPreview('"plain scalar prompt"')).toBe('plain scalar prompt');
    expect(buildInputPreview('"truncated scalar promp')).toBe('"truncated scalar promp');
  });

  it('returns undefined where it did before', () => {
    expect(buildInputPreview(null)).toBeUndefined();
    expect(buildInputPreview('   ')).toBeUndefined();
    expect(buildInputPreview('{"messages": [{"role"')).toBeUndefined();
  });

  it('caps the preview at maxLength', () => {
    expect(buildInputPreview('abcdefghij', 5)).toBe('abcde…');
    expect(buildInputPreview('abcde', 5)).toBe('abcde');
    expect(buildInputPreview({ messages: [{ role: 'user', content: 'abcdefghij' }] }, 5)).toBe('abcde…');
    expect(buildInputPreview(JSON.stringify({ text: 'abcdefghij' }), 5)).toBe('abcde…');
    expect(buildInputPreview('"abcdefghij"', 5)).toBe('abcde…');
    expect(buildInputPreview('x'.repeat(150), 120)).toBe(`${'x'.repeat(120)}…`);
    expect(buildInputPreview('x'.repeat(150))).toBe(`${'x'.repeat(100)}…`);
  });
});

describe('toLightSpanRecord', () => {
  const span: SpanRecord = {
    traceId: 'trace-1',
    spanId: 'span-1',
    name: 'run',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: new Date('2026-01-01T00:00:01Z'),
    input: { messages: [{ role: 'user', content: 'question' }] },
    output: { text: 'answer' },
    error: { message: 'failed' },
    createdAt: new Date('2026-01-01T00:00:01Z'),
    updatedAt: null,
  };

  it('builds all three previews from the payloads', () => {
    expect(toLightSpanRecord(span)).toMatchObject({
      inputPreview: 'question',
      outputPreview: 'answer',
      errorPreview: 'failed',
    });
  });

  it('prefers stored previews, with an empty string meaning nothing to preview', () => {
    expect(
      toLightSpanRecord({ ...span, inputPreview: 'stored input', outputPreview: '', errorPreview: null }),
    ).toMatchObject({ inputPreview: 'stored input', outputPreview: null, errorPreview: 'failed' });
  });
});
