import { describe, it, expect } from 'vitest';
import { SpanType } from '../../../observability/types';
import {
  BATCH_DELETE_TRACES_MAX_IDS,
  batchDeleteTracesArgsSchema,
  buildSpanInputPreview,
  buildSpanOutputPreview,
  extractBranchSpans,
  getTraceLightResponseSchema,
  lightSpanRecordSchema,
  PREVIEW_MAX_LENGTH,
} from './tracing';

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

const agentInput = (input: unknown, metadata?: Record<string, unknown>) =>
  buildSpanInputPreview({ spanType: SpanType.AGENT_RUN, input, metadata });

describe('buildSpanInputPreview', () => {
  it('previews an agent string prompt as-is', () => {
    expect(agentInput('plain prompt text')).toBe('plain prompt text');
  });

  it('joins user message text and ignores assistant turns', () => {
    const input = {
      messages: [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'an answer nobody previews' },
        { role: 'user', content: 'second question' },
      ],
    };

    expect(agentInput(input)).toBe('first question | second question');
    expect(buildSpanInputPreview({ spanType: SpanType.MODEL_GENERATION, input })).toBe(
      'first question | second question',
    );
  });

  it('reads text parts out of a message list', () => {
    const input = [{ role: 'user', content: [{ type: 'text', text: 'part one' }, { type: 'image' }] }];

    expect(agentInput(input)).toBe('part one');
  });

  it('accepts the raw JSON string a store hands back', () => {
    const input = JSON.stringify({ messages: [{ role: 'user', content: 'from the wire' }] });

    expect(agentInput(input)).toBe('from the wire');
  });

  it('unwraps a JSON-encoded scalar string instead of keeping its quotes', () => {
    expect(agentInput('"plain scalar prompt"')).toBe('plain scalar prompt');
    expect(agentInput('"truncated scalar promp')).toBe('"truncated scalar promp');
  });

  it('previews the resume data of a resumed agent run as JSON', () => {
    expect(agentInput({ resumeData: { approved: true } }, { resumed: true })).toBe('{"resumeData":{"approved":true}}');
  });

  it('previews workflow, tool and custom inputs as JSON', () => {
    expect(buildSpanInputPreview({ spanType: SpanType.WORKFLOW_RUN, input: { city: 'Paris' } })).toBe(
      '{"city":"Paris"}',
    );
    expect(buildSpanInputPreview({ spanType: SpanType.TOOL_CALL, input: JSON.stringify({ query: 'lookup' }) })).toBe(
      '{"query":"lookup"}',
    );
    expect(buildSpanInputPreview({ spanType: SpanType.GENERIC, input: [1, 2] })).toBe('[1,2]');
  });

  it('previews malformed JSON as empty, never leaking message text', () => {
    const contentFirst = JSON.stringify({
      messages: [
        { content: 'summarize my medical report', role: 'user' },
        { content: 'assistant text that must not leak', role: 'assistant' },
      ],
    });

    expect(agentInput(contentFirst.slice(0, 80))).toBeUndefined();
    expect(agentInput('{"messages": [{"role"')).toBeUndefined();
  });

  it('truncates past the max length with an ellipsis', () => {
    const preview = agentInput({ messages: [{ role: 'user', content: 'a'.repeat(400) }] });

    expect(preview).toHaveLength(PREVIEW_MAX_LENGTH + 1);
    expect(preview?.endsWith('…')).toBe(true);
  });

  it('never cuts a surrogate pair in half', () => {
    const preview = agentInput(`${'a'.repeat(PREVIEW_MAX_LENGTH - 1)}😀tail`);

    expect(preview).toBe(`${'a'.repeat(PREVIEW_MAX_LENGTH - 1)}…`);
  });

  it('returns undefined for empty or missing input', () => {
    expect(agentInput(null)).toBeUndefined();
    expect(agentInput(undefined)).toBeUndefined();
    expect(agentInput('   ')).toBeUndefined();
    expect(agentInput({ messages: [{ role: 'assistant', content: 'no user turn' }] })).toBeUndefined();
  });
});

describe('buildSpanOutputPreview', () => {
  it.each([SpanType.AGENT_RUN, SpanType.MODEL_GENERATION, SpanType.MODEL_STEP, SpanType.MODEL_INFERENCE])(
    'previews the result text of a %s span',
    spanType => {
      expect(buildSpanOutputPreview({ spanType, output: { text: 'the answer', object: { a: 1 } } })).toBe('the answer');
    },
  );

  it('previews an interrupted run by its status', () => {
    expect(
      buildSpanOutputPreview({ spanType: SpanType.AGENT_RUN, output: { status: 'suspended', toolName: 'approve' } }),
    ).toBe('suspended');
  });

  it('accepts the raw JSON string a store hands back', () => {
    expect(buildSpanOutputPreview({ spanType: SpanType.AGENT_RUN, output: JSON.stringify({ text: 'wire' }) })).toBe(
      'wire',
    );
  });

  it('previews strings as-is and other outputs as JSON', () => {
    expect(buildSpanOutputPreview({ spanType: SpanType.TOOL_CALL, output: 'done' })).toBe('done');
    expect(buildSpanOutputPreview({ spanType: SpanType.WORKFLOW_RUN, output: { temp: 21 } })).toBe('{"temp":21}');
    expect(buildSpanOutputPreview({ spanType: SpanType.AGENT_RUN, output: { object: { a: 1 } } })).toBe(
      '{"object":{"a":1}}',
    );
  });

  it('truncates past the max length with an ellipsis', () => {
    const preview = buildSpanOutputPreview({ spanType: SpanType.AGENT_RUN, output: { text: 'b'.repeat(400) } });

    expect(preview).toHaveLength(PREVIEW_MAX_LENGTH + 1);
    expect(preview?.endsWith('…')).toBe(true);
  });

  it('returns undefined for missing or malformed output', () => {
    expect(buildSpanOutputPreview({ spanType: SpanType.AGENT_RUN, output: null })).toBeUndefined();
    expect(buildSpanOutputPreview({ spanType: SpanType.AGENT_RUN, output: '{"text": "cut' })).toBeUndefined();
  });

  it('shows the run status when a suspended workflow has no output yet', () => {
    expect(
      buildSpanOutputPreview({ spanType: SpanType.WORKFLOW_RUN, output: null, attributes: { status: 'suspended' } }),
    ).toBe('suspended');
    expect(
      buildSpanOutputPreview({ spanType: SpanType.WORKFLOW_RUN, output: null, attributes: '{"status":"suspended"}' }),
    ).toBe('suspended');
  });

  it('prefers the output over the status and ignores running or successful runs without output', () => {
    expect(
      buildSpanOutputPreview({
        spanType: SpanType.WORKFLOW_RUN,
        output: { approved: true },
        attributes: { status: 'success' },
      }),
    ).toBe('{"approved":true}');
    expect(
      buildSpanOutputPreview({ spanType: SpanType.WORKFLOW_RUN, output: null, attributes: { status: 'running' } }),
    ).toBeUndefined();
  });
});
