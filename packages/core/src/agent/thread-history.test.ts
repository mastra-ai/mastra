import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from './message-list/types';
import { createThreadHistoryFilter } from './thread-history';

function stored(id: string, role: 'user' | 'signal' = 'signal'): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date(1_000),
    threadId: 't',
    resourceId: 'r',
    content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
  } as MastraDBMessage;
}

describe('createThreadHistoryFilter', () => {
  it('drops signal parts whose signal is already stored', () => {
    const filter = createThreadHistoryFilter([stored('sig-1'), stored('msg-1', 'user')]);

    expect(filter({ type: 'start', payload: { messageId: 'persisted-signal:sig-1' } }, 'run')).toBe(true);
    expect(filter({ type: 'data-signal', data: { id: 'sig-1' } }, 'run')).toBe(false);
    expect(filter({ type: 'data-user-message', data: { id: 'msg-1' } }, 'run')).toBe(false);
  });

  it('keeps signal parts that storage does not have', () => {
    const filter = createThreadHistoryFilter([stored('sig-1')]);

    expect(filter({ type: 'data-signal', data: { id: 'sig-2' } }, 'run')).toBe(true);
    expect(filter({ type: 'data-user-message', data: { id: 'msg-2' } }, 'run')).toBe(true);
  });
});
