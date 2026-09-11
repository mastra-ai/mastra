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

  function setupSemanticRecallMemory() {
    const dim = 4;
    const upsert = vi.fn().mockResolvedValue(undefined);
    const mockVector = {
      createIndex: vi.fn().mockResolvedValue(undefined),
      upsert,
      query: vi.fn().mockResolvedValue([]),
      listIndexes: vi.fn().mockResolvedValue([]),
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
      options: { semanticRecall: { scope: 'thread' }, lastMessages: 10, generateTitle: false },
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

  it('embeds every copied message exactly once when equal createdAt values straddle a batch boundary', async () => {
    const { upsert } = setupSemanticRecallMemory();
    // 150 messages with one shared timestamp: createdAt-ordered OFFSET paging has no stable
    // order across ties, so a store may return a different tie order per page.
    const tied = new Date('2024-01-01T10:00:00Z');
    await seedThread('src-ties', 150, () => tied);
    upsert.mockClear();
    const memoryStore = (await memory.storage.getStore('memory'))!;
    // Simulate a backend whose tie order differs between paginated reads.
    const originalList = memoryStore.listMessages.bind(memoryStore);
    vi.spyOn(memoryStore, 'listMessages').mockImplementation(async args => {
      const res = await originalList({ ...args, perPage: false });
      const shuffled = [...res.messages].sort(() => Math.random() - 0.5);
      const perPage = typeof args.perPage === 'number' ? args.perPage : shuffled.length;
      const page = args.page ?? 0;
      const messages = shuffled.slice(page * perPage, (page + 1) * perPage);
      return { ...res, messages, hasMore: (page + 1) * perPage < shuffled.length };
    });

    const { messageIdMap } = await memory.copyThread({ sourceThreadId: 'src-ties' });

    const ids = embeddedMessageIds(upsert);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.values(messageIdMap ?? {}).sort());
  });
});
