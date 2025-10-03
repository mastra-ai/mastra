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

describe('WorkingMemoryProcessor - Comprehensive Tests', () => {
  let mockStorage: MockStorage;
  let processor: WorkingMemoryProcessor;

  beforeEach(() => {
    mockStorage = new MockStorage();
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
          },
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
          },
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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

  describe('Assistant Response Processing', () => {
    it('should extract information from assistant responses', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.85,
        extracted_info: "User confirmed they're a developer who uses TypeScript",
      });

      const messages: MastraMessageV2[] = [
        {
          role: 'user',
          content: {
            content: 'I work as a developer',
            parts: [{ type: 'text', text: 'I work as a developer' }],
          },
        },
        {
          role: 'assistant',
          content: {
            content:
              'Great! As a developer, I understand you probably work with TypeScript given our earlier conversation.',
            parts: [
              {
                type: 'text',
                text: 'Great! As a developer, I understand you probably work with TypeScript given our earlier conversation.',
              },
            ],
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

      const thread = await mockStorage.stores.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('developer');
      expect(thread?.metadata?.workingMemory).toContain('TypeScript');
    });

    it('should include user context when processing assistant responses', async () => {
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
            content: 'Can you help me with Python?',
            parts: [{ type: 'text', text: 'Can you help me with Python?' }],
          },
        },
        {
          role: 'assistant',
          content: {
            content: 'Of course! I can help you with Python programming.',
            parts: [{ type: 'text', text: 'Of course! I can help you with Python programming.' }],
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

      // Verify the extraction agent received both user and assistant context
      expect(extractSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationContext: expect.stringContaining('[USER]: Can you help me with Python?'),
        }),
      );

      expect(extractSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationContext: expect.stringContaining(
            '[ASSISTANT]: Of course! I can help you with Python programming.',
          ),
        }),
      );
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
            },
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
            },
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
            },
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
            },
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
            },
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
          },
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
            },
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
            },
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
          },
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
