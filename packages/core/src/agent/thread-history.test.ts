import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from './message-list/types';
import { createThreadHistoryFilter, stampPartProducedAt } from './thread-history';

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

  describe('pending suspensions', () => {
    function msg(id: string, role: 'user' | 'assistant', at: number, suspended?: string): MastraDBMessage {
      return {
        id,
        role,
        createdAt: new Date(at),
        threadId: 't',
        resourceId: 'r',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'hi' }],
          ...(suspended ? { metadata: { suspendedTools: { tool: { toolCallId: suspended } } } } : {}),
        },
      } as MastraDBMessage;
    }
    // Replayed parts carry their production time; the suspension was produced with its message.
    const suspendedPart = (toolCallId: string, producedAt: number) => {
      const part = { type: 'tool-call-suspended', payload: { toolCallId } };
      stampPartProducedAt(part, producedAt);
      return part;
    };

    it('drops a suspension listed only on an older assistant message', () => {
      const filter = createThreadHistoryFilter([
        msg('a1', 'assistant', 1_000, 'call-1'),
        msg('u2', 'user', 2_000),
        msg('a3', 'assistant', 3_000),
      ]);

      filter({ type: 'start', payload: { messageId: 'a1' } }, 'run-1');
      expect(filter(suspendedPart('call-1', 1_000), 'run-1')).toBe(false);
    });

    it('keeps a suspension listed on the latest assistant message, regardless of input order', () => {
      const filter = createThreadHistoryFilter([
        msg('a3', 'assistant', 3_000, 'call-2'),
        msg('u2', 'user', 2_000),
        msg('a1', 'assistant', 1_000),
      ]);

      filter({ type: 'start', payload: { messageId: 'a3' } }, 'run-2');
      expect(filter(suspendedPart('call-2', 3_000), 'run-2')).toBe(true);
    });
  });
});
