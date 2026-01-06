import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import { WorkingMemory } from '@mastra/memory';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage for testing
const mockStorage = {
  getThreadById: vi.fn().mockResolvedValue({
    id: 'test-thread',
    metadata: { workingMemory: '# User Information\nname: John Doe\nlocation: submarine under the sea' },
  }),
  getResourceById: vi.fn().mockResolvedValue({
    id: 'test-resource',
    workingMemory: '# User Information\nname: John Doe\nlocation: submarine under the sea',
  }),
} as unknown as MemoryStorage;

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
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello, how are you?' }],
          metadata: {},
        },
        createdAt: new Date(),
      },
    ];

    const resultMessageList = await workingMemoryProcessor.processInput({
      messages,
      messageList: new MessageList().add(messages, 'input'),
      requestContext: mockContext,
      abort: (() => {
        throw new Error('Aborted');
      }) as any,
    });

    // Result is a MessageList - get the prompt format which includes system messages
    const result = (resultMessageList as MessageList).get.all.aiV4.prompt();

    // Should have added a system message with working memory
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(typeof result[0].content === 'string' ? result[0].content : '').toContain('submarine under the sea');
    expect(result[1].role).toBe('user');
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
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Update my name to John' }],
          metadata: {},
        },
        createdAt: new Date(),
      },
    ];

    // First run - should inject initial working memory
    const firstResultMessageList = await workingMemoryProcessor.processInput({
      messages,
      messageList: new MessageList().add(messages, 'input'),
      requestContext: mockContext,
      abort: (() => {}) as any,
    });

    const firstResult = (firstResultMessageList as MessageList).get.all.aiV4.prompt();
    const firstSystemContent = typeof firstResult[0].content === 'string' ? firstResult[0].content : '';
    expect(firstSystemContent).toContain('submarine under the sea');

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
    const secondResultMessageList = await workingMemoryProcessor.processInput({
      messages,
      messageList: new MessageList().add(messages, 'input'),
      requestContext: mockContext,
      abort: (() => {}) as any,
    });

    const secondResult = (secondResultMessageList as MessageList).get.all.aiV4.prompt();
    const secondSystemContent = typeof secondResult[0].content === 'string' ? secondResult[0].content : '';
    expect(secondSystemContent).toContain('John');
    expect(secondSystemContent).toContain('submarine under the sea');
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
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'What do you know about me?' }],
          metadata: {},
        },
        createdAt: new Date(),
      },
    ];

    const resultMessageList = await workingMemoryProcessor.processInput({
      messages,
      messageList: new MessageList().add(messages, 'input'),
      requestContext: mockContext,
      abort: (() => {
        throw new Error('Aborted');
      }) as any,
    });

    const result = (resultMessageList as MessageList).get.all.aiV4.prompt();

    // Should still have added a system message (with template but no data)
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(result[1].role).toBe('user');
  });
});
