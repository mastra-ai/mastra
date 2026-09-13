import { describe, expect, it } from 'vitest';

import { createSignal } from '../../signals';
import { getLogicalMessageId } from '../logical-message-identity';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function message(id: string, role: 'user' | 'assistant', text: string): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

describe('MessageList logical message identity', () => {
  it('stamps input and every rotated response segment and restores the active identity', () => {
    const list = new MessageList({
      threadId: 'thread-1',
      logicalMessageIdentity: { input: 'input-1', response: 'response-1' },
      generateMessageId: () => 'response-2',
    });

    list.add(message('user-1', 'user', 'hello'), 'input');
    list.add(
      createSignal({
        type: 'user-message',
        contents: 'steer',
        metadata: { logicalMessageId: 'input-2' },
      }),
      'input',
    );
    const unlineagedSteer = createSignal({ type: 'user-message', contents: 'unlineaged steer' });
    list.add(unlineagedSteer, 'input');
    list.add(message('assistant-1', 'assistant', 'first'), 'response');
    const serialized = list.serialize();

    expect(list.get.all.db().find(message => message.id === 'user-1')?.content.metadata).toMatchObject({
      logicalMessageId: 'input-1',
    });
    expect(list.get.all.db().find(message => message.id === 'assistant-1')?.content.metadata).toMatchObject({
      logicalMessageId: 'response-1',
    });
    expect(
      list.get.all
        .db()
        .find(message => message.content.parts.some(part => part.type === 'text' && part.text === 'steer'))?.content
        .metadata,
    ).toMatchObject({ logicalMessageId: 'input-2' });
    expect(
      getLogicalMessageId(list.get.all.db().find(message => message.id === unlineagedSteer.id)?.content.metadata),
    ).toBeUndefined();

    const idleSignalList = new MessageList();
    const idleSignal = createSignal({
      type: 'user-message',
      contents: 'idle signal',
      metadata: { logicalMessageId: 'input-only' },
    });
    idleSignalList.add(idleSignal, 'input');
    expect(getLogicalMessageId(idleSignalList.get.all.db()[0]?.content.metadata)).toBe('input-only');

    const recovered = new MessageList().deserialize(serialized);
    const nextResponseId = recovered.rotateResponseMessageId('assistant-1');
    recovered.add(message(nextResponseId, 'assistant', 'second'), 'response');

    const assistantMessages = recovered.get.all.db().filter(message => message.role === 'assistant');
    expect(assistantMessages.map(message => message.content.metadata?.logicalMessageId)).toEqual([
      'response-1',
      'response-1',
    ]);
  });

  it('rejects malformed identity values instead of admitting an untracked turn', () => {
    expect(
      () =>
        new MessageList({
          logicalMessageIdentity: { input: '', response: 'response-1' },
        }),
    ).toThrow(/logicalMessageIdentity/);
  });
});
