import { describe, expect, it } from 'vitest';

import type { MastraDBMessage, MastraMessagePart } from '../state/types';
import { isPersistedCopy } from './utils';

function assistant(parts: MastraMessagePart[], id = 'assistant-message'): MastraDBMessage {
  return { id, role: 'assistant', createdAt: new Date(0), content: { format: 2, parts } };
}

function reasoning(itemId: string): MastraMessagePart {
  return {
    type: 'reasoning',
    reasoning: '',
    details: [{ type: 'text', text: '' }],
    providerMetadata: { openai: { itemId } },
  };
}

const workingMemoryCall: MastraMessagePart = {
  type: 'tool-invocation',
  toolInvocation: {
    state: 'result',
    toolCallId: 'call-working-memory',
    toolName: 'updateWorkingMemory',
    args: { memory: 'likes tea' },
    result: { success: true },
  },
};

// Memory cleans a message when it saves it. The stored copy must still be recognized as the
// live message so MessageList does not re-add it with the same provider item ids. (#29380)
describe('isPersistedCopy', () => {
  it('matches a stored copy whose text lost surrounding whitespace', () => {
    const live = assistant([reasoning('rs_example'), { type: 'text', text: '  hello\n' }]);
    const stored = assistant([reasoning('rs_example'), { type: 'text', text: 'hello' }]);

    expect(isPersistedCopy(live, stored)).toBe(true);
  });

  it('matches a stored copy of whitespace-only text', () => {
    const live = assistant([reasoning('rs_example'), { type: 'text', text: '\n' }]);
    const stored = assistant([reasoning('rs_example'), { type: 'text', text: '' }]);

    expect(isPersistedCopy(live, stored)).toBe(true);
  });

  it('matches a stored copy without working-memory tags or tool steps', () => {
    const live = assistant([
      { type: 'step-start' },
      reasoning('rs_memory_step'),
      workingMemoryCall,
      { type: 'step-start' },
      reasoning('rs_example'),
      { type: 'text', text: 'hello <working_memory>likes tea</working_memory>' },
    ]);
    // Memory drops a step whose only other content was the working-memory call (#22798).
    const stored = assistant([{ type: 'step-start' }, reasoning('rs_example'), { type: 'text', text: 'hello' }]);

    expect(isPersistedCopy(live, stored)).toBe(true);
  });

  it('does not match when whitespace inside the text differs', () => {
    const live = assistant([{ type: 'text', text: 'hello  world' }]);
    const stored = assistant([{ type: 'text', text: 'hello world' }]);

    expect(isPersistedCopy(live, stored)).toBe(false);
  });

  it('does not match a message with a different id', () => {
    const live = assistant([{ type: 'text', text: 'hello\n' }]);
    const stored = assistant([{ type: 'text', text: 'hello' }], 'other-message');

    expect(isPersistedCopy(live, stored)).toBe(false);
  });

  it('does not match when a reasoning part has a different provider item id', () => {
    const live = assistant([reasoning('rs_live'), { type: 'text', text: 'hello\n' }]);
    const stored = assistant([reasoning('rs_stored'), { type: 'text', text: 'hello' }]);

    expect(isPersistedCopy(live, stored)).toBe(false);
  });

  it('does not match when a text part has a different provider item id', () => {
    const live = assistant([{ type: 'text', text: 'hello\n', providerMetadata: { openai: { itemId: 'msg_live' } } }]);
    const stored = assistant([{ type: 'text', text: 'hello', providerMetadata: { openai: { itemId: 'msg_stored' } } }]);

    expect(isPersistedCopy(live, stored)).toBe(false);
  });

  it('does not match when the stored copy has an extra part', () => {
    const live = assistant([{ type: 'text', text: 'hello\n' }]);
    const stored = assistant([
      { type: 'text', text: 'hello' },
      { type: 'text', text: 'more' },
    ]);

    expect(isPersistedCopy(live, stored)).toBe(false);
  });
});
