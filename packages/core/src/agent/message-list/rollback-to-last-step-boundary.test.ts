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

  it('survives back-to-back rejections, each retry opening and losing its own step', () => {
    // Mirrors the real loop: reject -> rollback -> the retry opens a fresh step and writes into
    // it -> reject again -> rollback again. Only the accepted first step may survive.
    const list = listWith(assistant([text('one', 'msg_1'), { type: 'step-start' }, text('rejected-a', 'msg_2')]));

    list.rollbackToLastStepBoundary('a1');

    const parts = partsOf(list, 'a1')!;
    parts.push({ type: 'step-start' }, text('rejected-b', 'msg_3'));

    list.rollbackToLastStepBoundary('a1');

    const final = partsOf(list, 'a1')!;
    expect(final.filter(p => p.type === 'text').map(p => (p as { text: string }).text)).toEqual(['one']);
    expect(final.some(p => p.type === 'step-start')).toBe(false);
    expect(JSON.stringify(final)).not.toContain('rejected');
  });

  it('removes the message when the rollback empties it', () => {
    const list = listWith(assistant([{ type: 'step-start' }, text('rejected', 'msg_1')]));

    expect(list.rollbackToLastStepBoundary('a1')).toBe(true);

    expect(list.get.all.db().find(m => m.id === 'a1')).toBeUndefined();
  });

  it('removes a message whose parts array is empty', () => {
    const list = listWith(assistant([text('seed')]));
    list.get.all.db().find(m => m.id === 'a1')!.content.parts = [];

    expect(list.rollbackToLastStepBoundary('a1')).toBe(true);
    expect(list.get.all.db().find(m => m.id === 'a1')).toBeUndefined();
  });

  it('removes a message carrying no parts field at all', () => {
    const list = listWith(assistant([text('seed')]));
    delete (list.get.all.db().find(m => m.id === 'a1')!.content as { parts?: unknown }).parts;

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

  it('re-sources a message already flushed mid-turn, so the rollback reaches storage', () => {
    // The loop flushes the assistant message mid-turn (around tool steps), which clears it from
    // the unsaved set. A rollback after that flush must put it back, or the rejected text stays
    // on disk from the earlier flush and only the in-memory copy is ever corrected.
    const list = listWith(assistant([text('kept', 'msg_1'), { type: 'step-start' }, text('rejected', 'msg_2')]));

    const firstDrain = list.drainUnsavedMessages();
    expect(firstDrain.map(m => m.id)).toContain('a1');
    expect(list.drainUnsavedMessages()).toHaveLength(0);

    list.rollbackToLastStepBoundary('a1');

    const secondDrain = list.drainUnsavedMessages();
    const a1 = secondDrain.find(m => m.id === 'a1');
    expect(a1).toBeDefined();
    expect(JSON.stringify(a1!.content.parts)).not.toContain('rejected');
  });

  it('prunes the rejected step from the legacy content.toolInvocations mirror', () => {
    // `content.toolInvocations` is the AIV4 mirror MessageMerger maintains alongside `parts`.
    // Anything left there but absent from `parts` is treated as an *unprocessed* invocation by
    // convert-to-mastra-v1 and pushed back into the prompt, which would resurrect the very tool
    // call the rejection discarded.
    const list = listWith(
      assistant([
        text('kept', 'msg_1'),
        { type: 'step-start' },
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'call-rejected',
            toolName: 'lookup',
            args: {},
            state: 'result',
            result: 'rejected-result',
          },
        },
      ]),
    );
    const stored = list.get.all.db().find(m => m.id === 'a1')!;
    stored.content.toolInvocations = [
      { toolCallId: 'call-rejected', toolName: 'lookup', args: {}, state: 'result', result: 'rejected-result' },
    ] as MastraDBMessage['content']['toolInvocations'];

    list.rollbackToLastStepBoundary('a1');

    const after = list.get.all.db().find(m => m.id === 'a1')!;
    expect(after.content.toolInvocations ?? []).toHaveLength(0);
    expect(JSON.stringify(list.get.all.v1())).not.toContain('call-rejected');
  });

  it('keeps accepted invocations in the mirror while pruning the rejected one', () => {
    const list = listWith(
      assistant([
        {
          type: 'tool-invocation',
          toolInvocation: { toolCallId: 'call-kept', toolName: 'lookup', args: {}, state: 'result', result: 'ok' },
        },
        { type: 'step-start' },
        {
          type: 'tool-invocation',
          toolInvocation: { toolCallId: 'call-rejected', toolName: 'lookup', args: {}, state: 'result', result: 'no' },
        },
      ]),
    );
    const stored = list.get.all.db().find(m => m.id === 'a1')!;
    stored.content.toolInvocations = [
      { toolCallId: 'call-kept', toolName: 'lookup', args: {}, state: 'result', result: 'ok' },
      { toolCallId: 'call-rejected', toolName: 'lookup', args: {}, state: 'result', result: 'no' },
    ] as MastraDBMessage['content']['toolInvocations'];

    list.rollbackToLastStepBoundary('a1');

    const after = list.get.all.db().find(m => m.id === 'a1')!;
    expect((after.content.toolInvocations ?? []).map(t => t.toolCallId)).toEqual(['call-kept']);
  });
});
