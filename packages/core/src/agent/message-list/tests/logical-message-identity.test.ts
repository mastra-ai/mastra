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

  it('binds every signal in the initial input batch and keeps later unlineaged signals unowned after recovery', () => {
    const list = new MessageList({
      logicalMessageIdentity: { input: 'input-1', response: 'response-1' },
    });
    const initialSignals = [
      createSignal({ type: 'user-message', contents: 'first' }),
      createSignal({ type: 'user-message', contents: 'second' }),
    ];

    list.add(initialSignals, 'input');
    const initialIds = list.get.all
      .db()
      .filter(message => message.role === 'signal')
      .map(message => getLogicalMessageId(message.content.metadata));
    expect(initialIds).toEqual(['input-1', 'input-1']);

    const recovered = new MessageList().deserialize(list.serialize());
    const laterSignal = createSignal({ type: 'user-message', contents: 'later steer' });
    recovered.add(laterSignal, 'input');
    expect(
      getLogicalMessageId(recovered.get.all.db().find(message => message.id === laterSignal.id)?.content.metadata),
    ).toBeUndefined();

    const direct = new MessageList({
      logicalMessageIdentity: { input: 'input-direct', response: 'response-direct' },
    });
    const firstDirectSignal = createSignal({ type: 'user-message', contents: 'first direct' });
    const laterDirectSignal = createSignal({ type: 'user-message', contents: 'later direct' });
    direct.addSignal(firstDirectSignal);
    direct.addSignal(laterDirectSignal);
    expect(
      getLogicalMessageId(direct.get.all.db().find(message => message.id === firstDirectSignal.id)?.content.metadata),
    ).toBe('input-direct');
    expect(
      getLogicalMessageId(direct.get.all.db().find(message => message.id === laterDirectSignal.id)?.content.metadata),
    ).toBeUndefined();

    const emptyThenSignal = new MessageList({
      logicalMessageIdentity: { input: 'input-after-empty', response: 'response-after-empty' },
    });
    emptyThenSignal.add([], 'input');
    const signalAfterEmpty = createSignal({ type: 'user-message', contents: 'after empty batch' });
    emptyThenSignal.addSignal(signalAfterEmpty);
    expect(
      getLogicalMessageId(
        emptyThenSignal.get.all.db().find(message => message.id === signalAfterEmpty.id)?.content.metadata,
      ),
    ).toBe('input-after-empty');

    const reactiveThenUser = new MessageList({
      logicalMessageIdentity: { input: 'input-after-reactive', response: 'response-after-reactive' },
    });
    reactiveThenUser.addSignal(createSignal({ type: 'reactive', contents: 'internal reminder' }));
    const userAfterReactive = createSignal({ type: 'user-message', contents: 'user after reminder' });
    reactiveThenUser.addSignal(userAfterReactive);
    expect(
      getLogicalMessageId(
        reactiveThenUser.get.all.db().find(message => message.id === userAfterReactive.id)?.content.metadata,
      ),
    ).toBe('input-after-reactive');
  });

  it('overrides stale metadata on ordinary caller input with the active input identity', () => {
    const list = new MessageList({
      logicalMessageIdentity: { input: 'input-current', response: 'response-1' },
    });

    list.add(
      {
        ...message('user-1', 'user', 'hello'),
        content: {
          ...message('user-1', 'user', 'hello').content,
          metadata: { logicalMessageId: 'input-old' },
        },
      },
      'input',
    );

    expect(getLogicalMessageId(list.get.all.db()[0]?.content.metadata)).toBe('input-current');
  });

  it('keeps a lineaged response separate from a recalled assistant owned by another identity', () => {
    const list = new MessageList({
      threadId: 'thread-1',
      logicalMessageIdentity: { input: 'input-current', response: 'response-current' },
    });

    list.add(
      {
        ...message('recalled-assistant', 'assistant', 'old answer'),
        content: {
          ...message('recalled-assistant', 'assistant', 'old answer').content,
          metadata: { logicalMessageId: 'response-old' },
        },
      },
      'memory',
    );
    list.add(message('new-assistant', 'assistant', 'new answer'), 'response');

    const assistants = list.get.all.db().filter(candidate => candidate.role === 'assistant');
    expect(assistants).toHaveLength(2);
    expect(assistants.map(candidate => getLogicalMessageId(candidate.content.metadata))).toEqual([
      'response-old',
      'response-current',
    ]);
  });

  it('does not merge a replacement response into a recalled assistant from another identity', () => {
    const list = new MessageList({
      threadId: 'thread-1',
      logicalMessageIdentity: { input: 'input-current', response: 'response-current' },
    });

    list.add(
      {
        ...message('recalled-assistant', 'assistant', 'old answer'),
        content: {
          ...message('recalled-assistant', 'assistant', 'old answer').content,
          metadata: { logicalMessageId: 'response-old' },
        },
      },
      'memory',
    );
    list.add(message('recalled-assistant', 'assistant', 'new answer'), 'response');

    const replacement = list.get.all.db().find(candidate => candidate.id === 'recalled-assistant');
    expect(replacement?.content.parts).toHaveLength(1);
    expect(replacement?.content.parts[0]).toMatchObject({ type: 'text', text: 'new answer' });
    expect(getLogicalMessageId(replacement?.content.metadata)).toBe('response-current');
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
