import { describe, it, expect } from 'vitest';
import { traceToItem, tracesToItems } from '../trace-to-item';
import type { TraceSpan, TraceFeedback } from '../trace-to-item';

function makeSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    traceId: 'trace-1',
    spanId: 'span-1',
    parentSpanId: null,
    name: 'agent_run',
    spanType: 'agent_run',
    startedAt: new Date('2025-04-20T10:00:00Z'),
    endedAt: new Date('2025-04-20T10:05:00Z'),
    input: { messages: [{ role: 'user', content: 'fix the bug in auth.ts' }] },
    output: null,
    error: null,
    attributes: {},
    metadata: {},
    requestContext: {
      mode: 'build',
      modelId: 'anthropic/claude-sonnet-4-20250514',
      projectPath: '/test/project',
      projectName: 'my-project',
      gitBranch: 'main',
    },
    threadId: 'thread-1',
    resourceId: 'resource-1',
    ...overrides,
  };
}

function makeToolSpan(name: string, traceId = 'trace-1'): TraceSpan {
  return makeSpan({
    traceId,
    spanId: `span-tool-${name}`,
    parentSpanId: 'span-1',
    name,
    spanType: 'tool_call',
    input: null,
    requestContext: null,
  });
}

describe('traceToItem', () => {
  it('converts a basic trace with user message', () => {
    const spans = [makeSpan()];
    const item = traceToItem(spans);

    expect(item).not.toBeNull();
    expect(item!.input.userMessage).toBe('fix the bug in auth.ts');
    expect(item!.environment.mode).toBe('build');
    expect(item!.environment.modelId).toBe('anthropic/claude-sonnet-4-20250514');
    expect(item!.environment.harnessState.projectPath).toBe('/test/project');
  });

  it('returns null when no root agent_run span exists', () => {
    const span = makeSpan({ spanType: 'tool_call', parentSpanId: 'parent-1' });
    expect(traceToItem([span])).toBeNull();
  });

  it('returns null when user message cannot be extracted', () => {
    const span = makeSpan({ input: null });
    expect(traceToItem([span])).toBeNull();
  });

  it('extracts user message from plain string input', () => {
    const span = makeSpan({ input: 'hello world' as unknown as Record<string, unknown> });
    const item = traceToItem([span]);
    expect(item).not.toBeNull();
    expect(item!.input.userMessage).toBe('hello world');
  });

  it('extracts user message from structured content parts', () => {
    const span = makeSpan({
      input: {
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'part one' }, { type: 'text', text: ' part two' }] },
        ],
      },
    });
    const item = traceToItem([span]);
    expect(item!.input.userMessage).toBe('part one part two');
  });

  it('uses the last user message from multiple messages', () => {
    const span = makeSpan({
      input: {
        messages: [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'response' },
          { role: 'user', content: 'second message' },
        ],
      },
    });
    const item = traceToItem([span]);
    expect(item!.input.userMessage).toBe('second message');
  });

  it('handles "null" string parentSpanId as root', () => {
    const span = makeSpan({ parentSpanId: 'null' });
    const item = traceToItem([span]);
    expect(item).not.toBeNull();
  });

  it('attaches feedback sentiment', () => {
    const spans = [makeSpan()];
    const feedback: TraceFeedback = { traceId: 'trace-1', feedbackType: 'thumbs', value: 'up' };
    const item = traceToItem(spans, {}, feedback);
    expect(item!.metadata.sourceFeedback).toBe('positive');
  });

  it('maps numeric feedback correctly', () => {
    const spans = [makeSpan()];
    const positive = traceToItem(spans, {}, { traceId: 'trace-1', feedbackType: 'rating', value: 0.8 });
    expect(positive!.metadata.sourceFeedback).toBe('positive');

    const negative = traceToItem(spans, {}, { traceId: 'trace-1', feedbackType: 'rating', value: 0.3 });
    expect(negative!.metadata.sourceFeedback).toBe('negative');
  });

  it('infers category from tool usage patterns', () => {
    // code-change: has execute_command + string_replace_lsp
    const codeChange = traceToItem([
      makeSpan(),
      makeToolSpan('execute_command'),
      makeToolSpan('string_replace_lsp'),
    ]);
    expect(codeChange!.metadata.category).toBe('code-change');

    // exploration: only read tools
    const exploration = traceToItem([
      makeSpan(),
      makeToolSpan('view'),
      makeToolSpan('search_content'),
    ]);
    expect(exploration!.metadata.category).toBe('exploration');

    // planning: has submit_plan
    const planning = traceToItem([
      makeSpan(),
      makeToolSpan('submit_plan'),
    ]);
    expect(planning!.metadata.category).toBe('planning');
  });

  it('applies option overrides', () => {
    const spans = [makeSpan()];
    const item = traceToItem(spans, {
      category: 'custom-cat',
      difficulty: 'hard',
      tags: ['regression'],
      description: 'test desc',
    });
    expect(item!.metadata.category).toBe('custom-cat');
    expect(item!.metadata.difficulty).toBe('hard');
    expect(item!.metadata.tags).toEqual(['regression']);
    expect(item!.metadata.description).toBe('test desc');
  });

  it('extracts memory from rememberedMessages', () => {
    const span = makeSpan({
      input: {
        messages: [{ role: 'user', content: 'fix it' }],
        rememberedMessages: [
          { id: 'm1', role: 'user', content: { format: 2, parts: [] }, createdAt: new Date() },
          { id: 'm2', role: 'assistant', content: { format: 2, parts: [] }, createdAt: new Date() },
        ],
      },
    });
    const item = traceToItem([span]);
    expect(item!.memory).toBeDefined();
    expect(item!.memory!.messages).toHaveLength(2);
  });

  it('skips memory when includeMemory is false', () => {
    const span = makeSpan({
      input: {
        messages: [{ role: 'user', content: 'fix it' }],
        rememberedMessages: [
          { id: 'm1', role: 'user', content: { format: 2, parts: [] }, createdAt: new Date() },
        ],
      },
    });
    const item = traceToItem([span], { includeMemory: false });
    expect(item!.memory).toBeUndefined();
  });

  it('extracts environment from attributes fallback', () => {
    const span = makeSpan({
      requestContext: null,
      attributes: { mode: 'plan', 'ai.model.id': 'openai/gpt-4o' },
    });
    const item = traceToItem([span]);
    expect(item!.environment.mode).toBe('plan');
    expect(item!.environment.modelId).toBe('openai/gpt-4o');
  });
});

describe('tracesToItems', () => {
  it('batch converts multiple traces', () => {
    const trace1 = [makeSpan({ traceId: 't1' })];
    const trace2 = [makeSpan({ traceId: 't2', input: { messages: [{ role: 'user', content: 'second' }] } })];
    const items = tracesToItems([trace1, trace2]);
    expect(items).toHaveLength(2);
  });

  it('skips invalid traces', () => {
    const valid = [makeSpan({ traceId: 't1' })];
    const invalid = [makeSpan({ traceId: 't2', input: null })]; // no user message
    const items = tracesToItems([valid, invalid]);
    expect(items).toHaveLength(1);
  });

  it('applies feedback from map', () => {
    const traces = [[makeSpan({ traceId: 't1' })]];
    const feedbackMap = new Map([
      ['t1', { traceId: 't1', feedbackType: 'thumbs', value: 'down' } as TraceFeedback],
    ]);
    const items = tracesToItems(traces, {}, feedbackMap);
    expect(items[0]!.metadata.sourceFeedback).toBe('negative');
  });
});
