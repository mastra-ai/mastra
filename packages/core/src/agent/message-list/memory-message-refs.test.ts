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
  return { warn: vi.fn(), debug: vi.fn() } as unknown as IMastraLogger & {
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
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

  it('ignores framework token caches at all supported metadata locations without losing stored content', async () => {
    const rows = storedRows();
    const { load } = storage(rows);
    const refs = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await refs.verify(state, load);
    const counted = structuredClone(state);
    const first = counted.messages[0]! as any;
    first.content.parts[0].providerMetadata = {
      mastra: { tokenEstimate: { v: 8, key: 'part', tokens: 2, source: 'v8:tokenx' } },
    };
    first.content.metadata = { mastra: { tokenEstimate: { v: 8, key: 'content', tokens: 3, source: 'v8:tokenx' } } };
    first.metadata = { mastra: { tokenEstimate: { v: 8, key: 'message', tokens: 4, source: 'v8:tokenx' } } };
    const second = counted.messages[1]! as any;
    second.content.parts[2].providerMetadata = {
      other: { retained: true },
      mastra: { tokenEstimate: { v: 8, key: 'part', tokens: 2, source: 'v8:tokenx' } },
    };
    // A non-cache metadata edit is still a real edit and stays inline.
    expect(refs.dehydrate(counted).messages.map(isMemoryMessageRef)).toEqual([true, false, false]);
    delete second.content.parts[2].providerMetadata.other;
    const dehydrated = refs.dehydrate(counted);
    expect(dehydrated.messages.map(isMemoryMessageRef)).toEqual([true, true, false]);
    expect(refs.dehydrate(dehydrated).messages).toEqual(dehydrated.messages);
    const restored = await new MemoryMessageRefs().hydrate(dehydrated, load);
    expect(restored.messages[0]).toEqual(JSON.parse(JSON.stringify(state.messages[0])));
    expect(restored.messages[1]).toEqual(JSON.parse(JSON.stringify(state.messages[1])));
  });

  it('preserves client token estimates and other metadata edits', async () => {
    const { load } = storage();
    const refs = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await refs.verify(state, load);
    const changed = structuredClone(state);
    (changed.messages[0]!.content.parts[0] as any).providerMetadata = {
      mastra: { tokenEstimate: { source: 'client', tokens: 5 } },
    };
    expect(isMemoryMessageRef(refs.dehydrate(changed).messages[0])).toBe(false);
    (changed.messages[0]!.content.parts[0] as any).providerMetadata.mastra.tokenEstimate.source = 'third-party';
    expect(isMemoryMessageRef(refs.dehydrate(changed).messages[0])).toBe(false);
    const counted = structuredClone(state);
    (counted.messages[0]!.content.parts[0] as any).providerMetadata = {
      mastra: { tokenEstimate: { key: 'counter', tokens: 1 }, imageDimensions: { width: 10 } },
    };
    expect(isMemoryMessageRef(refs.dehydrate(counted).messages[0])).toBe(false);
  });

  it('keeps client estimates in the match key when framework estimates are merged into their cache', () => {
    const rows = storedRows();
    const client = { v: 0, key: 'client', tokens: 7, source: 'client' };
    (rows[0]!.content.parts[0] as any).providerMetadata = { mastra: { tokenEstimate: client } };
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(rows, 'memory');
    const state = list.serialize();
    const refs = new MemoryMessageRefs();
    refs.recordSaved(rows, state.memoryInfo);

    const counted = structuredClone(state);
    (counted.messages[0]!.content.parts[0] as any).providerMetadata.mastra.tokenEstimate = {
      client: { ...client },
      framework: { v: 8, key: 'framework', tokens: 9, source: 'v8:tokenx' },
    };
    expect(isMemoryMessageRef(refs.dehydrate(counted).messages[0])).toBe(true);
    (counted.messages[0]!.content.parts[0] as any).providerMetadata.mastra.tokenEstimate.client.tokens = 8;
    expect(isMemoryMessageRef(refs.dehydrate(counted).messages[0])).toBe(false);

    (rows[0]!.content.parts[0] as any).providerMetadata.mastra.tokenEstimate = { client: { ...client, tokens: 7 } };
    const mappedList = new MessageList({ threadId: 't', resourceId: 'r' });
    mappedList.add(rows, 'memory');
    const mappedState = mappedList.serialize();
    const mappedRefs = new MemoryMessageRefs();
    mappedRefs.recordSaved(rows, mappedState.memoryInfo);
    const mappedCounted = structuredClone(mappedState);
    (mappedCounted.messages[0]!.content.parts[0] as any).providerMetadata.mastra.tokenEstimate.framework = {
      v: 8,
      key: 'framework',
      tokens: 9,
      source: 'v8:tokenx',
    };
    expect(isMemoryMessageRef(mappedRefs.dehydrate(mappedCounted).messages[0])).toBe(true);
    const renamed = structuredClone(mappedCounted);
    const renamedEstimate = (renamed.messages[0]!.content.parts[0] as any).providerMetadata.mastra.tokenEstimate;
    renamedEstimate.other = renamedEstimate.client;
    delete renamedEstimate.client;
    expect(isMemoryMessageRef(mappedRefs.dehydrate(renamed).messages[0])).toBe(false);
    (mappedCounted.messages[0]!.content.parts[0] as any).providerMetadata.mastra.tokenEstimate.client.tokens = 8;
    expect(isMemoryMessageRef(mappedRefs.dehydrate(mappedCounted).messages[0])).toBe(false);
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

  it('restores a message edited in storage as stored, logging it at debug level', async () => {
    const { byId, load } = storage();
    const writer = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await writer.verify(state, load);
    const persisted = JSON.parse(JSON.stringify(writer.dehydrate(state)));

    byId.get('u1')!.content = { format: 2, parts: [{ type: 'text', text: 'hi, edited' }] };
    const logger = testLogger();
    const hydrated = await new MemoryMessageRefs().hydrate(persisted, load, { logger, runId: 'run-1' });

    expect(hydrated.messages[0]!.content.parts).toEqual([{ type: 'text', text: 'hi, edited' }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('changed in memory'), {
      runId: 'run-1',
      messageId: 'u1',
    });
  });

  it('drops a message deleted from storage, logging it at debug level', async () => {
    const { byId, load } = storage();
    const writer = new MemoryMessageRefs();
    const state = runTranscript().serialize();
    await writer.verify(state, load);
    const persisted = JSON.parse(JSON.stringify(writer.dehydrate(state)));

    byId.delete('a1');
    const logger = testLogger();
    const reader = new MemoryMessageRefs();
    const hydrated = await reader.hydrate(persisted, load, { logger, runId: 'run-1' });

    expect(hydrated.messages.map(message => message.id)).toEqual(['u1', state.messages[2]!.id]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('deleted from memory'), {
      runId: 'run-1',
      messageId: 'a1',
    });
    const restored = new MessageList({ threadId: 't', resourceId: 'r' }).deserialize(hydrated);
    expect(restored.get.all.db().map(message => message.id)).toEqual(['u1', state.messages[2]!.id]);

    // Later restores of the same run don't look the deleted message up again.
    load.mockClear();
    expect(await reader.hydrate(persisted, load)).toEqual(hydrated);
    expect(load).not.toHaveBeenCalled();
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

  it('replaces messages the run saved with refs without reading storage, and keeps them inline once they change', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add('new input', 'input');
    const saved = list.get.all.db();
    const refs = new MemoryMessageRefs();
    refs.recordSaved(structuredClone(saved), { threadId: 't', resourceId: 'r' });

    const state = list.serialize();
    const dehydrated = refs.dehydrate(state);
    expect(dehydrated.messages.every(isMemoryMessageRef)).toBe(true);

    const load = vi.fn<StoredMessageLoader>();
    expect(await refs.hydrate(dehydrated, load)).toEqual(state);
    expect(load).not.toHaveBeenCalled();

    list.add({ role: 'user', content: 'edited', id: saved[0]!.id } as any, 'input');
    expect(refs.dehydrate(list.serialize()).messages.some(isMemoryMessageRef)).toBe(false);
  });
});
