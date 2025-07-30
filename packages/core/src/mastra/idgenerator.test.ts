import { MockLanguageModelV1 } from 'ai/test';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent';
import { MessageList } from '../agent/message-list';
import type { MastraMessageV2 } from '../agent/types';
import { MastraError } from '../error';
import type { StorageThreadType, MemoryConfig, MastraMessageV1 } from '../memory';
import { MastraMemory } from '../memory/memory';
import { RuntimeContext } from '../runtime-context';
import type { StorageGetMessagesArg } from '../storage';
import { Mastra } from './index';

// Mock Memory class for testing
class MockMemory extends MastraMemory {
  threads: Record<string, StorageThreadType> = {};
  messages: Map<string, MastraMessageV1> = new Map();

  constructor() {
    super({ name: 'mock' });
    Object.defineProperty(this, 'storage', {
      get: () => ({
        init: async () => {},
        getThreadById: this.getThreadById.bind(this),
        saveThread: async ({ thread }: { thread: StorageThreadType }) => {
          return this.saveThread({ thread });
        },
        getMessages: this.getMessages.bind(this),
        saveMessages: this.saveMessages.bind(this),
      }),
    });
    this._hasOwnStorage = true;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.threads[threadId] || null;
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    const newThread = { ...thread, updatedAt: new Date() };
    if (!newThread.createdAt) {
      newThread.createdAt = new Date();
    }
    this.threads[thread.id] = newThread;
    return this.threads[thread.id];
  }

  async getMessages({
    threadId,
    resourceId,
    format: _format = 'v1',
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[]> {
    let results = Array.from(this.messages.values());
    if (threadId) results = results.filter(m => m.threadId === threadId);
    if (resourceId) results = results.filter(m => m.resourceId === resourceId);
    return results;
  }

  async saveMessages(args: {
    messages: MastraMessageV1[] | MastraMessageV2[] | (MastraMessageV1 | MastraMessageV2)[];
    memoryConfig?: MemoryConfig | undefined;
    format?: 'v1' | undefined;
  }): Promise<MastraMessageV1[]>;
  async saveMessages(args: {
    messages: MastraMessageV1[] | MastraMessageV2[] | (MastraMessageV1 | MastraMessageV2)[];
    memoryConfig?: MemoryConfig | undefined;
    format: 'v2';
  }): Promise<MastraMessageV2[]>;
  async saveMessages(args: {
    messages: MastraMessageV1[] | MastraMessageV2[] | (MastraMessageV1 | MastraMessageV2)[];
    memoryConfig?: MemoryConfig | undefined;
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const { messages } = args as any;
    for (const msg of messages) {
      const existing = this.messages.get(msg.id);
      if (existing) {
        this.messages.set(msg.id, {
          ...existing,
          ...msg,
          createdAt: existing.createdAt,
        });
      } else {
        this.messages.set(msg.id, msg);
      }
    }
    return messages;
  }

  async rememberMessages() {
    return { messages: [], messagesV2: [] };
  }

  async getThreadsByResourceId() {
    return [];
  }

  async query() {
    return { messages: [], uiMessages: [] };
  }

  async deleteThread(threadId: string) {
    delete this.threads[threadId];
  }

  async getWorkingMemory() {
    return null;
  }

  async getWorkingMemoryTemplate() {
    return null;
  }

  getMergedThreadConfig(config?: MemoryConfig) {
    return config || {};
  }

  async updateWorkingMemory({
    threadId: _threadId,
    resourceId: _resourceId,
    workingMemory: _workingMemory,
    memoryConfig: _memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfig;
  }): Promise<void> {
    // Mock implementation
  }

  async __experimental_updateWorkingMemoryVNext({
    threadId: _threadId,
    resourceId: _resourceId,
    workingMemory: _workingMemory,
    searchString: _searchString,
    memoryConfig: _memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    searchString?: string;
    memoryConfig?: MemoryConfig;
  }): Promise<{ success: boolean; reason: string }> {
    // Mock implementation
    return { success: true, reason: 'Mock implementation' };
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    // Mock implementation - remove messages by ID
    for (const messageId of messageIds) {
      this.messages.delete(messageId);
    }
  }
}

// Helper function to create a Mastra instance with proper memory registration
function createMastraWithMemory(idGenerator?: () => string) {
  // Create a mock memory instance
  const memory = new MockMemory();

  // Create an agent with the registered memory
  const agent = new Agent({
    name: 'testAgent',
    instructions: 'You are a test agent',
    model: new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Test response',
      }),
    }),
    memory,
  });

  const mastra = new Mastra({
    idGenerator,
    logger: false,
    agents: {
      testAgent: agent,
    },
  });

  return { mastra, agent, memory };
}

