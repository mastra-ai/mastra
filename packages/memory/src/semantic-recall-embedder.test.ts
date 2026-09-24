import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, it, expect, vi } from 'vitest';

import { Memory } from './index';

/**
 * Semantic recall assumes the application produces every embedding: `Memory` refuses to be
 * constructed without an embedder, the index name is derived from the embedder's output
 * dimension, and both the write and read paths hand the vector store precomputed numbers.
 *
 * These tests record that assumption. They pin the parts a server-embedding store touches, so
 * that a change to any of them surfaces as a failing expectation.
 */

const makeVector = (dimension: number): MastraVector =>
  ({
    createIndex: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
    listIndexes: vi.fn().mockResolvedValue([]),
    deleteVectors: vi.fn().mockResolvedValue(undefined),
    describeIndex: vi.fn().mockResolvedValue({ dimension }),
    id: 'mock-vector',
  }) as any;

const makeEmbedder = (dimension: number, modelId = 'mock-embedder') =>
  ({
    doEmbed: vi.fn().mockResolvedValue({ embeddings: [new Array(dimension).fill(0.1)] }),
    modelId,
    specificationVersion: 'v1',
    provider: 'mock',
  }) as any;

describe('semantic recall requires a client-side embedder', () => {
  it('refuses to construct when semanticRecall is on and no embedder is configured', () => {
    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          vector: makeVector(1536),
          options: { semanticRecall: true },
        }),
    ).toThrow(/requires an embedder/);
  });

  it('names both routes to embeddings when neither is configured', () => {
    let caught: Error | undefined;
    try {
      new Memory({
        storage: new InMemoryStore(),
        vector: makeVector(1536),
        options: { semanticRecall: true },
      });
    } catch (e) {
      caught = e as Error;
    }

    // Pointing only at `embedder` sends someone whose store embeds server-side in the wrong
    // direction, so the message carries both options.
    expect(caught?.message).toMatch(/embedder/);
    expect(caught?.message).toMatch(/vector store that generates embeddings itself/);
  });

  it('refuses to construct when semanticRecall is on and no vector store is configured', () => {
    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          embedder: makeEmbedder(1536),
          options: { semanticRecall: true },
        }),
    ).toThrow(/requires a vector store/);
  });

  it('allows an embedder-less Memory when semanticRecall is off', () => {
    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          options: { semanticRecall: false },
        }),
    ).not.toThrow();
  });

  it('allows an embedder-less Memory when the vector store embeds server-side', () => {
    const vector = makeVector(1536);
    (vector as any).isSelfEmbedding = true;

    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          vector,
          options: { semanticRecall: true },
        }),
    ).not.toThrow();
  });

  it('keeps a server-embedded index off the name a client-side index already uses', () => {
    const vector = makeVector(1536);
    (vector as any).isSelfEmbedding = true;

    const serverMemory = new Memory({
      storage: new InMemoryStore(),
      vector,
      options: { semanticRecall: true },
    }) as unknown as { getEmbeddingIndexName(d?: number): string };

    const clientMemory = new Memory({
      storage: new InMemoryStore(),
      vector: makeVector(1536),
      embedder: makeEmbedder(1536),
      options: { semanticRecall: true },
    }) as unknown as { getEmbeddingIndexName(d?: number): string };

    expect(serverMemory.getEmbeddingIndexName()).toBe('memory_messages_selfembed');
    expect(clientMemory.getEmbeddingIndexName()).toBe('memory_messages');
  });

  it('still requires a vector store when there is no embedder', () => {
    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          options: { semanticRecall: true },
        }),
    ).toThrow(/requires a vector store/);
  });
});

describe('message updates on a self-embedding store', () => {
  const makeServerVector = () => {
    const vector = makeVector(1024);
    (vector as any).isSelfEmbedding = true;
    return vector;
  };

  const makeServerMemory = (vector: MastraVector) =>
    new Memory({
      storage: new InMemoryStore(),
      vector,
      options: {
        semanticRecall: { topK: 2, messageRange: 0, scope: 'thread' },
        lastMessages: false,
        generateTitle: false,
      },
    });

  const seed = async (memory: Memory) => {
    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'T',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await memory.saveMessages({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'the original text' }], content: 'the original text' },
          createdAt: new Date(),
          threadId: 'thread-1',
          resourceId: 'resource-1',
        } as MastraDBMessage,
      ],
    });
  };

  it('re-indexes an edited message as text rather than refusing', async () => {
    const vector = makeServerVector();
    const memory = makeServerMemory(vector);
    await seed(memory);
    vi.mocked(vector.upsert).mockClear();

    await memory.updateMessages({
      messages: [
        {
          id: 'msg-1',
          content: { format: 2, parts: [{ type: 'text', text: 'the edited text' }], content: 'the edited text' },
        } as any,
      ],
    });

    const [args] = vi.mocked(vector.upsert).mock.calls[0]! as any[];
    expect(args.documents).toEqual(['the edited text']);
    expect(args.vectors).toBeUndefined();
  });
});

