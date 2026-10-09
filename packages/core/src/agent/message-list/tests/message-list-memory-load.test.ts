import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function storedMessage(id: string, text: string, createdAt: number, role: 'user' | 'assistant' = 'user') {
  return {
    id,
    role,
    createdAt: new Date(createdAt),
    threadId: 'thread',
    resourceId: 'resource',
    content: { format: 2, parts: [{ type: 'text', text }] },
  } satisfies MastraDBMessage;
}

function storedHistory(count: number) {
  return Array.from({ length: count }, (_, i) =>
    storedMessage(`m${i}`, `message ${i}`, 1_000 + i, i % 2 === 0 ? 'user' : 'assistant'),
  );
}

function texts(list: MessageList) {
  return list.get.all.db().map(message => message.content.parts.map(part => (part.type === 'text' ? part.text : '')));
}

describe('MessageList memory loads', () => {
  it('loads and re-loads a long stored history without scanning the list for every message', () => {
    const rows = storedHistory(20_000);
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });

    const start = performance.now();
    list.add(rows, 'memory');
    list.add(rows, 'memory');
    const elapsed = performance.now() - start;

    const stored = list.get.all.db();
    expect(stored).toHaveLength(20_000);
    expect(stored.map(message => message.id)).toEqual(rows.map(row => row.id));
    // The quadratic implementation took tens of seconds here; linear takes tens of milliseconds.
    expect(elapsed).toBeLessThan(2_000);
  });

  it('keeps stored messages ordered by createdAt when they arrive out of order', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });

    list.add([storedMessage('b', 'b', 2_000), storedMessage('c', 'c', 3_000)], 'memory');
    list.add(storedMessage('a', 'a', 1_000), 'memory');
    list.add(storedMessage('d', 'd', 4_000), 'memory');

    expect(list.get.all.db().map(message => message.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('timestamps new input after the newest stored message', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    const future = Date.now() + 60_000;

    list.add(
      storedHistory(3).map((row, i) => ({ ...row, createdAt: new Date(future + i) })),
      'memory',
    );
    list.add('next question', 'input');

    const stored = list.get.all.db();
    expect(stored.at(-1)?.role).toBe('user');
    expect(stored.at(-1)!.createdAt.getTime()).toBeGreaterThan(future + 2);
  });

  it('dedups against the replacement after a stored message is replaced by id', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });

    list.add(storedMessage('a', 'first', 1_000), 'memory');
    list.add(storedMessage('a', 'second', 1_000), 'memory');
    list.add(storedMessage('a', 'first', 1_000), 'memory');

    expect(texts(list)).toEqual([['first']]);

    list.add(storedMessage('a', 'first', 1_000), 'memory');
    expect(texts(list)).toEqual([['first']]);
  });

  it('keeps one message when the stored copy of a live input message is loaded twice', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });

    list.add(storedMessage('a', 'hello', 1_000), 'input');
    list.add(storedMessage('a', 'hello (stored)', 1_000), 'memory');
    list.add(storedMessage('a', 'hello (stored again)', 1_000), 'memory');

    const stored = list.get.all.db();
    expect(stored).toHaveLength(1);
    expect(list.get.input.db()).toEqual(stored);
    expect(texts(list)).toEqual([['hello (stored again)']]);
  });

  it('adds a stored message again after it was removed from the list', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    const rows = storedHistory(3);

    list.add(rows, 'memory');
    list.removeByIds(['m1']);
    list.add(rows[1]!, 'memory');
    expect(list.get.all.db().map(message => message.id)).toEqual(['m0', 'm1', 'm2']);

    list.clear.all.db();
    list.add(rows, 'memory');
    expect(list.get.all.db().map(message => message.id)).toEqual(['m0', 'm1', 'm2']);
  });

  it('respects a seal applied in place after the messages were added', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });

    list.add(storedMessage('a', 'answer', 1_000, 'assistant'), 'response');
    list.add(storedMessage('u', 'follow-up', 2_000), 'input');
    list.add(storedMessage('b', 'second answer', 3_000, 'assistant'), 'response');

    // Observational memory seals messages by mutating the objects already in the list.
    const latest = list.get.all.db().at(-1)!;
    latest.content.metadata = { mastra: { sealed: true } };

    // `a` now sits before the sealed boundary, so an update to it becomes a new message.
    list.add(storedMessage('a', 'answer, continued', 1_000, 'assistant'), 'response');

    const stored = list.get.all.db();
    expect(stored).toHaveLength(4);
    expect(stored.find(message => message.id === 'a')?.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'answer' }),
    ]);
    const continuation = stored.find(message => !['a', 'u', 'b'].includes(message.id));
    expect(continuation?.content.parts).toEqual([expect.objectContaining({ type: 'text', text: 'answer, continued' })]);
  });
});
