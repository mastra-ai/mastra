import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Memory } from './index';

describe('Memory.copyThread / cloneThread', () => {
  let memory: Memory;
  const resourceId = 'copy-test-resource';

  beforeEach(() => {
    memory = new Memory({ storage: new InMemoryStore() });
  });

  async function seedThread(threadId: string, messageCount: number, createdAtFor?: (i: number) => Date) {
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Copy Test Thread',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });

    const messages: MastraDBMessage[] = [];
    for (let i = 0; i < messageCount; i++) {
      messages.push({
        id: `msg-${threadId}-${i}`,
        threadId,
        resourceId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: `Message ${i}` }] },
        createdAt: createdAtFor ? createdAtFor(i) : new Date(Date.UTC(2024, 0, 1, 10, 0, 0) + i * 1000),
      });
    }
    await memory.saveMessages({ messages });
  }

  it('cloneThread returns the copied messages read back from the destination thread', async () => {
    await seedThread('src-clone', 3);

    const { thread, clonedMessages, messageIdMap } = await memory.cloneThread({ sourceThreadId: 'src-clone' });

    expect(clonedMessages).toHaveLength(3);
    expect(clonedMessages.every(m => m.threadId === thread.id)).toBe(true);
    expect(clonedMessages.map(m => m.id).sort()).toEqual(Object.values(messageIdMap ?? {}).sort());
    expect(clonedMessages.map(m => (m.content.parts[0] as { text: string }).text)).toEqual([
      'Message 0',
      'Message 1',
      'Message 2',
    ]);
  });

  it('copyThread copies messages in the store without returning payloads', async () => {
    await seedThread('src-copy', 3);

    const result = await memory.copyThread({ sourceThreadId: 'src-copy' });

    expect(result).not.toHaveProperty('clonedMessages');
    expect(Object.keys(result.messageIdMap ?? {})).toHaveLength(3);

    const memoryStore = (await memory.storage.getStore('memory'))!;
    const { messages } = await memoryStore.listMessages({ threadId: result.thread.id, resourceId });
    expect(messages).toHaveLength(3);
  });

  it('copyThread never calls the store-level cloneThread', async () => {
    await seedThread('src-no-hydrate', 2);
    const memoryStore = (await memory.storage.getStore('memory'))!;
    const cloneSpy = vi.spyOn(memoryStore, 'cloneThread');
    const copySpy = vi.spyOn(memoryStore, 'copyThread');

    await memory.copyThread({ sourceThreadId: 'src-no-hydrate' });

    expect(cloneSpy).not.toHaveBeenCalled();
    expect(copySpy).toHaveBeenCalledTimes(1);
  });

  function setupSemanticRecallMemory(extraOptions: Record<string, unknown> = {}) {
    const dim = 4;
    const upsert = vi.fn().mockResolvedValue(undefined);
    const indexes = new Set<string>();
    const mockVector = {
      createIndex: vi.fn(async ({ indexName }: { indexName: string }) => {
        indexes.add(indexName);
      }),
      upsert,
      query: vi.fn().mockResolvedValue([]),
      listIndexes: vi.fn(async () => [...indexes]),
      deleteVectors: vi.fn().mockResolvedValue(undefined),
      describeIndex: vi.fn().mockResolvedValue({ dimension: dim }),
      id: 'mock-vector',
    } as unknown as MastraVector;
    const mockEmbedder = {
      doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => new Array(dim).fill(0.1)),
      })),
      modelId: 'mock-embedder',
      specificationVersion: 'v1',
      provider: 'mock',
    } as any;

    memory = new Memory({
      storage: new InMemoryStore(),
      vector: mockVector,
      embedder: mockEmbedder,
      options: { semanticRecall: { scope: 'thread' }, lastMessages: 10, generateTitle: false, ...extraOptions },
    });
    return { upsert };
  }

  function embeddedMessageIds(upsert: ReturnType<typeof vi.fn>) {
    return upsert.mock.calls.flatMap(([args]) => args.metadata.map((m: any) => m.message_id));
  }

  it('copyThread embeds the copied messages in batches when semantic recall is enabled', async () => {
    const { upsert } = setupSemanticRecallMemory();
    // 2 full batches of 100 + a partial batch.
    await seedThread('src-embed', 250);
    upsert.mockClear(); // saveMessages embeds too; only count the copy's work.
    const memoryStore = (await memory.storage.getStore('memory'))!;
    const listSpy = vi.spyOn(memoryStore, 'listMessages');
    const byIdSpy = vi.spyOn(memoryStore, 'listMessagesById');

    const { thread, messageIdMap } = await memory.copyThread({ sourceThreadId: 'src-embed' });

    // Every copied message was embedded exactly once, one upsert per batch, no batch bigger than 100.
    expect(embeddedMessageIds(upsert).sort()).toEqual(Object.values(messageIdMap ?? {}).sort());
    expect(upsert).toHaveBeenCalledTimes(3);
    for (const [args] of upsert.mock.calls) expect(args.vectors.length).toBeLessThanOrEqual(100);
    // Reads were by destination id in batches, never one unbounded read of the new thread.
    expect(byIdSpy).toHaveBeenCalledTimes(3);
    for (const [a] of byIdSpy.mock.calls) expect(a.messageIds.length).toBeLessThanOrEqual(100);
    expect(listSpy.mock.calls.some(([a]) => a.threadId === thread.id)).toBe(false);
  });

  // Copied rows keep the source createdAt. A backend with no stable secondary sort may return
  // tied rows in a different order on every query, so createdAt-ordered OFFSET paging can skip
  // or repeat a message across a batch boundary. These tests wrap the store so every
  // `listMessages` call reverses the previous call's tie order — the worst case for OFFSET.
  function makeTieOrderUnstable(memoryStore: { listMessages: (...a: any[]) => any }) {
    const originalList = memoryStore.listMessages.bind(memoryStore);
    let flip = false;
    vi.spyOn(memoryStore, 'listMessages').mockImplementation(async (args: any) => {
      const res = await originalList({ ...args, page: undefined, perPage: false });
      const ordered = flip ? [...res.messages].reverse() : res.messages;
      flip = !flip;
      const perPage = typeof args.perPage === 'number' ? args.perPage : ordered.length;
      const page = args.page ?? 0;
      const messages = ordered.slice(page * perPage, (page + 1) * perPage);
      return { ...res, messages, hasMore: (page + 1) * perPage < ordered.length };
    });
  }

  it('embeds every copied message exactly once when equal createdAt values straddle a batch boundary', async () => {
    const { upsert } = setupSemanticRecallMemory();
    const tied = new Date('2024-01-01T10:00:00Z');
    await seedThread('src-ties', 150, () => tied);
    upsert.mockClear();
    const memoryStore = (await memory.storage.getStore('memory'))!;
    makeTieOrderUnstable(memoryStore);

    const { messageIdMap } = await memory.copyThread({ sourceThreadId: 'src-ties' });

    // Batches are fetched by destination id, so the store's read order is irrelevant.
    expect(memoryStore.listMessages).not.toHaveBeenCalled();
    const ids = embeddedMessageIds(upsert);
    expect(new Set(ids).size).toBe(150);
    expect(ids.sort()).toEqual(Object.values(messageIdMap ?? {}).sort());
  });

  it('rolls back the copied thread and its vectors when a later embedding batch fails', async () => {
    const { upsert } = setupSemanticRecallMemory();
    await seedThread('src-rollback', 150);
    upsert.mockClear();
    const vector = memory.vector!;
    const deleteVectors = vi.mocked(vector.deleteVectors);
    // First batch succeeds, second batch fails.
    upsert.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('vector store down'));
    const memoryStore = (await memory.storage.getStore('memory'))!;
    const deleteThread = vi.spyOn(memoryStore, 'deleteThread');

    await expect(memory.copyThread({ sourceThreadId: 'src-rollback', newThreadId: 'dest-rollback' })).rejects.toThrow(
      'vector store down',
    );

    expect(deleteThread).toHaveBeenCalledWith({ threadId: 'dest-rollback' });
    expect(await memoryStore.getThreadById({ threadId: 'dest-rollback' })).toBeNull();
    expect((await memoryStore.listMessages({ threadId: 'dest-rollback', perPage: false })).messages).toHaveLength(0);
    expect(deleteVectors).toHaveBeenCalledWith(expect.objectContaining({ filter: { thread_id: 'dest-rollback' } }));
    // A retry with the same id no longer collides with the half-built copy.
    upsert.mockResolvedValue(undefined);
    const retry = await memory.copyThread({ sourceThreadId: 'src-rollback', newThreadId: 'dest-rollback' });
    expect(retry.thread.id).toBe('dest-rollback');
  });

  it('restores the destination resource working memory when a copy to another resource fails', async () => {
    const { upsert } = setupSemanticRecallMemory({ workingMemory: { enabled: true, scope: 'resource' } });
    await seedThread('src-wm', 3);
    const memoryStore = (await memory.storage.getStore('memory'))!;
    await memoryStore.updateResource({ resourceId, workingMemory: '# source memory' });
    await memoryStore.updateResource({ resourceId: 'dest-resource', workingMemory: '# dest memory' });
    upsert.mockRejectedValueOnce(new Error('vector store down'));

    await expect(memory.copyThread({ sourceThreadId: 'src-wm', resourceId: 'dest-resource' })).rejects.toThrow(
      'vector store down',
    );

    expect((await memoryStore.getResourceById({ resourceId: 'dest-resource' }))?.workingMemory).toBe('# dest memory');
  });

  it('clears the destination resource working memory on failure when none existed before the copy', async () => {
    const { upsert } = setupSemanticRecallMemory({ workingMemory: { enabled: true, scope: 'resource' } });
    await seedThread('src-wm-empty', 3);
    const memoryStore = (await memory.storage.getStore('memory'))!;
    await memoryStore.updateResource({ resourceId, workingMemory: '# source memory' });
    upsert.mockRejectedValueOnce(new Error('vector store down'));

    await expect(memory.copyThread({ sourceThreadId: 'src-wm-empty', resourceId: 'fresh-resource' })).rejects.toThrow(
      'vector store down',
    );

    expect(await memory.getWorkingMemory({ threadId: 'any', resourceId: 'fresh-resource' })).toBeNull();
  });

  it('embeds every copied message exactly once for adapters that return no messageIdMap', async () => {
    const { upsert } = setupSemanticRecallMemory();
    const tied = new Date('2024-01-01T10:00:00Z');
    await seedThread('src-ties-nomap', 150, () => tied);
    upsert.mockClear();
    const memoryStore = (await memory.storage.getStore('memory'))!;
    // A custom adapter that overrides cloneThread without reporting the id map.
    const originalCopy = memoryStore.copyThread.bind(memoryStore);
    vi.spyOn(memoryStore, 'copyThread').mockImplementation(async args => {
      const { thread } = await originalCopy(args);
      return { thread };
    });
    makeTieOrderUnstable(memoryStore);

    const { thread } = await memory.copyThread({ sourceThreadId: 'src-ties-nomap' });

    const ids = embeddedMessageIds(upsert);
    expect(new Set(ids).size).toBe(150);
    const { messages: dest } = await memoryStore.listMessages({ threadId: thread.id, perPage: false });
    expect(ids.sort()).toEqual(dest.map(m => m.id).sort());
    // Without a map the fallback must read the destination once, never OFFSET-page it.
    const reads = vi
      .mocked(memoryStore.listMessages)
      .mock.calls.filter(([a]) => a.threadId === thread.id && a.perPage !== false);
    expect(reads).toHaveLength(0);
  });
});
