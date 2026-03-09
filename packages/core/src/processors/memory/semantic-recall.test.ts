import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageList } from '../../agent';
import type { MastraDBMessage } from '../../agent';
import { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';
import type { MastraEmbeddingModel, MastraVector } from '../../vector';

import { globalEmbeddingCache } from './embedding-cache';
import { SemanticRecall } from './semantic-recall';

// Helper function to create test messages in MastraDBMessage format
function createTestMessage(
  id: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  createdAt: Date | string = new Date(),
): MastraDBMessage {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: content ? [{ type: 'text', text: content }] : [],
      content,
    },
    createdAt: typeof createdAt === 'string' ? new Date(createdAt) : createdAt,
  };
}

describe('SemanticRecall', () => {
  let mockStorage: MemoryStorage;
  let mockVector: MastraVector;
  let mockEmbedder: MastraEmbeddingModel<string>;
  let requestContext: RequestContext;

  beforeEach(() => {
    // Clear global embedding cache between tests
    globalEmbeddingCache.clear();

    // Mock storage
    mockStorage = {
      listMessages: vi.fn(),
    } as any;

    // Mock vector store
    mockVector = {
      query: vi.fn(),
      listIndexes: vi.fn(),
      createIndex: vi.fn(),
      upsert: vi.fn(),
    } as any;

    // Mock embedder
    mockEmbedder = {
      doEmbed: vi.fn(),
      modelId: 'text-embedding-3-small',
    } as any;

    // Setup runtime context with memory data
    requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: 'thread-1', resourceId: 'resource-1' },
      resourceId: 'resource-1',
    });
  });

  describe('Input Processing', () => {
    it('should perform semantic search and prepend similar messages', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
      });

      const now = Date.now();
      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: { format: 2, content: 'How do I use the API?', parts: [] },
          createdAt: new Date(now), // Current time
        },
      ];
      const similarMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'API documentation needed', parts: [] },
          createdAt: new Date(now - 2000), // 2 seconds ago
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, content: 'Here is the API guide...', parts: [] },
          createdAt: new Date(now - 1000), // 1 second ago
        },
      ];

      // Mock embedder
      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      // Mock vector query
      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      vi.mocked(mockVector.query).mockResolvedValue([
        {
          id: 'vec-1',
          score: 0.95,
          metadata: { message_id: 'msg-1', thread_id: 'thread-1' },
        },
        {
          id: 'vec-2',
          score: 0.92,
          metadata: { message_id: 'msg-2', thread_id: 'thread-1' },
        },
      ]);

      // Mock storage
      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: similarMessages,
        total: similarMessages.length,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should prepend similar messages
      const resultMessages = Array.isArray(result) ? result : result.get.all.aiV4.ui();
      expect(resultMessages).toHaveLength(3);
      expect(resultMessages[0].id).toBe('msg-1');
      expect(resultMessages[1].id).toBe('msg-2');
      expect(resultMessages[2].id).toBe('msg-new');

      // Verify embedder was called with user query
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['How do I use the API?'],
      });

      // Verify vector query was called
      expect(mockVector.query).toHaveBeenCalledWith({
        indexName: 'mastra_memory_text_embedding_3_small',
        queryVector: [0.1, 0.2, 0.3],
        topK: 3,
        filter: { resource_id: 'resource-1' },
      });
      // Verify storage was called with correct parameters
      expect(mockStorage.listMessages).toHaveBeenCalledWith({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        include: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            withNextMessages: 1,
            withPreviousMessages: 1,
          },
          {
            id: 'msg-2',
            threadId: 'thread-1',
            withNextMessages: 1,
            withPreviousMessages: 1,
          },
        ],
        perPage: 0,
      });
    });

    it('should respect topK limit', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 2,
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.92, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: { format: 2, parts: [], content: 'Message 1' },
            createdAt: new Date(),
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: { format: 2, parts: [], content: 'Message 2' },
            createdAt: new Date(),
          },
        ],
        total: 2,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify topK was passed to vector query
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: 2,
        }),
      );
    });

    it('should filter by threshold', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        threshold: 0.9,
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      // Return results with varying scores
      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.85, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } }, // Below threshold
        { id: 'vec-3', score: 0.92, metadata: { message_id: 'msg-3', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [createTestMessage('msg-1', 'user', 'Message 1'), createTestMessage('msg-3', 'user', 'Message 3')],
        total: 2,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should only include messages above threshold
      const resultMessages = Array.isArray(result) ? result : result.get.all.aiV4.ui();
      expect(resultMessages).toHaveLength(3); // 2 similar + 1 new
      expect(resultMessages.find((m: any) => m.id === 'msg-2')).toBeUndefined();

      // Verify storage was called with only messages above threshold
      expect(mockStorage.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          include: [expect.objectContaining({ id: 'msg-1' }), expect.objectContaining({ id: 'msg-3' })],
        }),
      );
    });

    it('should apply scope filter for thread scope', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        scope: 'thread',
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      vi.mocked(mockVector.query).mockResolvedValue([]);
      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [],
        total: 0,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify thread scope filter was applied
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { thread_id: 'thread-1' },
        }),
      );
    });

    it('should apply scope filter for resource scope', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        scope: 'resource',
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      vi.mocked(mockVector.query).mockResolvedValue([]);
      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [],
        total: 0,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify resource scope filter was applied
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { resource_id: 'resource-1' },
        }),
      );
    });

    it('should handle no results gracefully', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      // No results from vector search
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should return MessageList with original messages unchanged
      expect(result).toBeInstanceOf(MessageList);
      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toEqual(inputMessages);

      // Storage should not be called
      expect(mockStorage.listMessages).not.toHaveBeenCalled();
    });

    it('should handle vector store errors gracefully', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      // Simulate vector query error
      vi.mocked(mockVector.query).mockRejectedValue(new Error('Vector query failed'));

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should return original messages on error
      const resultMessages = Array.isArray(result) ? result : result.get.all.aiV4.ui();
      expect(resultMessages).toHaveLength(inputMessages.length);
      expect(resultMessages[0]!.id).toBe(inputMessages[0]!.id);
    });

    it('should skip when no user message present', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hello!',
            parts: [],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should return MessageList with original messages unchanged
      expect(result).toBeInstanceOf(MessageList);
      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toEqual(inputMessages);

      // No embedder or vector calls should be made
      expect(mockEmbedder.doEmbed).not.toHaveBeenCalled();
      expect(mockVector.query).not.toHaveBeenCalled();
    });

    it('should return original messages when no threadId', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      // Runtime context without thread
      const emptyContext = new RequestContext();

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext: emptyContext,
      });

      // Should return MessageList with original messages unchanged
      expect(result).toBeInstanceOf(MessageList);
      const resultMessages = result instanceof MessageList ? result.get.all.db() : result;
      expect(resultMessages).toEqual(inputMessages);

      // No embedder or vector calls should be made
      expect(mockEmbedder.doEmbed).not.toHaveBeenCalled();
      expect(mockVector.query).not.toHaveBeenCalled();
    });

    it('should handle multi-part user messages', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Part 1' },
              { type: 'text', text: 'Part 2' },
            ],
          },
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should combine text parts
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Part 1 Part 2'],
      });
    });

    it('should avoid duplicate message IDs', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Existing message',
            parts: [],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-new',
          role: 'user',
          content: {
            format: 2,
            content: 'New query',
            parts: [],
          },
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.92, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: { format: 2, content: 'Existing message', parts: [{ type: 'text', text: 'Existing message' }] },
            createdAt: new Date(),
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: { format: 2, content: 'Similar message', parts: [{ type: 'text', text: 'Similar message' }] },
            createdAt: new Date(),
          },
        ],
        total: 2,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should not duplicate msg-1
      const resultMessages = Array.isArray(result) ? result : result.get.all.aiV4.ui();
      expect(resultMessages).toHaveLength(3); // msg-2 (new from search) + msg-1 (existing) + msg-new
      expect(resultMessages.filter((m: any) => m.id === 'msg-1')).toHaveLength(1);
    });

    it('should respect custom messageRange', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        messageRange: { before: 5, after: 3 },
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [createTestMessage('msg-1', 'user', 'Message 1')],
        total: 1,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify custom messageRange was used
      expect(mockStorage.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          include: [
            {
              id: 'msg-1',
              threadId: 'thread-1',
              withNextMessages: 3,
              withPreviousMessages: 5,
            },
          ],
        }),
      );
    });

    it('should create vector index if it does not exist', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      // Index doesn't exist
      vi.mocked(mockVector.listIndexes).mockResolvedValue([]);
      vi.mocked(mockVector.createIndex).mockResolvedValue(undefined);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify index was created
      expect(mockVector.createIndex).toHaveBeenCalledWith({
        indexName: 'mastra_memory_text_embedding_3_small',
        dimension: 3,
        metric: 'cosine',
      });
    });

    it('should use custom index name if provided', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        indexName: 'custom-index',
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['custom-index']);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify custom index name was used
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'custom-index',
        }),
      );
    });

    it('should format cross-thread messages with timestamps and labels when scope is resource', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        scope: 'resource',
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: {
            format: 2,
            content: 'What did we discuss before?',
            parts: [{ type: 'text', text: 'What did we discuss before?' }],
          },
          createdAt: new Date('2024-01-15T12:00:00.000Z'), // After cross-thread messages
        },
      ];

      const crossThreadMessage1: MastraDBMessage = {
        id: 'msg-other-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Previous question',
          parts: [{ type: 'text', text: 'Previous question' }],
        },
        threadId: 'other-thread-1',
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
      };

      const crossThreadMessage2: MastraDBMessage = {
        id: 'msg-other-2',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Previous answer',
          parts: [{ type: 'text', text: 'Previous answer' }],
        },
        threadId: 'other-thread-1',
        createdAt: new Date('2024-01-15T10:31:00.000Z'),
      };

      const sameThreadMessage: MastraDBMessage = {
        id: 'msg-same',
        role: 'user',
        content: {
          format: 2,
          content: 'Same thread message',
          parts: [{ type: 'text', text: 'Same thread message' }],
        },
        threadId: 'thread-1', // Same as current thread in requestContext
        createdAt: new Date('2024-01-15T11:00:00.000Z'),
      };

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra-memory']);
      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'msg-other-1', score: 0.9, metadata: { message_id: 'msg-other-1', thread_id: 'other-thread-1' } },
        { id: 'msg-other-2', score: 0.85, metadata: { message_id: 'msg-other-2', thread_id: 'other-thread-1' } },
        { id: 'msg-same', score: 0.8, metadata: { message_id: 'msg-same', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [crossThreadMessage1, crossThreadMessage2, sameThreadMessage],
        total: 3,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should have: system message (cross-thread) + same-thread message + original message
      const promptMessages = Array.isArray(result) ? result : result.get.all.aiV4.prompt();
      expect(promptMessages).toHaveLength(3);

      // First message should be the formatted cross-thread message (as system message)
      expect(promptMessages[0]!.role).toBe('system');
      expect(promptMessages[0]!.content).toContain('<remembered_from_other_conversation>');
      expect(promptMessages[0]!.content).toContain('Previous question');
      expect(promptMessages[0]!.content).toContain('Previous answer');
      expect(promptMessages[0]!.content).toContain('User:');
      expect(promptMessages[0]!.content).toContain('Assistant:');

      // Second message should be the same-thread message
      expect(promptMessages[1]!.role).toBe(sameThreadMessage.role);
      const msg1Content = Array.isArray(promptMessages[1]!.content)
        ? (promptMessages[1]!.content.find((p: any) => p.type === 'text') as any)?.text
        : promptMessages[1]!.content;
      expect(msg1Content).toContain(sameThreadMessage.content.content);

      // Third message should be the original input
      expect(promptMessages[2]!.role).toBe(inputMessages[0]!.role);
      const msg2Content = Array.isArray(promptMessages[2]!.content)
        ? (promptMessages[2]!.content.find((p: any) => p.type === 'text') as any)?.text
        : promptMessages[2]!.content;
      expect(msg2Content).toContain(inputMessages[0]!.content.content);
    });

    it('should not add cross-thread messages when scope is thread', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        scope: 'thread',
      });

      const inputMessages: MastraDBMessage[] = [createTestMessage('msg-new', 'user', 'Test query')];

      const similarMessage: MastraDBMessage = {
        id: 'msg-similar',
        role: 'user',
        content: {
          format: 2,

          content: 'Similar message',

          parts: [],
        },
        threadId: 'thread-123',
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
      };

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra-memory']);
      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'msg-similar', score: 0.9, metadata: { message_id: 'msg-similar', thread_id: 'thread-123' } },
      ]);
      vi.mocked(mockStorage.listMessages).mockResolvedValue({
        messages: [similarMessage],
        total: 1,
        page: 1,
        perPage: false,
        hasMore: false,
      });

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      const result = await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should NOT add cross-thread messages when scope is 'thread'
      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0]!.id).toBe(inputMessages[0]!.id);

      // No system message with cross-thread formatting
      expect(
        resultMessages.some(
          (m: any) =>
            m.role === 'system' &&
            typeof m.content === 'object' &&
            m.content.content?.includes('<remembered_from_other_conversation>'),
        ),
      ).toBe(false);
    });
  });

  describe('Output Processing', () => {
    it('should create embeddings for both user and assistant messages', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi
          .fn()
          .mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
          .mockResolvedValueOnce({ embeddings: [[0.4, 0.5, 0.6]] }),
      };

      const mockVector = {
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_test_model']),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'What is the weather?',
          parts: [{ type: 'text', text: 'What is the weather?' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const assistantMessage: MastraDBMessage = {
        id: 'msg-assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The weather is sunny.',
          parts: [{ type: 'text', text: 'The weather is sunny.' }],
        },
        createdAt: new Date('2024-01-01T10:00:01Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([userMessage, assistantMessage], 'input');

      const result = await processor.processOutputResult({
        messages: [userMessage, assistantMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should return messageList (not an array) to signal no transformation
      expect(result).toBe(messageList);

      // Should create embeddings for both messages (called separately)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['What is the weather?'],
      });
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['The weather is sunny.'],
      });

      // Should upsert embeddings to vector store
      expect(mockVector.upsert).toHaveBeenCalledWith({
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
        ids: ['msg-user-1', 'msg-assistant-1'],
        metadata: [
          {
            message_id: 'msg-user-1',
            thread_id: 'thread-123',
            resource_id: 'user-456',
            role: 'user',
            content: 'What is the weather?',
            created_at: '2024-01-01T10:00:00.000Z',
          },
          {
            message_id: 'msg-assistant-1',
            thread_id: 'thread-123',
            resource_id: 'user-456',
            role: 'assistant',
            content: 'The weather is sunny.',
            created_at: '2024-01-01T10:00:01.000Z',
          },
        ],
        indexName: 'mastra_memory_test_model',
      });
    });

    it('should skip system messages when creating embeddings', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi
          .fn()
          .mockResolvedValueOnce({
            embeddings: [[0.1, 0.2, 0.3]],
          })
          .mockResolvedValueOnce({
            embeddings: [[0.4, 0.5, 0.6]],
          }),
      };

      const mockVector = {
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_test_model']),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const systemMessage: MastraDBMessage = {
        id: 'msg-system-1',
        role: 'system',
        content: {
          format: 2,
          content: 'You are a helpful assistant.',
          parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:01Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([systemMessage, userMessage], 'input');

      await processor.processOutputResult({
        messages: [systemMessage, userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should only create embedding for user message, not system
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Hello'],
      });

      expect(mockVector.upsert).toHaveBeenCalledWith({
        vectors: [[0.1, 0.2, 0.3]],
        ids: ['msg-user-1'],
        metadata: [
          {
            message_id: 'msg-user-1',
            thread_id: 'thread-123',
            resource_id: 'user-456',
            role: 'user',
            content: 'Hello',
            created_at: '2024-01-01T10:00:01.000Z',
          },
        ],
        indexName: 'mastra_memory_test_model',
      });
    });

    it('should handle messages with no text content', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      };

      const mockVector = {
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_test_model']),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const emptyMessage: MastraDBMessage = {
        id: 'msg-empty-1',
        role: 'user',
        content: {
          format: 2,
          content: '',
          parts: [],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const validMessage: MastraDBMessage = {
        id: 'msg-valid-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:01Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([emptyMessage, validMessage], 'input');

      await processor.processOutputResult({
        messages: [emptyMessage, validMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should only create embedding for message with content
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Hello'],
      });

      expect(mockVector.upsert).toHaveBeenCalledWith({
        vectors: [[0.1, 0.2, 0.3]],
        ids: ['msg-valid-1'],
        metadata: expect.arrayContaining([
          expect.objectContaining({
            message_id: 'msg-valid-1',
          }),
        ]),
        indexName: 'mastra_memory_test_model',
      });
    });

    it('should create vector index if it does not exist', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      };

      const mockVector = {
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue([]),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([userMessage], 'input');

      await processor.processOutputResult({
        messages: [userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should create index with correct dimension
      expect(mockVector.createIndex).toHaveBeenCalledWith({
        indexName: 'mastra_memory_test_model',
        dimension: 3,
        metric: 'cosine',
      });
    });

    it('should use custom index name if provided', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      };

      const mockVector = {
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue([]),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
        indexName: 'custom-index',
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([userMessage], 'input');

      await processor.processOutputResult({
        messages: [userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should use custom index name
      expect(mockVector.createIndex).toHaveBeenCalledWith({
        indexName: 'custom-index',
        dimension: 3,
        metric: 'cosine',
      });

      expect(mockVector.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'custom-index',
        }),
      );
    });

    it('should return original messages when no threadId', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi.fn(),
      };

      const mockVector = {
        upsert: vi.fn(),
        query: vi.fn(),
        createIndex: vi.fn(),
        listIndexes: vi.fn(),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const requestContext = new RequestContext();
      // No memory context set

      const messageList = new MessageList();
      messageList.add([userMessage], 'input');

      const result = await processor.processOutputResult({
        messages: [userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should return messageList to signal no transformation
      expect(result).toBe(messageList);

      // Should not create embeddings
      expect(mockEmbedder.doEmbed).not.toHaveBeenCalled();
      expect(mockVector.upsert).not.toHaveBeenCalled();
    });

    it('should handle embedding errors gracefully', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi.fn().mockRejectedValue(new Error('Embedding service unavailable')),
      };

      const mockVector = {
        upsert: vi.fn(),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_test_model']),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([userMessage], 'input');

      const result = await processor.processOutputResult({
        messages: [userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should return messageList even on error to signal no transformation
      expect(result).toBe(messageList);

      // Should not call upsert if embedding fails
      expect(mockVector.upsert).not.toHaveBeenCalled();
    });

    it('should embed user messages from messageList even when only response messages are passed', async () => {
      // This test verifies that when processOutputResult is called with only response messages
      // (as is the case in runOutputProcessors), it still embeds user messages from the messageList
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi
          .fn()
          .mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] }) // for assistant message
          .mockResolvedValueOnce({ embeddings: [[0.4, 0.5, 0.6]] }), // for user message
      };

      const mockVector = {
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_test_model']),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'What is the weather?',
          parts: [{ type: 'text', text: 'What is the weather?' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const assistantMessage: MastraDBMessage = {
        id: 'msg-assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The weather is sunny.',
          parts: [{ type: 'text', text: 'The weather is sunny.' }],
        },
        createdAt: new Date('2024-01-01T10:00:01Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      // Add both messages to messageList, but only pass response message to processOutputResult
      // This simulates how runOutputProcessors works - it passes messageList.get.response.db()
      const messageList = new MessageList();
      messageList.add([userMessage], 'input'); // User message added as input
      messageList.add([assistantMessage], 'response'); // Assistant added as response

      const result = await processor.processOutputResult({
        messages: [assistantMessage], // Only response messages passed (like runOutputProcessors does)
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(result).toBe(messageList);

      // Should create embeddings for BOTH user and assistant messages
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(2);
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['The weather is sunny.'],
      });
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['What is the weather?'],
      });

      // Should upsert embeddings for both messages
      expect(mockVector.upsert).toHaveBeenCalledWith({
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
        ids: ['msg-assistant-1', 'msg-user-1'],
        metadata: expect.arrayContaining([
          expect.objectContaining({
            message_id: 'msg-assistant-1',
            role: 'assistant',
          }),
          expect.objectContaining({
            message_id: 'msg-user-1',
            role: 'user',
          }),
        ]),
        indexName: 'mastra_memory_test_model',
      });
    });

    it('should handle vector store errors gracefully', async () => {
      const mockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const mockEmbedder = {
        modelId: 'test-model',
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      };

      const mockVector = {
        upsert: vi.fn().mockRejectedValue(new Error('Vector store unavailable')),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_test_model']),
      };

      const processor = new SemanticRecall({
        storage: mockStorage as any,
        embedder: mockEmbedder as any,
        vector: mockVector as any,
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([userMessage], 'input');

      const result = await processor.processOutputResult({
        messages: [userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should return messageList even on error to signal no transformation
      expect(result).toBe(messageList);

      // Should have attempted to upsert
      expect(mockVector.upsert).toHaveBeenCalled();
    });
  });

  describe('Embedding Caching', () => {
    it('should cache embeddings and reuse them for identical content', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3]];
      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: mockEmbeddings,
      });

      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
      });

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const message1: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello world',
          parts: [{ type: 'text', text: 'Hello world' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const message2: MastraDBMessage = {
        id: 'msg-2',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello world', // Same content as message1
          parts: [{ type: 'text', text: 'Hello world' }],
        },
        createdAt: new Date('2024-01-01T10:01:00Z'),
      };

      const message3: MastraDBMessage = {
        id: 'msg-3',
        role: 'user',
        content: {
          format: 2,
          content: 'Different content',
          parts: [{ type: 'text', text: 'Different content' }],
        },
        createdAt: new Date('2024-01-01T10:02:00Z'),
      };

      vi.mocked(mockVector.listIndexes).mockResolvedValue([]);
      vi.mocked(mockVector.createIndex).mockResolvedValue(undefined);
      vi.mocked(mockVector.upsert).mockResolvedValue([]);

      const messageList1 = new MessageList();
      messageList1.add([message1], 'input');

      // First call - should call embedder
      await processor.processOutputResult({
        messages: [message1],
        messageList: messageList1,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Hello world'],
      });

      const messageList2 = new MessageList();
      messageList2.add([message2], 'input');

      // Second call with same content - should use cache, not call embedder again
      await processor.processOutputResult({
        messages: [message2],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should still be 1 call (cached)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);

      const messageList3 = new MessageList();
      messageList3.add([message3], 'input');

      // Third call with different content - should call embedder again
      await processor.processOutputResult({
        messages: [message3],
        messageList: messageList3,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should now be 2 calls (new content)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(2);
      expect(mockEmbedder.doEmbed).toHaveBeenLastCalledWith({
        values: ['Different content'],
      });
    });

    it('should cache embeddings for processInput queries', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3]];
      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: mockEmbeddings,
      });

      vi.mocked(mockVector.query).mockResolvedValue([]);

      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
      });

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
          content: 'What is the weather?',
          parts: [{ type: 'text', text: 'What is the weather?' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const messageList1 = new MessageList();
      messageList1.add([message], 'input');

      // First query
      await processor.processInput({
        messages: [message],
        messageList: messageList1,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);

      const messageList2 = new MessageList();
      messageList2.add([message], 'input');

      // Second query with same content - should use cache
      await processor.processInput({
        messages: [message],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      // Should still be 1 call (cached)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(1);
    });
  });

  describe('Embedder Options', () => {
    it('should pass embedderOptions to doEmbed when configured', async () => {
      const embedderOptions = {
        providerOptions: {
          google: {
            outputDimensionality: 384,
            taskType: 'RETRIEVAL_DOCUMENT',
          },
        },
      };

      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
        embedderOptions,
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: { format: 2, content: 'Test query', parts: [] },
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify embedder was called with providerOptions
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Test query'],
        providerOptions: {
          google: {
            outputDimensionality: 384,
            taskType: 'RETRIEVAL_DOCUMENT',
          },
        },
      });
    });

    it('should pass embedderOptions during output processing (embedding generation)', async () => {
      const embedderOptions = {
        providerOptions: {
          google: {
            outputDimensionality: 768,
          },
        },
      };

      const localMockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const localMockEmbedder = {
        modelId: 'gemini-embedding-001',
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      };

      const localMockVector = {
        upsert: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_gemini_embedding_001']),
      };

      const processor = new SemanticRecall({
        storage: localMockStorage as any,
        embedder: localMockEmbedder as any,
        vector: localMockVector as any,
        embedderOptions,
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const localRequestContext = new RequestContext();
      localRequestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([userMessage], 'input');

      await processor.processOutputResult({
        messages: [userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext: localRequestContext,
      });

      // Verify embedder was called with providerOptions
      expect(localMockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Hello'],
        providerOptions: {
          google: {
            outputDimensionality: 768,
          },
        },
      });
    });

    it('should work without embedderOptions (backwards compatibility)', async () => {
      // Create processor without embedderOptions
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
        // No embedderOptions
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: { format: 2, content: 'Test query', parts: [] },
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        warnings: [],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify embedder was called with only values (no extra options)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Test query'],
      });
    });

    it('should pass non-providerOptions embedderOptions (like maxRetries)', async () => {
      const embedderOptions = {
        maxRetries: 5,
        maxParallelCalls: 2,
      };

      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
        embedderOptions,
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: { format: 2, content: 'Test query', parts: [] },
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        warnings: [],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify embedder was called with maxRetries and maxParallelCalls
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Test query'],
        maxRetries: 5,
        maxParallelCalls: 2,
      });
    });

    it('should handle empty embedderOptions object', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
        embedderOptions: {}, // Empty object
      });

      const inputMessages: MastraDBMessage[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: { format: 2, content: 'Test query', parts: [] },
          createdAt: new Date(),
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        warnings: [],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue(['mastra_memory_text_embedding_3_small']);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const messageList = new MessageList();
      messageList.add(inputMessages, 'input');

      await processor.processInput({
        messages: inputMessages,
        messageList,
        abort: vi.fn() as any,
        requestContext,
      });

      // Verify embedder was called (empty object spread is fine)
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Test query'],
      });
    });

    it('should handle embedding errors gracefully when embedderOptions are configured', async () => {
      const localMockStorage = {
        listMessages: vi.fn(),
        saveMessages: vi.fn(),
      };

      const localMockEmbedder = {
        modelId: 'gemini-embedding-001',
        doEmbed: vi.fn().mockRejectedValue(new Error('Invalid outputDimensionality value')),
      };

      const localMockVector = {
        upsert: vi.fn(),
        query: vi.fn(),
        createIndex: vi.fn().mockResolvedValue(undefined),
        listIndexes: vi.fn().mockResolvedValue(['mastra_memory_gemini_embedding_001']),
      };

      const processor = new SemanticRecall({
        storage: localMockStorage as any,
        embedder: localMockEmbedder as any,
        vector: localMockVector as any,
        embedderOptions: {
          providerOptions: {
            google: {
              outputDimensionality: -1, // Invalid value that would cause an error
            },
          },
        },
      });

      const userMessage: MastraDBMessage = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const localRequestContext = new RequestContext();
      localRequestContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const messageList = new MessageList();
      messageList.add([userMessage], 'input');

      // Should not throw, should handle error gracefully
      const result = await processor.processOutputResult({
        messages: [userMessage],
        messageList,
        abort: vi.fn() as any,
        requestContext: localRequestContext,
      });

      // Should return messageList (no transformation, just side effect embedding)
      expect(result).toBe(messageList);
      // Embedder should have been called with the providerOptions
      expect(localMockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['Hello'],
        providerOptions: {
          google: {
            outputDimensionality: -1,
          },
        },
      });
      // Vector upsert should not be called since embedding failed
      expect(localMockVector.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Dimension Validation', () => {
    it('should fail when querying index with mismatched dimensions (reproduces user issue #11854)', async () => {
      // Reproduces issue #11854: Create index with 384 dims, switch embedder to 1536 dims
      const customIndexName = 'atlas_project_memories';

      const createdIndexes = new Map<string, { dimension: number; metric: string; vectors: number[][] }>();

      const mockVector = {
        listIndexes: vi.fn().mockImplementation(async () => {
          return Array.from(createdIndexes.keys());
        }),
        createIndex: vi.fn().mockImplementation(async ({ indexName, dimension, metric }) => {
          if (createdIndexes.has(indexName)) {
            const existing = createdIndexes.get(indexName)!;
            if (existing.dimension !== dimension) {
              throw new Error(
                `Index "${indexName}" already exists with ${existing.dimension} dimensions, but ${dimension} dimensions were requested`,
              );
            }
            return;
          }
          createdIndexes.set(indexName, { dimension, metric, vectors: [] });
        }),
        upsert: vi.fn().mockImplementation(async ({ indexName, vectors }) => {
          const index = createdIndexes.get(indexName);
          if (!index) {
            throw new Error(`Index "${indexName}" does not exist`);
          }
          // Store vectors
          index.vectors.push(...vectors);
          return vectors.map((_, i) => `vec-${i}`);
        }),
        query: vi.fn().mockImplementation(async ({ indexName, queryVector }) => {
          const index = createdIndexes.get(indexName);
          if (!index) {
            throw new Error(`Index "${indexName}" does not exist`);
          }
          // Validate query vector dimensions match index
          if (queryVector.length !== index.dimension) {
            throw new Error(
              `vector field is indexed with ${index.dimension} dimensions but queried with ${queryVector.length}`,
            );
          }
          return [];
        }),
        describeIndex: vi.fn().mockImplementation(async ({ indexName }) => {
          const index = createdIndexes.get(indexName);
          if (!index) {
            throw new Error(`Index "${indexName}" does not exist`);
          }
          return {
            dimension: index.dimension,
            metric: index.metric,
            count: index.vectors.length,
          };
        }),
      } as any;

      const mockStorage = {
        listMessages: vi.fn().mockResolvedValue({
          messages: [],
          total: 0,
          page: 1,
          perPage: false,
          hasMore: false,
        }),
      } as any;

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-1' },
        resourceId: 'resource-1',
      });

      // Step 1: Create processor with fastembed (384 dims)
      const fastembedEmbedder = {
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [Array(384).fill(0.1)],
        }),
        modelId: 'fastembed-base',
      } as any;

      const fastembedProcessor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: fastembedEmbedder,
        indexName: customIndexName,
        topK: 3,
      });

      const message1: MastraDBMessage = {
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
      messageList1.add([message1], 'input');

      await fastembedProcessor.processOutputResult({
        messages: [message1],
        messageList: messageList1,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(createdIndexes.get(customIndexName)?.dimension).toBe(384);
      expect(createdIndexes.get(customIndexName)?.vectors.length).toBe(1);

      // Step 2: Switch to OpenAI embedder (1536 dims) with same index name
      const openaiEmbedder = {
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [Array(1536).fill(0.1)],
        }),
        modelId: 'text-embedding-3-small',
      } as any;

      const openaiProcessor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: openaiEmbedder,
        indexName: customIndexName,
        topK: 3,
      });

      const message2: MastraDBMessage = {
        id: 'msg-2',
        role: 'user',
        content: {
          format: 2,
          content: 'What is the weather?',
          parts: [{ type: 'text', text: 'What is the weather?' }],
        },
        createdAt: new Date(),
      };

      const messageList2 = new MessageList();
      messageList2.add([message2], 'input');

      // After fix: ensureVectorIndex should call createIndex, which catches mismatch early
      const result = await openaiProcessor.processInput({
        messages: [message2],
        messageList: messageList2,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(mockVector.createIndex).toHaveBeenCalledWith({
        indexName: customIndexName,
        dimension: 1536,
        metric: 'cosine',
      });

      // createIndex should have thrown, preventing query from happening
      expect(mockVector.query).not.toHaveBeenCalled();
      expect(result).toBe(messageList2);
    });

    it('should succeed when using same embedder dimensions on existing index', async () => {
      // Verifies idempotent createIndex when dimensions match
      const customIndexName = 'test_index';
      const createdIndexes = new Map<string, { dimension: number; metric: string }>();

      const mockVector = {
        listIndexes: vi.fn().mockImplementation(async () => {
          return Array.from(createdIndexes.keys());
        }),
        createIndex: vi.fn().mockImplementation(async ({ indexName, dimension, metric }) => {
          if (createdIndexes.has(indexName)) {
            const existing = createdIndexes.get(indexName)!;
            if (existing.dimension !== dimension) {
              throw new Error(
                `Index "${indexName}" already exists with ${existing.dimension} dimensions, but ${dimension} dimensions were requested`,
              );
            }
            return;
          }
          createdIndexes.set(indexName, { dimension, metric });
        }),
        describeIndex: vi.fn().mockImplementation(async ({ indexName }) => {
          const index = createdIndexes.get(indexName);
          if (!index) {
            throw new Error(`Index "${indexName}" does not exist`);
          }
          return {
            dimension: index.dimension,
            metric: index.metric,
            count: 0,
          };
        }),
        query: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue([]),
      } as any;

      const mockStorage = {
        listMessages: vi.fn().mockResolvedValue({
          messages: [],
          total: 0,
          page: 1,
          perPage: false,
          hasMore: false,
        }),
      } as any;

      const embedder = {
        doEmbed: vi.fn().mockResolvedValue({
          embeddings: [Array(384).fill(0.1)],
        }),
        modelId: 'test-embedder',
      } as any;

      const processor1 = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: embedder,
        indexName: customIndexName,
        topK: 3,
      });

      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: { id: 'thread-1' },
        resourceId: 'resource-1',
      });

      const inputMessage: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date(),
      };

      const messageList1 = new MessageList();
      messageList1.add([inputMessage], 'input');

      await processor1.processInput({
        messages: [inputMessage],
        messageList: messageList1,
        abort: vi.fn() as any,
        requestContext,
      });

      expect(createdIndexes.get(customIndexName)?.dimension).toBe(384);

      const processor2 = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: embedder,
        indexName: customIndexName,
        topK: 3,
      });

      const messageList2 = new MessageList();
      messageList2.add([inputMessage], 'input');

      await expect(
        processor2.processInput({
          messages: [inputMessage],
          messageList: messageList2,
          abort: vi.fn() as any,
          requestContext,
        }),
      ).resolves.not.toThrow();

      expect(mockVector.createIndex).toHaveBeenCalledTimes(2);
    });
  });
});
