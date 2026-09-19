import { describe, it, expect } from 'vitest';
import type { MastraDBMessage, MastraMessagePart } from '../agent/message-list/state/types';
import { applyUpdate } from './apply-update';
import type { Session } from './session';
import { createTestSession } from './test-utils';
import type { AgentControllerEvent } from './types';

function assistantMessage(parts: MastraMessagePart[], id = 'm1'): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    content: { format: 2, parts },
    createdAt: new Date(),
  };
}

function emit(session: Session, event: AgentControllerEvent) {
  session.emit(event);
}

describe('applyUpdate', () => {
  it('appends a text delta to the last text part and preserves other parts', () => {
    const reasoningPart: MastraMessagePart = { type: 'reasoning', reasoning: 'why', details: [] };
    const message = assistantMessage([reasoningPart, { type: 'text', text: 'hello' }, { type: 'text', text: '!' }]);

    const updated = applyUpdate(message, { type: 'text-delta', delta: ' world' });

    expect(updated?.content.parts).toEqual([
      { type: 'reasoning', reasoning: 'why', details: [] },
      { type: 'text', text: 'hello' },
      { type: 'text', text: '! world' },
    ]);
  });

  it('pushes a new text part when the message has no text part yet', () => {
    const message = assistantMessage([{ type: 'reasoning', reasoning: 'why', details: [] }]);

    const updated = applyUpdate(message, { type: 'text-delta', delta: 'first' });

    expect(updated?.content.parts).toEqual([
      { type: 'reasoning', reasoning: 'why', details: [] },
      { type: 'text', text: 'first' },
    ]);
  });

  it('appends a reasoning delta and rewrites details from the accumulated reasoning', () => {
    const message = assistantMessage([{ type: 'reasoning', reasoning: 'think', details: [] }]);

    const updated = applyUpdate(message, { type: 'reasoning-delta', index: 0, delta: 'ing' });

    expect(updated?.content.parts).toEqual([
      { type: 'reasoning', reasoning: 'thinking', details: [{ type: 'text', text: 'thinking' }] },
    ]);
  });

  it('returns undefined for a reasoning delta whose index is not a reasoning part', () => {
    const message = assistantMessage([{ type: 'text', text: 'hello' }]);

    expect(applyUpdate(message, { type: 'reasoning-delta', index: 0, delta: 'nope' })).toBeUndefined();
    expect(applyUpdate(message, { type: 'reasoning-delta', index: 7, delta: 'nope' })).toBeUndefined();
  });

  it('replaces the part at the given index with a clone of the update payload', () => {
    const part: MastraMessagePart = { type: 'text', text: 'before' };
    const message = assistantMessage([part]);
    const replacement: MastraMessagePart = {
      type: 'tool-invocation',
      toolInvocation: { state: 'call', toolCallId: 't1', toolName: 'read_file', args: {} },
    };

    const updated = applyUpdate(message, { type: 'part', index: 0, part: replacement });

    expect(updated?.content.parts[0]).toEqual(replacement);
    expect(updated?.content.parts[0]).not.toBe(replacement);

    // Mutating the folded copy must not reach the object the caller passed in.
    (
      updated!.content.parts[0] as { type: 'tool-invocation'; toolInvocation: { toolName: string } }
    ).toolInvocation.toolName = 'mutated';
    expect(replacement.toolInvocation.toolName).toBe('read_file');
  });

  it('appends a part at the length boundary and rejects indices beyond it', () => {
    const message = assistantMessage([{ type: 'text', text: 'hello' }]);
    const appended: MastraMessagePart = { type: 'text', text: 'appended' };

    // `parts.length` is the emitter's append boundary for a new part.
    const atBoundary = applyUpdate(message, { type: 'part', index: 1, part: appended });
    expect(atBoundary?.content.parts).toHaveLength(2);
    expect(atBoundary?.content.parts[1]).toEqual(appended);

    for (const index of [2, 7, -1, 0.5, Number.NaN]) {
      expect(applyUpdate(message, { type: 'part', index, part: appended })).toBeUndefined();
    }
  });

  it('returns undefined for a missing message or a string content', () => {
    expect(applyUpdate(undefined, { type: 'text-delta', delta: 'x' })).toBeUndefined();

    const legacy = {
      id: 'm1',
      role: 'assistant',
      content: 'plain text',
      createdAt: new Date(),
    } as unknown as MastraDBMessage;
    expect(applyUpdate(legacy, { type: 'text-delta', delta: 'x' })).toBeUndefined();
  });

  it('never mutates the input message or its parts array', () => {
    const originalParts: MastraMessagePart[] = [
      { type: 'reasoning', reasoning: 'think', details: [] },
      { type: 'text', text: 'hello' },
    ];
    const snapshot = structuredClone(originalParts);
    const message = assistantMessage(originalParts);

    const textUpdated = applyUpdate(message, { type: 'text-delta', delta: ' world' });
    const reasoningUpdated = applyUpdate(message, { type: 'reasoning-delta', index: 0, delta: 'ing' });
    const partUpdated = applyUpdate(message, {
      type: 'part',
      index: 1,
      part: { type: 'text', text: 'replaced' },
    });

    expect(originalParts).toEqual(snapshot);
    expect(message.content.parts).toBe(originalParts);

    for (const updated of [textUpdated, reasoningUpdated, partUpdated]) {
      expect(updated).not.toBe(message);
      expect(updated?.content).not.toBe(message.content);
      expect(updated?.content.parts).not.toBe(originalParts);
    }
  });
});

describe('SessionDisplayState.apply via applyUpdate', () => {
  let session: Session;

  const msg1: MastraDBMessage = {
    id: 'm1',
    role: 'assistant' as const,
    content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
    createdAt: new Date(),
  };

  async function freshSession() {
    const ctx = await createTestSession({});
    session = ctx.session;
  }

  it('folds compact deltas into currentMessage', async () => {
    await freshSession();
    emit(session, { type: 'message_start', message: msg1 });
    emit(session, { type: 'message_update', id: 'm1', event: { type: 'text-delta', delta: ' world' } });
    emit(session, { type: 'message_update', id: 'm1', event: { type: 'text-delta', delta: '!' } });

    expect(session.displayState.get().currentMessage?.content.parts).toEqual([{ type: 'text', text: 'hello world!' }]);
  });

  it('leaves currentMessage content-identical when a delta does not apply', async () => {
    await freshSession();
    emit(session, { type: 'message_start', message: msg1 });

    emit(session, { type: 'message_update', id: 'm1', event: { type: 'reasoning-delta', index: 0, delta: 'nope' } });

    expect(session.displayState.get().currentMessage).toEqual(msg1);
  });

  it('ignores deltas addressed to a different message id', async () => {
    await freshSession();
    emit(session, { type: 'message_start', message: msg1 });
    emit(session, { type: 'message_update', id: 'other', event: { type: 'text-delta', delta: ' ignored' } });
    emit(session, { type: 'message_end', id: 'm1' });

    expect(session.displayState.get().currentMessage).toEqual(msg1);
  });
});
