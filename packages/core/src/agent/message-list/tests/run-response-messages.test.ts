import { describe, expect, it } from 'vitest';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function message(id: string, role: 'user' | 'assistant', text: string, at: number): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date(at),
    threadId: 't',
    resourceId: 'r',
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function ids(messages: MastraDBMessage[]) {
  return messages.map(m => m.id);
}

describe('MessageList.getRunResponseMessages', () => {
  it('keeps response messages pruned from the live context', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('u1', 'user', 'hi', 1000), 'input');
    list.add(message('a1', 'assistant', 'first', 2000), 'response');
    list.add(message('u2', 'user', 'continue', 2500), 'input');
    list.add(message('a2', 'assistant', 'second', 3000), 'response');

    list.removeByIds(['u1', 'a1'], { pruned: true });

    expect(ids(list.get.all.db())).toEqual(['u2', 'a2']);
    expect(ids(list.getPersisted.response.db())).toEqual(['a2']);
    expect(ids(list.getRunResponseMessages())).toEqual(['a1', 'a2']);
  });

  it('drops messages removed without the pruned option', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'rejected', 2000), 'response');

    list.removeByIds(['a1']);

    expect(list.getRunResponseMessages()).toEqual([]);
  });

  it('does not report pruned input or memory messages as response', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('m1', 'assistant', 'recalled', 500), 'memory');
    list.add(message('u1', 'user', 'hi', 1000), 'input');

    list.removeByIds(['m1', 'u1'], { pruned: true });

    expect(list.getRunResponseMessages()).toEqual([]);
  });

  it('does not duplicate a pruned message that is added back to the list', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    const a1 = message('a1', 'assistant', 'first', 2000);
    list.add(a1, 'response');

    const [removed] = list.removeByIds(['a1'], { pruned: true });
    list.add(removed!, 'response');

    expect(ids(list.getRunResponseMessages())).toEqual(['a1']);
  });

  it('carries pruned response messages across serialize/deserialize', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'before suspend', 2000), 'response');
    list.removeByIds(['a1'], { pruned: true });
    list.add(message('u2', 'user', 'resume', 2500), 'input');
    list.add(message('a2', 'assistant', 'still live', 3000), 'response');

    const state = JSON.parse(JSON.stringify(list.serialize()));
    const restored = new MessageList({ threadId: 't', resourceId: 'r' }).deserialize(state);

    expect(ids(restored.get.all.db())).toEqual(['u2', 'a2']);
    const run = restored.getRunResponseMessages();
    expect(ids(run)).toEqual(['a1', 'a2']);
    expect(run[0]!.createdAt).toBeInstanceOf(Date);
  });

  it('omits prunedResponseMessages from serialized state when nothing was pruned', () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'hi', 2000), 'response');

    expect(list.serialize()).not.toHaveProperty('prunedResponseMessages');
  });
});
