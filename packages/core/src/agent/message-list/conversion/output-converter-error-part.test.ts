import { describe, expect, it } from 'vitest';

import type { AIV5Type } from '../types';
import { aiV5UIMessagesToAIV5ModelMessages, sanitizeV5UIMessages } from './output-converter';

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

const asErrorPart = ERROR_PART as unknown as AIV5Type.UIMessage['parts'][number];
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
