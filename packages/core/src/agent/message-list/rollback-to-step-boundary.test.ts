import { describe, expect, it } from 'vitest';
import type { MastraStepStartPart } from './state';
import type { MastraDBMessage } from './types';
import { MessageList } from './index';

let seq = 0;

// A fresh id per message: conversion caches key on the message id, so reusing one across tests
// hands a later test the earlier test's converted copy instead of its own live message.
function assistant(parts: MastraDBMessage['content']['parts'], content?: string): MastraDBMessage {
  return {
    id: `a${++seq}`,
    role: 'assistant',
    content: { format: 2, parts, ...(content === undefined ? {} : { content }) },
    // Strictly after the user turn: `openStepBoundary` writes to the *last* message, and equal
    // timestamps leave that ordering up to the sort, which made these tests flaky.
    createdAt: new Date(Date.now() + 1000),
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

function toolCall(toolCallId: string, result = 'ok') {
  return {
    type: 'tool-invocation' as const,
    toolInvocation: { toolCallId, toolName: 'lookup', args: {}, state: 'result' as const, result },
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
        createdAt: new Date(Date.now() - 1000),
      } as MastraDBMessage,
    ],
    'input',
  );
  list.add([message], 'response');
  return { list, id: message.id };
}

function partsOf(list: MessageList, id: string) {
  return list.get.all.db().find(m => m.id === id)?.content.parts;
}

/**
 * The marker a loop iteration would be holding: `openStepBoundary()` appends to whatever the
 * message ends with, so seeding a message that already ends in `step-start` and calling it
 * hands back that same marker by reference — exactly what the loop captures at iteration start.
 */
function openBoundary(list: MessageList): MastraStepStartPart | undefined {
  return list.openStepBoundary().boundary;
}

