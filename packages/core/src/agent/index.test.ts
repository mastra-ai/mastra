import { beforeEach, describe, expect, it } from 'vitest';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { MastraMemory } from '../memory/memory';
import { RuntimeContext } from '../runtime-context';
import { Agent } from '.';

// Minimal implementation of MastraMemory for testing
class TestMemory extends MastraMemory {
  async rememberMessages() {
    return { messages: [], messagesV2: [] };
  }
  async getThreadById() {
    return null;
  }
  async getThreadsByResourceId() {
    return [];
  }
  async saveThread() {
    return { id: '', resourceId: '', createdAt: new Date(), updatedAt: new Date() };
  }
  async saveMessages() {
    return [];
  }
  async query() {
    return { messages: [], uiMessages: [] };
  }
  async deleteThread() {}
  async getWorkingMemory() {
    return null;
  }
  async getWorkingMemoryTemplate() {
    return null;
  }
  async updateWorkingMemory() {}
  async __experimental_updateWorkingMemoryVNext() {
    return { success: true, reason: '' };
  }
}

describe('Agent.getMemory', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: 'test-model',
    });
  });

  it('should throw MastraError when memory function returns falsy value', async () => {
    // Arrange: Set up agent with memory function that returns null
    const runtimeContext = new RuntimeContext();
    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: 'test-model',
      memory: ({ runtimeContext: ctx }) => {
        // Verify runtime context is passed through
        expect(ctx).toBe(runtimeContext);
        return null;
      },
    });

    // Act & Assert: Call getMemory and verify error details
    await expect(agent.getMemory({ runtimeContext })).rejects.toMatchObject({
      id: 'AGENT_GET_MEMORY_FUNCTION_EMPTY_RETURN',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      details: {
        agentName: 'test-agent',
      },
    });

    // Additional type check
    await expect(agent.getMemory({ runtimeContext })).rejects.toBeInstanceOf(MastraError);
  });

  it('should return undefined when no memory is configured', async () => {
    const runtimeContext = new RuntimeContext();

    const result = await agent.getMemory({ runtimeContext });

    expect(result).toBeUndefined();
  });

  it('should resolve and return memory when function returns valid MastraMemory', async () => {
    const runtimeContext = new RuntimeContext();
    const memoryInstance = new TestMemory({ name: 'test-memory' });
    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: 'test-model',
      memory: ({ runtimeContext: ctx }) => {
        expect(ctx).toBe(runtimeContext);
        return memoryInstance;
      },
    });

    const result = await agent.getMemory({ runtimeContext });

    expect(result).toBe(memoryInstance);
  });

  it('should return memory instance directly when configured as object', async () => {
    // Arrange: Create new TestMemory instance and configure agent
    const memoryInstance = new TestMemory({ name: 'test-memory' });
    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: 'test-model',
      memory: memoryInstance,
    });

    // Act: Call getMemory with default runtime context
    const result = await agent.getMemory();

    // Assert: Verify returned memory is exactly the same instance
    expect(result).toBe(memoryInstance);
  });
});
