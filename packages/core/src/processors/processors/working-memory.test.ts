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
        if (!this.threads.has(threadId)) {
          // Auto-create thread if it doesn't exist
          this.threads.set(threadId, { id: threadId, title: 'Test Thread', metadata: {} });
        }
        return this.threads.get(threadId) || null;
      },
      updateThread: async ({ id, title, metadata }: { id: string; title: string; metadata?: any }) => {
        const existing = this.threads.get(id) || { id, title: title || 'Test Thread' };
        this.threads.set(id, { ...existing, id, title, metadata });
        return this.threads.get(id);
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

  describe('Input Processing (Extract and Inject)', () => {
    it('should extract info from user message and inject existing memory', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# User Info\n- Name: Alice\n- Likes: TypeScript');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      // Mock the extraction agent to capture new info from user
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: 'User wants to know their preferences',
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

      // Should have extracted info from user message
      expect(extractNewInfoSpy).toHaveBeenCalled();

      // Should have added a system message with existing memory
      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect((result[0].content as any).content).toContain('User Info');
      expect((result[0].content as any).content).toContain('Alice');
      expect(result[1]).toEqual(inputMessages[0]);
    });

    it('should extract and store new user information immediately', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      // Mock the extraction agent to capture name from user
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: "User's name is Daniel",
      });

      const inputMessages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'My name is Daniel',
            parts: [{ type: 'text', text: 'My name is Daniel' }],
          },
        },
      ];

      await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Check that working memory was updated with user's name
      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('Daniel');
    });

    it('should inject as user-prefix when configured', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# Context\n- Previous topic: AI');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        injectionStrategy: 'user-prefix',
      });

      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      // Mock extraction to not interfere
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({ has_memorable_info: false });

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
        scope: 'thread',
      });

      // Mock extraction to not find anything
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({ has_memorable_info: false });

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
        scope: 'thread',
        injectionThreshold: 0.5,
      });

      // Mock low relevance score
      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 0.2 });

      // Mock extraction to not interfere
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({ has_memorable_info: false });

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

    it('should work with resource-scoped memory', async () => {
      mockStorage.setResourceWorkingMemory('resource-1', '# Resource Info\n- Type: Document');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'resource',
      });

      const selectRelevantContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectRelevantContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      // Mock extraction to not interfere
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({ has_memorable_info: false });

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

  describe('Output Processing (Information Extraction from Assistant)', () => {
    it('should extract and update working memory from assistant response', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      // Mock the extraction agent to capture info from assistant
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({
        has_memorable_info: true,
        confidence: 0.8,
        extracted_info: "User's name is Bob and they prefer dark mode",
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
        scope: 'thread',
      });

      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({
        has_memorable_info: true,
        confidence: 0.8,
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
        scope: 'thread',
      });

      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({
        has_memorable_info: false,
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
            content: "I don't have access to weather data.",
            parts: [{ type: 'text', text: "I don't have access to weather data." }],
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

    it('should skip if no assistant messages', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Hello',
            parts: [{ type: 'text', text: 'Hello' }],
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

      // Should return messages unchanged without processing
      expect(result).toEqual(messages);
    });

    it('should work with resource-scoped memory for output', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'resource',
      });

      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({
        has_memorable_info: true,
        confidence: 0.8,
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

    it('should respect custom confidence threshold', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        confidenceThreshold: 0.6,
      });

      expect((processor as any).confidenceThreshold).toBe(0.6);
    });

    it('should default to resource scope', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
      });

      expect((processor as any).scope).toBe('resource');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage without memory stores gracefully', async () => {
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

      // Should return messages unchanged when storage is unavailable
      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      expect(result).toEqual(inputMessages);
    });

    it('should handle missing threadId and resourceId gracefully', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      // Mock extraction to not find anything
      const extractNewInfoSpy = vi.spyOn(processor as any, 'extractInformation');
      extractNewInfoSpy.mockResolvedValue({ has_memorable_info: false });

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

  describe('Multi-turn Conversation Flow', () => {
    it('should capture user name from first message and use it in subsequent turns', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      // Mock extraction for first message
      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: "User's name is Tyler",
      });

      // First turn: user introduces themselves
      const firstInput: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Hi, my name is Tyler',
            parts: [{ type: 'text', text: 'Hi, my name is Tyler' }],
            format: 2,
          },
          id: 'msg-1',
          createdAt: new Date(),
        },
      ];

      await processor.processInput!({
        messages: firstInput,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Verify name was captured
      const thread1 = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread1?.metadata?.workingMemory).toContain('Tyler');

      // Second turn: ask something that needs context
      const selectContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectContextSpy.mockResolvedValue({ relevance_score: 0.9 });

      // Don't extract from this message
      extractSpy.mockResolvedValueOnce({ has_memorable_info: false });

      const secondInput: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'What is my name?',
            parts: [{ type: 'text', text: 'What is my name?' }],
            format: 2,
          },
          id: 'msg-2',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput!({
        messages: secondInput,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should inject the context with Tyler's name
      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect((result[0].content as any).content).toContain('Tyler');
    });

    it('should update location and preferences across multiple turns', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        template: {
          format: 'markdown',
          content: `# User Information
- Name:
- Location:
- Preferences:`,
        },
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');

      // Turn 1: Name
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: '- Name: Tyler',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'My name is Tyler',
              parts: [{ type: 'text', text: 'My name is Tyler' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Turn 2: Location
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: '- Location: San Francisco',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'I live in San Francisco',
              parts: [{ type: 'text', text: 'I live in San Francisco' }],
              format: 2,
            },
            id: 'msg-2',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Turn 3: Preferences
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: '- Preferences: TypeScript, dark mode',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'I love TypeScript and prefer dark mode',
              parts: [{ type: 'text', text: 'I love TypeScript and prefer dark mode' }],
              format: 2,
            },
            id: 'msg-3',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Verify all information accumulated
      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      const memory = thread?.metadata?.workingMemory;

      expect(memory).toContain('Tyler');
      expect(memory).toContain('San Francisco');
      expect(memory).toContain('TypeScript');
      expect(memory).toContain('dark mode');
    });

    it('should handle name changes and updates', async () => {
      // Initialize with existing memory
      mockStorage.setThreadWorkingMemory('thread-1', '# User Info\n- Name: Tyler\n- Location: San Francisco');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');

      // User changes their name
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.95,
        extracted_info: '- Name: Jim (previously Tyler)',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'Actually, I changed my name to Jim',
              parts: [{ type: 'text', text: 'Actually, I changed my name to Jim' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      const memory = thread?.metadata?.workingMemory;

      expect(memory).toContain('Jim');
      expect(memory).toContain('San Francisco'); // Location should remain
    });
  });

  describe('Duplicate Detection', () => {
    it('should not add duplicate information', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# User Info\n- Name: Tyler');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');

      // Try to add the same information
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: '- Name: Tyler',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'My name is Tyler',
              parts: [{ type: 'text', text: 'My name is Tyler' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      const memory = thread?.metadata?.workingMemory || '';

      // Should only have one occurrence of Tyler
      const tylerOccurrences = (memory.match(/Tyler/g) || []).length;
      expect(tylerOccurrences).toBe(1);
    });

    it('should not add template as content', async () => {
      const template = {
        format: 'markdown' as const,
        content: '# User Information\n- Name:\n- Location:',
      };

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        template,
      });

      // Try to add the template itself as information through the extraction flow
      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: '# User Information\n- Name:\n- Location:',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'Setting up template',
              parts: [{ type: 'text', text: 'Setting up template' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should not save the template as working memory (duplicate detection)
      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toBeUndefined();
    });
  });

  describe('Resource vs Thread Scope', () => {
    it('should maintain separate memory for different resources', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'resource',
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');

      // Resource 1
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: 'Document type: Technical specification',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'This is a technical specification',
              parts: [{ type: 'text', text: 'This is a technical specification' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        resourceId: 'resource-1',
      });

      // Resource 2
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: 'Document type: User manual',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'This is a user manual',
              parts: [{ type: 'text', text: 'This is a user manual' }],
              format: 2,
            },
            id: 'msg-2',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        resourceId: 'resource-2',
      });

      // Verify separate memories
      const resource1 = await mockStorage.stores.memory.getResourceById({ resourceId: 'resource-1' });
      const resource2 = await mockStorage.stores.memory.getResourceById({ resourceId: 'resource-2' });

      expect(resource1?.workingMemory).toContain('Technical specification');
      expect(resource1?.workingMemory).not.toContain('User manual');

      expect(resource2?.workingMemory).toContain('User manual');
      expect(resource2?.workingMemory).not.toContain('Technical specification');
    });

    it('should maintain separate memory for different threads', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');

      // Thread 1
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: 'User: Alice',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'My name is Alice',
              parts: [{ type: 'text', text: 'My name is Alice' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Thread 2
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: 'User: Bob',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'My name is Bob',
              parts: [{ type: 'text', text: 'My name is Bob' }],
              format: 2,
            },
            id: 'msg-2',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-2',
      });

      // Verify separate memories
      const thread1 = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      const thread2 = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-2' });

      expect(thread1?.metadata?.workingMemory).toContain('Alice');
      expect(thread1?.metadata?.workingMemory).not.toContain('Bob');

      expect(thread2?.metadata?.workingMemory).toContain('Bob');
      expect(thread2?.metadata?.workingMemory).not.toContain('Alice');
    });
  });

  describe('Template Formats', () => {
    it('should work with JSON template format', async () => {
      const jsonTemplate = {
        format: 'json' as const,
        content: JSON.stringify(
          {
            user: {
              name: '',
              location: '',
              preferences: [],
            },
          },
          null,
          2,
        ),
      };

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        template: jsonTemplate,
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: JSON.stringify(
          {
            user: {
              name: 'Tyler',
              location: 'San Francisco',
              preferences: ['TypeScript', 'dark mode'],
            },
          },
          null,
          2,
        ),
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'I am Tyler from San Francisco, I like TypeScript and dark mode',
              parts: [{ type: 'text', text: 'I am Tyler from San Francisco, I like TypeScript and dark mode' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      const memory = thread?.metadata?.workingMemory;

      // Should have saved the JSON working memory
      expect(memory).toBeDefined();
      expect(() => JSON.parse(memory)).not.toThrow();
      const parsed = JSON.parse(memory);
      expect(parsed.user.name).toBe('Tyler');
      expect(parsed.user.location).toBe('San Francisco');
      expect(parsed.user.preferences).toContain('TypeScript');
    });
  });

  describe('Context Injection Strategies', () => {
    it('should inject as context when strategy is "context"', async () => {
      mockStorage.setThreadWorkingMemory('thread-1', '# Context\n- User: Tyler\n- Project: Mastra');

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        injectionStrategy: 'context',
      });

      const selectContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValue({ has_memorable_info: false });

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Tell me about the project',
            parts: [{ type: 'text', text: 'Tell me about the project' }],
            format: 2,
          },
          id: 'msg-1',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Context should be injected as user context message before the actual user message
      expect(result.length).toBe(2);
      expect(result[0].role).toBe('user');
      expect((result[0].content as any).content).toContain('[Context]');
      expect((result[0].content as any).content).toContain('[WORKING_MEMORY_INJECTED]');
      expect((result[0].content as any).content).toContain('Mastra');
      expect(result[1].role).toBe('user');
      expect((result[1].content as any).content).toContain('Tell me about the project');
    });
  });

  describe('Extraction Strategies', () => {
    it('should use aggressive extraction with low threshold', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        extractionStrategy: 'aggressive',
      });

      // Aggressive should have threshold of 0.3
      expect((processor as any).confidenceThreshold).toBe(0.3);

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.35, // Low confidence but above aggressive threshold
        extracted_info: 'Possibly mentioned coffee preference',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'Coffee sounds good',
              parts: [{ type: 'text', text: 'Coffee sounds good' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('coffee');
    });

    it('should use conservative extraction with high threshold', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        extractionStrategy: 'conservative',
      });

      // Conservative should have threshold of 0.7
      expect((processor as any).confidenceThreshold).toBe(0.7);

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.6, // Below conservative threshold
        extracted_info: 'Maybe likes coffee',
      });

      await processor.processInput!({
        messages: [
          {
            role: 'user',
            content: {
              content: 'Coffee sounds good',
              parts: [{ type: 'text', text: 'Coffee sounds good' }],
              format: 2,
            },
            id: 'msg-1',
            createdAt: new Date(),
          },
        ],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      // Should not be saved due to low confidence
      expect(thread?.metadata?.workingMemory).toBeUndefined();
    });
  });

  describe('Feedback Loop Prevention', () => {
    it('should not re-process messages with injection marker', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'Some text with [WORKING_MEMORY_INJECTED] marker',
            parts: [{ type: 'text', text: 'Some text with [WORKING_MEMORY_INJECTED] marker' }],
            format: 2,
          },
          id: 'msg-1',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should not try to extract or inject
      expect(extractSpy).not.toHaveBeenCalled();
      expect(result).toEqual(messages);
    });
  });
});
