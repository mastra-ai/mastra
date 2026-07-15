import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * memory.saveMessages must persist role, content, and created_at into the
 * vector store metadata — matching the shape SemanticRecall.processOutputResult
 * writes via the agent path. Otherwise consumers that build search results
 * directly from vector metadata (e.g. the built-in `/api/memory/search`
 * route or external clients) get matches with empty role/content.
 */
describe('saveMessages should persist role/content/created_at into vector metadata', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  let vector: LibSQLVector;
  let threadId: string;
  const resourceId = `test-resource-${crypto.randomUUID()}`;

  beforeEach(async () => {
    const uniqueId = crypto.randomUUID();
    const dbFile = `file:/tmp/test-${uniqueId}.db`;

    storage = new LibSQLStore({ id: `save-msg-storage-${uniqueId}`, url: dbFile });
    vector = new LibSQLVector({ id: `save-msg-vector-${uniqueId}`, url: dbFile });
    await storage.init();

    memory = new Memory({
      storage,
      vector,
      embedder: fastembed,
      options: {
        semanticRecall: { topK: 5, messageRange: 0, scope: 'thread' },
        lastMessages: false,
      },
    });

    const thread = await memory.saveThread({
      thread: {
        id: crypto.randomUUID(),
        title: 'Save Message Vector Metadata Test',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    threadId = thread.id;
  });

  afterEach(async () => {
    try {
      // @ts-expect-error - accessing internal client for cleanup
      await storage.client?.close();
      // @ts-expect-error - accessing internal client for cleanup
      await vector.turso?.close();
    } catch {
      // Ignore cleanup errors
    }
  });

  it('writes role, content, and created_at into vector metadata', async () => {
    const text = 'I prefer morning meetings.';
    const createdAt = new Date('2026-01-01T12:00:00.000Z');
    const message = {
      id: crypto.randomUUID(),
      threadId,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
      role: 'user' as const,
      createdAt,
      resourceId,
    };

    await memory.saveMessages({ messages: [message] });

    const indexName = (await vector.listIndexes()).find(name => name.startsWith('memory_messages_'));
    if (!indexName) throw new Error('No memory_messages_* index was created');
    const { dimension } = await vector.describeIndex({ indexName });

    const vectors = await vector.query({
      indexName,
      queryVector: new Array(dimension).fill(0.01),
      topK: 10,
    });

    const match = vectors.find(v => v.metadata?.message_id === message.id);
    expect(match).toBeDefined();
    expect(match!.metadata).toMatchObject({
      message_id: message.id,
      thread_id: threadId,
      resource_id: resourceId,
      role: 'user',
      content: text,
      created_at: createdAt.toISOString(),
    });
  });

  it('stamps every chunk of a long message with the full textForEmbedding', async () => {
    // chunkText splits at 4096 tokens × 4 chars/token = 16,384 chars; build a
    // message comfortably past that so saveMessages emits multiple chunks.
    const longText = 'sleep schedules and morning routines '.repeat(700).trim();
    expect(longText.length).toBeGreaterThan(20_000);

    const createdAt = new Date('2026-02-02T08:00:00.000Z');
    const message = {
      id: crypto.randomUUID(),
      threadId,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: longText }] },
      role: 'assistant' as const,
      createdAt,
      resourceId,
    };

    await memory.saveMessages({ messages: [message] });

    const indexName = (await vector.listIndexes()).find(name => name.startsWith('memory_messages_'));
    if (!indexName) throw new Error('No memory_messages_* index was created');
    const { dimension } = await vector.describeIndex({ indexName });

    const vectors = await vector.query({
      indexName,
      queryVector: new Array(dimension).fill(0.01),
      topK: 100,
    });

    const matches = vectors.filter(v => v.metadata?.message_id === message.id);
    expect(matches.length).toBeGreaterThan(1);
    for (const match of matches) {
      expect(match.metadata).toMatchObject({
        message_id: message.id,
        thread_id: threadId,
        resource_id: resourceId,
        role: 'assistant',
        content: longText,
        created_at: createdAt.toISOString(),
      });
    }
  });
});
