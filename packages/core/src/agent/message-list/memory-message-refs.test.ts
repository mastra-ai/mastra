import { describe, expect, it, vi } from 'vitest';
import { MastraError } from '../../error';
import type { IMastraLogger } from '../../logger';
import { isMemoryMessageRef, MemoryMessageRefs } from './memory-message-refs';
import type { StoredMessageLoader } from './memory-message-refs';
import { MessageList } from './message-list';
import type { MastraDBMessage } from './state/types';

function storedRows(): MastraDBMessage[] {
  return [
    {
      id: 'u1',
      threadId: 't',
      resourceId: 'r',
      role: 'user',
      createdAt: new Date(1000),
      content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
    },
    {
      id: 'a1',
      threadId: 't',
      resourceId: 'r',
      role: 'assistant',
      createdAt: new Date(2000),
      content: {
        format: 2,
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'c1', toolName: 'x', args: { a: 1 }, result: { ok: true } },
          },
          { type: 'text', text: 'done' },
        ],
      },
    },
  ];
}

/** A run transcript: recalled history plus a new user message. */
function runTranscript() {
  const list = new MessageList({ threadId: 't', resourceId: 'r' });
  list.add(storedRows(), 'memory');
  list.add('new input', 'input');
  return list;
}

function storage(rows = storedRows()) {
  const byId = new Map(rows.map(row => [row.id, structuredClone(row)]));
  const load = vi.fn<StoredMessageLoader>(async ids =>
    ids.flatMap(id => (byId.has(id) ? [structuredClone(byId.get(id)!)] : [])),
  );
  return { byId, load };
}

function testLogger() {
  return { warn: vi.fn() } as unknown as IMastraLogger & { warn: ReturnType<typeof vi.fn> };
}

describe('MemoryMessageRefs', () => {
  it('leaves the transcript inline until recalled messages are verified', () => {
    const state = runTranscript().serialize();
    expect(new MemoryMessageRefs().dehydrate(state)).toBe(state);
  });

  it('replaces verified recalled messages with refs and restores them exactly', async () => {
    const { load } = storage();
    const refs = new MemoryMessageRefs();
    const state = runTranscript().serialize();

    await refs.verify(state, load);
    const dehydrated = refs.dehydrate(state);

    expect(
      dehydrated.messages.map(message => (isMemoryMessageRef(message) ? `ref:${message.id}` : message.id)),
    ).toEqual(['ref:u1', 'ref:a1', state.messages[2]!.id]);
    expect(JSON.stringify(dehydrated).length).toBeLessThan(JSON.stringify(state).length);

    load.mockClear();
    const hydrated = await refs.hydrate(JSON.parse(JSON.stringify(dehydrated)), load);
    expect(load).not.toHaveBeenCalled();
    expect(hydrated).toEqual(JSON.parse(JSON.stringify(state)));
  });

  it('restores refs from storage in a process that never verified them', async () => {
    const { load } = storage();
    const writer = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await writer.verify(state, load);
    const persisted = JSON.parse(JSON.stringify(writer.dehydrate(state)));

    const reader = new MemoryMessageRefs();
    const hydrated = await reader.hydrate(persisted, load);

    expect(load).toHaveBeenLastCalledWith(['u1', 'a1']);
    expect(hydrated).toEqual(JSON.parse(JSON.stringify(state)));
    // The restored list behaves like the original one.
    const restored = new MessageList({ threadId: 't', resourceId: 'r' }).deserialize(hydrated);
    expect(restored.serialize()).toEqual(
      new MessageList({ threadId: 't', resourceId: 'r' }).deserialize(state).serialize(),
    );
    // Rows loaded to hydrate are verified for the next store.
    expect(reader.dehydrate(hydrated).messages.filter(isMemoryMessageRef)).toHaveLength(2);
  });

  it('keeps recalled messages a processor changed inline', async () => {
    const { load } = storage();
    const refs = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    state.messages[0] = {
      ...state.messages[0]!,
      content: { format: 2, parts: [{ type: 'text', text: 'hi (trimmed)' }] },
    };

    await refs.verify(state, load);
    const dehydrated = refs.dehydrate(state);

    expect(dehydrated.messages[0]).toEqual(state.messages[0]);
    expect(isMemoryMessageRef(dehydrated.messages[1])).toBe(true);
  });

  it('restores a message edited in storage as stored, with a warning', async () => {
    const { byId, load } = storage();
    const writer = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await writer.verify(state, load);
    const persisted = JSON.parse(JSON.stringify(writer.dehydrate(state)));

    byId.get('u1')!.content = { format: 2, parts: [{ type: 'text', text: 'hi, edited' }] };
    const logger = testLogger();
    const hydrated = await new MemoryMessageRefs().hydrate(persisted, load, { logger, runId: 'run-1' });

    expect(hydrated.messages[0]!.content.parts).toEqual([{ type: 'text', text: 'hi, edited' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('changed in memory'), {
      runId: 'run-1',
      messageId: 'u1',
    });
  });

  it('drops a message deleted from storage, with a warning', async () => {
    const { byId, load } = storage();
    const writer = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await writer.verify(state, load);
    const persisted = JSON.parse(JSON.stringify(writer.dehydrate(state)));

    byId.delete('a1');
    const logger = testLogger();
    const hydrated = await new MemoryMessageRefs().hydrate(persisted, load, { logger, runId: 'run-1' });

    expect(hydrated.messages.map(message => message.id)).toEqual(['u1', state.messages[2]!.id]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('deleted from memory'), {
      runId: 'run-1',
      messageId: 'a1',
    });
    const restored = new MessageList({ threadId: 't', resourceId: 'r' }).deserialize(hydrated);
    expect(restored.get.all.db().map(message => message.id)).toEqual(['u1', state.messages[2]!.id]);
  });

  it('fails to hydrate refs without a store, and stays inline when it cannot verify', async () => {
    const { load } = storage();
    const writer = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await writer.verify(state, load);
    const persisted = JSON.parse(JSON.stringify(writer.dehydrate(state)));

    const noStore: StoredMessageLoader = async () => undefined;
    await expect(new MemoryMessageRefs().hydrate(persisted, noStore)).rejects.toThrow(MastraError);

    const unverified = new MemoryMessageRefs();
    await unverified.verify(state, noStore);
    expect(unverified.dehydrate(state)).toBe(state);
  });

  it('keeps the transcript inline when verification fails', async () => {
    const refs = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    const logger = testLogger();
    await refs.verify(state, async () => Promise.reject(new Error('db down')), logger);

    expect(refs.dehydrate(state)).toBe(state);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('shares one lookup across concurrent and repeated verifies', async () => {
    const { load } = storage();
    const refs = new MemoryMessageRefs();
    const state = runTranscript().serialize();

    await Promise.all([refs.verify(state, load), refs.verify(state, load), refs.verify(state, load)]);
    await refs.verify(state, load);

    expect(load).toHaveBeenCalledTimes(1);
  });
});
