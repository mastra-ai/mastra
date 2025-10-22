import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import type { MastraMessageV1, MastraMessageV2 } from '@mastra/core/memory';
import { MastraMemory } from '@mastra/core/memory';
import { MockStore } from '@mastra/core/storage';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  getMemoryStatusHandler,
  getThreadsHandler,
  getThreadsPaginatedHandler,
  getThreadByIdHandler,
  saveMessagesHandler,
  createThreadHandler,
  getMessagesHandler,
  getMessagesPaginatedHandler,
  deleteMessagesHandler,
} from './memory';

vi.mock('@mastra/core/memory');

type MockedAbstractFn = {
  getThreadsByResourceId: Mock<MastraMemory['getThreadsByResourceId']>;
  getThreadsByResourceIdPaginated: Mock<MastraMemory['getThreadsByResourceIdPaginated']>;
  getThreadById: Mock<MastraMemory['getThreadById']>;
  query: Mock<MastraMemory['query']>;
  saveMessages: Mock<MastraMemory['saveMessages']>;
  createThread: Mock<MastraMemory['createThread']>;
};

type Thread = NonNullable<Awaited<ReturnType<MastraMemory['getThreadById']>>>;

function createThread(args: Partial<Thread>): Thread {
  return {
    id: '1',
    title: 'Test Thread',
    resourceId: 'test-resource',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...args,
  };
}

