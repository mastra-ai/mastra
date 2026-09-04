import type { ModelMessage } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { pairOrphanedToolCalls, sanitizeOrphanedToolPairs } from './provider-compat';

const assistantWithToolCalls = (...callIds: string[]): ModelMessage => ({
  role: 'assistant',
  content: callIds.map(toolCallId => ({
    type: 'tool-call',
    toolCallId,
    toolName: 'fetch',
    input: { url: `https://example.com/${toolCallId}` },
  })),
});

const toolMessageWithResults = (...callIds: string[]): ModelMessage => ({
  role: 'tool',
  content: callIds.map(toolCallId => ({
    type: 'tool-result',
    toolCallId,
    toolName: 'fetch',
    output: { type: 'text', value: `result-${toolCallId}` },
  })),
});

describe('sanitizeOrphanedToolPairs', () => {
  it('returns empty input untouched', () => {
    expect(sanitizeOrphanedToolPairs([])).toEqual([]);
  });

  it('passes through string-content messages unchanged', () => {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual(messages);
  });

  it('preserves a valid tool_use → tool_result pair', () => {
    const messages: ModelMessage[] = [assistantWithToolCalls('A'), toolMessageWithResults('A')];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual(messages);
  });

  it('drops a tool_result with no preceding tool_use', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'hi' },
      toolMessageWithResults('orphan-A'),
      { role: 'assistant', content: 'ok' },
    ];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'ok' },
    ]);
  });

  it('drops a tool_result after a string-content assistant message', () => {
    const messages: ModelMessage[] = [
      { role: 'assistant', content: 'no tool call here' },
      toolMessageWithResults('orphan-A'),
      { role: 'user', content: 'next' },
    ];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual([
      { role: 'assistant', content: 'no tool call here' },
      { role: 'user', content: 'next' },
    ]);
  });

  it('drops an assistant message that contains only an orphan tool_use', () => {
    const messages: ModelMessage[] = [assistantWithToolCalls('lonely-A'), { role: 'user', content: 'next question' }];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual([{ role: 'user', content: 'next question' }]);
  });

  it('keeps text on an assistant message after dropping its orphan tool_use', () => {
    const assistant: ModelMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'thinking out loud' },
        { type: 'tool-call', toolCallId: 'orphan', toolName: 'fetch', input: {} },
      ],
    };

    expect(sanitizeOrphanedToolPairs([assistant, { role: 'user', content: 'next' }])).toEqual([
      { role: 'assistant', content: [{ type: 'text', text: 'thinking out loud' }] },
      { role: 'user', content: 'next' },
    ]);
  });

  it('keeps the matched call and drops the orphan in a parallel tool group (missing result)', () => {
    const messages: ModelMessage[] = [assistantWithToolCalls('A', 'B'), toolMessageWithResults('A')];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual([assistantWithToolCalls('A'), toolMessageWithResults('A')]);
  });

  it('drops orphan tool_results in a tool message that has a mix of valid and orphan ids', () => {
    const messages: ModelMessage[] = [assistantWithToolCalls('A'), toolMessageWithResults('A', 'B')];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual([assistantWithToolCalls('A'), toolMessageWithResults('A')]);
  });

  it('preserves a deferred provider-executed tool_use with no matching tool_result', () => {
    // Anthropic non-deterministically defers server-side tools (e.g. web_search).
    // The tool_use must survive in history so the provider can resume on the next call.
    const assistant: ModelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'srv-deferred',
          toolName: 'web_search',
          input: { query: 'x' },
          providerExecuted: true,
        } as any,
      ],
    };

    const messages: ModelMessage[] = [assistant, { role: 'user', content: 'continue' }];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual(messages);
  });

  it('preserves inline provider-executed tool_result on assistant content', () => {
    // For provider-executed tools (e.g. Anthropic web_search) tool_use and tool_result
    // live in the same assistant message; only tool_call parts on assistants are subject
    // to the next-message pairing rule.
    const assistant: ModelMessage = {
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'srv-1', toolName: 'web_search', input: { q: 'x' } } as any,
        { type: 'tool-result', toolCallId: 'srv-1', toolName: 'web_search', output: 'results' } as any,
        { type: 'text', text: 'done' },
      ],
    };

    expect(sanitizeOrphanedToolPairs([assistant, { role: 'user', content: 'next' }])).toEqual([
      assistant,
      { role: 'user', content: 'next' },
    ]);
  });

  it('cleans multiple orphans across a long multi-turn chain', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'turn 1' },
      assistantWithToolCalls('t1-A', 't1-B'),
      toolMessageWithResults('t1-A'),
      { role: 'user', content: 'turn 2' },
      assistantWithToolCalls('t2-A'),
      toolMessageWithResults('t2-A'),
      { role: 'user', content: 'turn 3' },
      toolMessageWithResults('stray'),
      { role: 'assistant', content: 'final' },
    ];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual([
      { role: 'user', content: 'turn 1' },
      assistantWithToolCalls('t1-A'),
      toolMessageWithResults('t1-A'),
      { role: 'user', content: 'turn 2' },
      assistantWithToolCalls('t2-A'),
      toolMessageWithResults('t2-A'),
      { role: 'user', content: 'turn 3' },
      { role: 'assistant', content: 'final' },
    ]);
  });

  it('drops orphans across consecutive assistant messages with no tool message between them', () => {
    const messages: ModelMessage[] = [
      assistantWithToolCalls('orphan-1'),
      { role: 'assistant', content: 'reconsidered' },
      { role: 'user', content: 'continue' },
    ];

    expect(sanitizeOrphanedToolPairs(messages)).toEqual([
      { role: 'assistant', content: 'reconsidered' },
      { role: 'user', content: 'continue' },
    ]);
  });
});

