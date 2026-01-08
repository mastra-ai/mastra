/**
 * Tests for processor instance caching in MastraMemory
 *
 * These tests verify that getInputProcessors() and getOutputProcessors() return
 * cached processor instances rather than creating new ones each call. This is important
 * because processors like SemanticRecall have internal caches (embeddingCache) that
 * should persist across calls to avoid redundant embedding API calls.
 *
 * @see https://github.com/mastra-ai/mastra/issues/11455
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import type { SemanticRecall } from '../processors/memory/semantic-recall';
import { RequestContext } from '../request-context';
import type { MastraStorage, MemoryStorage } from '../storage';
import type { MastraEmbeddingModel, MastraVector } from '../vector';

import { MockMemory } from './mock';

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

      // Same instance should be returned to preserve internal caches
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

      // Second call with same content - should use cached embedding
      await semanticRecall2.processInput({
        messages: [message],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      // Embedder should NOT be called again (cache hit from shared instance)
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

      // Same instance should be returned to preserve internal caches
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

      // Embedder should NOT be called again (cache hit from shared instance between input/output)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache invalidation when dependencies change', () => {
    it('should invalidate SemanticRecall when setVector is called', async () => {
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

      // Get initial processor instances
      const inputProcessors1 = await memory.getInputProcessors();
      const outputProcessors1 = await memory.getOutputProcessors();

      const inputSemanticRecall1 = inputProcessors1.find(p => p.id === 'semantic-recall');
      const outputSemanticRecall1 = outputProcessors1.find(p => p.id === 'semantic-recall');

      expect(inputSemanticRecall1).toBeDefined();
      expect(outputSemanticRecall1).toBeDefined();

      // Create a new mock vector store
      const newMockVector = {
        query: vi.fn().mockResolvedValue([]),
        listIndexes: vi.fn().mockResolvedValue([]),
        createIndex: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn().mockResolvedValue([]),
      } as unknown as MastraVector;

      // Call setVector to change the vector store
      memory.setVector(newMockVector);

      // Get processors again
      const inputProcessors2 = await memory.getInputProcessors();
      const outputProcessors2 = await memory.getOutputProcessors();

      const inputSemanticRecall2 = inputProcessors2.find(p => p.id === 'semantic-recall');
      const outputSemanticRecall2 = outputProcessors2.find(p => p.id === 'semantic-recall');

      expect(inputSemanticRecall2).toBeDefined();
      expect(outputSemanticRecall2).toBeDefined();

      // SemanticRecall instances should be NEW (cache invalidated)
      expect(inputSemanticRecall1).not.toBe(inputSemanticRecall2);
      expect(outputSemanticRecall1).not.toBe(outputSemanticRecall2);
    });

    it('should invalidate SemanticRecall when setEmbedder is called', async () => {
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

      // Get initial processor instances
      const inputProcessors1 = await memory.getInputProcessors();
      const outputProcessors1 = await memory.getOutputProcessors();

      const inputSemanticRecall1 = inputProcessors1.find(p => p.id === 'semantic-recall');
      const outputSemanticRecall1 = outputProcessors1.find(p => p.id === 'semantic-recall');

      expect(inputSemanticRecall1).toBeDefined();
      expect(outputSemanticRecall1).toBeDefined();

      // Create a new mock embedder
      const newMockEmbedder = {
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [[0.4, 0.5, 0.6]],
        }),
        modelId: 'new-test-embedder',
      } as unknown as MastraEmbeddingModel<string>;

      // Call setEmbedder to change the embedder
      memory.setEmbedder(newMockEmbedder);

      // Get processors again
      const inputProcessors2 = await memory.getInputProcessors();
      const outputProcessors2 = await memory.getOutputProcessors();

      const inputSemanticRecall2 = inputProcessors2.find(p => p.id === 'semantic-recall');
      const outputSemanticRecall2 = outputProcessors2.find(p => p.id === 'semantic-recall');

      expect(inputSemanticRecall2).toBeDefined();
      expect(outputSemanticRecall2).toBeDefined();

      // SemanticRecall instances should be NEW (cache invalidated)
      expect(inputSemanticRecall1).not.toBe(inputSemanticRecall2);
      expect(outputSemanticRecall1).not.toBe(outputSemanticRecall2);
    });

    it('should invalidate all processors when setStorage is called', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      // Set up all processor types
      (memory as any).vector = mockVector;
      (memory as any).embedder = mockEmbedder;
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        semanticRecall: true,
        lastMessages: 10,
        workingMemory: { enabled: true, template: '# Test' },
      };

      // Get initial processor instances from both input and output
      const inputProcessors1 = await memory.getInputProcessors();
      const outputProcessors1 = await memory.getOutputProcessors();

      const inputSemanticRecall1 = inputProcessors1.find(p => p.id === 'semantic-recall');
      const inputWorkingMemory1 = inputProcessors1.find(p => p.id === 'working-memory');
      const inputMessageHistory1 = inputProcessors1.find(p => p.id === 'message-history');
      const outputSemanticRecall1 = outputProcessors1.find(p => p.id === 'semantic-recall');
      const outputMessageHistory1 = outputProcessors1.find(p => p.id === 'message-history');

      expect(inputSemanticRecall1).toBeDefined();
      expect(inputWorkingMemory1).toBeDefined();
      expect(inputMessageHistory1).toBeDefined();
      expect(outputSemanticRecall1).toBeDefined();
      expect(outputMessageHistory1).toBeDefined();

      // Create a new mock storage
      const newMockMemoryStore = {
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

      const newMockStorage = {
        getStore: vi.fn().mockResolvedValue(newMockMemoryStore),
        init: vi.fn().mockResolvedValue(undefined),
      } as unknown as MastraStorage;

      // Call setStorage to change the storage
      memory.setStorage(newMockStorage);

      // Get processors again
      const inputProcessors2 = await memory.getInputProcessors();
      const outputProcessors2 = await memory.getOutputProcessors();

      const inputSemanticRecall2 = inputProcessors2.find(p => p.id === 'semantic-recall');
      const inputWorkingMemory2 = inputProcessors2.find(p => p.id === 'working-memory');
      const inputMessageHistory2 = inputProcessors2.find(p => p.id === 'message-history');
      const outputSemanticRecall2 = outputProcessors2.find(p => p.id === 'semantic-recall');
      const outputMessageHistory2 = outputProcessors2.find(p => p.id === 'message-history');

      expect(inputSemanticRecall2).toBeDefined();
      expect(inputWorkingMemory2).toBeDefined();
      expect(inputMessageHistory2).toBeDefined();
      expect(outputSemanticRecall2).toBeDefined();
      expect(outputMessageHistory2).toBeDefined();

      // ALL processor instances should be NEW (cache invalidated)
      expect(inputSemanticRecall1).not.toBe(inputSemanticRecall2);
      expect(inputWorkingMemory1).not.toBe(inputWorkingMemory2);
      expect(inputMessageHistory1).not.toBe(inputMessageHistory2);
      expect(outputSemanticRecall1).not.toBe(outputSemanticRecall2);
      expect(outputMessageHistory1).not.toBe(outputMessageHistory2);
    });
  });

  describe('WorkingMemory and MessageHistory caching', () => {
    it('should return the SAME WorkingMemory instance across multiple getInputProcessors calls', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      // Enable working memory
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        workingMemory: { enabled: true, template: '# Test Working Memory' },
        lastMessages: false,
        semanticRecall: false,
      };

      // Call getInputProcessors multiple times
      const processors1 = await memory.getInputProcessors();
      const processors2 = await memory.getInputProcessors();
      const processors3 = await memory.getInputProcessors();

      // Find WorkingMemory processors
      const workingMemory1 = processors1.find(p => p.id === 'working-memory');
      const workingMemory2 = processors2.find(p => p.id === 'working-memory');
      const workingMemory3 = processors3.find(p => p.id === 'working-memory');

      expect(workingMemory1).toBeDefined();
      expect(workingMemory2).toBeDefined();
      expect(workingMemory3).toBeDefined();

      // Same instance should be returned across all calls
      expect(workingMemory1).toBe(workingMemory2);
      expect(workingMemory2).toBe(workingMemory3);
    });

    it('should return the SAME MessageHistory instance across multiple getInputProcessors calls', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      // Enable message history
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        lastMessages: 10,
        workingMemory: { enabled: false },
        semanticRecall: false,
      };

      // Call getInputProcessors multiple times
      const processors1 = await memory.getInputProcessors();
      const processors2 = await memory.getInputProcessors();
      const processors3 = await memory.getInputProcessors();

      // Find MessageHistory processors
      const messageHistory1 = processors1.find(p => p.id === 'message-history');
      const messageHistory2 = processors2.find(p => p.id === 'message-history');
      const messageHistory3 = processors3.find(p => p.id === 'message-history');

      expect(messageHistory1).toBeDefined();
      expect(messageHistory2).toBeDefined();
      expect(messageHistory3).toBeDefined();

      // Same instance should be returned across all calls
      expect(messageHistory1).toBe(messageHistory2);
      expect(messageHistory2).toBe(messageHistory3);
    });

    it('should return the SAME MessageHistory instance across multiple getOutputProcessors calls', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      // Enable message history
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        lastMessages: 10,
        workingMemory: { enabled: false },
        semanticRecall: false,
      };

      // Call getOutputProcessors multiple times
      const processors1 = await memory.getOutputProcessors();
      const processors2 = await memory.getOutputProcessors();
      const processors3 = await memory.getOutputProcessors();

      // Find MessageHistory processors
      const messageHistory1 = processors1.find(p => p.id === 'message-history');
      const messageHistory2 = processors2.find(p => p.id === 'message-history');
      const messageHistory3 = processors3.find(p => p.id === 'message-history');

      expect(messageHistory1).toBeDefined();
      expect(messageHistory2).toBeDefined();
      expect(messageHistory3).toBeDefined();

      // Same instance should be returned across all calls
      expect(messageHistory1).toBe(messageHistory2);
      expect(messageHistory2).toBe(messageHistory3);
    });

    it('should share the same MessageHistory instance between getInputProcessors and getOutputProcessors', async () => {
      const memory = new MockMemory({
        storage: mockStorage as any,
        enableMessageHistory: false,
      });

      // Enable message history
      (memory as any).threadConfig = {
        ...(memory as any).threadConfig,
        lastMessages: 10,
        workingMemory: { enabled: false },
        semanticRecall: false,
      };

      // Call both input and output processor getters
      const inputProcessors = await memory.getInputProcessors();
      const outputProcessors = await memory.getOutputProcessors();

      // Find MessageHistory processors
      const inputMessageHistory = inputProcessors.find(p => p.id === 'message-history');
      const outputMessageHistory = outputProcessors.find(p => p.id === 'message-history');

      expect(inputMessageHistory).toBeDefined();
      expect(outputMessageHistory).toBeDefined();

      // Same instance should be shared between input and output
      expect(inputMessageHistory).toBe(outputMessageHistory);
    });
  });
});
