import type { MastraDBMessage } from '@mastra/core/memory';
import { persistGeneratedMessages } from '@mastra/core/memory/internal';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
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

  it('canonicalizes mixed batches and places new generated rows after explicit rows', async () => {
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

    const reorderedGenerated = message('reordered-generated', branch.thread.id, forkTime);
    const reorderedExplicit = message('reordered-explicit', branch.thread.id, new Date(forkTime.getTime() + 20));
    await persistGeneratedMessages(memory, { messages: [reorderedGenerated, reorderedExplicit] }, [
      'reordered-generated',
    ]);
    const reordered = await store.listMessagesById({
      messageIds: ['reordered-generated', 'reordered-explicit'],
    });
    const reorderedById = new Map(reordered.messages.map(item => [item.id, item]));
    expect(reorderedById.get('reordered-generated')!.createdAt.getTime()).toBeGreaterThan(
      reorderedById.get('reordered-explicit')!.createdAt.getTime(),
    );
  });

  it('validates raw observational-memory persistence and its generated provenance', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(forkTime.getTime());
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    const saveStorage = vi.spyOn(store, 'saveMessages');
    const rejected = message('aaa-raw', branch.thread.id, forkTime);

    await expect(memory.persistMessages([rejected])).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect(saveStorage).not.toHaveBeenCalled();

    await memory.persistMessages([rejected], [rejected.id]);
    const saved = (await store.listMessagesById({ messageIds: [rejected.id] })).messages[0]!;
    expect(saved.createdAt.getTime()).toBeGreaterThan(forkTime.getTime());
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

  it('discovers descendant protections beyond the default thread page', async () => {
    let branchId = 0;
    vi.spyOn(memory as any, 'generateId').mockImplementation(() => `branch-${branchId++}`);
    for (let index = 0; index < 105; index += 1) {
      await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    }

    await expect(memory.deleteMessages(['fork'])).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });
    expect((await store.listMessagesById({ messageIds: ['fork'] })).messages).toHaveLength(1);
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
