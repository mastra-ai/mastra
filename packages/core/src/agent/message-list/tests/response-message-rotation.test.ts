import { describe, expect, it } from 'vitest';

import { createSignal } from '../../signals';
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
  it.each([
    ['Given a rotated response id, When the next response arrives, Then it lands in its own message', 'response-1'],
    [
      'Given a seal target that is not in the list, When the id rotates, Then the tail is sealed anyway',
      'never-persisted',
    ],
  ] as const)('%s', (_title, input) => {
    const messageList = new MessageList({
      threadId: 'thread-1',
      generateMessageId: context => (context?.role === 'assistant' ? 'response-2' : 'user-1'),
    });
    messageList.add({ role: 'user', content: 'hi' }, 'input');
    messageList.add(assistantMessage('response-1', 'first'), 'response');

    const nextMessageId = messageList.rotateResponseMessageId(input);
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

  it('Given a recalled assistant reply and no response yet, When a signal rotates the id, Then the recalled reply stays in memory unsaved and the response gets its own row', () => {
    const messageList = listWithRecalledReply();

    const nextMessageId = messageList.rotateResponseMessageId('response-not-created-yet');
    messageList.addSignal(createSignal({ type: 'state', contents: 'state 1' }));
    messageList.add({ ...assistantMessage(nextMessageId, 'this turn'), threadId: 'thread-1' }, 'response');

    expect(messageList.get.response.db().map(message => message.id)).toEqual([nextMessageId]);
    expect(messageList.get.remembered.db().map(message => message.id)).toContain('previous-reply');
    const previousReply = messageList.get.all.db().find(message => message.id === 'previous-reply');
    expect(previousReply?.content.parts).toEqual([{ type: 'text', text: 'from an earlier turn' }]);
    expect(messageList.drainUnsavedMessages().map(message => message.id)).not.toContain('previous-reply');
  });

  it('Given a recalled assistant reply at the end of the list, When the id rotates with nothing between, Then the next response still gets its own row after it', () => {
    const messageList = new MessageList({
      threadId: 'thread-1',
      generateMessageId: context => (context?.role === 'assistant' ? 'response-1' : 'user-1'),
    });
    messageList.add({ role: 'user', content: 'earlier question' }, 'memory');
    messageList.add({ ...assistantMessage('previous-reply', 'from an earlier turn'), threadId: 'thread-1' }, 'memory');

    const nextMessageId = messageList.rotateResponseMessageId('response-not-created-yet');
    messageList.add({ ...assistantMessage(nextMessageId, 'this turn'), threadId: 'thread-1' }, 'response');

    const assistants = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistants.map(message => message.id)).toEqual(['previous-reply', 'response-1']);
    expect(assistants[0]?.content.parts).toEqual([{ type: 'text', text: 'from an earlier turn' }]);
    expect(messageList.get.response.db().map(message => message.id)).toEqual(['response-1']);
  });

  it('Given a response from this run that went through serialization, When the id rotates without a seal target, Then that response is sealed and the recalled reply stays out of the response', () => {
    const original = listWithRecalledReply();
    original.add({ ...assistantMessage('response-1', 'this turn'), threadId: 'thread-1' }, 'response');
    const messageList = new MessageList({
      threadId: 'thread-1',
      generateMessageId: context => (context?.role === 'assistant' ? 'response-2' : 'user-1'),
    }).deserialize(original.serialize());

    const nextMessageId = messageList.rotateResponseMessageId();
    messageList.add({ ...assistantMessage(nextMessageId, 'next step'), threadId: 'thread-1' }, 'response');

    expect(
      messageList.get.response
        .db()
        .map(message => message.id)
        .sort(),
    ).toEqual(['response-1', 'response-2']);
    const byId = (id: string) => messageList.get.all.db().find(message => message.id === id);
    expect(byId('response-1')?.content.metadata?.mastra).toMatchObject({ responseBoundary: true });
    expect(messageList.get.remembered.db().map(message => message.id)).toContain('previous-reply');
  });
});

describe('MessageList response message rotation with an assistant-ending input', () => {
  it('Given input that ends with an assistant message and no response yet, When the id rotates, Then the input message stays input and the next response gets its own row', () => {
    const messageList = new MessageList({
      threadId: 'thread-1',
      generateMessageId: context => (context?.role === 'assistant' ? 'response-1' : 'user-1'),
    });
    messageList.add({ ...assistantMessage('recalled-reply', 'earlier turn'), threadId: 'thread-1' }, 'memory');
    messageList.add({ role: 'user', content: 'hi' }, 'input');
    messageList.add({ ...assistantMessage('prefill', 'partial answer'), threadId: 'thread-1' }, 'input');

    const nextMessageId = messageList.rotateResponseMessageId('response-not-created-yet');
    messageList.add({ ...assistantMessage(nextMessageId, 'this turn'), threadId: 'thread-1' }, 'response');

    const assistantIds = messageList.get.all
      .db()
      .filter(message => message.role === 'assistant')
      .map(message => message.id);
    expect(assistantIds).toEqual(['recalled-reply', 'prefill', 'response-1']);
    const prefill = messageList.get.all.db().find(message => message.id === 'prefill');
    expect(prefill?.content.parts).toMatchObject([{ type: 'text', text: 'partial answer' }]);
    expect(messageList.get.input.db().map(message => message.id)).toContain('prefill');
    expect(messageList.get.response.db().map(message => message.id)).toEqual(['response-1']);
  });
});

describe('MessageList response message rotation with a context assistant tail', () => {
  it('Given a context assistant and no live assistant, When the id rotates without a seal target, Then it is not moved into the response', () => {
    const messageList = new MessageList({ threadId: 'thread-1' });
    messageList.add({ ...assistantMessage('context-reply', 'context'), threadId: 'thread-1' }, 'context');
    messageList.add({ role: 'user', content: 'hi' }, 'input');

    messageList.rotateResponseMessageId('response-not-created-yet');

    expect(messageList.get.response.db()).toEqual([]);
    expect(messageList.drainUnsavedMessages().map(message => message.id)).not.toContain('context-reply');
  });
});
