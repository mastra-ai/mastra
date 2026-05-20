import { describe, expect, it } from 'vitest';
import type { MastraUIMessage } from '../lib/ai-sdk';
import { resolveInitialMessagesSync } from './initial-messages-sync';

const message = (id: string): MastraUIMessage =>
  ({ id, role: 'assistant', parts: [{ type: 'text', text: id }] }) as MastraUIMessage;

describe('resolveInitialMessagesSync', () => {
  it('keeps locally streamed messages when a same-thread initialMessages refresh is stale', () => {
    const currentMessages = [message('user-1'), message('assistant-streaming')];
    const formattedMessages = [message('user-1')];

    expect(resolveInitialMessagesSync({ currentMessages, formattedMessages, threadChanged: false })).toBe(
      currentMessages,
    );
  });

  it('uses fetched messages when they catch up', () => {
    const currentMessages = [message('user-1')];
    const formattedMessages = [message('user-1'), message('assistant-persisted')];

    expect(resolveInitialMessagesSync({ currentMessages, formattedMessages, threadChanged: false })).toBe(
      formattedMessages,
    );
  });

  it('does not preserve local messages across thread changes', () => {
    const currentMessages = [message('old-user'), message('old-assistant')];
    const formattedMessages = [message('new-user')];

    expect(resolveInitialMessagesSync({ currentMessages, formattedMessages, threadChanged: true })).toBe(
      formattedMessages,
    );
  });
});
