import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage, MastraMessagePart } from '../state/types';

const emptyReasoning: MastraMessagePart = { type: 'reasoning', reasoning: '', details: [] };

function project(parts: MastraMessagePart[]) {
  const message: MastraDBMessage = {
    id: 'assistant-message',
    role: 'assistant',
    createdAt: new Date('2026-09-06T00:00:00.000Z'),
    content: { format: 2, parts },
  };
  return new MessageList().add([message], 'memory').get.all.aiV6.ui();
}

describe('MessageList V6 empty reasoning', () => {
  it('keeps an assistant message whose empty reasoning part is omitted by V5', () => {
    expect(project([emptyReasoning])).toMatchObject([{ id: 'assistant-message', role: 'assistant', parts: [] }]);
  });

  it('keeps text and tool results in order around omitted reasoning parts', () => {
    const result = project([
      emptyReasoning,
      { type: 'text', text: 'Before' },
      emptyReasoning,
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'search-1',
          toolName: 'search',
          args: { query: 'example' },
          result: { found: true },
        },
      },
      { type: 'text', text: 'After' },
      emptyReasoning,
    ]);

    expect(result[0]?.parts).toEqual([
      { type: 'text', text: 'Before' },
      {
        type: 'tool-search',
        toolCallId: 'search-1',
        providerExecuted: undefined,
        state: 'output-available',
        input: { query: 'example' },
        output: { found: true },
      },
      { type: 'text', text: 'After' },
    ]);
  });

  it('preserves native tool approval state next to empty reasoning', () => {
    const result = project([
      emptyReasoning,
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'approval-requested',
          toolCallId: 'search-2',
          toolName: 'search',
          args: { query: 'example' },
          approval: { id: 'approval-2' },
        },
      },
    ]);

    expect(result[0]?.parts).toEqual([
      {
        type: 'tool-search',
        toolCallId: 'search-2',
        providerExecuted: undefined,
        state: 'approval-requested',
        input: { query: 'example' },
        approval: { id: 'approval-2' },
      },
    ]);
  });

  it('preserves nonempty reasoning and its metadata', () => {
    const result = project([
      emptyReasoning,
      {
        type: 'reasoning',
        reasoning: 'Keep this reasoning',
        details: [{ type: 'text', text: 'Keep this reasoning' }],
        providerMetadata: { example: { signature: 'signature-1' } },
        createdAt: 123,
      },
    ]);

    expect(result[0]?.parts).toEqual([
      {
        type: 'reasoning',
        text: 'Keep this reasoning',
        state: 'done',
        providerMetadata: { example: { signature: 'signature-1' }, mastra: { createdAt: 123 } },
      },
    ]);
  });

  it('preserves reasoning that has details but no summary text', () => {
    const result = project([
      { type: 'reasoning', reasoning: '', details: [{ type: 'text', text: 'From details' }] },
      { type: 'reasoning', reasoning: '', details: [{ type: 'redacted', data: 'opaque-data' }] },
    ]);

    expect(result[0]?.parts).toEqual([
      { type: 'reasoning', text: 'From details', state: 'done' },
      { type: 'reasoning', text: '', state: 'done' },
    ]);
  });
});
