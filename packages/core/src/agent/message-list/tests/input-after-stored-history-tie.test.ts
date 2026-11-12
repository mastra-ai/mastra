import { describe, expect, it } from 'vitest';

import { createSignal, signalToMastraDBMessage } from '../../signals';
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

describe('input stamped in the same millisecond as the stored history it follows', () => {
  it('keeps the new turn after the stored answer it ties with', () => {
    const tie = new Date('2026-11-01T09:03:24.929Z');
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    const followUp = createSignal({ id: 'follow-up', type: 'user-message', contents: 'follow-up', createdAt: tie });
    list.add(signalToMastraDBMessage(followUp), 'input');

    list.add(
      [
        stored('first', 'user', 'first', new Date(tie.getTime() - 52)),
        stored('first-response', 'assistant', 'first response', tie),
      ],
      'memory',
    );
    list.add(
      {
        id: 'follow-up-response',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'follow-up response' }] },
      },
      'response',
    );

    const all = list.get.all.db();
    expect(all.map(message => message.id)).toEqual(['first', 'first-response', 'follow-up', 'follow-up-response']);
    expect(all[1]!.content.parts).toHaveLength(1);
    expect(all[2]!.createdAt.getTime()).toBeGreaterThan(tie.getTime());
  });

  it('keeps a response stamped in the stored history millisecond after the input it answers', () => {
    const tie = new Date('2026-11-01T09:03:24.929Z');
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(stored('input', 'user', 'input', tie), 'input');
    list.add(stored('history', 'user', 'history', tie), 'memory');
    list.add(stored('response', 'assistant', 'response', tie), 'response');

    expect(list.get.all.db().map(message => message.id)).toEqual(['history', 'input', 'response']);
  });

  it('leaves live messages that tie only with each other untouched', () => {
    const same = new Date('2026-11-01T09:03:24.929Z');
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(stored('first', 'user', 'first', new Date(same.getTime() - 52)), 'memory');
    list.add([stored('a', 'user', 'a', same), stored('b', 'user', 'b', same)], 'input');
    list.add(stored('second', 'assistant', 'second', new Date(same.getTime() - 10)), 'memory');

    const all = list.get.all.db();
    expect(all.map(message => message.id)).toEqual(['first', 'second', 'a', 'b']);
    expect(all[2]!.createdAt.getTime()).toBe(same.getTime());
    expect(all[3]!.createdAt.getTime()).toBe(same.getTime());
  });
  it('keeps live inputs ahead of the response when moving them past a stored tie', () => {
    const tie = new Date('2026-11-01T09:03:24.929Z').getTime();
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add([stored('a', 'user', 'a', new Date(tie)), stored('b', 'user', 'b', new Date(tie))], 'input');
    list.add(stored('response', 'assistant', 'response', new Date(tie + 1)), 'response');
    list.add(stored('history', 'assistant', 'history', new Date(tie)), 'memory');

    expect(list.get.all.db().map(message => message.id)).toEqual(['history', 'a', 'b', 'response']);
  });

  it('keeps a reminder anchored before its message when later messages are added', () => {
    const tie = new Date('2026-11-01T09:03:24.929Z').getTime();
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(
      [
        stored('history', 'assistant', 'history', new Date(tie - 1)),
        stored('successor', 'user', 'successor', new Date(tie)),
      ],
      'memory',
    );
    list.addSignal(
      createSignal({
        id: 'reminder',
        type: 'system-reminder',
        contents: 'gap',
        metadata: { precedesMessageId: 'successor' },
      }),
    );
    list.add(stored('response', 'assistant', 'response', new Date(tie + 10)), 'response');

    expect(list.get.all.db().map(message => message.id)).toEqual(['history', 'reminder', 'successor', 'response']);
  });

  it('leaves remembered messages in place when they are added again as the current turn', () => {
    const same = new Date('2026-11-01T09:03:24.929Z');
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    const messages = [
      stored('history', 'user', 'history', same),
      stored('input', 'user', 'input', same),
      stored('response', 'assistant', 'response', same),
      stored('context', 'user', 'context', same),
    ];
    list.add(messages, 'memory');
    list.add(messages[1]!, 'input');
    list.add(messages[2]!, 'response');
    list.add(messages[3]!, 'context');

    expect(list.get.all.db().map(message => message.id)).toEqual(['history', 'input', 'response', 'context']);
  });
  it('keeps the turn in order when more stored history arrives after it was placed', () => {
    const tie = new Date('2026-11-01T09:03:24.929Z').getTime();
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add([stored('a', 'user', 'a', new Date(tie)), stored('b', 'user', 'b', new Date(tie))], 'input');
    list.add(stored('response', 'assistant', 'response', new Date(tie + 1)), 'response');
    list.add(stored('h0', 'assistant', 'h0', new Date(tie)), 'memory');
    list.add(
      [stored('h1', 'assistant', 'h1', new Date(tie + 1)), stored('h2', 'assistant', 'h2', new Date(tie + 2))],
      'memory',
    );

    expect(list.get.all.db().map(message => message.id)).toEqual(['h0', 'h1', 'h2', 'a', 'b', 'response']);
  });
});
