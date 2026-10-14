import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filterObservedMessages } from '../message-utils';

const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';

function msg(id: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text: id }] },
    type: 'text',
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
  } as unknown as MastraDBMessage;
}

const ts = (list: MessageList, id: string) =>
  list.get.all
    .db()
    .find(m => m.id === id)!
    .createdAt.getTime();
const ids = (list: MessageList) => list.get.all.db().map(m => m.id);

// MessageList spaces messages added within the same millisecond 1ms apart, so the next
// message can land exactly on the observation cursor.
describe('filterObservedMessages at the lastObservedAt boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  function threeMessages() {
    const list = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
    list.add(msg('u1'), 'input');
    list.add(msg('a1', 'assistant'), 'response');
    list.add(msg('a2'), 'input');
    return list;
  }

  it('keeps an unobserved message created exactly on a newest-observed + 1ms cursor', () => {
    const list = threeMessages();
    const lastObservedAt = new Date(ts(list, 'a1') + 1); // async buffering cursor
    expect(ts(list, 'a2')).toBe(lastObservedAt.getTime());

    filterObservedMessages({
      messageList: list,
      record: { lastObservedAt, observedMessageIds: ['u1', 'a1'] } as never,
    });

    expect(ids(list)).toEqual(['a2']);
  });

  it('keeps an unobserved message sharing the timestamp of a newest-observed cursor', () => {
    const list = threeMessages();
    const lastObservedAt = new Date(ts(list, 'a2')); // sync cursor = newest observed timestamp
    filterObservedMessages({
      messageList: list,
      record: { lastObservedAt, observedMessageIds: ['u1', 'a1'] } as never,
    });

    expect(ids(list)).toEqual(['a2']);
  });

  it('still prunes everything at or before the cursor for records without observed ids', () => {
    const list = threeMessages();
    const lastObservedAt = new Date(ts(list, 'a1') + 1);

    filterObservedMessages({ messageList: list, record: { lastObservedAt, observedMessageIds: [] } as never });

    expect(ids(list)).toEqual([]);
  });
});