describe('Memory Handlers', () => {
  let mockMemory: Omit<MastraMemory, keyof MockedAbstractFn> & MockedAbstractFn;
  let mockAgent: Agent;
  let storage: MockStore;

  beforeEach(() => {
    // @ts-ignore
    mockMemory = new MastraMemory();
    mockMemory.getThreadsByResourceId = vi.fn();
    mockMemory.getThreadsByResourceIdPaginated = vi.fn();
    mockMemory.getThreadById = vi.fn();
    mockMemory.query = vi.fn();
    mockMemory.saveMessages = vi.fn();
    mockMemory.createThread = vi.fn();

    mockAgent = new Agent({
      name: 'test-agent',
      instructions: 'test-instructions',
      model: {} as any,
      memory: mockMemory as unknown as MastraMemory,
    });

    storage = new MockStore();
  });

  describe('getMemoryStatusHandler', () => {
    it('should return false when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        storage,
      });

      const result = await getMemoryStatusHandler({ mastra });
      expect(result).toEqual({ result: false });
    });

    it('should return true when memory is initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        storage,
        agents: { mockAgent },
      });

      const result = await getMemoryStatusHandler({ mastra, agentId: 'mockAgent' });
      expect(result).toEqual({ result: true });
    });

    it('should use agent memory when agentId is provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });

      const result = await getMemoryStatusHandler({ mastra, agentId: 'test-agent' });
      expect(result).toEqual({ result: true });
    });

    it('should throw 404 when agent is not found', async () => {
      const mastra = new Mastra({
        logger: false,
      });
      await expect(getMemoryStatusHandler({ mastra, agentId: 'non-existent' })).rejects.toThrow(HTTPException);
    });
  });

  describe('getThreadsHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': new Agent({
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(getThreadsHandler({ mastra, resourceId: 'test-resource', agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(400, { message: 'Memory is not initialized' }),
      );
    });

    it('should throw error when resourceId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      await expect(getThreadsHandler({ mastra, agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "resourceId" is required' }),
      );
    });

    it('should return threads for valid resourceId', async () => {
      const mockThreads = [createThread({ resourceId: 'test-resource' })];
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      mockMemory.getThreadsByResourceId.mockResolvedValue(mockThreads);

      const result = await getThreadsHandler({ mastra, resourceId: 'test-resource', agentId: 'test-agent' });
      expect(result).toEqual(mockThreads);
      expect(mockMemory.getThreadsByResourceId).toBeCalledWith({ resourceId: 'test-resource' });
    });
  });

  describe('getThreadsPaginatedHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': new Agent({
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(
        getThreadsPaginatedHandler({
          mastra,
          resourceId: 'test-resource',
          agentId: 'test-agent',
          page: 0,
          perPage: 10,
          orderBy: 'createdAt',
          sortDirection: 'DESC',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Memory is not initialized' }));
    });

    it('should throw error when resourceId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });
      await expect(
        getThreadsPaginatedHandler({
          mastra,
          agentId: 'test-agent',
          page: 0,
          perPage: 10,
          orderBy: 'createdAt',
          sortDirection: 'DESC',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "resourceId" is required' }));
    });

    it('should return paginated threads with default parameters', async () => {
      const mockResult = {
        threads: [createThread({ resourceId: 'test-resource' })],
        total: 25,
        page: 0,
        perPage: 10,
        hasMore: true,
      };

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      mockMemory.getThreadsByResourceIdPaginated.mockResolvedValue(mockResult);

      const result = await getThreadsPaginatedHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 10,
        orderBy: 'createdAt',
        sortDirection: 'DESC',
      });

      expect(result).toEqual(mockResult);
      expect(mockMemory.getThreadsByResourceIdPaginated).toBeCalledWith({
        resourceId: 'test-resource',
        page: 0,
        perPage: 10,
        orderBy: 'createdAt',
        sortDirection: 'DESC',
      });
    });

    it('should respect custom pagination parameters', async () => {
      const mockResult = {
        threads: [createThread({ resourceId: 'test-resource' })],
        total: 50,
        page: 1,
        perPage: 20,
        hasMore: true,
      };

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      mockMemory.getThreadsByResourceIdPaginated.mockResolvedValue(mockResult);

      const result = await getThreadsPaginatedHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 1,
        perPage: 20,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });

      expect(result).toEqual(mockResult);
      expect(mockMemory.getThreadsByResourceIdPaginated).toBeCalledWith({
        resourceId: 'test-resource',
        page: 1,
        perPage: 20,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });
    });

    it('should handle sorting parameters correctly', async () => {
      const mockResult = {
        threads: [
          createThread({ id: '1', resourceId: 'test-resource', title: 'Thread 1' }),
          createThread({ id: '2', resourceId: 'test-resource', title: 'Thread 2' }),
        ],
        total: 2,
        page: 0,
        perPage: 10,
        hasMore: false,
      };

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      mockMemory.getThreadsByResourceIdPaginated.mockResolvedValue(mockResult);

      // Test updatedAt DESC sorting
      const result = await getThreadsPaginatedHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 10,
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
      });

      expect(result).toEqual(mockResult);
      expect(mockMemory.getThreadsByResourceIdPaginated).toBeCalledWith({
        resourceId: 'test-resource',
        page: 0,
        perPage: 10,
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
      });
    });

    it('should handle edge cases with no threads', async () => {
      const mockResult = {
        threads: [],
        total: 0,
        page: 0,
        perPage: 10,
        hasMore: false,
      };

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      mockMemory.getThreadsByResourceIdPaginated.mockResolvedValue(mockResult);

      const result = await getThreadsPaginatedHandler({
        mastra,
        resourceId: 'non-existent-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 10,
        orderBy: 'createdAt',
        sortDirection: 'DESC',
      });

      expect(result).toEqual(mockResult);
      expect(result.threads).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getThreadByIdHandler', () => {
    it('should throw error when threadId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
      });
      await expect(getThreadByIdHandler({ mastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "threadId" is required' }),
      );
    });

    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': new Agent({
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(getThreadByIdHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(400, { message: 'Memory is not initialized' }),
      );
    });

    it('should throw 404 when thread is not found', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      mockMemory.getThreadById.mockResolvedValue(null);
      await expect(getThreadByIdHandler({ mastra, threadId: 'non-existent', agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
    });

    it('should return thread when found', async () => {
      const mockThread = createThread({
        id: 'test-thread',
      });
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      mockMemory.getThreadById.mockResolvedValue(mockThread);

      const result = await getThreadByIdHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });
      expect(result).toEqual(mockThread);
      expect(mockMemory.getThreadById).toBeCalledWith({ threadId: 'test-thread' });
    });
  });

  describe('saveMessagesHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': new Agent({
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(
        saveMessagesHandler({
          mastra,
          agentId: 'test-agent',
          body: { messages: [] },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Memory is not initialized' }));
    });

    it('should throw error when messages are not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      await expect(
        saveMessagesHandler({
          mastra,
          agentId: 'test-agent',
          body: {} as { messages: MastraMessageV2[] },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Messages are required' }));
    });

    it('should throw error when messages is not an array', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      await expect(
        saveMessagesHandler({
          mastra,
          agentId: 'test-agent',
          body: { messages: 'not-an-array' as unknown as MastraMessageV2[] },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Messages should be an array' }));
    });

    it('should save messages successfully', async () => {
      const mockMessages: MastraMessageV1[] = [
        {
          id: 'test-id',
          content: 'Test message',
          role: 'user',
          createdAt: new Date(),
          threadId: 'test-thread',
          type: 'text',
          resourceId: 'test-resource',
        },
      ];

      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      mockMemory.saveMessages.mockResolvedValue(mockMessages);

      const result = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages: mockMessages },
      });
      expect(result).toEqual(mockMessages);
    });

    it('should accept, save, and retrieve both v1 and v2 format messages', async () => {
      const threadId = 'test-thread-123';
      const resourceId = 'test-resource-123';
      const now = new Date();

      // Create v1 message
      const v1Message: MastraMessageV1 = {
        id: 'msg-v1-123',
        role: 'user',
        content: 'Hello from v1 format!',
        type: 'text',
        createdAt: now,
        threadId,
        resourceId,
      };

      // Create v2 message
      const v2Message: MastraMessageV2 = {
        id: 'msg-v2-456',
        role: 'assistant',
        createdAt: new Date(now.getTime() + 1000), // 1 second later
        threadId,
        resourceId,
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello from v2 format!' }],
          content: 'Hello from v2 format!',
        },
      };

      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      // Mock saveMessages to return the messages as saved
      mockMemory.saveMessages.mockResolvedValue([v1Message, v2Message] as any);
      mockMemory.getThreadById.mockResolvedValue(createThread({ id: threadId }));

      // Mock query to return both messages
      mockMemory.query.mockResolvedValue({
        messages: [
          { role: 'user', content: 'Hello from v1 format!' },
          { role: 'assistant', content: 'Hello from v2 format!' },
        ] as CoreMessage[],
        uiMessages: [],
        messagesV2: [],
      });

      // Save both messages
      const saveResponse = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages: [v1Message, v2Message] },
      });

      expect(saveResponse).toBeDefined();
      expect(mockMemory.saveMessages).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({ id: 'msg-v1-123' }),
          expect.objectContaining({ id: 'msg-v2-456' }),
        ]),
        memoryConfig: {},
      });

      // Retrieve messages
      const getResponse = await getMessagesHandler({
        mastra,
        agentId: 'test-agent',
        threadId,
      });

      // Verify both messages are returned
      expect(getResponse.messages).toHaveLength(2);

      // Verify v1 message content
      expect(getResponse.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello from v1 format!',
      });

      // Verify v2 message content
      expect(getResponse.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hello from v2 format!',
      });
    });

    it('should handle mixed v1 and v2 messages in single request', async () => {
      const threadId = 'test-thread-mixed';
      const resourceId = 'test-resource-mixed';
      const baseTime = new Date();

      const messages = [
        // v1 message
        {
          id: 'msg-1',
          role: 'user',
          content: 'First v1 message',
          type: 'text',
          createdAt: baseTime,
          threadId,
          resourceId,
        } as MastraMessageV1,
        // v2 message
        {
          id: 'msg-2',
          role: 'assistant',
          createdAt: new Date(baseTime.getTime() + 1000),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'First v2 message' }],
            content: 'First v2 message',
          },
        } as MastraMessageV2,
        // Another v1 message
        {
          id: 'msg-3',
          role: 'user',
          content: 'Second v1 message',
          type: 'text',
          createdAt: new Date(baseTime.getTime() + 2000),
          threadId,
          resourceId,
        } as MastraMessageV1,
        // Another v2 message with tool call
        {
          id: 'msg-4',
          role: 'assistant',
          createdAt: new Date(baseTime.getTime() + 3000),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Let me help you with that.' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-123',
                  toolName: 'calculator',
                  args: { a: 1, b: 2 },
                  result: '3',
                },
              },
            ],
            toolInvocations: [
              {
                state: 'result' as const,
                toolCallId: 'call-123',
                toolName: 'calculator',
                args: { a: 1, b: 2 },
                result: '3',
              },
            ],
          },
        } as MastraMessageV2,
      ];

      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      // Mock saveMessages to accept the mixed array
      mockMemory.saveMessages.mockResolvedValue(messages as any);

      // Save mixed messages
      const saveResponse = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages },
      });

      expect(saveResponse).toBeDefined();
      expect(mockMemory.saveMessages).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({ id: 'msg-1' }),
          expect.objectContaining({ id: 'msg-2' }),
          expect.objectContaining({ id: 'msg-3' }),
          expect.objectContaining({ id: 'msg-4' }),
        ]),
        memoryConfig: {},
      });
    });
  });

  describe('createThreadHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': new Agent({
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(
        createThreadHandler({
          mastra,
          body: { resourceId: 'test-resource' },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Memory is not initialized' }));
    });

    it('should throw error when resourceId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      await expect(
        createThreadHandler({
          agentId: 'test-agent',
          mastra,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "resourceId" is required' }));
    });

    it('should create thread successfully', async () => {
      const mockThread = createThread({});
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      mockMemory.createThread.mockResolvedValue(mockThread);

      const result = await createThreadHandler({
        mastra,
        agentId: 'test-agent',
        body: {
          resourceId: 'test-resource',
          title: 'Test Thread',
        },
      });
      expect(result).toEqual(mockThread);
      expect(mockMemory.createThread).toBeCalledWith({
        resourceId: 'test-resource',
        title: 'Test Thread',
      });
    });
  });

  describe('getMessagesHandler', () => {
    it('should throw error when threadId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      await expect(getMessagesHandler({ mastra, agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "threadId" is required' }),
      );
    });

    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          testAgent: new Agent({
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'testAgent' })).rejects.toThrow(
        new HTTPException(400, { message: 'Memory is not initialized' }),
      );
    });

    it('should throw 404 when thread is not found', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      mockMemory.getThreadById.mockResolvedValue(null);
      await expect(getMessagesHandler({ mastra, threadId: 'non-existent', agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
    });

    it('should return messages for valid thread', async () => {
      const mockMessages: CoreMessage[] = [{ role: 'user', content: 'Test message' }];
      const mockMessagesV2: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Test message' }],
            content: 'Test message',
          },
        },
      ];
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      const expectedResult = { messages: mockMessages, uiMessages: [], messagesV2: mockMessagesV2, legacyMessages: [] };
      mockMemory.getThreadById.mockResolvedValue(createThread({}));
      mockMemory.query.mockResolvedValue(expectedResult);

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });
      expect(result.messages).toEqual(expectedResult.messages);
      expect(result.uiMessages).toMatchObject([
        {
          //"id": "a5bfc144-244b-4970-9f39-ef8e4ce76af3",
          metadata: {
            //"createdAt": 2025-10-08T14:33:23.266Z,
          },
          parts: [
            {
              text: 'Test message',
              type: 'text',
            },
          ],
          role: 'user',
        },
      ]);
      expect(result.legacyMessages).toEqual([]);
    });

    it('should preserve custom metadata in uiMessages when loading messages with metadata', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      // Create a V2 message with custom metadata (simulating what the client sends)
      const messagesV2: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello with custom metadata' }],
            content: 'Hello with custom metadata',
            metadata: {
              files: [
                {
                  id: 'file-1',
                  mediaType: 'image/png',
                  name: 'test.png',
                  access_token: '',
                },
              ],
            },
          },
        },
      ];

      // Mock the memory query to return our V2 messages
      const expectedResult = {
        messages: [] as CoreMessage[], // V1 format (legacy)
        uiMessages: [], // AIV4 UI format (legacy)
        messagesV2, // V2 format with metadata
      };

      mockMemory.getThreadById.mockResolvedValue(createThread({}));
      mockMemory.query.mockResolvedValue(expectedResult);

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });

      // Verify that uiMessages contains the custom metadata
      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.metadata).toMatchObject({
        files: [
          {
            id: 'file-1',
            mediaType: 'image/png',
            name: 'test.png',
            access_token: '',
          },
        ],
      });

      // Should also have system metadata
      expect(result.uiMessages[0]?.metadata).toHaveProperty('createdAt');
      expect(result.uiMessages[0]?.metadata).toHaveProperty('threadId', 'test-thread');
      expect(result.uiMessages[0]?.metadata).toHaveProperty('resourceId', 'test-resource');
    });

    it('should handle messages with tool invocations correctly', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const messagesV2: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          createdAt: new Date(),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  toolCallId: 'call-1',
                  toolName: 'searchTool',
                  args: { query: 'test' },
                  state: 'result',
                  result: 'search results',
                },
              },
            ],
            toolInvocations: [
              {
                toolCallId: 'call-1',
                toolName: 'searchTool',
                args: { query: 'test' },
                state: 'result',
                result: 'search results',
              },
            ],
          },
        },
      ];

      const expectedResult = {
        messages: [] as CoreMessage[],
        uiMessages: [],
        messagesV2,
      };

      mockMemory.getThreadById.mockResolvedValue(createThread({}));
      mockMemory.query.mockResolvedValue(expectedResult);

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });

      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.role).toBe('assistant');
      expect(result.uiMessages[0]?.parts).toHaveLength(1);
      // AIV5 converts tool-invocation to tool-{toolName} format
      expect(result.uiMessages[0]?.parts[0]?.type).toBe('tool-searchTool');
    });

    it('should handle multi-part messages (text + images) correctly', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const messagesV2: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Check this image' },
              { type: 'file', mimeType: 'image/png', data: 'base64data' },
            ],
            content: 'Check this image',
            metadata: {
              imageSource: 'upload',
            },
          },
        },
      ];

      const expectedResult = {
        messages: [] as CoreMessage[],
        uiMessages: [],
        messagesV2,
      };

      mockMemory.getThreadById.mockResolvedValue(createThread({}));
      mockMemory.query.mockResolvedValue(expectedResult);

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });

      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.parts).toHaveLength(2);
      expect(result.uiMessages[0]?.parts[0]?.type).toBe('text');
      expect(result.uiMessages[0]?.parts[1]?.type).toBe('file');
      // Custom metadata should be preserved
      expect(result.uiMessages[0]?.metadata).toHaveProperty('imageSource', 'upload');
    });

    it('should handle conversation with multiple messages and mixed metadata', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const messagesV2: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date('2025-01-01T00:00:00Z'),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'First message' }],
            content: 'First message',
            metadata: {
              sessionId: 'session-1',
            },
          },
        },
        {
          id: 'msg-2',
          role: 'assistant',
          createdAt: new Date('2025-01-01T00:01:00Z'),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Response' }],
            content: 'Response',
            // No custom metadata on this one
          },
        },
        {
          id: 'msg-3',
          role: 'user',
          createdAt: new Date('2025-01-01T00:02:00Z'),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Follow up' }],
            content: 'Follow up',
            metadata: {
              referenceId: 'ref-123',
            },
          },
        },
      ];

      const expectedResult = {
        messages: [] as CoreMessage[],
        uiMessages: [],
        messagesV2,
      };

      mockMemory.getThreadById.mockResolvedValue(createThread({}));
      mockMemory.query.mockResolvedValue(expectedResult);

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });

      expect(result.uiMessages).toHaveLength(3);

      // First message should have custom metadata
      expect(result.uiMessages[0]?.metadata).toHaveProperty('sessionId', 'session-1');

      // Second message should NOT have custom metadata (only system metadata)
      expect(result.uiMessages[1]?.metadata).not.toHaveProperty('sessionId');
      expect(result.uiMessages[1]?.metadata).not.toHaveProperty('referenceId');
      expect(result.uiMessages[1]?.metadata).toHaveProperty('threadId', 'test-thread');

      // Third message should have its own custom metadata
      expect(result.uiMessages[2]?.metadata).toHaveProperty('referenceId', 'ref-123');
    });
  });

  describe('getMessagesPaginatedHandler', () => {
    it('should throw error when threadId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        storage,
      });
      await expect(getMessagesPaginatedHandler({ mastra, threadId: undefined as any })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "threadId" is required' }),
      );
    });

    it('should throw error when storage is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
      });
      await expect(getMessagesPaginatedHandler({ mastra, threadId: 'test-thread' })).rejects.toThrow(
        new HTTPException(400, { message: 'Storage is not initialized' }),
      );
    });

    it('should throw 404 when thread is not found', async () => {
      const mastra = new Mastra({
        logger: false,
        storage,
      });
      storage.getThreadById = vi.fn().mockResolvedValue(null);
      await expect(getMessagesPaginatedHandler({ mastra, threadId: 'non-existent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
    });

    it('should return paginated messages for valid thread', async () => {
      const mockResult = {
        messages: [
          {
            id: 'msg-1',
            content: 'Test message',
            role: 'user',
            type: 'text',
            threadId: 'test-thread',
            resourceId: 'test-resource',
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 0,
        perPage: 10,
        hasMore: false,
      };

      const mastra = new Mastra({
        logger: false,
        storage,
      });

      storage.getThreadById = vi.fn().mockResolvedValue(createThread({}));
      storage.getMessagesPaginated = vi.fn().mockResolvedValue(mockResult);

      const result = await getMessagesPaginatedHandler({
        mastra,
        threadId: 'test-thread',
        resourceId: 'test-resource',
        format: 'v1',
      });

      expect(result).toEqual(mockResult);
      expect(storage.getThreadById).toHaveBeenCalledWith({ threadId: 'test-thread' });
      expect(storage.getMessagesPaginated).toHaveBeenCalledWith({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        selectBy: undefined,
        format: 'v1',
      });
    });
  });

  describe('deleteMessagesHandler', () => {
    it('should throw error when messageIds is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      await expect(
        deleteMessagesHandler({ mastra, messageIds: undefined as any, agentId: 'test-agent' }),
      ).rejects.toThrow(new HTTPException(400, { message: 'messageIds is required' }));
    });

    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        storage,
      });

      await expect(deleteMessagesHandler({ mastra, messageIds: ['test-message-id'] })).rejects.toThrow(
        new HTTPException(400, { message: 'Memory is not initialized' }),
      );
    });

    it('should successfully delete a single message', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      mockMemory.deleteMessages = vi.fn().mockResolvedValue(undefined);

      const result = await deleteMessagesHandler({
        mastra,
        messageIds: 'test-message-id',
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '1 message deleted successfully' });
      expect(mockMemory.deleteMessages).toHaveBeenCalledWith('test-message-id');
    });

    it('should delete multiple messages successfully', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      mockMemory.deleteMessages = vi.fn().mockResolvedValue(undefined);

      const result = await deleteMessagesHandler({
        mastra,
        messageIds: ['msg-1', 'msg-2', 'msg-3'],
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '3 messages deleted successfully' });
      expect(mockMemory.deleteMessages).toHaveBeenCalledWith(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should accept message object with id property', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      mockMemory.deleteMessages = vi.fn().mockResolvedValue(undefined);

      const result = await deleteMessagesHandler({
        mastra,
        messageIds: { id: 'test-message-id' },
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '1 message deleted successfully' });
      expect(mockMemory.deleteMessages).toHaveBeenCalledWith({ id: 'test-message-id' });
    });

    it('should accept array of message objects', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      mockMemory.deleteMessages = vi.fn().mockResolvedValue(undefined);

      const result = await deleteMessagesHandler({
        mastra,
        messageIds: [{ id: 'msg-1' }, { id: 'msg-2' }],
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '2 messages deleted successfully' });
      expect(mockMemory.deleteMessages).toHaveBeenCalledWith([{ id: 'msg-1' }, { id: 'msg-2' }]);
    });

    it('should handle errors from memory.deleteMessages', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const errorMessage = 'Database error';
      mockMemory.deleteMessages = vi.fn().mockRejectedValue(new Error(errorMessage));

      await expect(
        deleteMessagesHandler({
          mastra,
          messageIds: ['msg-1', 'msg-2'],
          agentId: 'test-agent',
        }),
      ).rejects.toThrow(errorMessage);
    });

    it('should use agent memory when agentId is provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      mockMemory.deleteMessages = vi.fn().mockResolvedValue(undefined);

      await deleteMessagesHandler({
        mastra,
        messageIds: ['msg-1', 'msg-2', 'msg-3'],
        agentId: 'test-agent',
      });

      expect(mockMemory.deleteMessages).toHaveBeenCalledWith(['msg-1', 'msg-2', 'msg-3']);
    });
  });
});
