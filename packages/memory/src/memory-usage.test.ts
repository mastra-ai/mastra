import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';
import { Memory } from './index';

// Mock embedMany for all AI SDK versions
// v3 spec uses @internal/ai-v6
vi.mock('@internal/ai-v6', () => ({
  embedMany: vi.fn().mockResolvedValue({
    embeddings: [[0.1, 0.2]],
    usage: { tokens: 42 },
  }),
}));

// v2 spec uses @internal/ai-sdk-v5
vi.mock('@internal/ai-sdk-v5', () => ({
  embedMany: vi.fn().mockResolvedValue({
    embeddings: [[0.1, 0.2]],
    usage: { tokens: 55 },
  }),
}));

// v1 spec uses @internal/ai-sdk-v4
vi.mock('@internal/ai-sdk-v4', () => ({
  embedMany: vi.fn().mockResolvedValue({
    embeddings: [[0.1, 0.2]],
    usage: { tokens: 33 },
  }),
}));

// Helper to create a Memory instance with specific embedder version
function createMemoryWithEmbedder(specVersion: 'v1' | 'v2' | 'v3') {
  return new Memory({
    storage: new InMemoryStore(),
    vector: {
      upsert: vi.fn().mockResolvedValue('id'),
      createIndex: vi.fn().mockResolvedValue({ indexName: 'test-index' }),
      query: vi.fn().mockResolvedValue([]),
      describeIndex: vi.fn(),
    } as any,
    embedder: {
      specificationVersion: specVersion,
      provider: 'test',
      modelId: 'test-model',
      doEmbed: vi.fn(),
    } as any,
    options: {
      semanticRecall: true,
    },
  });
}

const testMessages: MastraDBMessage[] = [
  {
    id: 'msg-1',
    threadId: 'thread-1',
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'Hello usage' }] },
    createdAt: new Date(),
  },
];

describe('Memory Token Usage', () => {
  describe('saveMessages usage tracking', () => {
    it('should track usage with v3 spec embedder (ai-v6)', async () => {
      const memory = createMemoryWithEmbedder('v3');
      const result = await memory.saveMessages({
        messages: testMessages,
        memoryConfig: { semanticRecall: true },
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.tokens).toBe(42);
    });

    it('should track usage with v2 spec embedder (ai-sdk-v5)', async () => {
      const memory = createMemoryWithEmbedder('v2');
      const result = await memory.saveMessages({
        messages: testMessages,
        memoryConfig: { semanticRecall: true },
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.tokens).toBe(55);
    });

    it('should track usage with v1 spec embedder (ai-sdk-v4)', async () => {
      const memory = createMemoryWithEmbedder('v1');
      const result = await memory.saveMessages({
        messages: testMessages,
        memoryConfig: { semanticRecall: true },
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.tokens).toBe(33);
    });
  });

  describe('recall usage tracking', () => {
    it('should track usage from recall with v3 spec', async () => {
      const memory = createMemoryWithEmbedder('v3');
      const result = await memory.recall({
        threadId: 'thread-1',
        vectorSearchString: 'search query',
        threadConfig: {
          semanticRecall: {
            scope: 'thread',
            topK: 10,
            messageRange: 2,
          },
        },
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.tokens).toBe(42);
    });

    it('should track usage from recall with v2 spec', async () => {
      const memory = createMemoryWithEmbedder('v2');
      const result = await memory.recall({
        threadId: 'thread-1',
        vectorSearchString: 'search query',
        threadConfig: {
          semanticRecall: {
            scope: 'thread',
            topK: 10,
            messageRange: 2,
          },
        },
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.tokens).toBe(55);
    });

    it('should track usage from recall with v1 spec', async () => {
      const memory = createMemoryWithEmbedder('v1');
      const result = await memory.recall({
        threadId: 'thread-1',
        vectorSearchString: 'search query',
        threadConfig: {
          semanticRecall: {
            scope: 'thread',
            topK: 10,
            messageRange: 2,
          },
        },
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.tokens).toBe(33);
    });
  });

  describe('edge cases', () => {
    it('should return undefined usage when semanticRecall is disabled', async () => {
      const memory = createMemoryWithEmbedder('v3');
      const result = await memory.saveMessages({
        messages: testMessages,
        memoryConfig: { semanticRecall: false },
      });

      expect(result.usage).toBeUndefined();
    });
  });
});
