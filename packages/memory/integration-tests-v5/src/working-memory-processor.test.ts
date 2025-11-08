import type { Storage } from '@mastra/core';
import type { MastraDBMessage } from '@mastra/core/memory';
import { WorkingMemory } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach } from 'vitest';

// Mock storage for testing
const mockStorage: Storage = {
  get: async () => null,
  set: async () => {},
  delete: async () => {},
  list: async () => ({ messages: [], hasNextPage: false }),
  listMessages: async () => ({ messages: [], hasNextPage: false }),
  update: async () => ({}),
  getThreadById: vi.fn().mockResolvedValue({
    id: 'test-thread',
    metadata: { workingMemory: '# User Information\nname: John Doe\nlocation: submarine under the sea' },
  }),
  getResourceById: vi.fn().mockResolvedValue({
    id: 'test-resource',
    workingMemory: '# User Information\nname: John Doe\nlocation: submarine under the sea',
  }),
  stores: {
    memory: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      list: async () => ({ messages: [], hasNextPage: false }),
      listMessages: async () => ({ messages: [], hasNextPage: false }),
      update: async () => ({}),
    },
    threads: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      list: async () => ({ messages: [], hasNextPage: false }),
      listMessages: async () => ({ messages: [], hasNextPage: false }),
      update: async () => ({}),
    },
  },
};

describe('Working Memory Processor Unit Tests', () => {
  let workingMemoryProcessor: WorkingMemory;
  let mockContext: RequestContext;

  beforeEach(() => {
    workingMemoryProcessor = new WorkingMemory({
      storage: mockStorage,
      scope: 'resource',
    });

    mockContext = new RequestContext([
      [
        'MastraMemory',
        {
          thread: { id: 'test-thread-id' },
          resourceId: 'test-resource-id',
        },
      ],
    ]);
  });

  it('should inject existing working memory as system message', async () => {
    // Mock the storage to return working memory
    const mockWorkingMemory = `# user information
- **first name**: Tyler
- **last name**: 
- **location**: submarine under the sea
- **interests**:`;

    // Mock the direct storage methods that WorkingMemory processor calls
    mockStorage.getResourceById = vi.fn().mockResolvedValue({
      id: 'test-resource-id',
      workingMemory: mockWorkingMemory,
    });

    const messages: MastraDBMessage[] = [
      {
        id: 'msg1',
        threadId: 'test-thread-id',
        resourceId: 'test-resource-id',
        source: 'input',
        content: {
          parts: [{ type: 'text', text: 'Hello, how are you?' }],
          metadata: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await workingMemoryProcessor.processInput({
      messages,
      runtimeContext: mockContext,
      abort: () => {
        throw new Error('Aborted');
      },
    });

    // Should have added a system message with working memory
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(result[0].content.content).toContain('submarine under the sea');
    expect(result[1]).toEqual(messages[0]);
  });

  it('should preserve working memory across multiple processor runs', async () => {
    const initialWorkingMemory = `# user information
- **first name**: Tyler
- **last name**: 
- **location**: submarine under the sea
- **interests**:`;

    // Mock initial working memory
    mockStorage.getResourceById = vi.fn().mockResolvedValue({
      id: 'test-resource-id',
      workingMemory: initialWorkingMemory,
    });

    const messages: MastraDBMessage[] = [
      {
        id: 'msg1',
        threadId: 'test-thread-id',
        resourceId: 'test-resource-id',
        source: 'input',
        content: {
          parts: [{ type: 'text', text: 'Update my name to John' }],
          metadata: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // First run - should inject initial working memory
    const firstResult = await workingMemoryProcessor.processInput({
      messages,
      runtimeContext: mockContext,
      abort: () => {},
    });

    expect(firstResult[0].content.content).toContain('submarine under the sea');

    // Simulate working memory update (this would happen via the tool)
    const updatedWorkingMemory = `# user information
- **first name**: John
- **last name**: 
- **location**: submarine under the sea
- **interests**:`;

    mockStorage.getResourceById = vi.fn().mockResolvedValue({
      id: 'test-resource-id',
      workingMemory: updatedWorkingMemory,
    });

    // Second run - should inject updated working memory
    const secondResult = await workingMemoryProcessor.processInput({
      messages,
      runtimeContext: mockContext,
      abort: () => {},
    });

    expect(secondResult[0].content.content).toContain('John');
    expect(secondResult[0].content.content).toContain('submarine under the sea');
  });

  it('should show working memory is lost when not properly injected', async () => {
    // Mock no working memory stored
    mockStorage.getResourceById = vi.fn().mockResolvedValue({
      id: 'test-resource-id',
      workingMemory: null,
    });

    const messages: MastraDBMessage[] = [
      {
        id: 'msg1',
        threadId: 'test-thread-id',
        resourceId: 'test-resource-id',
        source: 'input',
        content: {
          parts: [{ type: 'text', text: 'What do you know about me?' }],
          metadata: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await workingMemoryProcessor.processInput({
      messages,
      runtimeContext: mockContext,
      abort: () => {
        throw new Error('Aborted');
      },
    });

    // Should still have added a system message (with template but no data)
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(result[1]).toEqual(messages[0]);
  });
});
