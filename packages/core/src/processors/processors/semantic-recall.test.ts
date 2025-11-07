import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { MastraMessageV2 } from '../../agent/types';
import type { Embedder } from '../../llm/model';
import { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage/domains/memory/base';
import type { VectorStore } from '../../vector/types';

import { SemanticRecall } from './semantic-recall';

// Helper function to create test messages in MastraMessageV2 format
function createTestMessage(
  id: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  createdAt: Date = new Date(),
): MastraMessageV2 {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [],
      content,
    },
    createdAt,
  };
}

describe('SemanticRecall', () => {
  let mockStorage: MemoryStorage;
  let mockVector: VectorStore;
  let mockEmbedder: Embedder;
  let runtimeContext: RequestContext;

  beforeEach(() => {
    // Mock storage
    mockStorage = {
      getMessages: vi.fn(),
    } as any;

    // Mock vector store
    mockVector = {
      query: vi.fn(),
      listIndexes: vi.fn(),
      createIndex: vi.fn(),
    } as any;

    // Mock embedder
    mockEmbedder = {
      doEmbed: vi.fn(),
      modelId: 'text-embedding-3-small',
    } as any;

    // Setup runtime context with memory data
    runtimeContext = new RequestContext();
    runtimeContext.set('MastraMemory', {
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

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: { format: 2, content: 'How do I use the API?', parts: [] },
        },
      ];

      const similarMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, content: 'API documentation needed', parts: [] },
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, content: 'Here is the API guide...', parts: [] },
        },
      ];

      // Mock embedder
      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      // Mock vector query
      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

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
      vi.mocked(mockStorage.getMessages).mockResolvedValue({ messages: similarMessages });

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should prepend similar messages
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[2].id).toBe('msg-new');

      // Verify embedder was called with user query
      expect(mockEmbedder.doEmbed).toHaveBeenCalledWith({
        values: ['How do I use the API?'],
      });

      // Verify vector query was called
      expect(mockVector.query).toHaveBeenCalledWith({
        indexName: 'mastra_memory_text_embedding_3_small',
        queryVector: [0.1, 0.2, 0.3],
        topK: 3,
        filter: { thread_id: 'thread-1' },
      });

      // Verify storage was called with correct parameters
      expect(mockStorage.getMessages).toHaveBeenCalledWith({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        selectBy: {
          include: [
            {
              id: 'msg-1',
              threadId: 'thread-1',
              withNextMessages: 2,
              withPreviousMessages: 2,
            },
            {
              id: 'msg-2',
              threadId: 'thread-1',
              withNextMessages: 2,
              withPreviousMessages: 2,
            },
          ],
        },
      });
    });

    it('should respect topK limit', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 2,
      });

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.92, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue({
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
      });

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
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

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      // Return results with varying scores
      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.85, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } }, // Below threshold
        { id: 'vec-3', score: 0.92, metadata: { message_id: 'msg-3', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue({
        messages: [createTestMessage('msg-1', 'user', 'Message 1'), createTestMessage('msg-3', 'user', 'Message 3')],
      });

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should only include messages above threshold
      expect(result).toHaveLength(3); // 2 similar + 1 new
      expect(result.find(m => m.id === 'msg-2')).toBeUndefined();

      // Verify storage was called with only messages above threshold
      expect(mockStorage.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          selectBy: {
            include: [expect.objectContaining({ id: 'msg-1' }), expect.objectContaining({ id: 'msg-3' })],
          },
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

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([]);
      vi.mocked(mockStorage.getMessages).mockResolvedValue({ messages: [] });

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
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

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([]);
      vi.mocked(mockStorage.getMessages).mockResolvedValue({ messages: [] });

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
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

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      // No results from vector search
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return original messages unchanged
      expect(result).toEqual(inputMessages);

      // Storage should not be called
      expect(mockStorage.getMessages).not.toHaveBeenCalled();
    });

    it('should handle vector store errors gracefully', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      // Simulate vector query error
      vi.mocked(mockVector.query).mockRejectedValue(new Error('Vector query failed'));

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return original messages on error
      expect(result).toEqual(inputMessages);
    });

    it('should skip when no user message present', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,

            content: 'Hello!',

            parts: [],
          },
        },
      ];

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return original messages unchanged
      expect(result).toEqual(inputMessages);

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

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      // Runtime context without thread
      const emptyContext = new RequestContext();

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext: emptyContext,
      });

      // Should return original messages unchanged
      expect(result).toEqual(inputMessages);

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

      const inputMessages: MastraMessageV2[] = [
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
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
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

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,

            content: 'Existing message',

            parts: [],
          },
        },
        {
          id: 'msg-new',
          role: 'user',
          content: {
            format: 2,

            content: 'New query',

            parts: [],
          },
        },
      ];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.92, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue({
        messages: [
          { id: 'msg-1', role: 'user', content: { format: 2, content: 'Existing message', parts: [] } },
          { id: 'msg-2', role: 'assistant', content: { format: 2, content: 'Similar message', parts: [] } },
        ],
      });

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should not duplicate msg-1
      expect(result).toHaveLength(3); // msg-2 (new from search) + msg-1 (existing) + msg-new
      expect(result.filter(m => m.id === 'msg-1')).toHaveLength(1);
    });

    it('should respect custom messageRange', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        messageRange: { before: 5, after: 3 },
      });

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra_memory_text_embedding_3_small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue({
        messages: [createTestMessage('msg-1', 'user', 'Message 1')],
      });

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Verify custom messageRange was used
      expect(mockStorage.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          selectBy: {
            include: [
              {
                id: 'msg-1',
                threadId: 'thread-1',
                withNextMessages: 3,
                withPreviousMessages: 5,
              },
            ],
          },
        }),
      );
    });

    it('should create vector index if it does not exist', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      // Index doesn't exist
      vi.mocked(mockVector.listIndexes).mockResolvedValue([]);
      vi.mocked(mockVector.createIndex).mockResolvedValue(undefined);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
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

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([{ name: 'custom-index', dimension: 3 }]);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
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

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: {
            format: 2,

            content: 'What did we discuss before?',

            parts: [],
          },
        },
      ];

      const crossThreadMessage1: MastraMessageV2 = {
        id: 'msg-other-1',
        role: 'user',
        content: {
          format: 2,

          content: 'Previous question',

          parts: [],
        },
        threadId: 'other-thread-1',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      const crossThreadMessage2: MastraMessageV2 = {
        id: 'msg-other-2',
        role: 'assistant',
        content: {
          format: 2,

          content: 'Previous answer',

          parts: [],
        },
        threadId: 'other-thread-1',
        createdAt: '2024-01-15T10:31:00.000Z',
      };

      const sameThreadMessage: MastraMessageV2 = {
        id: 'msg-same',
        role: 'user',
        content: {
          format: 2,

          content: 'Same thread message',

          parts: [],
        },
        threadId: 'thread-1', // Same as current thread in runtimeContext
        createdAt: '2024-01-15T11:00:00.000Z',
      };

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([{ name: 'mastra-memory', dimension: 3 }]);
      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'msg-other-1', score: 0.9, metadata: { message_id: 'msg-other-1', thread_id: 'other-thread-1' } },
        { id: 'msg-other-2', score: 0.85, metadata: { message_id: 'msg-other-2', thread_id: 'other-thread-1' } },
        { id: 'msg-same', score: 0.8, metadata: { message_id: 'msg-same', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue({
        messages: [crossThreadMessage1, crossThreadMessage2, sameThreadMessage],
      });

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should have: system message (cross-thread) + same-thread message + original message
      expect(result).toHaveLength(3);

      // First message should be the formatted cross-thread system message
      expect(result[0]!.role).toBe('system');
      expect(result[0]!.content.content).toContain('<remembered_from_other_conversation>');
      expect(result[0]!.content.content).toContain('Previous question');
      expect(result[0]!.content.content).toContain('Previous answer');
      expect(result[0]!.content.content).toContain('User:');
      expect(result[0]!.content.content).toContain('Assistant:');

      // Second message should be the same-thread message
      expect(result[1]).toEqual(sameThreadMessage);

      // Third message should be the original input
      expect(result[2]).toEqual(inputMessages[0]);
    });

    it('should not format cross-thread messages when scope is thread', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        scope: 'thread',
      });

      const inputMessages: MastraMessageV2[] = [createTestMessage('msg-new', 'user', 'Test query')];

      const similarMessage: MastraMessageV2 = {
        id: 'msg-similar',
        role: 'user',
        content: {
          format: 2,

          content: 'Similar message',

          parts: [],
        },
        threadId: 'thread-123',
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      vi.mocked(mockEmbedder.doEmbed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([{ name: 'mastra-memory', dimension: 3 }]);
      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'msg-similar', score: 0.9, metadata: { message_id: 'msg-similar', thread_id: 'thread-123' } },
      ]);
      vi.mocked(mockStorage.getMessages).mockResolvedValue({ messages: [similarMessage] });

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should just prepend the similar message, no special formatting
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(similarMessage);
      expect(result[1]).toEqual(inputMessages[0]);

      // No system message with cross-thread formatting
      expect(
        result.some(
          m =>
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
        getMessages: vi.fn(),
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

      const userMessage: MastraMessageV2 = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          content: 'What is the weather?',
          parts: [{ type: 'text', text: 'What is the weather?' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const assistantMessage: MastraMessageV2 = {
        id: 'msg-assistant-1',
        role: 'assistant',
        content: {
          content: 'The weather is sunny.',
          parts: [{ type: 'text', text: 'The weather is sunny.' }],
        },
        createdAt: new Date('2024-01-01T10:00:01Z'),
      };

      const runtimeContext = new RequestContext();
      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const result = await processor.processOutputResult({
        messages: [userMessage, assistantMessage],
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return messages unchanged
      expect(result).toEqual([userMessage, assistantMessage]);

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
        getMessages: vi.fn(),
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

      const systemMessage: MastraMessageV2 = {
        id: 'msg-system-1',
        role: 'system',
        content: {
          content: 'You are a helpful assistant.',
          parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const userMessage: MastraMessageV2 = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:01Z'),
      };

      const runtimeContext = new RequestContext();
      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      await processor.processOutputResult({
        messages: [systemMessage, userMessage],
        abort: vi.fn() as any,
        runtimeContext,
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
        getMessages: vi.fn(),
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

      const emptyMessage: MastraMessageV2 = {
        id: 'msg-empty-1',
        role: 'user',
        content: {
          content: '',
          parts: [],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const validMessage: MastraMessageV2 = {
        id: 'msg-valid-1',
        role: 'user',
        content: {
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:01Z'),
      };

      const runtimeContext = new RequestContext();
      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      await processor.processOutputResult({
        messages: [emptyMessage, validMessage],
        abort: vi.fn() as any,
        runtimeContext,
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
        getMessages: vi.fn(),
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

      const userMessage: MastraMessageV2 = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const runtimeContext = new RequestContext();
      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      await processor.processOutputResult({
        messages: [userMessage],
        abort: vi.fn() as any,
        runtimeContext,
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
        getMessages: vi.fn(),
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

      const userMessage: MastraMessageV2 = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const runtimeContext = new RequestContext();
      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      await processor.processOutputResult({
        messages: [userMessage],
        abort: vi.fn() as any,
        runtimeContext,
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
        getMessages: vi.fn(),
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

      const userMessage: MastraMessageV2 = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const runtimeContext = new RequestContext();
      // No memory context set

      const result = await processor.processOutputResult({
        messages: [userMessage],
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return messages unchanged
      expect(result).toEqual([userMessage]);

      // Should not create embeddings
      expect(mockEmbedder.doEmbed).not.toHaveBeenCalled();
      expect(mockVector.upsert).not.toHaveBeenCalled();
    });

    it('should handle embedding errors gracefully', async () => {
      const mockStorage = {
        getMessages: vi.fn(),
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

      const userMessage: MastraMessageV2 = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const runtimeContext = new RequestContext();
      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const result = await processor.processOutputResult({
        messages: [userMessage],
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return messages unchanged even on error
      expect(result).toEqual([userMessage]);

      // Should not call upsert if embedding fails
      expect(mockVector.upsert).not.toHaveBeenCalled();
    });

    it('should handle vector store errors gracefully', async () => {
      const mockStorage = {
        getMessages: vi.fn(),
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

      const userMessage: MastraMessageV2 = {
        id: 'msg-user-1',
        role: 'user',
        content: {
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      const runtimeContext = new RequestContext();
      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-123' },
        resourceId: 'user-456',
      });

      const result = await processor.processOutputResult({
        messages: [userMessage],
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return messages unchanged even on error
      expect(result).toEqual([userMessage]);

      // Should have attempted to upsert
      expect(mockVector.upsert).toHaveBeenCalled();
    });
  });
});
