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
});
