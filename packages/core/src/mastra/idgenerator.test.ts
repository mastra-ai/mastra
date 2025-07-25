import { MockLanguageModelV1 } from 'ai/test';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent';
import type { MastraMessageV2 } from '../agent/types';
import { MastraError } from '../error';
import type { StorageThreadType, MemoryConfig, MastraMessageV1 } from '../memory';
import { MastraMemory } from '../memory/memory';
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
}

// Helper function to create a Mastra instance with proper memory registration
function createMastraWithMemory(idGenerator?: () => string) {
  const mastra = new Mastra({
    idGenerator,
    logger: false,
  });

  // Create a mock memory instance
  const memory = new MockMemory();

  // Register the memory with Mastra
  memory.__registerMastra(mastra);

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

  // Register the agent with Mastra
  agent.__registerMastra(mastra);

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
});
