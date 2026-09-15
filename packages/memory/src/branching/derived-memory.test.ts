import { MASTRA_THREAD_BRANCH_METADATA_KEY } from '@mastra/core/memory';
import type { MastraDBMessage, ObservationalMemoryRecord } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import xxhash from 'xxhash-wasm';
import { Memory } from '../index';

const resourceId = 'branch-om-resource';
const firstTime = new Date('2026-01-01T00:00:00.000Z');
const secondTime = new Date('2026-01-01T00:01:00.000Z');

function message(id: string, createdAt: Date): MastraDBMessage {
  return {
    id,
    threadId: 'root',
    resourceId,
    role: 'user',
    type: 'text',
    content: { format: 2, parts: [{ type: 'text', text: id }] },
    createdAt,
  };
}

async function seedSource(memory: Memory, store: MemoryStorage) {
  await memory.createThread({ threadId: 'root', resourceId });
  await memory.saveMessages({ messages: [message('reachable', firstTime), message('post-fork', secondTime)] });
  return store;
}

async function seedRecord(store: MemoryStorage, scope: 'thread' | 'resource'): Promise<ObservationalMemoryRecord> {
  const record = await store.initializeObservationalMemory({
    threadId: scope === 'thread' ? 'root' : null,
    resourceId,
    scope,
    config: { sourceOnly: { nested: true } },
  });
  Object.assign(record, {
    activeObservations: 'current aggregate state',
    metadata: { sourceOnly: { nested: true } },
    observedMessageIds: ['reachable', 'post-fork', 'missing'],
    bufferedMessageIds: ['reachable', 'post-fork'],
    isObserving: true,
    isReflecting: true,
    isBufferingObservation: true,
    isBufferingReflection: true,
  });
  return record;
}