describe('Mastra ID Generator', () => {
  let customIdGenerator: () => string;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;
    customIdGenerator = vi.fn(() => `custom-id-${++idCounter}`);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic ID Generator Functionality', () => {
    it('should use custom ID generator when provided', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const id1 = mastra.generateId();
      const id2 = mastra.generateId();

      expect(customIdGenerator).toHaveBeenCalledTimes(2);
      expect(id1).toBe('custom-id-1');
      expect(id2).toBe('custom-id-2');
    });

    it('should fallback to crypto.randomUUID when no custom generator is provided', () => {
      const mastra = new Mastra({
        logger: false,
      });

      const id1 = mastra.generateId();
      const id2 = mastra.generateId();

      expect(customIdGenerator).not.toHaveBeenCalled();
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(id1).not.toBe(id2);
    });

    it('should return the custom ID generator function via getIdGenerator', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      expect(mastra.getIdGenerator()).toBe(customIdGenerator);
    });

    it('should return undefined for getIdGenerator when no custom generator is provided', () => {
      const mastra = new Mastra({
        logger: false,
      });

      expect(mastra.getIdGenerator()).toBeUndefined();
    });
  });

  describe('Component Integration', () => {
    it('should use custom ID generator when components are registered with Mastra', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      // Test that the ID generator is available to components
      expect(mastra.getIdGenerator()).toBe(customIdGenerator);

      // Test direct ID generation
      const id = mastra.generateId();
      expect(customIdGenerator).toHaveBeenCalled();
      expect(id).toBe('custom-id-1');
    });

    it('should use fallback ID generator when components are registered without custom generator', () => {
      const mastra = new Mastra({
        logger: false,
      });

      // Test that no custom ID generator is available
      expect(mastra.getIdGenerator()).toBeUndefined();

      // Test direct ID generation
      const id = mastra.generateId();
      expect(customIdGenerator).not.toHaveBeenCalled();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should maintain ID uniqueness across multiple generations', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const ids = new Set<string>();

      // Generate multiple IDs
      for (let i = 0; i < 10; i++) {
        const id = mastra.generateId();
        ids.add(id);
      }

      // All IDs should be unique
      expect(ids.size).toBe(10);
      expect(customIdGenerator).toHaveBeenCalledTimes(10);
    });

    it('should handle ID generator that returns the same value', () => {
      const staticIdGenerator = vi.fn(() => 'static-id');

      const mastra = new Mastra({
        idGenerator: staticIdGenerator,
        logger: false,
      });

      const id1 = mastra.generateId();
      const id2 = mastra.generateId();

      expect(id1).toBe('static-id');
      expect(id2).toBe('static-id');
      expect(staticIdGenerator).toHaveBeenCalledTimes(2);
    });

    it('should handle ID generator that throws an error', () => {
      const errorIdGenerator = vi.fn(() => {
        throw new Error('ID generation failed');
      });

      const mastra = new Mastra({
        idGenerator: errorIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow('ID generation failed');
      expect(errorIdGenerator).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null ID generator gracefully', () => {
      const mastra = new Mastra({
        idGenerator: null as any,
        logger: false,
      });

      const id = mastra.generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should handle undefined ID generator gracefully', () => {
      const mastra = new Mastra({
        idGenerator: undefined as any,
        logger: false,
      });

      const id = mastra.generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should handle ID generator that returns empty string', () => {
      const emptyIdGenerator = vi.fn(() => '');

      const mastra = new Mastra({
        idGenerator: emptyIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow(MastraError);
      expect(() => mastra.generateId()).toThrow('ID generator returned an empty string, which is not allowed');
      expect(emptyIdGenerator).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle rapid successive ID generation calls', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const ids: string[] = [];

      // Generate many IDs rapidly
      for (let i = 0; i < 100; i++) {
        ids.push(mastra.generateId());
      }

      expect(customIdGenerator).toHaveBeenCalledTimes(100);
      expect(ids.length).toBe(100);

      // All IDs should be unique (since our custom generator increments)
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });

    it('should handle concurrent ID generation', async () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const promises = Array.from({ length: 10 }, () => Promise.resolve(mastra.generateId()));

      const ids = await Promise.all(promises);

      expect(customIdGenerator).toHaveBeenCalledTimes(10);
      expect(ids.length).toBe(10);

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('Agent ID Generation', () => {
    it('should use custom ID generator for agent message IDs', async () => {
      const { mastra: _mastra, agent } = createMastraWithMemory(customIdGenerator);

      // Test that the agent uses the custom ID generator for run IDs when not provided
      const _result = await agent.generate('Hello');

      // The agent should have used the custom ID generator for run IDs
      expect(customIdGenerator).toHaveBeenCalled();
    });

    it('should use fallback ID generator for agent message IDs when no custom generator is provided', async () => {
      const { mastra: _mastra, agent } = createMastraWithMemory();

      // Mock the LLM to avoid actual API calls
      vi.spyOn(agent, 'generate').mockResolvedValue({
        text: 'Test response',
        messages: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      } as any);

      await agent.generate('Hello');

      // The agent should not have used the custom ID generator
      expect(customIdGenerator).not.toHaveBeenCalled();
    });
  });

  describe('Memory ID Generation', () => {
    it('should use custom ID generator for memory operations', async () => {
      const { mastra: _mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      // Test memory ID generation through agent
      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');
      const id = agentMemory.generateId();

      expect(customIdGenerator).toHaveBeenCalled();
      expect(id).toMatch(/^custom-id-\d+$/);
    });

    it('should use fallback ID generator for memory operations when no custom generator is provided', async () => {
      const { mastra: _mastra, agent, memory: _memory } = createMastraWithMemory();

      // Test memory ID generation through agent
      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');
      const id = agentMemory.generateId();

      expect(customIdGenerator).not.toHaveBeenCalled();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should use custom ID generator when creating threads and messages', async () => {
      const { mastra: _mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Test memory ID generation directly
      const id = agentMemory.generateId();

      // The memory should have used the custom ID generator
      expect(customIdGenerator).toHaveBeenCalled();
      expect(id).toMatch(/^custom-id-\d+$/);
    });
  });

  describe('Agent with Memory ID Generation', () => {
    it('should use custom ID generator for both agent and memory operations', async () => {
      const { mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Test agent ID generation
      const agentId = mastra.generateId();
      expect(customIdGenerator).toHaveBeenCalled();

      // Test memory ID generation
      const memoryId = agentMemory.generateId();
      expect(customIdGenerator).toHaveBeenCalled();

      // Both should use the same custom ID generator
      expect(agentId).toMatch(/^custom-id-\d+$/);
      expect(memoryId).toMatch(/^custom-id-\d+$/);
    });

    it('should use fallback ID generator for both agent and memory operations when no custom generator is provided', async () => {
      const { mastra, agent, memory: _memory } = createMastraWithMemory();

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Test agent ID generation
      const agentId = mastra.generateId();
      expect(customIdGenerator).not.toHaveBeenCalled();

      // Test memory ID generation
      const memoryId = agentMemory.generateId();
      expect(customIdGenerator).not.toHaveBeenCalled();

      // Both should use the fallback UUID generator
      expect(agentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(memoryId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('Memory Registration Scenarios', () => {
    it('should register memory set dynamically inside an agent using a function', async () => {
      let dynamicFunctionCalled = false;
      let receivedRuntimeContext: RuntimeContext | undefined;
      let receivedMastraInstance: Mastra | undefined;

      const agent = new Agent({
        name: 'testAgent',
        instructions: 'You are a test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Test response',
          }),
        }),
        memory: ({ runtimeContext, mastra: mastraInstance }) => {
          dynamicFunctionCalled = true;
          receivedRuntimeContext = runtimeContext;
          receivedMastraInstance = mastraInstance;

          const dynamicMemory = new MockMemory();
          // Verify that the mastra instance has access to the custom ID generator
          if (mastraInstance) {
            expect(mastraInstance.getIdGenerator()).toBe(customIdGenerator);
          }
          return dynamicMemory;
        },
      });

      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { testAgent: agent },
      });

      // Test that the dynamically created memory is properly registered and uses the custom ID generator
      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Verify the dynamic function was called
      expect(dynamicFunctionCalled).toBe(true);
      expect(receivedRuntimeContext).toBeDefined();
      expect(receivedMastraInstance).toBe(mastra);

      const memoryId = agentMemory.generateId();
      expect(customIdGenerator).toHaveBeenCalled();
      expect(memoryId).toMatch(/^custom-id-\d+$/);
    });

    it('should handle dynamic memory creation with runtime context', async () => {
      let dynamicFunctionCalled = false;
      let receivedRuntimeContext: RuntimeContext | undefined;

      const agent = new Agent({
        name: 'testAgent',
        instructions: 'You are a test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Test response',
          }),
        }),
        memory: ({ runtimeContext, mastra: mastraInstance }) => {
          dynamicFunctionCalled = true;
          receivedRuntimeContext = runtimeContext;

          // Verify runtime context is available and has expected interface
          expect(runtimeContext).toBeDefined();
          expect(typeof runtimeContext.get).toBe('function');
          expect(typeof runtimeContext.set).toBe('function');

          if (mastraInstance) {
            expect(mastraInstance.getIdGenerator()).toBe(customIdGenerator);
          }

          const dynamicMemory = new MockMemory();
          return dynamicMemory;
        },
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { testAgent: agent },
      });

      // Test that the dynamically created memory works correctly
      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Verify the dynamic function was called
      expect(dynamicFunctionCalled).toBe(true);
      expect(receivedRuntimeContext).toBeDefined();

      const memoryId = agentMemory.generateId();
      expect(customIdGenerator).toHaveBeenCalled();
      expect(memoryId).toMatch(/^custom-id-\d+$/);
    });
  });

  describe('MessageList Integration', () => {
    it('should use custom ID generator when creating MessageList with generateMessageId', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });

      // Test that MessageList uses the custom ID generator
      const _message = messageList.add('Test message', 'user');
      expect(customIdGenerator).toHaveBeenCalled();
    });

    it('should fallback to randomUUID when MessageList has no custom ID generator', () => {
      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
      });

      // Test that MessageList uses fallback UUID generator
      const _message = messageList.add('Test message', 'user');
      expect(customIdGenerator).not.toHaveBeenCalled();
    });

    it('should use custom ID generator for user and assistant messages in MessageList', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });

      // Test different message types - only user and assistant messages get IDs
      messageList.add('User message', 'user');
      messageList.add({ role: 'assistant', content: 'Assistant message' }, 'response');
      messageList.addSystem('System message', 'system'); // System messages don't get IDs

      expect(customIdGenerator).toHaveBeenCalledTimes(2); // Only user and assistant messages
    });
  });

  describe('Agent Primitive Integration', () => {
    it('should pass custom ID generator to MessageList in agent primitive when experimental_generateMessageId is provided', async () => {
      const { mastra: _mastra, agent } = createMastraWithMemory(customIdGenerator);

      // Mock the agent's primitive method to test ID generator usage
      const primitiveSpy = vi.spyOn(agent as any, '__primitive');

      // Trigger a generation with experimental_generateMessageId
      await agent.generate('Hello', {
        experimental_generateMessageId: customIdGenerator,
      });

      expect(primitiveSpy).toHaveBeenCalled();
      const callArgs = primitiveSpy.mock.calls[0][0] as any;
      expect(callArgs.generateMessageId).toBeDefined();

      // Verify the ID generator is passed correctly
      expect(callArgs.generateMessageId).toBe(customIdGenerator);
    });

    it('should use fallback ID generator in agent primitive when no custom generator is provided', async () => {
      const { mastra: _mastra, agent } = createMastraWithMemory();

      const primitiveSpy = vi.spyOn(agent as any, '__primitive');

      await agent.generate('Hello');

      expect(primitiveSpy).toHaveBeenCalled();
      const callArgs = primitiveSpy.mock.calls[0][0] as any;
      expect(callArgs.generateMessageId).toBeUndefined();
    });
  });

  describe('Memory Operations with Custom ID Generator', () => {
    it('should use custom ID generator when creating threads', async () => {
      const { mastra: _mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Mock the createThread method to actually use the ID generator
      const _createThreadSpy = vi.spyOn(agentMemory, 'createThread').mockImplementation(async args => {
        const threadId = agentMemory.generateId();
        return {
          id: threadId,
          title: args.title || 'Test Thread',
          resourceId: args.resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      const thread = await agentMemory.createThread({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        title: 'Test Thread',
      });

      expect(customIdGenerator).toHaveBeenCalled();
      expect(thread.id).toMatch(/^custom-id-\d+$/);
    });

    it('should use custom ID generator when saving messages', async () => {
      const { mastra: _mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      const message = await agentMemory.addMessage({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        content: 'Test message',
        role: 'user',
        type: 'text',
      });

      expect(customIdGenerator).toHaveBeenCalled();
      expect(message.id).toMatch(/^custom-id-\d+$/);
    });

    it('should use custom ID generator when saving multiple messages', async () => {
      const { mastra: _mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Mock the saveMessages method to actually use the ID generator
      const _saveMessagesSpy = vi.spyOn(agentMemory, 'saveMessages').mockImplementation(async args => {
        const messages = args.messages.map((msg: any) => ({
          ...msg,
          id: agentMemory.generateId(),
        }));
        return messages;
      });

      const messages = await agentMemory.saveMessages({
        messages: [
          {
            id: 'temp-id-1',
            content: 'Message 1',
            role: 'user',
            createdAt: new Date(),
            threadId: 'test-thread',
            resourceId: 'test-resource',
            type: 'text',
          },
          {
            id: 'temp-id-2',
            content: 'Message 2',
            role: 'assistant',
            createdAt: new Date(),
            threadId: 'test-thread',
            resourceId: 'test-resource',
            type: 'text',
          },
        ],
      });

      expect(customIdGenerator).toHaveBeenCalled();
      expect(messages).toHaveLength(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle ID generator that returns null', () => {
      const nullIdGenerator = vi.fn(() => null as any);

      const mastra = new Mastra({
        idGenerator: nullIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow(MastraError);
      expect(() => mastra.generateId()).toThrow('ID generator returned an empty string, which is not allowed');
    });

    it('should handle ID generator that returns undefined', () => {
      const undefinedIdGenerator = vi.fn(() => undefined as any);

      const mastra = new Mastra({
        idGenerator: undefinedIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow(MastraError);
      expect(() => mastra.generateId()).toThrow('ID generator returned an empty string, which is not allowed');
    });

    it('should handle ID generator that throws an error during generation', () => {
      const errorIdGenerator = vi.fn(() => {
        throw new Error('ID generation failed');
      });

      const mastra = new Mastra({
        idGenerator: errorIdGenerator,
        logger: false,
      });

      expect(() => mastra.generateId()).toThrow('ID generation failed');
    });

    it('should handle memory operations when ID generator throws an error', async () => {
      const errorIdGenerator = vi.fn(() => {
        throw new Error('Memory ID generation failed');
      });

      const { mastra: _mastra, agent, memory: _memory } = createMastraWithMemory(errorIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      expect(() => agentMemory.generateId()).toThrow('Memory ID generation failed');
    });

    it('should handle MessageList operations when ID generator throws an error', () => {
      const errorIdGenerator = vi.fn(() => {
        throw new Error('MessageList ID generation failed');
      });

      const mastra = new Mastra({
        idGenerator: errorIdGenerator,
        logger: false,
      });

      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });

      expect(() => messageList.add('Test message', 'user')).toThrow('MessageList ID generation failed');
    });
  });

  describe('ID Generator Consistency Across Components', () => {
    it('should use the same ID generator across all components', async () => {
      const { mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Test Mastra level
      const mastraId = mastra.generateId();
      expect(customIdGenerator).toHaveBeenCalled();

      // Test Memory level
      const memoryId = agentMemory.generateId();
      expect(customIdGenerator).toHaveBeenCalled();

      // Test MessageList level
      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });
      messageList.add('Test message', 'user');
      expect(customIdGenerator).toHaveBeenCalled();

      // All should use the same generator
      expect(mastraId).toMatch(/^custom-id-\d+$/);
      expect(memoryId).toMatch(/^custom-id-\d+$/);
    });

    it('should maintain ID uniqueness across different component types', async () => {
      const { mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      const ids = new Set<string>();

      // Generate IDs from different components
      ids.add(mastra.generateId());
      ids.add(agentMemory.generateId());

      const messageList = new MessageList({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        generateMessageId: mastra.generateId.bind(mastra),
      });
      messageList.add('Test message', 'user');

      // All IDs should be unique
      expect(ids.size).toBe(2);
      expect(customIdGenerator).toHaveBeenCalledTimes(3);
    });
  });

  describe('Runtime Context Integration', () => {
    it('should pass runtime context to dynamic memory creation', async () => {
      let receivedRuntimeContext: RuntimeContext | undefined;

      const agent = new Agent({
        name: 'testAgent',
        instructions: 'You are a test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: 'Test response',
          }),
        }),
        memory: ({ runtimeContext, mastra: _mastraInstance }) => {
          receivedRuntimeContext = runtimeContext;

          // Test that runtime context can be used
          runtimeContext.set('test-key', 'test-value');
          expect(runtimeContext.get('test-key')).toBe('test-value');

          const dynamicMemory = new MockMemory();
          return dynamicMemory;
        },
      });

      const _mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
        agents: { testAgent: agent },
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('user-id', 'user-123');

      const agentMemory = await agent.getMemory({ runtimeContext });
      if (!agentMemory) throw new Error('Memory not found');

      expect(receivedRuntimeContext).toBe(runtimeContext);
      expect(receivedRuntimeContext?.get('user-id')).toBe('user-123');
    });
  });

  describe('ID Generator Lifecycle', () => {
    it('should allow changing ID generator after Mastra creation', () => {
      const mastra = new Mastra({
        idGenerator: customIdGenerator,
        logger: false,
      });

      expect(mastra.getIdGenerator()).toBe(customIdGenerator);

      const newIdGenerator = vi.fn(() => `new-id-${++idCounter}`);
      mastra.setIdGenerator(newIdGenerator);

      expect(mastra.getIdGenerator()).toBe(newIdGenerator);
      expect(mastra.generateId()).toBe('new-id-1');
    });

    it('should propagate ID generator changes to registered components', async () => {
      const { mastra, agent, memory: _memory } = createMastraWithMemory(customIdGenerator);

      const agentMemory = await agent.getMemory();
      if (!agentMemory) throw new Error('Memory not found');

      // Change the ID generator
      const newIdGenerator = vi.fn(() => `new-id-${++idCounter}`);
      mastra.setIdGenerator(newIdGenerator);

      // Test that memory uses the new generator
      const memoryId = agentMemory.generateId();
      expect(newIdGenerator).toHaveBeenCalled();
      expect(memoryId).toMatch(/^new-id-\d+$/);
    });
  });
});
