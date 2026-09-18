import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from './types';
import { MessageList } from './index';

function assistant(parts: MastraDBMessage['content']['parts'], content?: string): MastraDBMessage {
  return {
    id: 'a1',
    role: 'assistant',
    content: { format: 2, parts, ...(content === undefined ? {} : { content }) },
    createdAt: new Date(),
  } as MastraDBMessage;
}

function text(t: string, itemId?: string) {
  return {
    type: 'text' as const,
    text: t,
    ...(itemId ? { providerMetadata: { openai: { itemId } } } : {}),
  };
}

function reasoning(t: string, itemId: string) {
  return {
    type: 'reasoning' as const,
    text: t,
    reasoning: t,
    details: [{ type: 'text' as const, text: t }],
    providerMetadata: { openai: { itemId } },
  };
}

function listWith(message: MastraDBMessage) {
  const list = new MessageList({ threadId: 't' });
  list.add(
    [
      {
        id: 'u1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
        createdAt: new Date(),
      } as MastraDBMessage,
    ],
    'input',
  );
  list.add([message], 'response');
  return list;
}

function partsOf(list: MessageList, id: string) {
  return list.get.all.db().find(m => m.id === id)?.content.parts;
}

describe('MessageList#rollbackToLastStepBoundary', () => {
  it('returns false for an unknown message id', () => {
    const list = listWith(assistant([text('hello')]));
    expect(list.rollbackToLastStepBoundary('nope')).toBe(false);
    expect(partsOf(list, 'a1')).toHaveLength(1);
  });

  it('removes the message outright when it has no step boundary', () => {
    // A rejection on the very first step: nothing was accepted, so nothing is kept.
    const list = listWith(assistant([reasoning('think', 'rs_1'), text('rejected', 'msg_1')]));

    expect(list.rollbackToLastStepBoundary('a1')).toBe(true);

    expect(list.get.all.db().find(m => m.id === 'a1')).toBeUndefined();
  });

  it('drops only the last step, keeping everything accepted before it', () => {
    const list = listWith(
      assistant([
        reasoning('think', 'rs_1'),
        {
          type: 'tool-invocation',
          toolInvocation: { toolCallId: 'call-1', toolName: 'lookup', args: {}, state: 'result', result: 'ok' },
        },
        { type: 'step-start' },
        text('rejected', 'msg_2'),
      ]),
    );

    expect(list.rollbackToLastStepBoundary('a1')).toBe(true);

    const parts = partsOf(list, 'a1')!;
    expect(parts.map(p => p.type)).toEqual(['reasoning', 'tool-invocation']);
    expect(JSON.stringify(parts)).not.toContain('rejected');
  });

  it('drops the step-start marker too, so the retry opens a fresh step', () => {
    const list = listWith(assistant([text('kept', 'msg_1'), { type: 'step-start' }, text('rejected', 'msg_2')]));

    list.rollbackToLastStepBoundary('a1');

    expect(partsOf(list, 'a1')!.some(p => p.type === 'step-start')).toBe(false);
  });

  it('rolls back only to the LAST boundary when several steps were accepted', () => {
    const list = listWith(
      assistant([
        text('one', 'msg_1'),
        { type: 'step-start' },
        text('two', 'msg_2'),
        { type: 'step-start' },
        text('rejected', 'msg_3'),
      ]),
    );

    list.rollbackToLastStepBoundary('a1');

    const parts = partsOf(list, 'a1')!;
    expect(parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text)).toEqual(['one', 'two']);
  });

  it('is idempotent enough to survive consecutive retries', () => {
    const list = listWith(
      assistant([
        text('one', 'msg_1'),
        { type: 'step-start' },
        text('rejected-a', 'msg_2'),
        { type: 'step-start' },
        text('rejected-b', 'msg_3'),
      ]),
    );

    list.rollbackToLastStepBoundary('a1');
    list.rollbackToLastStepBoundary('a1');

    const parts = partsOf(list, 'a1')!;
    expect(parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text)).toEqual(['one']);
    expect(JSON.stringify(parts)).not.toContain('rejected');
  });

  it('removes the message when the rollback empties it', () => {
    const list = listWith(assistant([{ type: 'step-start' }, text('rejected', 'msg_1')]));

    expect(list.rollbackToLastStepBoundary('a1')).toBe(true);

    expect(list.get.all.db().find(m => m.id === 'a1')).toBeUndefined();
  });

  it('removes a message that has no parts at all', () => {
    const list = listWith(assistant([text('seed')]));
    const message = list.get.all.db().find(m => m.id === 'a1')!;
    message.content.parts = [];

    expect(list.rollbackToLastStepBoundary('a1')).toBe(true);
    expect(list.get.all.db().find(m => m.id === 'a1')).toBeUndefined();
  });

  it('re-derives content.content so the rejected text cannot outlive the rollback', () => {
    // `content.content` mirrors the latest text part and is preferred by AIV4 readers.
    const list = listWith(
      assistant([text('kept', 'msg_1'), { type: 'step-start' }, text('rejected', 'msg_2')], 'rejected'),
    );

    list.rollbackToLastStepBoundary('a1');

    expect(list.get.all.db().find(m => m.id === 'a1')!.content.content).toBe('kept');
  });

  it('empties content.content when no text part survives the rollback', () => {
    const list = listWith(
      assistant([reasoning('think', 'rs_1'), { type: 'step-start' }, text('rejected', 'msg_2')], 'rejected'),
    );

    list.rollbackToLastStepBoundary('a1');

    expect(list.get.all.db().find(m => m.id === 'a1')!.content.content).toBe('');
  });

  it('keeps the rolled-back message drainable so the rollback is persisted', () => {
    const list = listWith(assistant([text('kept', 'msg_1'), { type: 'step-start' }, text('rejected', 'msg_2')]));

    list.rollbackToLastStepBoundary('a1');

    const drained = list.drainUnsavedMessages();
    const a1 = drained.find(m => m.id === 'a1');
    expect(a1).toBeDefined();
    expect(JSON.stringify(a1!.content.parts)).not.toContain('rejected');
  });
});
