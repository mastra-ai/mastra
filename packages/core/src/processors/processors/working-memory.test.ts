import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { MastraStorage } from '../../storage/base';
import { WorkingMemoryProcessor } from './working-memory';

// Mock Storage implementation
class MockStorage implements MastraStorage {
  private threads: Map<string, any> = new Map();
  private resources: Map<string, any> = new Map();

  stores = {
    memory: {
      getThreadById: async ({ threadId }: { threadId: string }) => {
        return this.threads.get(threadId) || null;
      },
      updateThread: async ({ id, title, metadata }: { id: string; title: string; metadata?: any }) => {
        const existing = this.threads.get(id) || {};
        this.threads.set(id, { ...existing, id, title, metadata });
      },
      getResourceById: async ({ resourceId }: { resourceId: string }) => {
        return this.resources.get(resourceId) || null;
      },
      updateResource: async ({ resourceId, workingMemory }: { resourceId: string; workingMemory: string }) => {
        const existing = this.resources.get(resourceId) || {};
        this.resources.set(resourceId, { ...existing, resourceId, workingMemory });
      },
    },
  } as any;

  setThreadWorkingMemory(threadId: string, workingMemory: string) {
    const existing = this.threads.get(threadId) || { id: threadId, title: 'Test Thread' };
    this.threads.set(threadId, { ...existing, metadata: { workingMemory } });
  }

  setResourceWorkingMemory(resourceId: string, workingMemory: string) {
    this.resources.set(resourceId, { resourceId, workingMemory });
  }
}

// Mock model
const mockModel: MastraLanguageModel = {
  modelId: 'mock-model',
  specificationVersion: 'v2',
} as MastraLanguageModel;

