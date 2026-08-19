import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function assistantMessage(id: string, text: string): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
  };
}

describe('MessageList response message rotation', () => {
  it('Given a rotated response id, When the next response arrives, Then it lands in its own message', () => {
    const messageList = new MessageList({ threadId: 'thread-1' });
    messageList.add({ role: 'user', content: 'hi' }, 'input');
    messageList.add(assistantMessage('response-1', 'first'), 'response');

    const nextMessageId = messageList.rotateResponseMessageId(() => 'response-2', 'response-1');
    messageList.add(assistantMessage(nextMessageId, 'second'), 'response');

    const assistantMessages = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistantMessages.map(message => message.id)).toEqual(['response-1', 'response-2']);
  });

  it('Given a seal target that is not in the list, When the id rotates, Then the tail is sealed anyway', () => {
    const messageList = new MessageList({ threadId: 'thread-1' });
    messageList.add({ role: 'user', content: 'hi' }, 'input');
    messageList.add(assistantMessage('response-1', 'first'), 'response');

    const nextMessageId = messageList.rotateResponseMessageId(() => 'response-2', 'never-persisted');
    messageList.add(assistantMessage(nextMessageId, 'second'), 'response');

    const assistantMessages = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistantMessages.map(message => message.id)).toEqual(['response-1', 'response-2']);
  });
});
