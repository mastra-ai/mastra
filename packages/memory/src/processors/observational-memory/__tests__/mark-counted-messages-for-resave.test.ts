import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { resaveCountedMessagesFor } from '../resave-counted-messages';
import { TokenCounter } from '../token-counter';

const message = (id: string, threadId: string, text: string, counted = false): MastraDBMessage => {
  const built: MastraDBMessage = {
    id,
    threadId,
    resourceId: 'resource',
    role: id.endsWith('a') ? 'assistant' : 'user',
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, id.length)),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
  if (!counted) return built;
  // A message loaded from storage that already carries its count: counted, then read back as new objects.
  new TokenCounter().countMessages([built]);
  return { ...JSON.parse(JSON.stringify(built)), createdAt: built.createdAt };
};

function history() {
  const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
  list.add(
    [
      message('uncounted-u', 'thread', 'first question '.repeat(20)),
      message('counted-a', 'thread', 'already counted answer', true),
      message('other-thread-u', 'other', 'a recalled message '.repeat(20)),
    ],
    'memory',
  );
  return list;
}

describe('resaveCountedMessagesFor', () => {
  it('marks only current-thread messages that gained a count', () => {
    const list = history();
    const finish = resaveCountedMessagesFor(list, 'thread');

    new TokenCounter().countMessages(list.get.remembered.db());
    finish();

    expect(list.drainUnsavedMessages().map(m => m.id)).toEqual(['uncounted-u']);
  });

  it('marks nothing when every part already had a count', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add([message('counted-u', 'thread', 'text', true)], 'memory');
    const finish = resaveCountedMessagesFor(list, 'thread');

    new TokenCounter().countMessages(list.get.remembered.db());
    finish();

    expect(list.drainUnsavedMessages()).toEqual([]);
  });

  it('leaves counting working, and saves nothing, with a Core that has no markForResave', () => {
    const list = history();
    // The part of the list OM touches in an older Core: reading messages, no markForResave.
    const oldCoreList = { get: list.get } as unknown as MessageList;
    const finish = resaveCountedMessagesFor(oldCoreList, 'thread');

    const counter = new TokenCounter();
    const total = counter.countMessages(list.get.remembered.db());
    expect(() => finish()).not.toThrow();

    expect(total).toBeGreaterThan(0);
    expect(list.drainUnsavedMessages()).toEqual([]);
  });
});