describe('WorkingMemoryProcessor', () => {
  let mockStorage: MockStorage;
  let processor: WorkingMemoryProcessor;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  describe('Input Processing (Context Injection)', () => {
    it('should inject working memory as system message by default', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# User Info\n- Name: Alice\n- Likes: TypeScript');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
      });

      // Mock the context selection agent to return high relevance
      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'What do I like?',
            parts: [{ type: 'text', text: 'What do I like?' }],
          },
        },
      ];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should have added a system message at the beginning
      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect((result[0].content as any).content).toContain('User Info');
      expect((result[0].content as any).content).toContain('Alice');
      expect(result[1]).toEqual(inputMessages[0]);
    });

    it('should inject as user-prefix when configured', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# Context\n- Previous topic: AI');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        injectionStrategy: 'user-prefix',
      });

      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Tell me more',
            parts: [{ type: 'text', text: 'Tell me more' }],
          },
        },
      ];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should have modified the user message
      expect(result.length).toBe(1);
      expect(result[0].role).toBe('user');
      expect((result[0].content as any).content).toContain('Context from working memory');
      expect((result[0].content as any).content).toContain('Tell me more');
    });

    it('should not inject if working memory is empty', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Hello',
            parts: [{ type: 'text', text: 'Hello' }],
          },
        },
      ];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should return messages unchanged
      expect(result).toEqual(inputMessages);
    });

    it('should not inject if relevance score is below threshold', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# User Info\n- Name: Alice');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        injectionThreshold: 0.5,
      });

      // Mock low relevance score
      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 0.2 });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'What is 2+2?',
            parts: [{ type: 'text', text: 'What is 2+2?' }],
          },
        },
      ];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should return messages unchanged
      expect(result).toEqual(inputMessages);
    });

    it('should inject as context when strategy is "context"', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# Project Context\n- Framework: Mastra');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        injectionStrategy: 'context',
      });

      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'What framework are we using?',
            parts: [{ type: 'text', text: 'What framework are we using?' }],
          },
        },
      ];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should have added a context message
      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect((result[0].content as any).content).toContain('Context');
      expect((result[0].content as any).content).toContain('Mastra');
      expect(result[1]).toEqual(inputMessages[0]);
    });

    it('should work with resource-scoped memory', async () => {
      mockStorage.setResourceWorkingMemory('resource-1', '# Resource Info\n- Type: Document');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'resource',
      });

      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'What type is this resource?',
            parts: [{ type: 'text', text: 'What type is this resource?' }],
          },
        },
      ];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        resourceId: 'resource-1',
      });

      // Should have injected resource working memory
      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect((result[0].content as any).content).toContain('Resource Info');
    });
  });

  describe('Output Processing (Information Extraction)', () => {
    it('should extract and update working memory from assistant response', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
      });

      // Mock the extraction agent
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractNewInfo');
      extractNewInfoSpy.mockResolvedValue({
        extracted_info: "User's name is Bob, prefers dark mode",
      });

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'My name is Bob and I prefer dark mode',
            parts: [{ type: 'text', text: 'My name is Bob and I prefer dark mode' }],
          },
        },
        {
          role: 'assistant',
          content: {
            content: 'Nice to meet you Bob! I will remember that you prefer dark mode.',
            parts: [{ type: 'text', text: 'Nice to meet you Bob! I will remember that you prefer dark mode.' }],
          },
        },
      ];

      const result = await processor.processOutputResult!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should return messages unchanged
      expect(result).toEqual(messages);

      // Check that working memory was updated
      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('Bob');
      expect(thread?.metadata?.workingMemory).toContain('dark mode');
    });

    it('should merge new information with existing working memory', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# User Info\n- Name: Alice');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
      });

      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractNewInfo');
      extractNewInfoSpy.mockResolvedValue({
        extracted_info: 'User likes TypeScript',
      });

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'I really like TypeScript',
            parts: [{ type: 'text', text: 'I really like TypeScript' }],
          },
        },
        {
          role: 'assistant',
          content: {
            content: "That's great! TypeScript is a powerful language.",
            parts: [{ type: 'text', text: "That's great! TypeScript is a powerful language." }],
          },
        },
      ];

      await processor.processOutputResult!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Check that working memory was merged
      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('Alice');
      expect(thread?.metadata?.workingMemory).toContain('TypeScript');
    });

    it('should not update if no new information extracted', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# User Info\n- Name: Alice');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
      });

      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractNewInfo');
      extractNewInfoSpy.mockResolvedValue({
        extracted_info: '',
      });

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'What is the weather?',
            parts: [{ type: 'text', text: 'What is the weather?' }],
          },
        },
        {
          role: 'assistant',
          content: {
            content: 'I don't have access to weather data.',
            parts: [{ type: 'text', text: 'I don't have access to weather data.' }],
          },
        },
      ];

      const originalMemory = (await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' }))?.metadata
        ?.workingMemory;

      await processor.processOutputResult!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Working memory should remain unchanged
      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toEqual(originalMemory);
    });

    it('should work with resource-scoped memory for output', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'resource',
      });

      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractNewInfo');
      extractNewInfoSpy.mockResolvedValue({
        extracted_info: 'Document contains TypeScript code',
      });

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'This document contains TypeScript code',
            parts: [{ type: 'text', text: 'This document contains TypeScript code' }],
          },
        },
        {
          role: 'assistant',
          content: {
            content: 'I see, this is a TypeScript document.',
            parts: [{ type: 'text', text: 'I see, this is a TypeScript document.' }],
          },
        },
      ];

      await processor.processOutputResult!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        resourceId: 'resource-1',
      });

      // Check resource working memory
      const resource = await mockStorage.stores.memory.getResourceById({ resourceId: 'resource-1' });
      expect(resource?.workingMemory).toContain('TypeScript code');
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom template', async () => {
      const customTemplate = {
        format: 'json' as const,
        template: '{"user": {}}',
      };

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        template: customTemplate,
      });

      expect((processor as any).template).toEqual(customTemplate);
    });

    it('should respect custom injection threshold', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        injectionThreshold: 0.8,
      });

      expect((processor as any).injectionThreshold).toBe(0.8);
    });

    it('should respect custom extraction threshold', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        extractionThreshold: 0.6,
      });

      expect((processor as any).extractionThreshold).toBe(0.6);
    });
  });

  describe('Error Handling', () => {
    it('should throw error if storage does not have memory stores', async () => {
      const badStorage = {
        stores: {},
      } as any;

      processor = new WorkingMemoryProcessor({
        storage: badStorage,
        model: mockModel,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Hello',
            parts: [{ type: 'text', text: 'Hello' }],
          },
        },
      ];

      await expect(
        processor.processInput!({
          messages: inputMessages,
          abort: () => {
            throw new Error('abort');
          },
          threadId: 'thread-1',
        }),
      ).rejects.toThrow('Memory storage not available');
    });

    it('should handle missing threadId and resourceId gracefully', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Hello',
            parts: [{ type: 'text', text: 'Hello' }],
          },
        },
      ];

      // Should not throw, just return messages unchanged
      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
      });

      expect(result).toEqual(inputMessages);
    });
  });
});
