/**
 * Test for issue #11455: SemanticRecall embedding cache not reused across getInputProcessors calls
 *
 * The bug: MastraMemory.getInputProcessors() creates new SemanticRecall instances on each call,
 * which means the internal embeddingCache is never reused, leading to:
 * - Unnecessary embedding API calls
 * - Increased latency
 * - Wasted money on embeddings that were already computed
 *
 * @see https://github.com/mastra-ai/mastra/issues/11455
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraStorage, MemoryStorage } from '../storage';
import type { MastraEmbeddingModel, MastraVector } from '../vector';
import { MockMemory } from './mock';
import { SemanticRecall } from '../processors/memory/semantic-recall';
import { MessageList } from '../agent/message-list';
import { RequestContext } from '../request-context';
import type { MastraDBMessage } from '../agent/message-list';

describe('MastraMemory Processor Caching (Issue #11455)', () => {
  let mockStorage: MastraStorage;
  let mockMemoryStore: MemoryStorage;
  let mockVector: MastraVector;
  let mockEmbedder: MastraEmbeddingModel<string>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock memory store
    mockMemoryStore = {
      getThreadById: vi.fn().mockResolvedValue(null),
      getThreadsByResourceId: vi.fn().mockResolvedValue({ threads: [], cursor: null, hasMore: false }),
      listThreadsByResourceId: vi.fn().mockResolvedValue({ threads: [], cursor: null, hasMore: false }),
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

  describe('getInputProcessors caching', () => {
    it('should return the SAME SemanticRecall instance across multiple calls', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false, // Disable to focus on SemanticRecall
      });

      // Manually set up semantic recall via internal properties
      (memory as any).vector = mockVector;
      (memory as any).embedder = mockEmbedder;
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        semanticRecall: true,
        lastMessages: false,
      };

      // Call getInputProcessors twice
      const processors1 = await memory.getInputProcessors();
      const processors2 = await memory.getInputProcessors();

      // Find SemanticRecall processors
      const semanticRecall1 = processors1.find(p => p.id === 'semantic-recall');
      const semanticRecall2 = processors2.find(p => p.id === 'semantic-recall');

      expect(semanticRecall1).toBeDefined();
      expect(semanticRecall2).toBeDefined();

      // BUG: Currently this fails because new instances are created each time
      // The fix should ensure the same instance is returned
      expect(semanticRecall1).toBe(semanticRecall2);
    });

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

      // Get processors second time
      const processors2 = await memory.getInputProcessors();
      const semanticRecall2 = processors2.find(p => p.id === 'semantic-recall') as SemanticRecall;

      const messageList2 = new MessageList();
      messageList2.add([message], 'input');

      // Second call with SAME content via NEW processor instance
      // BUG: Currently this calls embedder again because it's a new instance with empty cache
      await semanticRecall2.processInput({
        messages: [message],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      // After the fix, embedder should NOT be called again (cache hit)
      // Currently this fails with 2 calls because cache is not preserved
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOutputProcessors caching', () => {
    it('should return the SAME SemanticRecall instance across multiple calls', async () => {
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

      // Call getOutputProcessors twice
      const processors1 = await memory.getOutputProcessors();
      const processors2 = await memory.getOutputProcessors();

      // Find SemanticRecall processors
      const semanticRecall1 = processors1.find(p => p.id === 'semantic-recall');
      const semanticRecall2 = processors2.find(p => p.id === 'semantic-recall');

      expect(semanticRecall1).toBeDefined();
      expect(semanticRecall2).toBeDefined();

      // BUG: Currently this fails because new instances are created each time
      expect(semanticRecall1).toBe(semanticRecall2);
    });
  });

  describe('shared processor instances between input and output', () => {
    it('should share the same SemanticRecall instance for input and output processing', async () => {
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

      const inputProcessors = await memory.getInputProcessors();
      const outputProcessors = await memory.getOutputProcessors();

      const inputSemanticRecall = inputProcessors.find(p => p.id === 'semantic-recall');
      const outputSemanticRecall = outputProcessors.find(p => p.id === 'semantic-recall');

      expect(inputSemanticRecall).toBeDefined();
      expect(outputSemanticRecall).toBeDefined();

      // SemanticRecall is used for both input (query) and output (index)
      // They should share the same instance so the embedding cache is shared
      expect(inputSemanticRecall).toBe(outputSemanticRecall);
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

      // Get input processors and process a message (populates cache)
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

      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);

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

      // BUG: Currently embedder is called again because output processor is a different instance
      // After fix, should still be 1 (cache hit from shared instance)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);
    });
  });
});
