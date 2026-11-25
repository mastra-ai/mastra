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
    const messageList = new MessageList({
      threadId: 'thread-1',
      generateMessageId: context => (context?.role === 'assistant' ? 'response-2' : 'user-1'),
    });
    messageList.add({ role: 'user', content: 'hi' }, 'input');
    messageList.add(assistantMessage('response-1', 'first'), 'response');

    const nextMessageId = messageList.rotateResponseMessageId('response-1');
    messageList.add(assistantMessage(nextMessageId, 'second'), 'response');

    const assistantMessages = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistantMessages.map(message => message.id)).toEqual(['response-1', 'response-2']);
  });

  it('Given a seal target that is not in the list, When the id rotates, Then the tail is sealed anyway', () => {
    const messageList = new MessageList({
      threadId: 'thread-1',
      generateMessageId: context => (context?.role === 'assistant' ? 'response-2' : 'user-1'),
    });
    messageList.add({ role: 'user', content: 'hi' }, 'input');
    messageList.add(assistantMessage('response-1', 'first'), 'response');

    const nextMessageId = messageList.rotateResponseMessageId('never-persisted');
    messageList.add(assistantMessage(nextMessageId, 'second'), 'response');

    const assistantMessages = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistantMessages.map(message => message.id)).toEqual(['response-1', 'response-2']);
  });
});

describe('MessageList response message rotation with recalled history (#28565)', () => {
  function listWithRecalledReply() {
    const messageList = new MessageList({
      threadId: 'thread-1',
      generateMessageId: context => (context?.role === 'assistant' ? 'response-1' : 'user-1'),
    });
    messageList.add({ ...assistantMessage('previous-reply', 'from an earlier turn'), threadId: 'thread-1' }, 'memory');
    messageList.add({ role: 'user', content: 'hi' }, 'input');
    return messageList;
  }

  it('Given a recalled assistant reply and no response yet, When the id rotates, Then the recalled reply stays in memory untouched', () => {
    const messageList = listWithRecalledReply();

    messageList.rotateResponseMessageId('response-not-created-yet');

    expect(messageList.get.response.db().map(message => message.id)).toEqual([]);
    const previousReply = messageList.get.all.db().find(message => message.id === 'previous-reply');
    expect(messageList.get.remembered.db().map(message => message.id)).toContain('previous-reply');
    expect(previousReply?.content.metadata).toBeUndefined();
  });

  it('Given a recalled assistant reply and a response from this run, When the id rotates without a seal target, Then only the response is sealed', () => {
    const messageList = listWithRecalledReply();
    messageList.add(assistantMessage('response-1', 'this turn'), 'response');

    messageList.rotateResponseMessageId();

    expect(messageList.get.response.db().map(message => message.id)).toEqual(['response-1']);
    const byId = (id: string) => messageList.get.all.db().find(message => message.id === id);
    expect(byId('response-1')?.content.metadata?.mastra).toMatchObject({ responseBoundary: true });
    expect(byId('previous-reply')?.content.metadata).toBeUndefined();
  });
});
