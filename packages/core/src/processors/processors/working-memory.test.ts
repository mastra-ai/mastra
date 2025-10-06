import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import { WorkingMemoryProcessor } from './working-memory';
import { InMemoryStore } from '../../storage/mock';

// Mock model
const mockModel: MastraLanguageModel = {
  modelId: 'mock-model',
  specificationVersion: 'v2',
} as MastraLanguageModel;

// Helper to create properly typed messages
function createMessage(role: 'user' | 'assistant' | 'system', content: string, id?: string): MastraMessageV2 {
  return {
    role,
    content: {
      content,
      parts: [{ type: 'text', text: content }],
      format: 2,
    },
    id: id || `msg-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date(),
  };
}

describe('WorkingMemoryProcessor', () => {
  let mockStorage: InMemoryStore;
  let processor: WorkingMemoryProcessor;

  beforeEach(() => {
    mockStorage = new InMemoryStore();
  });

  describe('Input Processing (Extract and Inject)', () => {
    it('should extract info from user message and inject existing memory', async () => {
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# User Info\n- Name: Alice\n- Likes: TypeScript' },
        },
      });

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'What do I like?', 'msg-1')];

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'My name is Daniel', 'msg-1')];

      await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Check that working memory was updated with user's name
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('Daniel');
    });

    it('should inject as user-prefix when configured', async () => {
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# Context\n- Previous topic: AI' },
        },
      });

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'Tell me more', 'msg-1')];

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'Hello', 'msg-1')];

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
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# User Info\n- Name: Alice' },
        },
      });

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'What is 2+2?', 'msg-1')];

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
      await mockStorage.saveResource({
        resource: {
          id: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          workingMemory: '# Resource Info\n- Type: Document',
        },
      });

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'What type is this resource?', 'msg-1')];

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
        createMessage('user', 'My name is Bob and I prefer dark mode', 'msg-1'),
        createMessage('assistant', 'Nice to meet you Bob! I will remember that you prefer dark mode.', 'msg-2'),
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
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('Bob');
      expect(thread?.metadata?.workingMemory).toContain('dark mode');
    });

    it('should merge new information with existing working memory', async () => {
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# User Info\n- Name: Alice' },
        },
      });

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
        createMessage('user', 'I really like TypeScript', 'msg-1'),
        createMessage('assistant', "That's great! TypeScript is a powerful language.", 'msg-2'),
      ];

      await processor.processOutputResult!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Check that working memory was merged
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('Alice');
      expect(thread?.metadata?.workingMemory).toContain('TypeScript');
    });

    it('should not update if no new information extracted', async () => {
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# User Info\n- Name: Alice' },
        },
      });

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
        createMessage('user', 'What is the weather?', 'msg-1'),
        createMessage('assistant', "I don't have access to weather data.", 'msg-2'),
      ];

      const originalMemory = (await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' }))?.metadata
        ?.workingMemory;

      await processor.processOutputResult!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Working memory should remain unchanged
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toEqual(originalMemory);
    });

    it('should skip if no assistant messages', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
      });

      const messages: MastraMessageV2[] = [createMessage('user', 'Hello', 'msg-1')];

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
        createMessage('user', 'This document contains TypeScript code', 'msg-1'),
        createMessage('assistant', 'I see, this is a TypeScript document.', 'msg-2'),
      ];

      await processor.processOutputResult!({
        messages,
        abort: () => {
          throw new Error('abort');
        },
        resourceId: 'resource-1',
      });

      // Check resource working memory
      const resource = await mockStorage.stores!.memory.getResourceById({ resourceId: 'resource-1' });
      expect(resource?.workingMemory).toContain('TypeScript code');
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom template', async () => {
      const customTemplate = {
        format: 'json' as const,
        content: '{"user": {}}',
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
      const badStorage = new InMemoryStore();
      badStorage.stores = undefined as any;

      processor = new WorkingMemoryProcessor({
        storage: badStorage,
        model: mockModel,
      });

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'Hello', 'msg-1')];

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'Hello', 'msg-1')];

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
      const selectContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: "User's name is Tyler",
      });

      // First turn: user introduces themselves
      const firstInput: MastraMessageV2[] = [createMessage('user', 'Hi, my name is Tyler', 'msg-1')];

      await processor.processInput!({
        messages: firstInput,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Verify name was captured
      const thread1 = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread1?.metadata?.workingMemory).toContain('Tyler');

      // Second turn: ask something that needs context
      selectContextSpy.mockResolvedValue({ relevance_score: 0.9 });

      // Don't extract from this message
      extractSpy.mockResolvedValueOnce({ has_memorable_info: false });

      const secondInput: MastraMessageV2[] = [createMessage('user', 'What is my name?', 'msg-2')];

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
        messages: [createMessage('user', 'My name is Tyler', 'msg-1')],
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
        messages: [createMessage('user', 'I live in San Francisco', 'msg-2')],
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
        messages: [createMessage('user', 'I love TypeScript and prefer dark mode', 'msg-3')],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Verify all information accumulated
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      const memory = thread?.metadata?.workingMemory;

      expect(memory).toContain('Tyler');
      expect(memory).toContain('San Francisco');
      expect(memory).toContain('TypeScript');
      expect(memory).toContain('dark mode');
    });

    it('should handle name changes and updates', async () => {
      // Initialize with existing memory
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# User Info\n- Name: Tyler\n- Location: San Francisco' },
        },
      });

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
        messages: [createMessage('user', 'Actually, I changed my name to Jim', 'msg-1')],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Verify name was updated
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('Jim');
    });
  });

  describe('Extraction Strategies', () => {
    it('should use conservative extraction with high threshold', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        confidenceThreshold: 0.9,
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.7, // Below threshold
        extracted_info: 'Uncertain information',
      });

      await processor.processInput!({
        messages: [createMessage('user', 'Maybe I like pizza', 'msg-1')],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should not store due to low confidence
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory || '').not.toContain('pizza');
    });

    it('should use aggressive extraction with low threshold', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        confidenceThreshold: 0.3,
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.5, // Above low threshold
        extracted_info: 'User might like pizza',
      });

      await processor.processInput!({
        messages: [createMessage('user', 'Maybe I like pizza', 'msg-1')],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      // Should store even with moderate confidence
      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toContain('pizza');
    });
  });

  describe('Context Injection Strategies', () => {
    it('should inject as system message when strategy is "system"', async () => {
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# Context\n- User: Tyler' },
        },
      });

      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        injectionStrategy: 'system',
      });

      const selectContextSpy = vi.spyOn(processor as any, 'selectRelevantContext');
      selectContextSpy.mockResolvedValue({ relevance_score: 1.0 });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValue({ has_memorable_info: false });

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'Who am I?', 'msg-1')];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect((result[0].content as any).content).toContain('Tyler');
    });

    it('should inject as context when strategy is "context"', async () => {
      await mockStorage.saveThread({
        thread: {
          id: 'thread-1',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { workingMemory: '# Context\n- User: Tyler\n- Project: Mastra' },
        },
      });

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

      const inputMessages: MastraMessageV2[] = [createMessage('user', 'Tell me about the project', 'msg-1')];

      const result = await processor.processInput!({
        messages: inputMessages,
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      expect(result.length).toBe(2);
      expect(result[0].role).toBe('system');
      expect((result[0].content as any).content).toContain('Tyler');
      expect((result[0].content as any).content).toContain('Mastra');
    });
  });

  describe('Template Formats', () => {
    it('should work with markdown template', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        template: {
          format: 'markdown',
          content: '# Custom\n- Field:',
        },
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: '- Field: Value',
      });

      await processor.processInput!({
        messages: [createMessage('user', 'Test', 'msg-1')],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      expect(thread?.metadata?.workingMemory).toMatch(/Field.*Value/);
    });

    it('should work with JSON schema template', async () => {
      processor = new WorkingMemoryProcessor({
        storage: mockStorage,
        model: mockModel,
        scope: 'thread',
        template: {
          format: 'json',
          content: '{"name": "", "preferences": []}',
        },
      });

      const extractSpy = vi.spyOn(processor as any, 'extractInformation');
      extractSpy.mockResolvedValueOnce({
        has_memorable_info: true,
        confidence: 0.9,
        extracted_info: '{"name": "Tyler", "preferences": ["TypeScript"]}',
      });

      await processor.processInput!({
        messages: [createMessage('user', 'My name is Tyler and I like TypeScript', 'msg-1')],
        abort: () => {
          throw new Error('abort');
        },
        threadId: 'thread-1',
      });

      const thread = await mockStorage.stores!.memory.getThreadById({ threadId: 'thread-1' });
      const memory = thread?.metadata?.workingMemory;
      expect(memory).toContain('Tyler');
      expect(memory).toContain('TypeScript');
    });
  });
});
