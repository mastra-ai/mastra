import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function stored(id: string, role: 'user' | 'assistant', text: string, createdAt: Date): MastraDBMessage {
  return {
    id,
    role,
    createdAt,
    threadId: 'thread',
    resourceId: 'resource',
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function listWithHistory() {
  const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
  list.add(stored('old-user', 'user', 'old question', new Date('2026-11-01T09:00:00Z')), 'memory');
  list.add(stored('old-answer', 'assistant', 'old answer', new Date('2026-11-01T09:00:01Z')), 'memory');
  return list;
}

describe('MessageList.markForResave', () => {
  it('drains a marked stored message once, through the normal drain', () => {
    const list = listWithHistory();
    const [oldUser] = list.get.remembered.db();

    list.markForResave(oldUser!);

    expect(list.drainUnsavedMessages().map(message => message.id)).toEqual(['old-user']);
    expect(list.drainUnsavedMessages()).toEqual([]);
  });

  it('does not report a marked message as new input, response or source output', () => {
    const list = listWithHistory();
    list.add(stored('new-user', 'user', 'new question', new Date('2026-11-02T09:00:00Z')), 'input');
    const [oldUser] = list.get.remembered.db();

    list.markForResave(oldUser!);

    expect(list.get.input.db().map(message => message.id)).toEqual(['new-user']);
    expect(list.get.response.db()).toEqual([]);
    expect(list.get.remembered.db().map(message => message.id)).toEqual(['old-user', 'old-answer']);
    expect(list.isNewMessage('old-user')).toBe(false);
    expect(list.getEarliestUnsavedMessageTimestamp()).toBe(new Date('2026-11-02T09:00:00Z').getTime());
  });

  it('drains a message that is both marked and new once', () => {
    const list = listWithHistory();
    list.add(stored('new-user', 'user', 'new question', new Date('2026-11-02T09:00:00Z')), 'input');
    const newUser = list.get.input.db()[0]!;

    list.markForResave(newUser);

    expect(list.drainUnsavedMessages().map(message => message.id)).toEqual(['new-user']);
  });

  it('keeps the mark when the save fails and the drain is restored', () => {
    const list = listWithHistory();
    list.markForResave(list.get.remembered.db()[1]!);

    const drained = list.drainUnsavedMessagesForSave();
    expect(drained.messages.map(message => message.id)).toEqual(['old-answer']);
    expect(list.drainUnsavedMessages()).toEqual([]);

    drained.restore();

    expect(list.drainUnsavedMessages().map(message => message.id)).toEqual(['old-answer']);
  });

  it('does not restore a mark for a message that left the list', () => {
    const list = listWithHistory();
    list.markForResave(list.get.remembered.db()[1]!);
    const drained = list.drainUnsavedMessagesForSave();

    list.removeByIds(['old-answer']);
    drained.restore();

    expect(list.drainUnsavedMessages()).toEqual([]);
  });

  it('keeps the marks on a clone', () => {
    const list = listWithHistory();
    list.markForResave(list.get.remembered.db()[0]!);

    expect(
      list
        .clone()
        .getMessagesToResave()
        .map(message => message.id),
    ).toEqual(['old-user']);
    expect(list.getMessagesToResave().map(message => message.id)).toEqual(['old-user']);
  });

  it('ignores a message that is not in the list', () => {
    const list = listWithHistory();

    list.markForResave(stored('elsewhere', 'user', 'not here', new Date('2026-11-01T08:00:00Z')));

    expect(list.drainUnsavedMessages()).toEqual([]);
  });
});
