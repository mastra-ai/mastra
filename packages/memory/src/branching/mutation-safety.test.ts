import { MASTRA_THREAD_BRANCH_METADATA_KEY } from '@mastra/core/memory';
import type { MastraDBMessage } from '@mastra/core/memory';
import {
  getThreadBranchAuthorizationCandidates,
  persistGeneratedMessages,
  persistMessagesWithThreadCreation,
} from '@mastra/core/memory/internal';
import { MessageHistory } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../index';

const resourceId = 'mutation-resource';
const forkTime = new Date('2026-01-01T00:00:00.000Z');

function message(id: string, threadId: string, createdAt: Date, text = id): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    type: 'text',
    content: { format: 2, parts: [{ type: 'text', text }] },
    createdAt,
  };
}

describe('branch mutation integrity', () => {
  let memory: Memory;
  let store: MemoryStorage;

  beforeEach(async () => {
    memory = new Memory({ storage: new InMemoryStore() });
    store = (await memory.storage.getStore('memory'))!;
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({ messages: [message('fork', 'root', forkTime)] });
  });

  it('does not serialize mutations for unrelated branch trees', async () => {
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    await memory.createThread({ threadId: 'unrelated', resourceId: 'unrelated-resource' });

    const originalPatchThread = store.patchThread.bind(store);
    let releaseRoot!: () => void;
    let rootReachedPatch!: () => void;
    let unrelatedReachedPatch!: () => void;
    const rootAtPatch = new Promise<void>(resolve => {
      rootReachedPatch = resolve;
    });
    const unrelatedAtPatch = new Promise<void>(resolve => {
      unrelatedReachedPatch = resolve;
    });
    const continueRoot = new Promise<void>(resolve => {
      releaseRoot = resolve;
    });
    vi.spyOn(store, 'patchThread').mockImplementation(async input => {
      if (input.id === 'root') {
        rootReachedPatch();
        await continueRoot;
      } else if (input.id === 'unrelated') {
        unrelatedReachedPatch();
      }
      return originalPatchThread(input);
    });

    const rootUpdate = memory.updateThread({ id: 'root', title: 'updated root' });
    await rootAtPatch;
    const concurrentMemory = new Memory({ storage: memory.storage });
    const unrelatedUpdate = concurrentMemory.updateThread({ id: 'unrelated', title: 'updated unrelated' });

    const unrelatedProgressed = await Promise.race([
      unrelatedAtPatch.then(() => true),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 250)),
    ]);
    releaseRoot();
    expect(unrelatedProgressed).toBe(true);
    await expect(Promise.all([rootUpdate, unrelatedUpdate])).resolves.toHaveLength(2);
  });

  it('creates missing threads inside the validated persistence lock without deleting a concurrent writer', async () => {
    const originalSaveMessages = store.saveMessages.bind(store);
    let releaseFirst!: () => void;
    let firstReachedSave!: () => void;
    const firstAtSave = new Promise<void>(resolve => {
      firstReachedSave = resolve;
    });
    const continueFirst = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    vi.spyOn(store, 'saveMessages').mockImplementation(async input => {
      if (input.messages.some(item => item.id === 'first-generated')) {
        firstReachedSave();
        await continueFirst;
        throw new Error('first persistence failed');
      }
      return originalSaveMessages(input);
    });
    const thread = {
      id: 'generated-thread',
      resourceId,
      title: '',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const first = persistGeneratedMessages(
      memory,
      { messages: [message('first-generated', thread.id, forkTime)], thread },
      ['first-generated'],
    );
    await firstAtSave;
    const concurrentMemory = new Memory({ storage: memory.storage });
    const second = persistGeneratedMessages(
      concurrentMemory,
      { messages: [message('second-generated', thread.id, forkTime)], thread },
      ['second-generated'],
    );
    releaseFirst();

    await expect(first).rejects.toThrow('first persistence failed');
    await expect(second).resolves.toMatchObject({ messages: [expect.objectContaining({ id: 'second-generated' })] });
    expect(await store.getThreadById({ threadId: thread.id })).toMatchObject({ id: thread.id });
    expect((await store.listMessagesById({ messageIds: ['first-generated', 'second-generated'] })).messages).toEqual([
      expect.objectContaining({ id: 'second-generated' }),
    ]);
  });

  it('preserves branch lineage when explicit-only missing-thread persistence races branch creation', async () => {
    const originalGetThreadById = store.getThreadById.bind(store);
    let releaseLookup!: () => void;
    let lookupCompleted!: () => void;
    const staleLookupReached = new Promise<void>(resolve => {
      lookupCompleted = resolve;
    });
    const continuePersistence = new Promise<void>(resolve => {
      releaseLookup = resolve;
    });
    vi.spyOn(store, 'getThreadById').mockImplementationOnce(async input => {
      const stale = await originalGetThreadById(input);
      lookupCompleted();
      await continuePersistence;
      return stale;
    });
    const processor = new MessageHistory({
      storage: store,
      persistMessages: (input, generatedIds) => persistMessagesWithThreadCreation(memory, input, generatedIds),
      persistMessagesCreatesThread: true,
    });
    const explicit = message('explicit-race', 'race-child', new Date(forkTime.getTime() + 1));
    const persistence = processor.persistMessages({
      messages: [explicit],
      threadId: 'race-child',
      resourceId,
    });
    await staleLookupReached;
    vi.spyOn(memory as any, 'generateId').mockReturnValue('race-child');
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    releaseLookup();

    await expect(persistence).resolves.toBeUndefined();
    expect(branch.thread.id).toBe('race-child');
    expect((await store.getThreadById({ threadId: branch.thread.id }))?.metadata).toHaveProperty(
      MASTRA_THREAD_BRANCH_METADATA_KEY,
    );
    expect((await store.listMessagesById({ messageIds: [explicit.id] })).messages).toEqual([explicit]);
  });

  it('atomically rejects duplicate create-only thread persistence without overwriting the winner', async () => {
    const createThread = (title: string) =>
      persistMessagesWithThreadCreation(
        memory,
        {
          messages: [],
          thread: {
            id: 'create-only-thread',
            resourceId,
            title,
            metadata: { title },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          requireThreadCreation: true,
        },
        [],
      );

    const results = await Promise.allSettled([createThread('winner-a'), createThread('winner-b')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const stored = await store.getThreadById({ threadId: 'create-only-thread' });
    expect(stored).toMatchObject({
      id: 'create-only-thread',
      resourceId,
      title: expect.stringMatching(/^winner-[ab]$/),
    });
    expect(stored?.metadata).toEqual({ title: stored?.title });
  });

  it('preserves resource-scoped Working Memory initialization for atomic thread creation and rolls back failures', async () => {
    const workingMemory = new Memory({
      storage: new InMemoryStore(),
      options: { workingMemory: { enabled: true, scope: 'resource' } },
    });
    const workingMemoryStore = (await workingMemory.storage.getStore('memory'))!;
    const create = (threadId: string, value: string) =>
      persistMessagesWithThreadCreation(
        workingMemory,
        {
          messages: [],
          thread: {
            id: threadId,
            resourceId,
            title: '',
            metadata: { workingMemory: value },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          requireThreadCreation: true,
        },
        [],
      );

    await create('working-memory-thread', 'remember me');
    expect(await workingMemoryStore.getResourceById({ resourceId })).toMatchObject({ workingMemory: 'remember me' });

    vi.spyOn(workingMemoryStore, 'updateResource').mockRejectedValueOnce(new Error('resource update failed'));
    await expect(create('failed-working-memory-thread', 'do not retain')).rejects.toThrow('resource update failed');
    expect(await workingMemoryStore.getThreadById({ threadId: 'failed-working-memory-thread' })).toBeNull();

    vi.spyOn(workingMemoryStore, 'saveMessages').mockRejectedValueOnce(new Error('message persistence failed'));
    await expect(
      persistMessagesWithThreadCreation(
        workingMemory,
        {
          messages: [message('failed-create-message', 'failed-message-thread', new Date())],
          thread: {
            id: 'failed-message-thread',
            resourceId,
            title: '',
            metadata: { workingMemory: 'must not replace prior state' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          requireThreadCreation: true,
        },
        [],
      ),
    ).rejects.toThrow('message persistence failed');
    expect(await workingMemoryStore.getResourceById({ resourceId })).toMatchObject({ workingMemory: 'remember me' });
    expect(await workingMemoryStore.getThreadById({ threadId: 'failed-message-thread' })).toBeNull();

    const originalSaveMessages = workingMemoryStore.saveMessages.bind(workingMemoryStore);
    vi.spyOn(workingMemoryStore, 'saveMessages').mockImplementationOnce(async ({ messages }) => {
      await originalSaveMessages({ messages: messages.slice(0, 1) });
      throw new Error('partial message persistence failed');
    });
    await expect(
      persistMessagesWithThreadCreation(
        workingMemory,
        {
          messages: [message('partial-create-message', 'partial-message-thread', new Date())],
          thread: {
            id: 'partial-message-thread',
            resourceId,
            title: '',
            metadata: { workingMemory: 'must not replace prior state' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          requireThreadCreation: true,
        },
        [],
      ),
    ).rejects.toThrow('partial message persistence failed');
    expect((await workingMemoryStore.listMessagesById({ messageIds: ['partial-create-message'] })).messages).toEqual(
      [],
    );
    expect(await workingMemoryStore.getThreadById({ threadId: 'partial-message-thread' })).toBeNull();
    expect(await workingMemoryStore.getResourceById({ resourceId })).toMatchObject({ workingMemory: 'remember me' });

    vi.spyOn(workingMemoryStore, 'updateResource').mockRejectedValueOnce(new Error('direct save resource failure'));
    await expect(
      workingMemory.saveThread({
        thread: {
          id: 'direct-save-thread',
          resourceId,
          title: 'new',
          metadata: { workingMemory: 'must roll back' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow('direct save resource failure');
    expect(await workingMemoryStore.getThreadById({ threadId: 'direct-save-thread' })).toBeNull();

    const beforeUpdate = await workingMemoryStore.getThreadById({ threadId: 'working-memory-thread' });
    vi.spyOn(workingMemoryStore, 'updateResource').mockRejectedValueOnce(new Error('direct update resource failure'));
    await expect(
      workingMemory.updateThread({
        id: 'working-memory-thread',
        title: 'changed',
        metadata: { workingMemory: 'must roll back' },
      }),
    ).rejects.toThrow('direct update resource failure');
    expect(await workingMemoryStore.getThreadById({ threadId: 'working-memory-thread' })).toEqual(beforeUpdate);
    expect(await workingMemoryStore.getResourceById({ resourceId })).toMatchObject({ workingMemory: 'remember me' });
  });

  it('ignores pending-only descendants when authorizing and mutating an ordinary root', async () => {
    await store.saveThread({
      thread: {
        id: 'pending-child',
        resourceId,
        title: '',
        metadata: {
          [MASTRA_THREAD_BRANCH_METADATA_KEY]: {
            state: 'pending',
            parentThreadId: 'root',
            branchPointMessageId: 'fork',
            branchPointCreatedAt: forkTime.toISOString(),
            branchCreatedAt: new Date(forkTime.getTime() + 1).toISOString(),
            observationalMemoryThreadId: 'pending-child',
          },
        },
        createdAt: new Date(forkTime.getTime() + 1),
        updatedAt: new Date(forkTime.getTime() + 1),
      },
    });

    await expect(getThreadBranchAuthorizationCandidates(memory, 'root', 'descendants')).resolves.toEqual([
      expect.objectContaining({ id: 'root' }),
    ]);
    await expect(
      memory.saveMessages({ messages: [message('root-after-pending', 'root', new Date(forkTime.getTime() + 2))] }),
    ).resolves.toMatchObject({ messages: [expect.objectContaining({ id: 'root-after-pending' })] });
  });

  it('normalizes trusted generated timestamps monotonically while explicit backdated rows fail closed', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(forkTime.getTime());
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const first = message('generated-a', branch.thread.id, forkTime);
    const second = message('generated-b', branch.thread.id, forkTime);

    await persistGeneratedMessages(memory, { messages: [first, second] }, ['generated-a', 'generated-b']);

    const physical = await store.listMessages({
      threadId: branch.thread.id,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(physical.messages.map(item => item.id)).toEqual(['generated-a', 'generated-b']);
    expect(physical.messages[0]!.createdAt.getTime()).toBeGreaterThan(forkTime.getTime());
    expect(physical.messages[1]!.createdAt.getTime()).toBeGreaterThan(physical.messages[0]!.createdAt.getTime());

    await expect(
      memory.saveMessages({ messages: [message('explicit-backdated', branch.thread.id, forkTime)] }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect((await store.listMessagesById({ messageIds: ['explicit-backdated'] })).messages).toEqual([]);
  });

  it('preserves stored tuples for generated upserts and places later generated rows after the physical tail', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    await persistGeneratedMessages(memory, { messages: [message('generated', branch.thread.id, forkTime)] }, [
      'generated',
    ]);
    const stored = (await store.listMessagesById({ messageIds: ['generated'] })).messages[0]!;
    const laterTime = new Date(stored.createdAt.getTime() + 10_000);
    await memory.saveMessages({ messages: [message('physical-tail', branch.thread.id, laterTime)] });

    await persistGeneratedMessages(
      memory,
      {
        messages: [
          message('generated', branch.thread.id, new Date('2030-01-01T00:00:00.000Z'), 'updated'),
          message('generated-after-upsert', branch.thread.id, forkTime),
        ],
      },
      ['generated', 'generated-after-upsert'],
    );

    const updated = (await store.listMessagesById({ messageIds: ['generated'] })).messages[0]!;
    const later = (await store.listMessagesById({ messageIds: ['generated-after-upsert'] })).messages[0]!;
    expect(updated.createdAt).toEqual(stored.createdAt);
    expect(updated.content).toMatchObject({ parts: [{ type: 'text', text: 'updated' }] });
    expect(later.createdAt.getTime()).toBeGreaterThan(laterTime.getTime());
  });

  it('rejects referenced-prefix rewrites, ownership moves, and ancestor deletion before side effects', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const tailTime = new Date('2026-01-01T00:01:00.000Z');
    await memory.saveMessages({ messages: [message('tail', 'root', tailTime)] });
    const updateStorage = vi.spyOn(store, 'updateMessages');
    const deleteStorage = vi.spyOn(store, 'deleteMessages');

    await expect(
      memory.updateMessages({ messages: [{ id: 'fork', content: { content: 'rewritten' } }] }),
    ).rejects.toMatchObject({
      id: 'BRANCH_MUTATION_CONFLICT',
    });
    await expect(
      memory.updateMessages({ messages: [{ id: 'tail', threadId: branch.thread.id }] }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    await expect(memory.deleteMessages(['fork'])).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(updateStorage).not.toHaveBeenCalled();
    expect(deleteStorage).not.toHaveBeenCalled();
    await expect(memory.deleteThread('root')).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    await expect(
      memory.updateThreadResourceId({ threadId: 'root', resourceId: 'other-resource' }),
    ).rejects.toMatchObject({
      id: 'BRANCH_MUTATION_CONFLICT',
    });
    await expect(
      memory.updateThreadResourceId({ threadId: branch.thread.id, resourceId: 'other-resource' }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });

    await expect(
      memory.updateMessages({ messages: [{ id: 'tail', content: { content: 'allowed tail update' } }] }),
    ).resolves.toBeDefined();
    expect((await store.listMessagesById({ messageIds: ['fork'] })).messages[0]!.content).not.toMatchObject({
      content: 'rewritten',
    });
  });

  it('does not alter vectors when message storage rejects an update', async () => {
    const indexes = new Set<string>();
    const deleteVectors = vi.fn().mockResolvedValue(undefined);
    const upsert = vi.fn().mockResolvedValue(undefined);
    const vector = {
      id: 'mutation-vector',
      createIndex: vi.fn(async ({ indexName }: { indexName: string }) => indexes.add(indexName)),
      listIndexes: vi.fn(async () => [...indexes]),
      describeIndex: vi.fn().mockResolvedValue({ dimension: 4 }),
      deleteVectors,
      upsert,
      query: vi.fn().mockResolvedValue([]),
    } as unknown as MastraVector;
    const vectorMemory = new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder: {
        doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({
          embeddings: values.map(() => [0.1, 0.1, 0.1, 0.1]),
        })),
        modelId: 'mock-embedder',
        specificationVersion: 'v1',
        provider: 'mock',
      } as any,
      options: { semanticRecall: { scope: 'thread' }, generateTitle: false },
    });
    const vectorStore = (await vectorMemory.storage.getStore('memory'))!;
    await vectorMemory.createThread({ threadId: 'vector-root', resourceId });
    await vectorMemory.saveMessages({
      messages: [message('vector-message', 'vector-root', forkTime, 'before')],
    });
    await vectorMemory.settled();
    deleteVectors.mockClear();
    upsert.mockClear();
    const updateMessages = vi
      .spyOn(vectorStore, 'updateMessages')
      .mockRejectedValueOnce(new Error('storage rejected update'));

    await expect(
      vectorMemory.updateMessages({ messages: [{ id: 'vector-message', content: { content: 'after' } }] }),
    ).rejects.toThrow('storage rejected update');
    expect(deleteVectors).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();

    const persisted = (await vectorStore.listMessagesById({ messageIds: ['vector-message'] })).messages[0]!;
    updateMessages.mockResolvedValueOnce([persisted]);
    await vectorMemory.updateMessages({
      messages: [{ id: 'vector-message', content: { content: undefined } }],
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: [expect.objectContaining({ message_id: 'vector-message', content: 'before' })],
      }),
    );
  });

  it('indexes canonical messages returned by the storage adapter', async () => {
    const indexes = new Set<string>();
    const upsert = vi.fn().mockResolvedValue(undefined);
    const doEmbed = vi.fn(async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => [0.1, 0.1, 0.1, 0.1]),
    }));
    const vector = {
      id: 'adapter-parity-vector',
      createIndex: vi.fn(async ({ indexName }: { indexName: string }) => indexes.add(indexName)),
      listIndexes: vi.fn(async () => [...indexes]),
      describeIndex: vi.fn().mockResolvedValue({ dimension: 4 }),
      deleteVectors: vi.fn().mockResolvedValue(undefined),
      upsert,
      query: vi.fn().mockResolvedValue([]),
    } as unknown as MastraVector;
    const vectorMemory = new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder: {
        doEmbed,
        modelId: 'mock-embedder',
        specificationVersion: 'v1',
        provider: 'mock',
      } as any,
      options: { semanticRecall: { scope: 'thread' }, generateTitle: false },
    });
    const vectorStore = (await vectorMemory.storage.getStore('memory'))!;
    await vectorMemory.createThread({ threadId: 'adapter-root', resourceId });
    const originalSaveMessages = vectorStore.saveMessages.bind(vectorStore);
    vi.spyOn(vectorStore, 'saveMessages').mockImplementation(async ({ messages }) =>
      originalSaveMessages({
        messages: messages.map(item =>
          item.id === 'adapter-message'
            ? {
                ...item,
                content: { format: 2, parts: [{ type: 'text', text: 'adapter normalized' }] },
              }
            : item,
        ),
      }),
    );

    await vectorMemory.saveMessages({
      messages: [message('adapter-message', 'adapter-root', forkTime, 'caller value')],
    });
    await vectorMemory.settled();

    expect(doEmbed).toHaveBeenCalledWith(expect.objectContaining({ values: ['adapter normalized'] }));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: [
          expect.objectContaining({
            message_id: 'adapter-message',
            content: 'adapter normalized',
            created_at: forkTime.toISOString(),
          }),
        ],
      }),
    );

    upsert.mockClear();
    vi.spyOn(vectorStore, 'saveMessages').mockImplementationOnce(async ({ messages }) =>
      originalSaveMessages({
        messages: messages.map(item => ({ ...item, createdAt: new Date(item.createdAt.getTime() - 1) })),
      }),
    );
    await expect(
      vectorMemory.saveMessages({
        messages: [message('invalid-adapter-message', 'adapter-root', new Date(forkTime.getTime() + 10), 'invalid')],
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect((await vectorStore.listMessagesById({ messageIds: ['invalid-adapter-message'] })).messages).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();

    vi.spyOn(vectorStore, 'saveMessages').mockImplementationOnce(async ({ messages }) => {
      const persisted = await originalSaveMessages({ messages: messages.slice(0, 1) });
      return { ...persisted, messages: [persisted.messages[0]!, persisted.messages[0]!] };
    });
    await expect(
      vectorMemory.saveMessages({
        messages: [
          message('duplicate-result-a', 'adapter-root', new Date(forkTime.getTime() + 20)),
          message('missing-result-b', 'adapter-root', new Date(forkTime.getTime() + 21)),
        ],
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(
      (await vectorStore.listMessagesById({ messageIds: ['duplicate-result-a', 'missing-result-b'] })).messages,
    ).toEqual([]);

    vi.spyOn(vectorStore, 'saveMessages').mockImplementationOnce(async ({ messages }) =>
      originalSaveMessages({ messages: messages.map(item => ({ ...item, id: 'unexpected-adapter-id' })) }),
    );
    await expect(
      vectorMemory.saveMessages({
        messages: [message('expected-adapter-id', 'adapter-root', new Date(forkTime.getTime() + 30))],
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(
      (await vectorStore.listMessagesById({ messageIds: ['expected-adapter-id', 'unexpected-adapter-id'] })).messages,
    ).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('enforces both equal-timestamp ID tie directions on parent and child writes', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const saveStorage = vi.spyOn(store, 'saveMessages');

    await expect(memory.saveMessages({ messages: [message('aaa-parent', 'root', forkTime)] })).rejects.toMatchObject({
      id: 'BRANCH_MUTATION_CONFLICT',
    });
    await expect(
      memory.saveMessages({ messages: [message('aaa-child', branch.thread.id, forkTime)] }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(saveStorage).not.toHaveBeenCalled();

    await memory.saveMessages({
      messages: [message('zzz-parent', 'root', forkTime), message('zzz-child', branch.thread.id, forkTime)],
    });
    expect((await store.listMessagesById({ messageIds: ['zzz-parent', 'zzz-child'] })).messages).toHaveLength(2);

    await expect(
      memory.updateMessages({ messages: [{ id: 'zzz-parent', createdAt: new Date(forkTime.getTime() - 1) }] }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    await expect(
      memory.updateMessages({ messages: [{ id: 'zzz-child', createdAt: new Date(forkTime.getTime() - 1) }] }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
  });

  it('preserves mixed-batch input order and rejects invalid ordering atomically', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(forkTime.getTime());
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const explicit = message('explicit', branch.thread.id, new Date(forkTime.getTime() + 10));
    const generated = message('generated', branch.thread.id, forkTime);

    await persistGeneratedMessages(memory, { messages: [explicit, generated] }, ['generated']);
    const accepted = await store.listMessages({
      threadId: branch.thread.id,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(accepted.messages.map(item => item.id)).toEqual(['explicit', 'generated']);
    expect(accepted.messages[1]!.createdAt.getTime()).toBeGreaterThan(accepted.messages[0]!.createdAt.getTime());

    const rejectedGenerated = message('rejected-generated', branch.thread.id, forkTime);
    const rejectedExplicit = message('rejected-explicit', branch.thread.id, forkTime);
    await expect(
      persistGeneratedMessages(memory, { messages: [rejectedGenerated, rejectedExplicit] }, ['rejected-generated']),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(
      (await store.listMessagesById({ messageIds: ['rejected-generated', 'rejected-explicit'] })).messages,
    ).toEqual([]);
  });

  it.each([
    { clockOffset: 0, generatedOffset: 2 },
    { clockOffset: 100, generatedOffset: 100 },
    { clockOffset: 100, generatedOffset: 2 },
  ])(
    'preserves an already-valid generated timestamp in an ordinary mixed batch clock=$clockOffset generated=$generatedOffset',
    async ({ clockOffset, generatedOffset }) => {
      const start = forkTime.getTime();
      vi.spyOn(Date, 'now').mockReturnValue(start + clockOffset);
      const explicit = message(`ordinary-explicit-${clockOffset}-${generatedOffset}`, 'root', forkTime);
      const generatedAt = new Date(start + generatedOffset);
      const generated = message(`ordinary-generated-${clockOffset}-${generatedOffset}`, 'root', generatedAt);

      await persistGeneratedMessages(memory, { messages: [explicit, generated] }, [generated.id]);

      const stored = (await store.listMessagesById({ messageIds: [generated.id] })).messages[0]!;
      expect(stored.createdAt).toEqual(generatedAt);
    },
  );

  it('preserves caller order while accepting an existing generated-message upsert', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(forkTime.getTime());
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const existing = message('existing-generated', branch.thread.id, forkTime);
    await persistGeneratedMessages(memory, { messages: [existing] }, [existing.id]);
    const storedBefore = (await store.listMessagesById({ messageIds: [existing.id] })).messages[0]!;
    const saveStorage = vi.spyOn(store, 'saveMessages');
    const explicit = message(
      'explicit-after-existing',
      branch.thread.id,
      new Date(storedBefore.createdAt.getTime() + 10),
    );
    const upsert = {
      ...existing,
      content: { ...existing.content, parts: [{ type: 'text' as const, text: 'updated' }] },
    };

    await persistGeneratedMessages(memory, { messages: [explicit, upsert] }, [upsert.id]);

    expect(saveStorage.mock.calls.at(-1)?.[0].messages.map(item => item.id)).toEqual([explicit.id, upsert.id]);
    const storedAfter = (await store.listMessagesById({ messageIds: [existing.id] })).messages[0]!;
    expect(storedAfter.createdAt).toEqual(storedBefore.createdAt);

    saveStorage.mockClear();
    const backdated = message('zzz-backdated', branch.thread.id, forkTime);
    await expect(
      persistGeneratedMessages(memory, { messages: [upsert, backdated] }, [upsert.id]),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(saveStorage).not.toHaveBeenCalled();
  });

  it('validates raw observational-memory persistence and its generated provenance', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(forkTime.getTime());
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const originalSaveMessages = store.saveMessages.bind(store);
    const saveStorage = vi.spyOn(store, 'saveMessages');
    const rejected = message('aaa-raw', branch.thread.id, forkTime);

    await expect(memory.persistMessages([rejected])).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(saveStorage).not.toHaveBeenCalled();

    await memory.persistMessages([rejected], [rejected.id]);
    const saved = (await store.listMessagesById({ messageIds: [rejected.id] })).messages[0]!;
    expect(saved.createdAt.getTime()).toBeGreaterThan(forkTime.getTime());

    saveStorage.mockImplementationOnce(async ({ messages }) =>
      originalSaveMessages({ messages: messages.map(item => ({ ...item, createdAt: forkTime })) }),
    );
    await expect(
      memory.persistMessages(
        [message('invalid-raw-canonical', branch.thread.id, new Date(forkTime.getTime() + 10))],
        ['invalid-raw-canonical'],
      ),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect((await store.listMessagesById({ messageIds: ['invalid-raw-canonical'] })).messages).toEqual([]);

    saveStorage.mockImplementationOnce(async ({ messages }) => {
      const persisted = await originalSaveMessages({ messages: messages.slice(0, 1) });
      return { ...persisted, messages: [persisted.messages[0]!, persisted.messages[0]!] };
    });
    await expect(
      memory.persistMessages(
        [
          message('raw-duplicate-result', branch.thread.id, new Date(forkTime.getTime() + 20)),
          message('raw-missing-result', branch.thread.id, new Date(forkTime.getTime() + 21)),
        ],
        ['raw-duplicate-result', 'raw-missing-result'],
      ),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(
      (await store.listMessagesById({ messageIds: ['raw-duplicate-result', 'raw-missing-result'] })).messages,
    ).toEqual([]);
  });

  it('does not let message properties activate generated timestamp normalization', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const spoofed = Object.assign(message('aaa-spoofed', branch.thread.id, forkTime), {
      generatedMessageIds: ['aaa-spoofed'],
      [Symbol.for('mastra.generatedMessageIds')]: ['aaa-spoofed'],
    });

    await expect(memory.saveMessages({ messages: [spoofed] })).rejects.toMatchObject({
      id: 'BRANCH_MUTATION_CONFLICT',
    });
    expect((await store.listMessagesById({ messageIds: ['aaa-spoofed'] })).messages).toEqual([]);
  });

  it('retains ordinary explicit-only ordering outside a branch tree', async () => {
    await memory.createThread({ threadId: 'ordinary', resourceId });
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const later = message('ordinary-later', 'ordinary', new Date('2026-01-01T00:02:00.000Z'));
    const earlier = message('ordinary-earlier', 'ordinary', new Date('2026-01-01T00:01:00.000Z'));

    await memory.saveMessages({ messages: [later, earlier] });

    expect((await store.listMessagesById({ messageIds: [later.id, earlier.id] })).messages).toHaveLength(2);
  });

  it('serializes a pre-branch mutation through branch snapshot revalidation', async () => {
    let releaseMutation!: () => void;
    let mutationReachedStorage!: () => void;
    let branchReachedLock!: () => void;
    const mutationAtStorage = new Promise<void>(resolve => {
      mutationReachedStorage = resolve;
    });
    const branchAtLock = new Promise<void>(resolve => {
      branchReachedLock = resolve;
    });
    const continueMutation = new Promise<void>(resolve => {
      releaseMutation = resolve;
    });
    const originalUpdate = store.updateMessages.bind(store);
    vi.spyOn(store, 'updateMessages').mockImplementationOnce(async input => {
      mutationReachedStorage();
      await continueMutation;
      return originalUpdate(input);
    });
    const originalLocks = (memory as any).withBranchMutationLocks.bind(memory);
    let lockCalls = 0;
    vi.spyOn(memory as any, 'withBranchMutationLocks').mockImplementation(
      async (keys: string[], operation: () => unknown) => {
        lockCalls += 1;
        if (lockCalls === 2) branchReachedLock();
        return originalLocks(keys, operation);
      },
    );

    const rewrite = memory.updateMessages({ messages: [{ id: 'fork', content: { content: 'rewritten' } }] });
    await mutationAtStorage;
    vi.spyOn(memory as any, 'generateId').mockReturnValue('losing-branch');
    const branch = memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    await branchAtLock;
    releaseMutation();

    await expect(rewrite).resolves.toBeDefined();
    await expect(branch).rejects.toMatchObject({ id: expect.stringMatching(/^BRANCH_/) });
    expect(await store.getThreadById({ threadId: 'losing-branch' })).toBeNull();
  });

  it('serializes branch creation with root resource changes in either order', async () => {
    const rawRoot = (await store.getThreadById({ threadId: 'root' }))!;
    const originalLocks = (memory as any).withBranchMutationLocks.bind(memory);
    let releaseTransfer!: () => void;
    let transferReachedLock!: () => void;
    const transferAtLock = new Promise<void>(resolve => {
      transferReachedLock = resolve;
    });
    const continueTransfer = new Promise<void>(resolve => {
      releaseTransfer = resolve;
    });
    const lockSpy = vi
      .spyOn(memory as any, 'withBranchMutationLocks')
      .mockImplementationOnce(async (keys: string[], operation: () => unknown) => {
        transferReachedLock();
        await continueTransfer;
        return originalLocks(keys, operation);
      });

    const transfer = memory.saveThread({ thread: { ...rawRoot, resourceId: 'other-resource' } });
    await transferAtLock;
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    releaseTransfer();
    await expect(transfer).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });

    lockSpy.mockRestore();
    const secondMemory = new Memory({ storage: new InMemoryStore() });
    const secondStore = (await secondMemory.storage.getStore('memory'))!;
    await secondMemory.createThread({ threadId: 'root', resourceId });
    await secondMemory.saveMessages({ messages: [message('fork', 'root', forkTime)] });
    const secondRawRoot = (await secondStore.getThreadById({ threadId: 'root' }))!;
    const secondOriginalLocks = (secondMemory as any).withBranchMutationLocks.bind(secondMemory);
    vi.spyOn(secondMemory as any, 'generateId').mockReturnValue('losing-branch');
    let releaseBranch!: () => void;
    let branchReachedLock!: () => void;
    const branchAtLock = new Promise<void>(resolve => {
      branchReachedLock = resolve;
    });
    const continueBranch = new Promise<void>(resolve => {
      releaseBranch = resolve;
    });
    vi.spyOn(secondMemory as any, 'withBranchMutationLocks').mockImplementationOnce(
      async (keys: string[], operation: () => unknown) => {
        branchReachedLock();
        await continueBranch;
        return secondOriginalLocks(keys, operation);
      },
    );

    const secondBranch = secondMemory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    await branchAtLock;
    await expect(
      secondMemory.saveThread({ thread: { ...secondRawRoot, resourceId: 'other-resource' } }),
    ).resolves.toMatchObject({ resourceId: 'other-resource' });
    releaseBranch();
    await expect(secondBranch).rejects.toMatchObject({ id: expect.stringMatching(/^BRANCH_/) });
    expect(await secondStore.getThreadById({ threadId: 'losing-branch' })).toBeNull();
  });

  it('retries deletion when message ownership changes before locks are acquired', async () => {
    const originalListMessagesById = store.listMessagesById.bind(store);
    let releaseSnapshot!: () => void;
    let snapshotRead!: () => void;
    const snapshotReached = new Promise<void>(resolve => {
      snapshotRead = resolve;
    });
    const continueDelete = new Promise<void>(resolve => {
      releaseSnapshot = resolve;
    });
    vi.spyOn(store, 'listMessagesById').mockImplementationOnce(async input => {
      const stale = await originalListMessagesById(input);
      snapshotRead();
      await continueDelete;
      return stale;
    });

    const deletion = memory.deleteMessages(['fork']);
    await snapshotReached;
    await memory.updateThreadResourceId({ threadId: 'root', resourceId: 'moved-resource' });
    const movedFork = (await originalListMessagesById({ messageIds: ['fork'] })).messages[0]!;
    await store.updateMessages({ messages: [{ ...movedFork, resourceId: 'moved-resource' }] });
    expect((await store.getThreadById({ threadId: 'root' }))?.resourceId).toBe('moved-resource');
    expect((await originalListMessagesById({ messageIds: ['fork'] })).messages[0]?.resourceId).toBe('moved-resource');
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    releaseSnapshot();

    await expect(deletion).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect((await originalListMessagesById({ messageIds: ['fork'] })).messages).toHaveLength(1);
  });

  it('discovers descendant protections beyond the default thread page', async () => {
    let branchId = 0;
    vi.spyOn(memory as any, 'generateId').mockImplementation(() => `branch-${branchId++}`);
    for (let index = 0; index < 105; index += 1) {
      await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    }

    await expect(memory.deleteMessages(['fork'])).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect((await store.listMessagesById({ messageIds: ['fork'] })).messages).toHaveLength(1);
  });

  it('ignores malformed lineage metadata in unrelated resources during message mutations', async () => {
    await store.saveThread({
      thread: {
        id: 'unrelated-corrupt',
        resourceId: 'unrelated-resource',
        title: '',
        metadata: { [MASTRA_THREAD_BRANCH_METADATA_KEY]: { malformed: true } },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const leaf = message('ordinary-leaf', 'root', new Date(forkTime.getTime() + 1));

    await expect(memory.saveMessages({ messages: [leaf] })).resolves.toMatchObject({ messages: [leaf] });
    await expect(
      memory.updateMessages({ messages: [{ id: leaf.id, content: { content: 'updated' } }] }),
    ).resolves.toHaveLength(1);
    await expect(memory.deleteMessages([leaf.id])).resolves.toBeUndefined();
  });

  it('allows leaf deletion and removes its physical rows', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    await persistGeneratedMessages(memory, { messages: [message('child-tail', branch.thread.id, forkTime)] }, [
      'child-tail',
    ]);

    await memory.deleteThread(branch.thread.id);

    expect(await store.getThreadById({ threadId: branch.thread.id })).toBeNull();
    expect((await store.listMessagesById({ messageIds: ['child-tail'] })).messages).toEqual([]);
  });
});