describe('MessageList#rollbackToStepBoundary', () => {
  it('returns false for an unknown message id', () => {
    const { list, id } = listWith(assistant([text('hello')]));
    const boundary = openBoundary(list);

    expect(list.rollbackToStepBoundary('nope', boundary)).toBe(false);
    expect(partsOf(list, id)).toHaveLength(2);
  });

  it('removes the message outright when the iteration opened no boundary', () => {
    // A rejection on the very first iteration: nothing was accepted, so nothing is kept.
    const { list, id } = listWith(assistant([reasoning('think', 'rs_1'), text('rejected', 'msg_1')]));

    expect(list.rollbackToStepBoundary(id, undefined)).toBe(true);

    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('removes the whole message when a first-iteration response synthesized its own step-start', () => {
    // The regression this signature exists for. A response that emits a tool call and then text
    // gets a *synthetic* step-start between them, indistinguishable from a loop boundary. On a
    // first iteration nothing was accepted, so anchoring on "the last step-start" would splice
    // below the synthetic marker and strand the rejected tool call — unexecuted, still carrying
    // its `fc_…` item id. With no boundary of its own, the rejected attempt is the whole message.
    const { list, id } = listWith(
      assistant([toolCall('call-rejected'), { type: 'step-start' }, text('rejected', 'msg_1')]),
    );

    expect(list.rollbackToStepBoundary(id, undefined)).toBe(true);

    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
    expect(JSON.stringify(list.get.all.v1())).not.toContain('call-rejected');
  });

  it('keeps the accepted step when the rejected response synthesizes a marker of its own', () => {
    // Tyler's case one iteration later. The *rejected* response is tool-call-then-text, so it
    // synthesizes a marker after the loop's boundary. "The last step-start" is now that synthetic
    // one, and anchoring on it would keep the rejected tool call; identity drops the whole step.
    const { list, id } = listWith(
      assistant([toolCall('call-kept'), { type: 'step-start' }, text('accepted', 'msg_1')]),
    );
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(toolCall('call-rejected', 'no'), { type: 'step-start' }, text('rejected', 'msg_2'));

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);

    const parts = partsOf(list, id)!;
    expect(parts.map(p => p.type)).toEqual(['tool-invocation', 'step-start', 'text']);
    expect(JSON.stringify(parts)).not.toContain('rejected');
    expect(JSON.stringify(parts)).not.toContain('call-rejected');
    expect(JSON.stringify(parts)).toContain('call-kept');
  });

  it('drops only the boundary-opened step, keeping everything accepted before it', () => {
    const { list, id } = listWith(assistant([reasoning('think', 'rs_1'), toolCall('call-1')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_2'));

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);

    const parts = partsOf(list, id)!;
    expect(parts.map(p => p.type)).toEqual(['reasoning', 'tool-invocation']);
    expect(JSON.stringify(parts)).not.toContain('rejected');
  });

  it('drops the boundary marker too, so the retry opens a fresh step', () => {
    const { list, id } = listWith(assistant([text('kept', 'msg_1')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_2'));

    list.rollbackToStepBoundary(id, boundary);

    expect(partsOf(list, id)!.some(p => p.type === 'step-start')).toBe(false);
  });

  it('rolls back only to its own boundary when several steps were accepted', () => {
    const { list, id } = listWith(assistant([text('one', 'msg_1'), { type: 'step-start' }, text('two', 'msg_2')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_3'));

    list.rollbackToStepBoundary(id, boundary);

    const parts = partsOf(list, id)!;
    expect(parts.filter(p => p.type === 'text').map(p => (p as { text: string }).text)).toEqual(['one', 'two']);
  });

  it('falls back to whole-message removal when the boundary is no longer in parts', () => {
    // A stale marker — spliced away by an earlier rollback in the same turn, or opened against a
    // different message. Identity lookup misses, and the safe reading is that nothing is accepted.
    const { list, id } = listWith(assistant([text('kept', 'msg_1')]));
    const stale = { type: 'step-start' } as MastraStepStartPart;

    expect(list.rollbackToStepBoundary(id, stale)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('splices at a boundary handed back by the dedupe branch', () => {
    // The message already ends in a marker, so `openStepBoundary` returns it instead of
    // appending a second (whichever writer left it is irrelevant here). It still
    // delimits the coming iteration, and rolling back to it must behave like any other boundary.
    const { list, id } = listWith(assistant([toolCall('call-kept'), { type: 'step-start' }]));
    const { boundary, appended } = list.openStepBoundary();
    expect(appended).toBe(false);
    partsOf(list, id)!.push(text('rejected', 'msg_1'));

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);

    expect(partsOf(list, id)!.map(p => p.type)).toEqual(['tool-invocation']);
  });

  it('recovers the boundary by timestamp when a processor cloned the parts array', () => {
    // A processor may return an *array* instead of mutating the list, and the runner re-adds each
    // returned message with `{ merge: false }`. A processor that clones its messages hands back
    // parts this list has never seen, so reference identity is gone — but `stampPart` put a
    // `createdAt` on the marker and the clone carries it, so the accepted step still survives.
    const { list, id } = listWith(assistant([text('accepted', 'msg_1')]));
    const boundary = openBoundary(list);
    const message = list.get.all.db().find(m => m.id === id)!;
    message.content.parts = message.content.parts!.map(part => structuredClone(part));
    partsOf(list, id)!.push(text('rejected', 'msg_2'));

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);

    const parts = partsOf(list, id)!;
    expect(parts.map(p => p.type)).toEqual(['text']);
    expect(JSON.stringify(parts)).not.toContain('rejected');
  });

  it('removes the message whole rather than guess between two markers sharing a timestamp', () => {
    // Timestamps are millisecond-resolution, so a synthesized marker can tie with the iteration's
    // own. Picking wrong is worse than not picking: too early discards accepted content, too late
    // strands the rejected step — the bug this anchoring exists to prevent.
    const { list, id } = listWith(assistant([text('accepted', 'msg_1')]));
    const boundary = openBoundary(list);
    const message = list.get.all.db().find(m => m.id === id)!;
    message.content.parts = message.content.parts!.map(part => structuredClone(part));
    partsOf(list, id)!.push({ type: 'step-start', createdAt: boundary!.createdAt }, text('rejected', 'msg_2'));

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('removes the message whole when a processor dropped the boundary and left a twin behind', () => {
    // The dangerous shape: a processor that both clones and *edits* can delete the real boundary
    // while a same-millisecond synthetic marker survives. It is then the only timestamp match, and
    // believing it would splice below the rejected tool call — exactly the bug being fixed. What
    // catches it is the checkpoint: the parts in front of the survivor are not the accepted ones.
    const { list, id } = listWith(assistant([text('accepted', 'msg_1')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(toolCall('call-rejected', 'no'), {
      type: 'step-start',
      createdAt: boundary!.createdAt,
    });
    const message = list.get.all.db().find(m => m.id === id)!;
    const cloned = message.content.parts!.map(part => structuredClone(part));
    // Drop the boundary the iteration opened, keeping the twin that trails the rejected call.
    message.content.parts = cloned.filter(part => part !== cloned[1]);

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('removes the message whole when a trim left the survivor with a look-alike prefix', () => {
    // The harder version of the same attack: the processor drops the accepted tool call *and* the
    // boundary, so the surviving twin has one tool-invocation in front of it exactly as the
    // boundary did — the rejected one. Part types alone cannot tell those apart; the tool call id
    // in the checkpoint can.
    const { list, id } = listWith(assistant([toolCall('call-accepted')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(toolCall('call-rejected', 'no'), {
      type: 'step-start',
      createdAt: boundary!.createdAt,
    });
    const message = list.get.all.db().find(m => m.id === id)!;
    const cloned = message.content.parts!.map(part => structuredClone(part));
    message.content.parts = cloned.slice(2);

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('removes the message whole when the survivor is preceded by same-length rejected text', () => {
    // 'approved' and 'rejected' are both eight characters, so a checkpoint that recorded lengths
    // would accept the twin and keep the rejected text. The checkpoint records the strings.
    const { list, id } = listWith(assistant([text('approved', 'msg_1')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_2'), { type: 'step-start', createdAt: boundary!.createdAt });
    const message = list.get.all.db().find(m => m.id === id)!;
    const cloned = message.content.parts!.map(part => structuredClone(part));
    message.content.parts = cloned.slice(2);

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('will not carry a boundary across to a different message that matches by timestamp', () => {
    const { list, id } = listWith(assistant([text('accepted', 'msg_1')]));
    const boundary = openBoundary(list);
    // Sealed, or the merger folds the next assistant row into this one and there is no twin.
    list.get.all.db().find(m => m.id === id)!.content.metadata = { mastra: { sealed: true } };
    const twin = assistant([
      text('accepted', 'msg_1'),
      { type: 'step-start', createdAt: boundary!.createdAt },
      text('rejected', 'msg_2'),
    ]);
    list.add([twin], 'response');

    // Same timestamp, same prefix — but a different message, so the checkpoint does not transfer.
    expect(list.rollbackToStepBoundary(twin.id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === twin.id)).toBeUndefined();
  });

  it('prefers the held reference even when another marker shares its timestamp', () => {
    const { list, id } = listWith(assistant([text('accepted', 'msg_1')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_2'), { type: 'step-start', createdAt: boundary!.createdAt });

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);

    expect(partsOf(list, id)!.map(p => p.type)).toEqual(['text']);
    expect(JSON.stringify(partsOf(list, id)!)).not.toContain('rejected');
  });

  it('removes the message whole when the boundary carries no timestamp to recover by', () => {
    // `MessageMerger` leaves a synthesized marker unstamped when no step-start precedes it, so a
    // deduped boundary can have no `createdAt`. Nothing identifies it once identity is lost.
    const { list, id } = listWith(assistant([text('accepted', 'msg_1')]));
    const boundary = openBoundary(list);
    delete boundary!.createdAt;
    const message = list.get.all.db().find(m => m.id === id)!;
    message.content.parts = message.content.parts!.map(part => structuredClone(part));

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('survives back-to-back rejections, each retry opening and losing its own step', () => {
    // Mirrors the real loop: reject -> rollback -> the retry opens a fresh boundary and writes
    // into it -> reject again -> rollback again. Only the accepted first step may survive.
    const { list, id } = listWith(assistant([text('one', 'msg_1')]));

    const firstBoundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected-a', 'msg_2'));
    list.rollbackToStepBoundary(id, firstBoundary);

    const secondBoundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected-b', 'msg_3'));
    list.rollbackToStepBoundary(id, secondBoundary);

    const final = partsOf(list, id)!;
    expect(final.filter(p => p.type === 'text').map(p => (p as { text: string }).text)).toEqual(['one']);
    expect(final.some(p => p.type === 'step-start')).toBe(false);
    expect(JSON.stringify(final)).not.toContain('rejected');
  });

  it('removes the message when the rollback empties it', () => {
    const { list, id } = listWith(assistant([text('seed', 'msg_0')]));
    const boundary = openBoundary(list);
    // The boundary is the first part: the seed was the previous turn's and has since been sealed
    // off, leaving the marker at index 0. Splicing there leaves nothing.
    partsOf(list, id)!.splice(0, 1);
    partsOf(list, id)!.push(text('rejected', 'msg_1'));

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);

    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('removes a message whose parts array is empty', () => {
    const { list, id } = listWith(assistant([text('seed')]));
    const boundary = openBoundary(list);
    list.get.all.db().find(m => m.id === id)!.content.parts = [];

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('removes a message carrying no parts field at all', () => {
    const { list, id } = listWith(assistant([text('seed')]));
    const boundary = openBoundary(list);
    delete (list.get.all.db().find(m => m.id === id)!.content as { parts?: unknown }).parts;

    expect(list.rollbackToStepBoundary(id, boundary)).toBe(true);
    expect(list.get.all.db().find(m => m.id === id)).toBeUndefined();
  });

  it('re-derives content.content so the rejected text cannot outlive the rollback', () => {
    // `content.content` mirrors the latest text part and is preferred by AIV4 readers.
    const { list, id } = listWith(assistant([text('kept', 'msg_1')], 'kept'));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_2'));
    list.get.all.db().find(m => m.id === id)!.content.content = 'rejected';

    list.rollbackToStepBoundary(id, boundary);

    expect(list.get.all.db().find(m => m.id === id)!.content.content).toBe('kept');
  });

  it('empties content.content when no text part survives the rollback', () => {
    const { list, id } = listWith(assistant([reasoning('think', 'rs_1')], 'seed'));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_2'));
    list.get.all.db().find(m => m.id === id)!.content.content = 'rejected';

    list.rollbackToStepBoundary(id, boundary);

    expect(list.get.all.db().find(m => m.id === id)!.content.content).toBe('');
  });

  it('re-sources a message already flushed mid-turn, so the rollback reaches storage', () => {
    // The loop flushes the assistant message mid-turn (around tool steps), which clears it from
    // the unsaved set. A rollback after that flush must put it back, or the rejected text stays
    // on disk from the earlier flush and only the in-memory copy is ever corrected.
    const { list, id } = listWith(assistant([text('kept', 'msg_1')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(text('rejected', 'msg_2'));

    const firstDrain = list.drainUnsavedMessages();
    expect(firstDrain.map(m => m.id)).toContain(id);
    expect(list.drainUnsavedMessages()).toHaveLength(0);

    list.rollbackToStepBoundary(id, boundary);

    const secondDrain = list.drainUnsavedMessages();
    const a1 = secondDrain.find(m => m.id === id);
    expect(a1).toBeDefined();
    expect(JSON.stringify(a1!.content.parts)).not.toContain('rejected');
  });

  it('prunes the rejected step from the legacy content.toolInvocations mirror', () => {
    // `content.toolInvocations` is the AIV4 mirror MessageMerger maintains alongside `parts`.
    // Anything left there but absent from `parts` is treated as an *unprocessed* invocation by
    // convert-to-mastra-v1 and pushed back into the prompt, which would resurrect the very tool
    // call the rejection discarded.
    const { list, id } = listWith(assistant([text('kept', 'msg_1')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(toolCall('call-rejected', 'rejected-result'));
    const stored = list.get.all.db().find(m => m.id === id)!;
    stored.content.toolInvocations = [
      { toolCallId: 'call-rejected', toolName: 'lookup', args: {}, state: 'result', result: 'rejected-result' },
    ] as MastraDBMessage['content']['toolInvocations'];

    list.rollbackToStepBoundary(id, boundary);

    const after = list.get.all.db().find(m => m.id === id)!;
    expect(after.content.toolInvocations ?? []).toHaveLength(0);
    expect(JSON.stringify(list.get.all.v1())).not.toContain('call-rejected');
  });

  it('keeps accepted invocations in the mirror while pruning the rejected one', () => {
    const { list, id } = listWith(assistant([toolCall('call-kept')]));
    const boundary = openBoundary(list);
    partsOf(list, id)!.push(toolCall('call-rejected', 'no'));
    const stored = list.get.all.db().find(m => m.id === id)!;
    stored.content.toolInvocations = [
      { toolCallId: 'call-kept', toolName: 'lookup', args: {}, state: 'result', result: 'ok' },
      { toolCallId: 'call-rejected', toolName: 'lookup', args: {}, state: 'result', result: 'no' },
    ] as MastraDBMessage['content']['toolInvocations'];

    list.rollbackToStepBoundary(id, boundary);

    const after = list.get.all.db().find(m => m.id === id)!;
    expect((after.content.toolInvocations ?? []).map(t => t.toolCallId)).toEqual(['call-kept']);
  });
});

describe('MessageList#openStepBoundary', () => {
  it('hands back the marker it appended', () => {
    const { list, id } = listWith(assistant([text('one', 'msg_1')]));

    const { boundary, appended } = list.openStepBoundary();

    expect(appended).toBe(true);
    expect(boundary).toBeDefined();
    expect(partsOf(list, id)!.at(-1)).toBe(boundary);
  });

  it('reuses a trailing marker rather than duplicating it', () => {
    // A response ending in a synthetic marker leaves nothing after it, so that marker already
    // delimits the coming iteration and is safe to hand back as its boundary.
    const { list, id } = listWith(assistant([toolCall('call-1'), { type: 'step-start' }]));

    const { boundary, appended } = list.openStepBoundary();

    expect(appended).toBe(false);
    expect(boundary).toBe(partsOf(list, id)!.at(-1));
    expect(partsOf(list, id)!.filter(p => p.type === 'step-start')).toHaveLength(1);
  });

  it('reports no boundary when the last assistant message is sealed', () => {
    // Sealing happens post-observation; a sealed message must not be appended to, so the
    // iteration gets no boundary and a rejection falls back to removing the message.
    const { list, id } = listWith(assistant([text('one', 'msg_1')]));
    const message = list.get.all.db().find(m => m.id === id)!;
    message.content.metadata = { ...(message.content.metadata ?? {}), mastra: { sealed: true } };

    expect(list.openStepBoundary()).toEqual({ appended: false });
    expect(
      list.get.all
        .db()
        .find(m => m.id === id)!
        .content.parts!.some(p => p.type === 'step-start'),
    ).toBe(false);
  });
});
