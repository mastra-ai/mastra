import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { MessageList } from '../agent';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '../memory/types';
import { deepMerge } from '../utils';
import { InMemoryStore } from './mock';
import { StoreOperationsInMemory } from './domains/operations/inmemory';

describe('InMemoryStore - Thread Sorting', () => {
  let store: InMemoryStore;
  const resourceId = 'test-resource-id';

  beforeEach(async () => {
    store = new InMemoryStore();

    // Create test threads with different dates
    const threads: StorageThreadType[] = [
      {
        id: 'thread-1',
        resourceId,
        title: 'Thread 1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-03T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-2',
        resourceId,
        title: 'Thread 2',
        createdAt: new Date('2024-01-02T10:00:00Z'),
        updatedAt: new Date('2024-01-02T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-3',
        resourceId,
        title: 'Thread 3',
        createdAt: new Date('2024-01-03T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        metadata: {},
      },
    ];

    // Save threads to store
    for (const thread of threads) {
      await store.saveThread({ thread });
    }
  });

  describe('getThreadsByResourceId', () => {
    it('should sort by createdAt DESC by default', async () => {
      const threads = await store.getThreadsByResourceId({ resourceId });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-3'); // 2024-01-03 (latest)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-1'); // 2024-01-01 (earliest)
    });

    it('should sort by createdAt ASC when specified', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId,
        orderBy: 'createdAt',
        sortDirection: 'ASC',
      });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-1'); // 2024-01-01 (earliest)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-3'); // 2024-01-03 (latest)
    });

    it('should sort by updatedAt DESC when specified', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId,
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
      });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-1'); // 2024-01-03 (latest updatedAt)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-3'); // 2024-01-01 (earliest updatedAt)
    });

    it('should sort by updatedAt ASC when specified', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-3'); // 2024-01-01 (earliest updatedAt)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-1'); // 2024-01-03 (latest updatedAt)
    });

    it('should handle empty results', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId: 'non-existent-resource',
      });

      expect(threads).toHaveLength(0);
    });

    it('should filter by resourceId correctly', async () => {
      // Add a thread with different resourceId
      await store.saveThread({
        thread: {
          id: 'thread-other',
          resourceId: 'other-resource',
          title: 'Other Thread',
          createdAt: new Date('2024-01-04T10:00:00Z'),
          updatedAt: new Date('2024-01-04T10:00:00Z'),
          metadata: {},
        },
      });

      const threads = await store.getThreadsByResourceId({ resourceId });

      expect(threads).toHaveLength(3);
      expect(threads.every(t => t.resourceId === resourceId)).toBe(true);
    });
  });

  describe('getThreadsByResourceIdPaginated', () => {
    it('should sort by createdAt DESC by default with pagination', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 0,
        perPage: 2,
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].id).toBe('thread-3'); // 2024-01-03 (latest)
      expect(result.threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by updatedAt ASC with pagination', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].id).toBe('thread-3'); // 2024-01-01 (earliest updatedAt)
      expect(result.threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should maintain sort order across pages', async () => {
      // First page
      const page1 = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: 'createdAt',
        sortDirection: 'ASC',
      });

      // Second page
      const page2 = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 1,
        perPage: 2,
        orderBy: 'createdAt',
        sortDirection: 'ASC',
      });

      expect(page1.threads).toHaveLength(2);
      expect(page1.threads[0].id).toBe('thread-1'); // 2024-01-01 (earliest)
      expect(page1.threads[1].id).toBe('thread-2'); // 2024-01-02

      expect(page2.threads).toHaveLength(1);
      expect(page2.threads[0].id).toBe('thread-3'); // 2024-01-03 (latest)
    });

    it('should calculate pagination info correctly after sorting', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 1,
        perPage: 2,
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
      });

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0].id).toBe('thread-3'); // Last item after sorting
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should handle empty results with pagination', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
        resourceId: 'non-existent-resource',
        page: 0,
        perPage: 10,
      });

      expect(result.threads).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});