describe('branch-owned Observational Memory', () => {
  it.each(['thread', 'resource'] as const)(
    'clones the active %s-scoped baseline into child-owned state with reachable references',
    async scope => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: { observationalMemory: { enabled: true, scope } },
      });
      const store = (await memory.storage.getStore('memory'))!;
      await seedSource(memory, store);
      const source = await seedRecord(store, scope);

      const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });
      const cloned = await store.getObservationalMemory(branch.thread.id, resourceId);

      expect(cloned).toMatchObject({
        threadId: branch.thread.id,
        resourceId,
        scope,
        activeObservations: 'current aggregate state',
        observedMessageIds: ['reachable'],
        bufferedMessageIds: ['reachable'],
        isObserving: false,
        isReflecting: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
      });
      expect(cloned?.id).not.toBe(source.id);
      expect(await store.getObservationalMemoryHistory(branch.thread.id, resourceId)).toHaveLength(1);
      expect(await store.getObservationalMemory(scope === 'thread' ? 'root' : null, resourceId)).toBe(source);
    },
  );

  it('remaps resource-scoped thread tags to the child identity', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'resource' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await seedSource(memory, store);
    const source = await seedRecord(store, 'resource');
    const hasher = await xxhash();
    const sourceTag = hasher.h32ToString('root');
    const childId = 'tagged-child';
    const childTag = hasher.h32ToString(childId);
    source.activeObservations = `<thread id="${sourceTag}">source</thread>`;
    source.bufferedReflection = `<thread id="${sourceTag}">reflection</thread>`;
    vi.spyOn(memory as any, 'generateId').mockReturnValue(childId);

    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });

    const child = (await store.getObservationalMemory(childId, resourceId))!;
    expect(child.activeObservations).toBe(`<thread id="${childTag}">source</thread>`);
    expect(child.bufferedReflection).toBe(`<thread id="${childTag}">reflection</thread>`);
    expect(source.activeObservations).toContain(sourceTag);
  });

  it('does not fall back to shared resource OM for pending branches', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'resource' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await seedSource(memory, store);
    await seedRecord(store, 'resource');
    await store.saveThread({
      thread: {
        id: 'pending-child',
        resourceId,
        createdAt: secondTime,
        updatedAt: secondTime,
        metadata: {
          [MASTRA_THREAD_BRANCH_METADATA_KEY]: {
            parentThreadId: 'root',
            branchPointMessageId: 'reachable',
            branchPointCreatedAt: firstTime.toISOString(),
            branchCreatedAt: secondTime.toISOString(),
            observationalMemoryThreadId: 'pending-child',
            state: 'pending',
          },
        },
      },
    });
    const engine = (await memory.omEngine)!;

    await expect(engine.getObservations('pending-child', resourceId)).rejects.toMatchObject({ id: 'BRANCH_NOT_FOUND' });
  });

  it('routes resource-scoped lifecycle operations to child-owned records and keeps generations independent', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'resource' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await seedSource(memory, store);
    const source = await seedRecord(store, 'resource');
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });
    const engine = (await memory.omEngine)!;

    expect(await engine.getObservations(branch.thread.id, resourceId)).toBe('current aggregate state');
    const child = (await engine.getRecord(branch.thread.id, resourceId))!;
    expect(child.config).not.toBe(source.config);
    expect(child.metadata).not.toBe(source.metadata);
    await engine.updateRecordConfig(branch.thread.id, resourceId, { branchOnly: true });
    await store.createReflectionGeneration({ currentRecord: child, reflection: 'child reflection', tokenCount: 2 });

    expect((await engine.getRecord(branch.thread.id, resourceId))?.config).toMatchObject({
      _overrides: { branchOnly: true },
    });
    expect(await engine.getHistory(branch.thread.id, resourceId)).toHaveLength(2);
    expect(await store.getObservationalMemory(null, resourceId)).toBe(source);
    expect(source.config).toEqual({ sourceOnly: { nested: true } });
    expect(source.metadata).toEqual({ sourceOnly: { nested: true } });
    expect(await store.getObservationalMemoryHistory(null, resourceId)).toHaveLength(1);

    await engine.clear(branch.thread.id, resourceId);
    expect(await engine.getRecord(branch.thread.id, resourceId)).toBeNull();
    expect(await store.getObservationalMemory(null, resourceId)).toBe(source);
  });

  it('excludes branch tails from resource-scoped root context and disables cross-thread context for a branch', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'resource' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await seedSource(memory, store);
    await seedRecord(store, 'resource');
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });
    await memory.saveMessages({
      messages: [{ ...message('branch-tail', new Date('2026-01-01T00:02:00.000Z')), threadId: branch.thread.id }],
    });
    await memory.createThread({ threadId: 'ordinary', resourceId });
    await memory.saveMessages({
      messages: [{ ...message('ordinary-tail', new Date('2026-01-01T00:03:00.000Z')), threadId: 'ordinary' }],
    });
    const engine = (await memory.omEngine)!;

    expect(await engine.getOtherThreadsContext(resourceId, branch.thread.id)).toBeUndefined();
    const rootContext = await engine.getOtherThreadsContext(resourceId, 'root');
    expect(rootContext).toContain('ordinary-tail');
    expect(rootContext).not.toContain('branch-tail');
  });

  it('skips cloning when OM is disabled or has no active source record', async () => {
    const disabled = new Memory({ storage: new InMemoryStore() });
    const disabledStore = (await disabled.storage.getStore('memory'))!;
    await seedSource(disabled, disabledStore);
    await seedRecord(disabledStore, 'thread');
    const disabledBranch = await disabled.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });
    expect(await disabledStore.getObservationalMemory(disabledBranch.thread.id, resourceId)).toBeNull();

    const empty = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'thread' } },
    });
    const emptyStore = (await empty.storage.getStore('memory'))!;
    await seedSource(empty, emptyStore);
    const emptyBranch = await empty.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });
    expect(await emptyStore.getObservationalMemory(emptyBranch.thread.id, resourceId)).toBeNull();
  });

  it('fails before publication when configured OM is unsupported', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'thread' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await seedSource(memory, store);
    Object.defineProperty(store, 'supportsObservationalMemory', { value: false });

    await expect(memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' })).rejects.toMatchObject({
      id: 'BRANCHING_UNSUPPORTED',
    });
    expect((await store.listThreads({ perPage: false })).threads.map(thread => thread.id)).toEqual(['root']);
  });

  it('preserves raw lineage through both thread-scoped Working Memory update paths', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { workingMemory: { enabled: true, scope: 'thread' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await memory.createThread({ threadId: 'root', resourceId, metadata: { workingMemory: 'source memory' } });
    await memory.saveMessages({ messages: [message('reachable', firstTime)] });
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });

    await memory.updateWorkingMemory({ threadId: branch.thread.id, resourceId, workingMemory: 'updated memory' });
    await memory.__experimental_updateWorkingMemoryVNext({
      threadId: branch.thread.id,
      resourceId,
      workingMemory: 'appended memory',
    });

    const raw = await store.getThreadById({ threadId: branch.thread.id });
    expect(raw?.metadata?.workingMemory).toContain('appended memory');
    expect(raw?.metadata).toHaveProperty(MASTRA_THREAD_BRANCH_METADATA_KEY);
    expect((await memory.getThreadById({ threadId: branch.thread.id }))?.metadata).not.toHaveProperty(
      MASTRA_THREAD_BRANCH_METADATA_KEY,
    );
  });

  it('keeps resource-scoped Working Memory shared after branch creation and updates', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { workingMemory: { enabled: true, scope: 'resource' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.updateWorkingMemory({ threadId: 'root', resourceId, workingMemory: 'shared source memory' });
    await memory.saveMessages({ messages: [message('reachable', firstTime)] });
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' });

    await memory.updateWorkingMemory({
      threadId: branch.thread.id,
      resourceId,
      workingMemory: 'shared child update',
    });

    expect(await memory.getWorkingMemory({ threadId: 'root', resourceId })).toBe('shared child update');
    expect(await memory.getWorkingMemory({ threadId: branch.thread.id, resourceId })).toBe('shared child update');
    expect((await store.getThreadById({ threadId: branch.thread.id }))?.metadata?.workingMemory).toBeUndefined();
  });

  it('rolls back child-owned state without changing the source when OM cloning fails', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'thread' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await seedSource(memory, store);
    const source = await seedRecord(store, 'thread');
    vi.spyOn(memory as any, 'generateId').mockReturnValue('failed-branch');
    vi.spyOn(store, 'insertObservationalMemoryRecord').mockRejectedValueOnce(new Error('insert failed'));

    await expect(memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' })).rejects.toThrow(
      'insert failed',
    );

    expect(await store.getThreadById({ threadId: 'failed-branch' })).toBeNull();
    expect(await store.getObservationalMemory('failed-branch', resourceId)).toBeNull();
    expect(await store.getObservationalMemory('root', resourceId)).toBe(source);
  });

  it('removes cloned OM when ready publication fails and leaves source state unchanged', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { enabled: true, scope: 'resource' } },
    });
    const store = (await memory.storage.getStore('memory'))!;
    await seedSource(memory, store);
    const source = await seedRecord(store, 'resource');
    vi.spyOn(memory as any, 'generateId').mockReturnValue('publish-failed-branch');
    vi.spyOn(store, 'patchThread').mockRejectedValueOnce(new Error('publish failed'));

    await expect(memory.branchThread({ threadId: 'root', branchPointMessageId: 'reachable' })).rejects.toThrow(
      'publish failed',
    );

    expect(await store.getThreadById({ threadId: 'publish-failed-branch' })).toBeNull();
    expect(await store.getObservationalMemory('publish-failed-branch', resourceId)).toBeNull();
    expect(await store.getObservationalMemory(null, resourceId)).toBe(source);
  });
});