const pendingResult = (toolCallId: string) => ({
  type: 'tool-result',
  toolCallId,
  toolName: 'fetch',
  output: { type: 'json', value: { status: 'pending' } },
});

describe('pairOrphanedToolCalls', () => {
  it('keeps a suspended tool call and pairs it with a pending result', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'transfer 1000000' },
      assistantWithToolCalls('A'),
      { role: 'user', content: 'thanks' },
    ];

    expect(pairOrphanedToolCalls(messages)).toEqual([
      { role: 'user', content: 'transfer 1000000' },
      assistantWithToolCalls('A'),
      { role: 'tool', content: [pendingResult('A')] },
      { role: 'user', content: 'thanks' },
    ]);
  });

  it('leaves an already-paired tool call untouched', () => {
    const messages: ModelMessage[] = [assistantWithToolCalls('A'), toolMessageWithResults('A')];

    expect(pairOrphanedToolCalls(messages)).toEqual(messages);
  });

  it('fills in only the missing half of a parallel tool-call group', () => {
    const messages: ModelMessage[] = [assistantWithToolCalls('A', 'B'), toolMessageWithResults('A')];

    expect(pairOrphanedToolCalls(messages)).toEqual([
      assistantWithToolCalls('A', 'B'),
      { role: 'tool', content: [...toolMessageWithResults('A').content, pendingResult('B')] },
    ]);
  });

  it('does not resolve deferred provider-executed calls', () => {
    const messages: ModelMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'web-1', toolName: 'web_search', input: {}, providerExecuted: true },
        ],
      },
    ];

    expect(pairOrphanedToolCalls(messages)).toEqual(messages);
  });

  it('still drops a tool_result whose tool_use is gone', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'hi' },
      toolMessageWithResults('orphan-A'),
      { role: 'assistant', content: 'ok' },
    ];

    expect(pairOrphanedToolCalls(messages)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'ok' },
    ]);
  });

  it('never emits a tool call without a matching result', () => {
    const messages: ModelMessage[] = [
      assistantWithToolCalls('A'),
      { role: 'user', content: 'turn 2' },
      assistantWithToolCalls('B', 'C'),
      toolMessageWithResults('B'),
      { role: 'user', content: 'turn 3' },
    ];

    const result = pairOrphanedToolCalls(messages);
    const callIds = result.flatMap(m =>
      Array.isArray(m.content) ? m.content.filter(p => p.type === 'tool-call').map(p => p.toolCallId) : [],
    );
    const resultIds = result.flatMap(m =>
      Array.isArray(m.content) ? m.content.filter(p => p.type === 'tool-result').map(p => p.toolCallId) : [],
    );

    expect(callIds).toEqual(['A', 'B', 'C']);
    expect(resultIds.sort()).toEqual(['A', 'B', 'C']);
  });
});
