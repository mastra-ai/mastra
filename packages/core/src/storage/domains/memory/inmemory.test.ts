import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, beforeEach } from 'vitest';
import type { MastraDBMessage } from '../../../memory/types';
import { setRunFenceContext } from '../../run-fencing';
import type { RunFence, RunFenceScope } from '../../run-fencing';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

// This mirrors createMessagesListIncludeResourceScopeTest in @internal/storage-test-utils.
// @mastra/core cannot depend on that package, because it would make the workspace
// dependency graph circular, so the same contract is asserted here by hand.

const makeMessage = ({
  id,
  threadId,
  resourceId,
  text,
  minute,
}: {
  id: string;
  threadId: string;
  resourceId: string;
  text: string;
  minute: number;
}): MastraDBMessage =>
  ({
    id,
    threadId,
    resourceId,
    role: 'user',
    type: 'text',
    createdAt: new Date(Date.UTC(2024, 0, 1, 0, minute)),
    content: { format: 2, parts: [{ type: 'text', text }] },
  }) as MastraDBMessage;

describe('InMemoryMemory listMessages include resource scope', () => {
  let store: InMemoryMemory;

  beforeEach(async () => {
    store = new InMemoryMemory({ db: new InMemoryDB() });
    await store.saveMessages({
      messages: [
        // resource-a owns thread-a1 and thread-a2.
        makeMessage({ id: 'a1', threadId: 'thread-a1', resourceId: 'resource-a', text: 'a first', minute: 0 }),
        makeMessage({ id: 'a2', threadId: 'thread-a1', resourceId: 'resource-a', text: 'a target', minute: 1 }),
        makeMessage({ id: 'a3', threadId: 'thread-a1', resourceId: 'resource-a', text: 'a last', minute: 2 }),
        makeMessage({ id: 'a4', threadId: 'thread-a2', resourceId: 'resource-a', text: 'a other thread', minute: 3 }),
        // resource-b owns thread-b1.
        makeMessage({ id: 'b1', threadId: 'thread-b1', resourceId: 'resource-b', text: 'b message', minute: 4 }),
      ],
    });
  });

  it('does not return messages owned by another resource', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      resourceId: 'resource-b',
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['b1']);
  });

  it('still returns a cross-thread include from the same resource', async () => {
    const result = await store.listMessages({
      threadId: 'thread-a2',
      resourceId: 'resource-a',
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('does not return another resource on the semantic recall fast path', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      resourceId: 'resource-b',
      perPage: 0,
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages).toEqual([]);
  });

  it('keeps cross-resource includes when no resourceId is given', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('reads the context window from the thread that owns the target message', async () => {
    // The include entry names a thread that the target message does not belong to.
    // The window must still come from the target message's own thread.
    const result = await store.listMessages({
      threadId: 'thread-a2',
      resourceId: 'resource-a',
      include: [{ id: 'a2', threadId: 'thread-b1', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('does not return messages owned by another resource from listMessagesByResourceId', async () => {
    const result = await store.listMessagesByResourceId({
      resourceId: 'resource-b',
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['b1']);
  });

  it('does not return another resource from listMessagesByResourceId on the fast path', async () => {
    const result = await store.listMessagesByResourceId({
      resourceId: 'resource-b',
      perPage: 0,
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages).toEqual([]);
  });

  it('returns the include context window from listMessagesByResourceId', async () => {
    const result = await store.listMessagesByResourceId({
      resourceId: 'resource-a',
      perPage: 0,
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('treats an empty resourceId in listMessagesByResourceId as a real scope', async () => {
    // The main query of listMessagesByResourceId compares the resourceId exactly, so an
    // empty string selects nothing. The include lookup must not be looser than that.
    const result = await store.listMessagesByResourceId({
      resourceId: '',
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages).toEqual([]);
  });

  it('keeps an empty resourceId in listMessages unscoped, like its main query', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      resourceId: '',
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'b1']);
  });
});

describe('InMemoryMemory listMessages hasMore with include and a date filter', () => {
  let store: InMemoryMemory;
  const ids = Array.from({ length: 10 }, (_, minute) => `m${minute}`);
  // The filter keeps m4..m9; m0..m3 are outside it.
  const dateRange = { start: new Date(Date.UTC(2024, 0, 1, 0, 4)) };

  beforeEach(async () => {
    store = new InMemoryMemory({ db: new InMemoryDB() });
    await store.saveMessages({
      messages: ids.map((id, minute) =>
        makeMessage({ id, threadId: 'thread-1', resourceId: 'resource-1', text: id, minute }),
      ),
    });
  });

  it('reports more pages when include adds messages from outside the filter', async () => {
    const result = await store.listMessages({
      threadId: 'thread-1',
      perPage: 2,
      page: 0,
      filter: { dateRange },
      include: ['m0', 'm1', 'm2', 'm3'].map(id => ({ id })),
    });

    expect(result.total).toBe(6);
    expect(result.messages.map(message => message.id)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
    expect(result.hasMore).toBe(true);
  });

  it('reports no more pages on the last page when include adds a message from outside the filter', async () => {
    const result = await store.listMessages({
      threadId: 'thread-1',
      perPage: 2,
      page: 2,
      filter: { dateRange },
      include: [{ id: 'm0' }],
    });

    expect(result.total).toBe(6);
    expect(result.messages.map(message => message.id)).toEqual(['m0', 'm8', 'm9']);
    expect(result.hasMore).toBe(false);
  });

  it('reports no more pages when include returns every filtered message', async () => {
    const result = await store.listMessages({
      threadId: 'thread-1',
      perPage: 2,
      page: 0,
      filter: { dateRange },
      include: ['m6', 'm7', 'm8', 'm9'].map(id => ({ id })),
    });

    expect(result.messages.map(message => message.id)).toEqual(['m4', 'm5', 'm6', 'm7', 'm8', 'm9']);
    expect(result.hasMore).toBe(false);
  });
});

describe('InMemoryMemory updateThread partial updates', () => {
  it('leaves the stored title alone when only metadata is provided', async () => {
    const memory = new InMemoryMemory({ db: new InMemoryDB() });
    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Generated title',
        metadata: { a: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const updated = await memory.updateThread({ id: 'thread-1', metadata: { b: 2 } });

    expect(updated.title).toBe('Generated title');
    expect(updated.metadata).toEqual({ a: 1, b: 2 });
  });
});

describe('InMemoryMemory swapBufferedReflectionToActive under a takeover', () => {
  const scopes = new AsyncLocalStorage<RunFenceScope | undefined>();
  const context = setRunFenceContext({ current: () => scopes.getStore(), run: (s, f) => scopes.run(s, f) });
  const inFence = <T>(fence: RunFence, fn: () => T): T => context.run({ fenceFor: () => fence }, fn);
  const bufferReflection = (memory: InMemoryMemory, id: string, reflection: string) =>
    memory.updateBufferedReflection({
      id,
      reflection,
      tokenCount: 1,
      inputTokenCount: 1,
      reflectedObservationLineCount: 0,
    });

  it('keeps a reflection the new owner buffers while a superseded swap is in flight', async () => {
    const memory = new InMemoryMemory({ db: new InMemoryDB() });
    const fenceA = { runId: 'run-1', generation: 1, ownerId: 'owner-a' };
    const fenceB = { runId: 'run-1', generation: 2, ownerId: 'owner-b' };
    await memory.raiseRunFence(fenceA);
    const record = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-1',
      scope: 'resource',
      config: { observationThreshold: 5000, reflectionThreshold: 40000 },
    });
    await inFence(fenceA, () => bufferReflection(memory, record.id, 'a reflection'));

    // Start A's swap, then take over and buffer as B before the swap settles.
    const swap = inFence(fenceA, () => memory.swapBufferedReflectionToActive({ currentRecord: record, tokenCount: 1 }));
    const takeover = memory.raiseRunFence(fenceB);
    const write = inFence(fenceB, () => bufferReflection(memory, record.id, 'b reflection'));
    await Promise.all([swap, takeover, write]);

    const history = await memory.getObservationalMemoryHistory(null, 'resource-1');
    expect(history.find(r => r.id === record.id)?.bufferedReflection).toBe('b reflection');
  });
});
