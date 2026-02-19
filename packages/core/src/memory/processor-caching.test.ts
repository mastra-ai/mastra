/**
 * Tests for embedding cache behavior in MastraMemory processors
 *
 * These tests verify that the global embedding cache in SemanticRecall
 * preserves embeddings across multiple processor instances and calls.
 * This is important to avoid redundant embedding API calls.
 *
 * @see https://github.com/mastra-ai/mastra/issues/11455
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import { globalEmbeddingCache } from '../processors/memory/embedding-cache';
import type { SemanticRecall } from '../processors/memory/semantic-recall';
import { RequestContext } from '../request-context';
import type { MastraStorage, MemoryStorage } from '../storage';
import type { MastraEmbeddingModel, MastraVector } from '../vector';

import { MockMemory } from './mock';

describe('MastraMemory Embedding Cache (Issue #11455)', () => {
  let mockStorage: MastraStorage;
  let mockMemoryStore: MemoryStorage;
  let mockVector: MastraVector;
  let mockEmbedder: MastraEmbeddingModel<string>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Clear the global embedding cache between tests
    globalEmbeddingCache.clear();

    // Mock memory store
    mockMemoryStore = {
      getThreadById: vi.fn().mockResolvedValue(null),
      listThreads: vi.fn().mockResolvedValue({ threads: [], cursor: null, hasMore: false }),
      saveThread: vi.fn().mockImplementation(({ thread }) => Promise.resolve(thread)),
      deleteThread: vi.fn().mockResolvedValue(undefined),
      listMessages: vi.fn().mockResolvedValue({ messages: [] }),
      getMessages: vi.fn().mockResolvedValue([]),
      saveMessages: vi.fn().mockResolvedValue({ messages: [] }),
      deleteMessages: vi.fn().mockResolvedValue(undefined),
      getResourceById: vi.fn().mockResolvedValue(null),
      updateResource: vi.fn().mockResolvedValue(undefined),
    } as unknown as MemoryStorage;

    // Mock storage
    mockStorage = {
      getStore: vi.fn().mockResolvedValue(mockMemoryStore),
      init: vi.fn().mockResolvedValue(undefined),
    } as unknown as MastraStorage;

    // Mock vector store
    mockVector = {
      query: vi.fn().mockResolvedValue([]),
      listIndexes: vi.fn().mockResolvedValue([]),
      createIndex: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue([]),
    } as unknown as MastraVector;

    // Mock embedder
    mockEmbedder = {
      doEmbed: vi.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      }),
      modelId: 'test-embedder',
    } as unknown as MastraEmbeddingModel<string>;
  });

  describe('global embedding cache', () => {
    it('should preserve embedding cache across multiple getInputProcessors calls', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      // Set up semantic recall
      (memory as any).vector = mockVector;
      (memory as any).embedder = mockEmbedder;
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        semanticRecall: true,
        lastMessages: false,
      };

      // Get processors first time
      const processors1 = await memory.getInputProcessors();
      const semanticRecall1 = processors1.find(p => p.id === 'semantic-recall') as SemanticRecall;

      // Clear mock call counts from the dimension probe that happens inside getInputProcessors()
      // (getEmbeddingDimension() calls doEmbed({ values: ['a'] }) to discover the embedding dimension)
      vi.mocked(mockEmbedder.doEmbed).mockClear();

      // Set up request context
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const message: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello world',
          parts: [{ type: 'text', text: 'Hello world' }],
        },
        createdAt: new Date(),
      };

      const messageList1 = new MessageList();
      messageList1.add([message], 'input');

      // First call - should call embedder
      await semanticRecall1.processInput({
        messages: [message],
        messageList: messageList1,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);

      // Get processors second time (NEW instance, but shares global cache)
      const processors2 = await memory.getInputProcessors();
      const semanticRecall2 = processors2.find(p => p.id === 'semantic-recall') as SemanticRecall;

      const messageList2 = new MessageList();
      messageList2.add([message], 'input');

      // Second call with same content - should use global cached embedding
      await semanticRecall2.processInput({
        messages: [message],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      // Embedder should NOT be called again (cache hit from global cache,
      // dimension probe is also cached per memory instance via _embeddingDimensionPromise)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);
    });

    it('should preserve embedding cache between input and output processing', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      // Set up semantic recall
      (memory as any).vector = mockVector;
      (memory as any).embedder = mockEmbedder;
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        semanticRecall: true,
        lastMessages: false,
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const message: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello world',
          parts: [{ type: 'text', text: 'Hello world' }],
        },
        createdAt: new Date(),
      };

      // Get input processors and process a message (populates global cache)
      const inputProcessors = await memory.getInputProcessors();
      const inputSemanticRecall = inputProcessors.find(p => p.id === 'semantic-recall') as SemanticRecall;

      const messageList1 = new MessageList();
      messageList1.add([message], 'input');

      await inputSemanticRecall.processInput({
        messages: [message],
        messageList: messageList1,
        abort: vi.fn() as any,
        requestContext,
      });

      // doEmbed is called twice: once by getEmbeddingDimension() to probe dimensions,
      // and once by processInput() for the actual embedding
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(2);

      // Get output processors and process the same message
      const outputProcessors = await memory.getOutputProcessors();
      const outputSemanticRecall = outputProcessors.find(p => p.id === 'semantic-recall') as SemanticRecall;

      vi.mocked(mockVector.listIndexes).mockResolvedValue([]);
      vi.mocked(mockVector.createIndex).mockResolvedValue(undefined);
      vi.mocked(mockVector.upsert).mockResolvedValue([]);

      const messageList2 = new MessageList();
      messageList2.add([message], 'input');

      await outputSemanticRecall.processOutputResult({
        messages: [message],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      // Embedder should NOT be called again (cache hit from global cache,
      // dimension probe is also cached per memory instance via _embeddingDimensionPromise)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(2);
    });

    it('should share embedding cache across different Memory instances', async () => {
      // Create first memory instance
      const memory1 = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });
      (memory1 as any).vector = mockVector;
      (memory1 as any).embedder = mockEmbedder;
      (memory1 as any).threadConfig = {
        ...(memory1 as any).threadConfig,
        semanticRecall: true,
        lastMessages: false,
      };

      // Create second memory instance
      const memory2 = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });
      (memory2 as any).vector = mockVector;
      (memory2 as any).embedder = mockEmbedder;
      (memory2 as any).threadConfig = {
        ...(memory2 as any).threadConfig,
        semanticRecall: true,
        lastMessages: false,
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const message: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello world',
          parts: [{ type: 'text', text: 'Hello world' }],
        },
        createdAt: new Date(),
      };

      // Process with first memory instance
      const processors1 = await memory1.getInputProcessors();
      const semanticRecall1 = processors1.find(p => p.id === 'semantic-recall') as SemanticRecall;

      // Clear mock call counts from the dimension probe that happens inside getInputProcessors()
      vi.mocked(mockEmbedder.doEmbed).mockClear();

      const messageList1 = new MessageList();
      messageList1.add([message], 'input');

      await semanticRecall1.processInput({
        messages: [message],
        messageList: messageList1,
        abort: vi.fn() as any,
        requestContext,
      });

      // doEmbed is called twice: once by getEmbeddingDimension() to probe dimensions,
      // and once by processInput() for the actual embedding
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);

      // Process with second memory instance - should use global cache
      const processors2 = await memory2.getInputProcessors();
      const semanticRecall2 = processors2.find(p => p.id === 'semantic-recall') as SemanticRecall;

      const messageList2 = new MessageList();
      messageList2.add([message], 'input');

      await semanticRecall2.processInput({
        messages: [message],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(2);
    });
  });

  describe('processor creation', () => {
    it('should create new processor instances on each call (not cached)', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      (memory as any).vector = mockVector;
      (memory as any).embedder = mockEmbedder;
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        semanticRecall: true,
        lastMessages: 10,
        workingMemory: { enabled: true, template: '# Test' },
      };

      // Call getInputProcessors twice
      const processors1 = await memory.getInputProcessors();
      const processors2 = await memory.getInputProcessors();

      // Find processors
      const semanticRecall1 = processors1.find(p => p.id === 'semantic-recall');
      const semanticRecall2 = processors2.find(p => p.id === 'semantic-recall');

      expect(semanticRecall1).toBeDefined();
      expect(semanticRecall2).toBeDefined();

      // Instances should be different (we create new instances each time)
      // but they share the global embedding cache
      expect(semanticRecall1).not.toBe(semanticRecall2);
    });
  });
});
