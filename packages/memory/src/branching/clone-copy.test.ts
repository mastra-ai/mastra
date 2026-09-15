import { MASTRA_THREAD_BRANCH_METADATA_KEY } from '@mastra/core/memory';
import type { MastraDBMessage } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../index';

const resourceId = 'clone-branch-resource';
const time = new Date('2026-03-01T00:00:00.000Z');

function message(id: string, threadId: string, offset = 0): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: id }] },
    createdAt: new Date(time.getTime() + offset),
  };
}

describe('clone and copy of branch-tree participants', () => {
  let memory: Memory;
  let store: MemoryStorage;

  beforeEach(async () => {
    memory = new Memory({ storage: new InMemoryStore() });
    store = (await memory.storage.getStore('memory'))!;
    await memory.createThread({ threadId: 'root', resourceId, title: 'Source' });
    await memory.saveMessages({
      messages: [message('a', 'root'), message('b', 'root'), message('c', 'root', 1)],
    });
  });

  it('materializes a child logical path with fresh IDs while preserving copy and clone return shapes', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'b' });
    await memory.saveMessages({ messages: [message('child-tail', branch.thread.id, 2)] });

    const copied = await memory.copyThread({ sourceThreadId: branch.thread.id, newThreadId: 'copied' });
    expect(copied).not.toHaveProperty('clonedMessages');
    expect(copied.thread.metadata).not.toHaveProperty(MASTRA_THREAD_BRANCH_METADATA_KEY);
    expect(copied.thread.metadata?.clone).toMatchObject({
      sourceThreadId: branch.thread.id,
      lastMessageId: 'child-tail',
    });
    expect(Object.keys(copied.messageIdMap ?? {})).toEqual(['a', 'b', 'child-tail']);

    const copiedRows = (await store.listMessages({ threadId: 'copied', perPage: false })).messages;
    expect(copiedRows.map(item => item.id)).not.toEqual(['a', 'b', 'child-tail']);
    expect(copiedRows.map(item => (item.content.parts[0] as { text: string }).text)).toEqual(['a', 'b', 'child-tail']);

    const cloned = await memory.cloneThread({
      sourceThreadId: branch.thread.id,
      newThreadId: 'cloned',
      resourceId: 'cloned-resource',
    });
    expect(cloned.clonedMessages).toHaveLength(3);
    expect(cloned.clonedMessages.map(item => item.threadId)).toEqual(['cloned', 'cloned', 'cloned']);
    expect(cloned.clonedMessages.map(item => item.resourceId)).toEqual([
      'cloned-resource',
      'cloned-resource',
      'cloned-resource',
    ]);
  });

  it('applies explicit IDs, dates, deterministic newest limits, combined filters, and empty selections', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'b' });
    await memory.saveMessages({
      messages: [message('tail-a', branch.thread.id, 1), message('tail-b', branch.thread.id, 1)],
    });

    const filtered = await memory.cloneThread({
      sourceThreadId: branch.thread.id,
      newThreadId: 'filtered',
      options: {
        messageLimit: 2,
        messageFilter: {
          startDate: time,
          endDate: new Date(time.getTime() + 1),
          messageIds: ['a', 'tail-a', 'tail-b'],
        },
      },
    });
    expect(filtered.clonedMessages.map(item => (item.content.parts[0] as { text: string }).text)).toEqual([
      'tail-a',
      'tail-b',
    ]);

    const empty = await memory.cloneThread({
      sourceThreadId: branch.thread.id,
      newThreadId: 'empty',
      options: { messageFilter: { messageIds: [] } },
    });
    expect(empty.clonedMessages).toEqual([]);
    expect(empty.thread.metadata?.clone).not.toHaveProperty('lastMessageId');
  });

  it('materializes nested paths and root paths without child-tail leakage', async () => {
    const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'b' });
    await memory.saveMessages({ messages: [message('child-tail', child.thread.id, 2)] });
    const nested = await memory.branchThread({ threadId: child.thread.id, branchPointMessageId: 'a' });
    await memory.saveMessages({ messages: [message('nested-tail', nested.thread.id, 3)] });

    const nestedClone = await memory.cloneThread({ sourceThreadId: nested.thread.id, newThreadId: 'nested-clone' });
    expect(nestedClone.clonedMessages.map(item => (item.content.parts[0] as { text: string }).text)).toEqual([
      'a',
      'nested-tail',
    ]);

    const rootClone = await memory.cloneThread({ sourceThreadId: 'root', newThreadId: 'root-clone' });
    expect(rootClone.clonedMessages.map(item => (item.content.parts[0] as { text: string }).text)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('copies thread-scoped working memory from a branch into its independent snapshot', async () => {
    memory = new Memory({
      storage: new InMemoryStore(),
      options: { workingMemory: { enabled: true, scope: 'thread' } },
    });
    store = (await memory.storage.getStore('memory'))!;
    await memory.createThread({
      threadId: 'wm-root',
      resourceId,
      metadata: { workingMemory: 'current source state' },
    });
    await memory.saveMessages({ messages: [message('wm-message', 'wm-root')] });
    const branch = await memory.branchThread({ threadId: 'wm-root', branchPointMessageId: 'wm-message' });

    const cloned = await memory.cloneThread({ sourceThreadId: branch.thread.id, newThreadId: 'wm-clone' });
    expect(cloned.thread.metadata?.workingMemory).toBe('current source state');
  });

  it('rejects reserved destination metadata and retains the optimized path for unrelated roots', async () => {
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'a' });
    await expect(
      memory.copyThread({
        sourceThreadId: branch.thread.id,
        metadata: { [MASTRA_THREAD_BRANCH_METADATA_KEY]: {} },
      }),
    ).rejects.toMatchObject({ id: 'BRANCH_MUTATION_CONFLICT' });

    await memory.createThread({ threadId: 'ordinary', resourceId: 'ordinary-resource' });
    await memory.saveMessages({
      messages: [{ ...message('ordinary-message', 'ordinary'), resourceId: 'ordinary-resource' }],
    });
    const copySpy = vi.spyOn(store, 'copyThread');
    await memory.copyThread({ sourceThreadId: 'ordinary', newThreadId: 'ordinary-copy' });
    expect(copySpy).toHaveBeenCalledOnce();
  });
});
