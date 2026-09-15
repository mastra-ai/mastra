import { MASTRA_THREAD_BRANCH_METADATA_KEY } from '@mastra/core/memory';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../index';
import { resolveThreadLineage } from './lineage';

const resourceId = 'branch-resource';

function message(id: string, threadId: string, createdAt: Date, text = id): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text }] },
    createdAt,
  };
}

describe('Memory.branchThread', () => {
  let memory: Memory;
  let store: MemoryStorage;

  beforeEach(async () => {
    memory = new Memory({ storage: new InMemoryStore() });
    store = (await memory.storage.getStore('memory'))!;
  });

  async function seedRoot(
    metadata?: Record<string, unknown>,
    messages: MastraDBMessage[] = [
      message('m1', 'root', new Date('2026-01-01T00:00:00.000Z')),
      message('m2', 'root', new Date('2026-01-01T00:01:00.000Z')),
      message('m3', 'root', new Date('2026-01-01T00:02:00.000Z')),
    ],
  ): Promise<StorageThreadType> {
    const thread = await memory.createThread({
      threadId: 'root',
      resourceId,
      title: 'Source title',
      metadata,
    });
    await memory.saveMessages({ messages });
    return thread;
  }

  it('creates an inclusive shared-history branch with stable inherited IDs and no copied rows', async () => {
    await seedRoot({ sourceOnly: true });

    const result = await memory.branchThread({
      threadId: 'root',
      branchPointMessageId: 'm2',
      metadata: { purpose: 'alternative' },
    });

    expect(result.thread.id).not.toBe('root');
    expect(result.thread).toMatchObject({
      title: 'Source title',
      resourceId,
      metadata: { purpose: 'alternative' },
    });
    expect(result.thread.metadata).not.toHaveProperty(MASTRA_THREAD_BRANCH_METADATA_KEY);
    expect(result.branch).toEqual({
      parentThreadId: 'root',
      branchPointMessageId: 'm2',
      branchPointCreatedAt: new Date('2026-01-01T00:01:00.000Z'),
      branchCreatedAt: expect.any(Date),
    });

    const resolved = await resolveThreadLineage(store, result.thread.id);
    expect(resolved.messages.map(item => item.id)).toEqual(['m1', 'm2']);
    expect((await store.listMessages({ threadId: result.thread.id, perPage: false })).messages).toEqual([]);
  });

  it('uses tuple ordering for equal timestamps and permits nested forks from inherited messages', async () => {
    const tied = new Date('2026-01-01T00:00:00.000Z');
    await seedRoot(undefined, [message('a', 'root', tied), message('b', 'root', tied)]);

    const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'a', title: '' });
    const nested = await memory.branchThread({ threadId: child.thread.id, branchPointMessageId: 'a' });

    expect(child.thread.title).toBe('');
    expect((await resolveThreadLineage(store, child.thread.id)).messages.map(item => item.id)).toEqual(['a']);
    expect((await memory.getBranchHistory({ threadId: nested.thread.id })).history.map(item => item.thread.id)).toEqual(
      ['root', child.thread.id, nested.thread.id],
    );
  });

  it('supports generated-ID collision retries and fails without overwriting after the fixed limit', async () => {
    await seedRoot();
    await memory.createThread({ threadId: 'collision', resourceId });
    const generateId = vi.spyOn(memory as any, 'generateId');
    generateId.mockReturnValueOnce('collision').mockReturnValueOnce('unique-child');

    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1' });
    expect(branch.thread.id).toBe('unique-child');
    expect((await memory.getThreadById({ threadId: 'collision' }))?.id).toBe('collision');

    generateId.mockReset().mockReturnValue('collision');
    await expect(memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1' })).rejects.toMatchObject({
      id: 'BRANCH_MUTATION_CONFLICT',
    });
    expect(
      (await store.listThreads({ perPage: false })).threads.filter(thread => thread.id === 'collision'),
    ).toHaveLength(1);
  });

  it('rejects reserved metadata and working memory before mutating thread or resource state', async () => {
    await seedRoot();
    const before = await store.listThreads({ perPage: false });

    await expect(
      memory.branchThread({
        threadId: 'root',
        branchPointMessageId: 'm1',
        metadata: { [MASTRA_THREAD_BRANCH_METADATA_KEY]: {} },
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    await expect(
      memory.branchThread({
        threadId: 'root',
        branchPointMessageId: 'm1',
        metadata: { workingMemory: 'forged' },
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });

    expect((await store.listThreads({ perPage: false })).threads).toHaveLength(before.threads.length);
    expect(await store.getResourceById({ resourceId })).toBeNull();
  });

  it('clones current thread-scoped working memory but keeps resource-scoped working memory shared', async () => {
    memory = new Memory({
      storage: new InMemoryStore(),
      options: { workingMemory: { enabled: true, scope: 'thread' } },
    });
    store = (await memory.storage.getStore('memory'))!;
    await seedRoot({ workingMemory: 'source thread memory' });
    const threadScoped = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1' });
    expect(threadScoped.thread.metadata?.workingMemory).toBe('source thread memory');

    memory = new Memory({
      storage: new InMemoryStore(),
      options: { workingMemory: { enabled: true, scope: 'resource' } },
    });
    store = (await memory.storage.getStore('memory'))!;
    await seedRoot({ workingMemory: 'shared resource memory' });
    const resourceBefore = await store.getResourceById({ resourceId });
    const resourceScoped = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1' });
    expect(resourceScoped.thread.metadata?.workingMemory).toBeUndefined();
    expect(await store.getResourceById({ resourceId })).toEqual(resourceBefore);
  });

  it('returns direct children with exact pagination and root-to-current parent/history shapes', async () => {
    await seedRoot();
    const children = [];
    for (let index = 0; index < 105; index += 1) {
      children.push(
        await memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1', title: `child-${index}` }),
      );
    }

    const page = await memory.listBranches({ threadId: 'root', page: 1, perPage: 10 });
    expect(page).toMatchObject({ total: 105, page: 1, perPage: 10, hasMore: true });
    expect(page.branches).toHaveLength(10);
    expect((await memory.listBranches({ threadId: 'root', perPage: false })).branches).toHaveLength(105);
    expect(await memory.getParentThread({ threadId: 'root' })).toBeNull();
    expect((await memory.getParentThread({ threadId: children[0]!.thread.id }))?.id).toBe('root');
  });

  it('keeps pending children invisible and only publishes after the ready patch', async () => {
    await seedRoot();
    vi.spyOn(memory as any, 'generateId').mockReturnValue('pending-child');
    const originalPatch = store.patchThread.bind(store);
    let observedPending = false;
    vi.spyOn(store, 'patchThread').mockImplementationOnce(async args => {
      observedPending = (await memory.getThreadById({ threadId: 'pending-child' })) === null;
      expect((await memory.listThreads({ perPage: false })).threads.map(thread => thread.id)).not.toContain(
        'pending-child',
      );
      expect((await memory.listBranches({ threadId: 'root', perPage: false })).branches).toEqual([]);
      return originalPatch(args);
    });

    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1' });
    expect(observedPending).toBe(true);
    expect(branch.thread.id).toBe('pending-child');
    expect(await memory.getThreadById({ threadId: 'pending-child' })).not.toBeNull();
  });

  it('rolls back only the pending child when full fork snapshot revalidation fails', async () => {
    await seedRoot();
    vi.spyOn(memory as any, 'generateId').mockReturnValue('rolled-back-child');
    const originalSave = store.saveThread.bind(store);
    vi.spyOn(store, 'saveThread').mockImplementationOnce(async args => {
      const saved = await originalSave(args);
      await store.updateMessages({ messages: [{ id: 'm1', content: { content: 'changed during branch' } }] });
      return saved;
    });

    await expect(memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1' })).rejects.toMatchObject({
      id: 'BRANCH_MUTATION_CONFLICT',
    });
    expect(await store.getThreadById({ threadId: 'rolled-back-child' })).toBeNull();
    expect(await store.getThreadById({ threadId: 'root' })).not.toBeNull();
  });

  it('sanitizes public thread methods while preserving raw lineage through ordinary round trips', async () => {
    await seedRoot();
    vi.spyOn(memory as any, 'generateId').mockReturnValue('sanitized-child');
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'm1', metadata: { value: 1 } });
    const raw = await store.getThreadById({ threadId: branch.thread.id });
    expect(raw?.metadata).toHaveProperty(MASTRA_THREAD_BRANCH_METADATA_KEY);

    const publicThread = await memory.getThreadById({ threadId: branch.thread.id });
    expect(publicThread?.metadata).not.toHaveProperty(MASTRA_THREAD_BRANCH_METADATA_KEY);
    await expect(
      memory.updateThread({
        id: branch.thread.id,
        metadata: { [MASTRA_THREAD_BRANCH_METADATA_KEY]: {} },
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    await expect(
      memory.saveThread({
        thread: { ...publicThread!, metadata: { [MASTRA_THREAD_BRANCH_METADATA_KEY]: {} } },
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });

    const saved = await memory.saveThread({
      thread: { ...publicThread!, title: 'updated', metadata: { value: 2 } },
    });
    expect(saved).toMatchObject({ title: 'updated', metadata: { value: 2 } });
    expect((await store.getThreadById({ threadId: branch.thread.id }))?.metadata).toHaveProperty(
      MASTRA_THREAD_BRANCH_METADATA_KEY,
    );
    const updated = await memory.updateThread({ id: branch.thread.id, metadata: { value: 3 } });
    expect(updated.metadata).toEqual({ value: 3 });
    expect(
      (await memory.listThreads({ perPage: false })).threads.find(thread => thread.id === branch.thread.id)?.metadata,
    ).toEqual({
      value: 3,
    });
    expect((await memory.updateThreadResourceId({ threadId: branch.thread.id, resourceId })).metadata).toEqual({
      value: 3,
    });

    await expect(
      memory.copyThread({
        sourceThreadId: branch.thread.id,
        newThreadId: 'forged-copy',
        metadata: { [MASTRA_THREAD_BRANCH_METADATA_KEY]: {} },
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(await store.getThreadById({ threadId: 'forged-copy' })).toBeNull();

    const copied = await memory.copyThread({ sourceThreadId: branch.thread.id, newThreadId: 'copied-child' });
    expect(copied.thread.metadata).not.toHaveProperty(MASTRA_THREAD_BRANCH_METADATA_KEY);
    const cloned = await memory.cloneThread({ sourceThreadId: branch.thread.id, newThreadId: 'cloned-child' });
    expect(cloned.thread.metadata).not.toHaveProperty(MASTRA_THREAD_BRANCH_METADATA_KEY);
  });
});
