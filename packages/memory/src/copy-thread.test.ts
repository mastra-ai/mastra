import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraVector } from '@mastra/core/vector';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Memory } from './index';

describe('Memory.copyThread / cloneThread', () => {
  let memory: Memory;
  const resourceId = 'copy-test-resource';

  beforeEach(() => {
    memory = new Memory({ storage: new InMemoryStore() });
  });

  async function seedThread(threadId: string, messageCount: number) {
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
        createdAt: new Date(Date.UTC(2024, 0, 1, 10, 0, 0) + i * 1000),
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

  it('copyThread embeds the copied messages in pages when semantic recall is enabled', async () => {
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
    // 3 pages of 100 + a partial page.
    await seedThread('src-embed', 250);
    upsert.mockClear(); // saveMessages embeds too; only count the copy's work.
    const memoryStore = (await memory.storage.getStore('memory'))!;
    const listSpy = vi.spyOn(memoryStore, 'listMessages');

    const { thread, messageIdMap } = await memory.copyThread({ sourceThreadId: 'src-embed' });

    // Every copied message was embedded, one upsert per page, no page bigger than 100.
    const embeddedIds = upsert.mock.calls.flatMap(([args]) => args.metadata.map((m: any) => m.message_id));
    expect(embeddedIds.sort()).toEqual(Object.values(messageIdMap ?? {}).sort());
    expect(upsert).toHaveBeenCalledTimes(3);
    for (const [args] of upsert.mock.calls) expect(args.vectors.length).toBeLessThanOrEqual(100);
    // The embed read was paged over the destination thread rather than one unbounded read.
    const pagedReads = listSpy.mock.calls.filter(([a]) => a.threadId === thread.id && a.perPage === 100);
    expect(pagedReads).toHaveLength(3);
    expect(listSpy.mock.calls.some(([a]) => a.threadId === thread.id && a.perPage === false)).toBe(false);
  });
});