describe('semantic recall index naming at the default dimension', () => {
  /**
   * The 384-dimension case is covered in index.test.ts. This covers 1536, which takes the other
   * branch of `getEmbeddingIndexName` and produces the unsuffixed `memory_messages`.
   */
  it('uses one unsuffixed index for both the processor write and the recall read', async () => {
    const vector = makeVector(1536);
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder: makeEmbedder(1536),
      options: {
        semanticRecall: { topK: 2, messageRange: 0, scope: 'thread' },
        lastMessages: 10,
        generateTitle: false,
      },
    });

    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Write path: the SemanticRecall output processor, which is what an agent turn runs.
    const outputProcessors = await memory.getOutputProcessors();
    const semanticProcessor = outputProcessors.find(p => p.id === 'semantic-recall');
    expect(semanticProcessor).toBeDefined();

    const message: MastraDBMessage = {
      id: 'msg-1',
      role: 'user',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'What is machine learning?' }],
        content: 'What is machine learning?',
      },
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'resource-1',
    };
    const messageList = new MessageList();
    messageList.add([message], 'input');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: 'thread-1', resourceId: 'resource-1' },
      resourceId: 'resource-1',
    });

    await semanticProcessor!.processOutputResult!({
      messages: [message],
      messageList,
      abort: vi.fn() as any,
      requestContext,
      state: {},
      result: {} as any,
      retryCount: 0,
    });

    const upsert = vi.mocked(vector.upsert);
    expect(upsert).toHaveBeenCalled();
    const writeIndexName = upsert.mock.calls[0]![0].indexName;

    // Read path: recall(), which does not go through the processor at all.
    vi.mocked(vector.query).mockClear();
    await memory.recall({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      vectorSearchString: 'machine learning',
    });

    const query = vi.mocked(vector.query);
    expect(query).toHaveBeenCalled();
    const readIndexName = query.mock.calls[0]![0].indexName;

    expect(writeIndexName).toBe('memory_messages');
    expect(readIndexName).toBe(writeIndexName);
  });

  it('writes precomputed vectors and the metadata recall reads back', async () => {
    const vector = makeVector(1536);
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder: makeEmbedder(1536),
      options: {
        semanticRecall: { topK: 2, messageRange: 0, scope: 'thread' },
        lastMessages: 10,
        generateTitle: false,
      },
    });

    await memory.saveThread({
      thread: {
        id: 'thread-2',
        resourceId: 'resource-2',
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const outputProcessors = await memory.getOutputProcessors();
    const semanticProcessor = outputProcessors.find(p => p.id === 'semantic-recall');

    const message: MastraDBMessage = {
      id: 'msg-2',
      role: 'user',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Remember the deadline' }],
        content: 'Remember the deadline',
      },
      createdAt: new Date(),
      threadId: 'thread-2',
      resourceId: 'resource-2',
    };
    const messageList = new MessageList();
    messageList.add([message], 'input');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: 'thread-2', resourceId: 'resource-2' },
      resourceId: 'resource-2',
    });

    await semanticProcessor!.processOutputResult!({
      messages: [message],
      messageList,
      abort: vi.fn() as any,
      requestContext,
      state: {},
      result: {} as any,
      retryCount: 0,
    });

    const [upsertArgs] = vi.mocked(vector.upsert).mock.calls[0]!;
    // The store receives numbers and is never asked to embed anything.
    expect(upsertArgs.vectors).toHaveLength(1);
    expect(upsertArgs.vectors[0]).toHaveLength(1536);
    expect(upsertArgs.metadata![0]).toMatchObject({
      message_id: 'msg-2',
      thread_id: 'thread-2',
      resource_id: 'resource-2',
      role: 'user',
      content: 'Remember the deadline',
    });
  });
});

