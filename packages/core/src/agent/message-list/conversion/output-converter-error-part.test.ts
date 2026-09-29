import { describe, expect, it } from 'vitest';

import type { AIV5Type, UIMessageV4 } from '../types';
import {
  aiV4UIMessagesToAIV4CoreMessages,
  aiV5UIMessagesToAIV5ModelMessages,
  sanitizeAIV4UIMessages,
  sanitizeV5UIMessages,
} from './output-converter';

/**
 * The persisted terminal-error part is Mastra-only: it belongs in DB/UI history
 * but must never become provider content. These tests pin the two filters that
 * keep it out of model messages, and the message-level rule that drops an
 * assistant turn once nothing provider-safe is left.
 */

const ERROR_PART = { type: 'error', error: { name: 'APICallError', message: 'model exploded' } };

function makeV5Message(parts: AIV5Type.UIMessage['parts'], role: 'user' | 'assistant' = 'assistant') {
  return { id: `msg-${role}`, role, parts } as AIV5Type.UIMessage;
}

function makeV4Message(parts: UIMessageV4['parts'], role: 'user' | 'assistant' = 'assistant') {
  return { id: `msg-${role}`, role, parts } as unknown as UIMessageV4;
}

const asErrorPart = ERROR_PART as unknown as AIV5Type.UIMessage['parts'][number];
const asV4ErrorPart = ERROR_PART as unknown as UIMessageV4['parts'][number];

describe('sanitizeV5UIMessages — error parts', () => {
  it('removes the error part and keeps the remaining partial parts', () => {
    const result = sanitizeV5UIMessages(
      [makeV5Message([{ type: 'text', text: 'partial answer' }, asErrorPart])],
      'prompt',
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.parts).toEqual([{ type: 'text', text: 'partial answer' }]);
  });

  it('drops an error-only assistant message entirely', () => {
    const result = sanitizeV5UIMessages([makeV5Message([asErrorPart])], 'prompt');

    expect(result).toHaveLength(0);
  });

  it('drops the error-only assistant but keeps surrounding turns', () => {
    const result = sanitizeV5UIMessages(
      [
        makeV5Message([{ type: 'text', text: 'what is the weather?' }], 'user'),
        makeV5Message([asErrorPart]),
        makeV5Message([{ type: 'text', text: 'follow up' }], 'user'),
      ],
      'prompt',
    );

    expect(result.map(message => message.role)).toEqual(['user', 'user']);
    expect(JSON.stringify(result)).not.toContain('model exploded');
  });

  it('applies in every conversion mode', () => {
    for (const mode of ['response', 'prompt', 'prompt-with-suspended'] as const) {
      const result = sanitizeV5UIMessages(
        [makeV5Message([{ type: 'text', text: 'partial answer' }, asErrorPart])],
        mode,
      );

      expect(result[0]?.parts).toEqual([{ type: 'text', text: 'partial answer' }]);
    }
  });

  it('does not surface the error through model messages', () => {
    const uiMessages = [
      makeV5Message([{ type: 'text', text: 'what is the weather?' }], 'user'),
      makeV5Message([asErrorPart]),
    ];

    const modelMessages = aiV5UIMessagesToAIV5ModelMessages(uiMessages, [], 'prompt');

    expect(modelMessages.map(message => message.role)).toEqual(['user']);
    expect(JSON.stringify(modelMessages)).not.toContain('model exploded');
    expect(JSON.stringify(modelMessages)).not.toContain('"type":"error"');
  });

  it('keeps partial content in model messages while removing the error part', () => {
    const uiMessages = [makeV5Message([{ type: 'text', text: 'partial answer' }, asErrorPart])];

    const modelMessages = aiV5UIMessagesToAIV5ModelMessages(uiMessages, [], 'prompt');
    const serialized = JSON.stringify(modelMessages);

    expect(serialized).toContain('partial answer');
    expect(serialized).not.toContain('model exploded');
  });
});

describe('sanitizeAIV4UIMessages — error parts', () => {
  it('removes the error part and keeps the remaining partial parts', () => {
    const result = sanitizeAIV4UIMessages([makeV4Message([{ type: 'text', text: 'partial answer' }, asV4ErrorPart])]);

    expect(result).toHaveLength(1);
    expect(result[0]?.parts).toEqual([{ type: 'text', text: 'partial answer' }]);
  });

  it('drops an error-only assistant message entirely', () => {
    expect(sanitizeAIV4UIMessages([makeV4Message([asV4ErrorPart])])).toHaveLength(0);
  });

  it('still strips incomplete tool calls alongside error parts', () => {
    const result = sanitizeAIV4UIMessages([
      makeV4Message([
        { type: 'text', text: 'partial answer' },
        asV4ErrorPart,
        {
          type: 'tool-invocation',
          toolInvocation: { toolCallId: 'call-1', toolName: 'get_info', args: {}, state: 'call' },
        } as unknown as UIMessageV4['parts'][number],
      ]),
    ]);

    expect(result[0]?.parts).toEqual([{ type: 'text', text: 'partial answer' }]);
  });

  it('does not surface the error through core messages', () => {
    const coreMessages = aiV4UIMessagesToAIV4CoreMessages([
      makeV4Message([{ type: 'text', text: 'what is the weather?' }], 'user'),
      makeV4Message([asV4ErrorPart]),
    ]);

    expect(coreMessages.map(message => message.role)).toEqual(['user']);
    expect(JSON.stringify(coreMessages)).not.toContain('model exploded');
  });
});
