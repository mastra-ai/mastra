import { describe, expect, it } from 'vitest';

import { createSignal } from '../../signals';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function assistant(id: string, parts: MastraDBMessage['content']['parts'], createdAt: Date): MastraDBMessage {
  return { id, role: 'assistant', content: { format: 2, parts }, createdAt, threadId: 't' };
}

describe('MessageList response boundary', () => {
  it('folds late parts for a rotated message into that message instead of replacing it', () => {
    const list = new MessageList({ threadId: 't' });
    list.add({ role: 'user', content: 'Hello' }, 'input');
    list.add(
      assistant(
        'running',
        [
          { type: 'step-start' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'slowTool', args: {} },
          },
        ],
        new Date(1_000),
      ),
      'response',
    );

    // A signal arrives mid-tool: the in-flight message is sealed and the id rotates.
    const nextId = list.rotateResponseMessageId('running');
    expect(nextId).not.toBe('running');
    list.addSignal(createSignal({ type: 'reactive', contents: 'reminder' }));

    // The still-running tool reports under the id it started with.
    list.add(
      assistant('running', [{ type: 'data-tool-exit', data: { toolCallId: 'call-1' } }], new Date(2_000)),
      'response',
    );
    expect(
      list.get.all
        .db()
        .find(message => message.id === 'running')
        ?.content.parts.map(part => part.type),
    ).toEqual(['step-start', 'tool-invocation', 'data-tool-exit']);
    list.add(
      assistant(
        'running',
        [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'slowTool', args: {}, result: 'ok' },
          },
        ],
        new Date(3_000),
      ),
      'response',
    );

    const running = list.get.all.db().filter(message => message.id === 'running');
    expect(running).toHaveLength(1);
    expect(running[0]!.content.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-invocation',
          toolInvocation: expect.objectContaining({ toolCallId: 'call-1', state: 'result', result: 'ok' }),
        }),
        expect.objectContaining({ type: 'data-tool-exit' }),
      ]),
    );

    // The boundary still holds for the next response: a different id never folds back in.
    list.add(assistant(nextId, [{ type: 'text', text: 'next response' }], new Date(4_000)), 'response');
    expect(list.get.all.db().find(message => message.id === nextId)?.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'next response' }),
    ]);
    expect(running[0]!.content.parts.some(part => part.type === 'text')).toBe(false);
  });
});