describe('semantic recall against a store that embeds server-side', () => {
  const makeServerVector = () => {
    const vector = makeVector(1024);
    (vector as any).isSelfEmbedding = true;
    return vector;
  };

  const runTurn = async (memory: Memory, threadId: string, text: string) => {
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const outputProcessors = await memory.getOutputProcessors();
    const semanticProcessor = outputProcessors.find(p => p.id === 'semantic-recall');
    expect(semanticProcessor).toBeDefined();

    const message: MastraDBMessage = {
      id: 'msg-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text }], content: text },
      createdAt: new Date(),
      threadId,
      resourceId: 'resource-1',
    };
    const messageList = new MessageList();
    messageList.add([message], 'input');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: threadId, resourceId: 'resource-1' },
      resourceId: 'resource-1',
    });

    await semanticProcessor!.processOutputResult!({
      messages: [message],
      messageList,
      abort: vi.fn() as any,
      requestContext,
      state: {},
      result: {} as any,
      retryCount: 0,
    });
  };

  it('constructs without an embedder and writes text rather than vectors', async () => {
    const vector = makeServerVector();
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      options: {
        semanticRecall: { topK: 2, messageRange: 0, scope: 'thread' },
        lastMessages: 10,
        generateTitle: false,
      },
    });

    await runTurn(memory, 'thread-1', 'Remember the deadline');

    const [upsertArgs] = vi.mocked(vector.upsert).mock.calls[0]! as any[];
    expect(upsertArgs.documents).toEqual(['Remember the deadline']);
    expect(upsertArgs.vectors).toBeUndefined();
    expect(upsertArgs.indexName).toBe('memory_messages_selfembed');
    // The metadata recall reads back.
    expect(upsertArgs.metadata[0]).toMatchObject({
      message_id: 'msg-1',
      thread_id: 'thread-1',
      resource_id: 'resource-1',
    });
  });

  it('creates the index without a dimension', async () => {
    const vector = makeServerVector();
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      options: {
        semanticRecall: { topK: 2, messageRange: 0, scope: 'thread' },
        lastMessages: 10,
        generateTitle: false,
      },
    });

    await runTurn(memory, 'thread-1', 'Remember the deadline');

    const [createArgs] = vi.mocked(vector.createIndex).mock.calls[0]! as any[];
    expect(createArgs).toEqual({ indexName: 'memory_messages_selfembed' });
  });

  it('never calls an embedder on the write path', async () => {
    const vector = makeServerVector();
    const embedder = makeEmbedder(1024);
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      options: {
        semanticRecall: { topK: 2, messageRange: 0, scope: 'thread' },
        lastMessages: 10,
        generateTitle: false,
      },
    });

    await runTurn(memory, 'thread-1', 'Remember the deadline');

    expect(embedder.doEmbed).not.toHaveBeenCalled();
  });
});

describe('recall() against a store that embeds server-side', () => {
  const makeServerVector = () => {
    const vector = makeVector(1024);
    (vector as any).isSelfEmbedding = true;
    return vector;
  };

  const makeServerMemory = (vector: MastraVector) =>
    new Memory({
      storage: new InMemoryStore(),
      vector,
      options: {
        semanticRecall: { topK: 3, messageRange: 0, scope: 'thread' },
        lastMessages: 10,
        generateTitle: false,
      },
    });

  const seedThread = async (memory: Memory, threadId: string) =>
    memory.saveThread({
      thread: {
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

  it('sends the search string as text instead of a query vector', async () => {
    const vector = makeServerVector();
    const memory = makeServerMemory(vector);
    await seedThread(memory, 'thread-1');

    await memory.recall({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      vectorSearchString: 'what did we decide about the deadline',
    });

    const [queryArgs] = vi.mocked(vector.query).mock.calls[0]! as any[];
    expect(queryArgs.queryText).toBe('what did we decide about the deadline');
    expect(queryArgs.queryVector).toBeUndefined();
    expect(queryArgs.indexName).toBe('memory_messages_selfembed');
    expect(queryArgs.filter).toEqual({ thread_id: 'thread-1' });
  });

  it('creates the index it reads from without a dimension', async () => {
    const vector = makeServerVector();
    const memory = makeServerMemory(vector);
    await seedThread(memory, 'thread-1');

    await memory.recall({ threadId: 'thread-1', resourceId: 'resource-1', vectorSearchString: 'deadline' });

    const [createArgs] = vi.mocked(vector.createIndex).mock.calls[0]! as any[];
    expect(createArgs).toEqual({ indexName: 'memory_messages_selfembed' });
  });

  it('writes and reads through the same index', async () => {
    const vector = makeServerVector();
    const memory = makeServerMemory(vector);
    await seedThread(memory, 'thread-1');

    await memory.saveMessages({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'the deadline is Friday' }],
            content: 'the deadline is Friday',
          },
          createdAt: new Date(),
          threadId: 'thread-1',
          resourceId: 'resource-1',
        } as MastraDBMessage,
      ],
    });

    const [upsertArgs] = vi.mocked(vector.upsert).mock.calls[0]! as any[];
    expect(upsertArgs.documents).toEqual(['the deadline is Friday']);
    expect(upsertArgs.vectors).toBeUndefined();

    await memory.recall({ threadId: 'thread-1', resourceId: 'resource-1', vectorSearchString: 'deadline' });

    const [queryArgs] = vi.mocked(vector.query).mock.calls[0]! as any[];
    expect(queryArgs.indexName).toBe(upsertArgs.indexName);
  });
});