describe('InMemoryStore - Message Fetching', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('getMessages should throw when threadId is an empty string or whitespace only', async () => {
    await expect(() => store.getMessages({ threadId: '' })).rejects.toThrowError('threadId must be a non-empty string');

    await expect(() => store.getMessages({ threadId: '   ' })).rejects.toThrowError(
      'threadId must be a non-empty string',
    );
  });

  it('getMessagesPaginated should throw when threadId is an empty string or whitespace only', async () => {
    await expect(() => store.getMessagesPaginated({ threadId: '' })).rejects.toThrowError(
      'threadId must be a non-empty string',
    );

    await expect(() => store.getMessagesPaginated({ threadId: '   ' })).rejects.toThrowError(
      'threadId must be a non-empty string',
    );
  });
});

describe('InMemoryStore - getMessagesById', () => {
  let store: InMemoryStore;
  const resourceId = 'test-resource-id';
  const resourceId2 = 'test-resource-id-2';
  let threads: StorageThreadType[] = [];
  let thread1Messages: MastraMessageV1[] = [];
  let thread2Messages: MastraMessageV1[] = [];
  let resource2Messages: MastraMessageV1[] = [];

  let messageCounter = 0;
  const createTestMessageV1 = (text: string, props?: Partial<Omit<MastraMessageV1, 'content'>>): MastraMessageV1 => {
    messageCounter += 1;

    const defaults = {
      id: randomUUID(),
      role: 'user' as const,
      resourceId,
      createdAt: new Date(Date.now() + messageCounter * 1000),
      content: text,
      type: 'text' as const,
    };

    return deepMerge<MastraMessageV1>(defaults, props ?? {});
  };

  beforeEach(async () => {
    store = new InMemoryStore();

    // Create test threads with different dates
    threads = [
      {
        id: 'thread-1',
        resourceId,
        title: 'Thread 1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-03T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-2',
        resourceId,
        title: 'Thread 2',
        createdAt: new Date('2024-01-02T10:00:00Z'),
        updatedAt: new Date('2024-01-02T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-3',
        resourceId: resourceId2,
        title: 'Thread 3',
        createdAt: new Date('2024-01-03T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        metadata: {},
      },
    ];

    // Save threads to store
    for (const thread of threads) {
      await store.saveThread({ thread });
    }

    thread1Messages = [
      createTestMessageV1('Message 1', { threadId: threads[0].id, resourceId }),
      createTestMessageV1('Message 2', { threadId: threads[0].id, resourceId }),
    ];

    thread2Messages = [
      createTestMessageV1('Message A', { threadId: threads[1].id, resourceId }),
      createTestMessageV1('Message B', { threadId: threads[1].id, resourceId }),
    ];

    resource2Messages = [
      createTestMessageV1('The quick brown fox jumps over the lazy dog', {
        threadId: threads[2].id,
        resourceId: resourceId2,
      }),
    ];

    await store.saveMessages({ messages: thread1Messages, format: 'v1' });
    await store.saveMessages({ messages: thread2Messages, format: 'v1' });
    await store.saveMessages({ messages: resource2Messages, format: 'v1' });
  });

  it('should return an empty array if no message IDs are provided', async () => {
    const messages = await store.getMessagesById({ messageIds: [] });
    expect(messages).toHaveLength(0);
  });

  it('should return messages sorted by createdAt DESC', async () => {
    const messageIds = [
      thread1Messages[1]!.id,
      thread2Messages[0]!.id,
      resource2Messages[0]!.id,
      thread1Messages[0]!.id,
      thread2Messages[1]!.id,
    ];
    const messages = await store.getMessagesById({
      messageIds,
    });

    expect(messages).toHaveLength(thread1Messages.length + thread2Messages.length + resource2Messages.length);
    expect(messages.every((msg, i, arr) => i === 0 || msg.createdAt >= arr[i - 1]!.createdAt)).toBe(true);
  });

  it('should return V2 messages by default', async () => {
    const messages: MastraMessageV2[] = await store.getMessagesById({ messageIds: thread1Messages.map(msg => msg.id) });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.every(MessageList.isMastraMessageV2)).toBe(true);
  });

  it('should return messages in the specified format', async () => {
    const v1messages: MastraMessageV1[] = await store.getMessagesById({
      messageIds: thread1Messages.map(msg => msg.id),
      format: 'v1',
    });

    expect(v1messages.length).toBeGreaterThan(0);
    expect(v1messages.every(MessageList.isMastraMessageV1)).toBe(true);

    const v2messages: MastraMessageV2[] = await store.getMessagesById({
      messageIds: thread1Messages.map(msg => msg.id),
      format: 'v2',
    });

    expect(v2messages.length).toBeGreaterThan(0);
    expect(v2messages.every(MessageList.isMastraMessageV2)).toBe(true);
  });

  it('should return messages from multiple threads', async () => {
    const messages = await store.getMessagesById({
      messageIds: [...thread1Messages.map(msg => msg.id), ...thread2Messages.map(msg => msg.id)],
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some(msg => msg.threadId === threads[0]?.id)).toBe(true);
    expect(messages.some(msg => msg.threadId === threads[1]?.id)).toBe(true);
  });

  it('should return messages from multiple resources', async () => {
    const messages = await store.getMessagesById({
      messageIds: [...thread1Messages.map(msg => msg.id), ...resource2Messages.map(msg => msg.id)],
    });

    expect(messages).toHaveLength(thread1Messages.length + resource2Messages.length);
    expect(messages.some(msg => msg.resourceId === threads[0]?.resourceId)).toBe(true);
    expect(messages.some(msg => msg.resourceId === threads[2]?.resourceId)).toBe(true);
  });
});

describe('InMemoryStore - Agent Management', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('should create an agent successfully', async () => {
    const agentConfig = {
      id: 'test-agent-id',
      name: 'Test Agent',
      workflowIds: ['workflow-1', 'workflow-2'],
      agentIds: ['sub-agent-1'],
      toolIds: ['tool-1', 'tool-2', 'tool-3'],
      model: 'gpt-4',
      instructions: 'You are a helpful assistant.',
    };

    // Should not throw
    await expect(store.createAgent(agentConfig)).resolves.toBeUndefined();
  });

  it('should store agent data correctly in the database', async () => {
    const agentConfig = {
      id: 'test-agent-id-2',
      name: 'Test Agent 2',
      workflowIds: ['workflow-a', 'workflow-b'],
      agentIds: [],
      toolIds: ['tool-x', 'tool-y'],
      model: 'claude-3',
      instructions: 'You are a specialized assistant.',
    };

    await store.createAgent(agentConfig);

    // Access the internal data structure to verify the agent was stored
    const database = store.stores.operations.getDatabase();
    const agentsTable = database.mastra_agents;

    expect(agentsTable.has(agentConfig.id)).toBe(true);

    const storedAgent = agentsTable.get(agentConfig.id);
    expect(storedAgent).toBeDefined();
    expect(storedAgent.id).toBe(agentConfig.id);
    expect(storedAgent.name).toBe(agentConfig.name);
    expect(storedAgent.model).toBe(agentConfig.model);
    expect(storedAgent.instructions).toBe(agentConfig.instructions);

    // JSON fields should be stored as strings
    expect(JSON.parse(storedAgent.workflowIds)).toEqual(agentConfig.workflowIds);
    expect(JSON.parse(storedAgent.agentIds)).toEqual(agentConfig.agentIds);
    expect(JSON.parse(storedAgent.toolIds)).toEqual(agentConfig.toolIds);

    // Timestamps should be present
    expect(storedAgent.createdAt).toBeInstanceOf(Date);
    expect(storedAgent.updatedAt).toBeInstanceOf(Date);
  });

  it('should handle empty arrays correctly', async () => {
    const agentConfig = {
      id: 'test-agent-empty',
      name: 'Empty Agent',
      workflowIds: [],
      agentIds: [],
      toolIds: [],
      model: 'gpt-3.5-turbo',
      instructions: 'Simple agent with no tools.',
    };

    await store.createAgent(agentConfig);

    const storedAgent = await store.getAgent(agentConfig.id);

    expect(storedAgent?.workflowIds).toEqual([]);
    expect(storedAgent?.agentIds).toEqual([]);
    expect(storedAgent?.toolIds).toEqual([]);
  });

  it('should get an agent by ID', async () => {
    const agentConfig = {
      id: 'get-agent-test',
      name: 'Get Agent Test',
      workflowIds: ['workflow-1', 'workflow-2'],
      agentIds: ['sub-agent-1'],
      toolIds: ['tool-1', 'tool-2'],
      model: 'gpt-4',
      instructions: 'You are a test agent.',
    };

    await store.createAgent(agentConfig);

    const retrievedAgent = await store.getAgent(agentConfig.id);

    expect(retrievedAgent).not.toBeNull();
    expect(retrievedAgent!.id).toBe(agentConfig.id);
    expect(retrievedAgent!.name).toBe(agentConfig.name);
    expect(retrievedAgent!.workflowIds).toEqual(agentConfig.workflowIds);
    expect(retrievedAgent!.agentIds).toEqual(agentConfig.agentIds);
    expect(retrievedAgent!.toolIds).toEqual(agentConfig.toolIds);
    expect(retrievedAgent!.model).toBe(agentConfig.model);
    expect(retrievedAgent!.instructions).toBe(agentConfig.instructions);
    expect(retrievedAgent!.createdAt).toBeInstanceOf(Date);
    expect(retrievedAgent!.updatedAt).toBeInstanceOf(Date);
  });

  it('should return null for non-existent agent', async () => {
    const retrievedAgent = await store.getAgent('non-existent-id');
    expect(retrievedAgent).toBeNull();
  });

  it('should list all agents', async () => {
    const agent1Config = {
      id: 'list-agent-1',
      name: 'List Agent 1',
      workflowIds: ['workflow-1'],
      agentIds: [],
      toolIds: ['tool-1'],
      model: 'gpt-4',
      instructions: 'First test agent.',
    };

    const agent2Config = {
      id: 'list-agent-2',
      name: 'List Agent 2',
      workflowIds: ['workflow-2'],
      agentIds: ['sub-agent-1'],
      toolIds: ['tool-2', 'tool-3'],
      model: 'claude-3',
      instructions: 'Second test agent.',
    };

    await store.createAgent(agent1Config);
    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));
    await store.createAgent(agent2Config);

    const agents = await store.listAgents();

    expect(agents).toHaveLength(2);

    // Should be sorted by createdAt DESC (newest first)
    expect(agents[0].id).toBe(agent2Config.id);
    expect(agents[1].id).toBe(agent1Config.id);

    // Verify all fields are correctly parsed
    expect(agents[0].name).toBe(agent2Config.name);
    expect(agents[0].workflowIds).toEqual(agent2Config.workflowIds);
    expect(agents[0].agentIds).toEqual(agent2Config.agentIds);
    expect(agents[0].toolIds).toEqual(agent2Config.toolIds);
    expect(agents[0].model).toBe(agent2Config.model);
    expect(agents[0].instructions).toBe(agent2Config.instructions);
    expect(agents[0].createdAt).toBeInstanceOf(Date);
    expect(agents[0].updatedAt).toBeInstanceOf(Date);

    expect(agents[1].name).toBe(agent1Config.name);
    expect(agents[1].workflowIds).toEqual(agent1Config.workflowIds);
    expect(agents[1].agentIds).toEqual(agent1Config.agentIds);
    expect(agents[1].toolIds).toEqual(agent1Config.toolIds);
    expect(agents[1].model).toBe(agent1Config.model);
    expect(agents[1].instructions).toBe(agent1Config.instructions);
  });

  it('should return empty array when no agents exist', async () => {
    const agents = await store.listAgents();
    expect(agents).toHaveLength(0);
  });

  it('should handle agents with empty arrays in listAgents', async () => {
    const agentConfig = {
      id: 'empty-arrays-agent',
      name: 'Empty Arrays Agent',
      workflowIds: [],
      agentIds: [],
      toolIds: [],
      model: 'gpt-3.5-turbo',
      instructions: 'Agent with empty arrays.',
    };

    await store.createAgent(agentConfig);

    const agents = await store.listAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].workflowIds).toEqual([]);
    expect(agents[0].agentIds).toEqual([]);
    expect(agents[0].toolIds).toEqual([]);
  });
});
