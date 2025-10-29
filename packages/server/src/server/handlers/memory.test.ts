import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { MastraMessageV1, MastraMessageV2 } from '@mastra/core/memory';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
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
  deleteMessagesHandler,
} from './memory';

describe('Memory Handlers', () => {
  let mockMemory: MockMemory;
  let mockAgent: Agent;
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
    mockMemory = new MockMemory({ storage });

    mockAgent = new Agent({
      name: 'test-agent',
      instructions: 'test-instructions',
      model: {} as any,
      memory: mockMemory,
    });
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
      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
        title: 'Test Thread',
      });

      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const getThreadsByResourceIdSpy = vi.spyOn(mockMemory, 'getThreadsByResourceId');

      const result = await getThreadsHandler({ mastra, resourceId: 'test-resource', agentId: 'test-agent' });

      expect(result).toEqual([
        expect.objectContaining({
          id: 'test-thread',
          resourceId: 'test-resource',
          title: 'Test Thread',
        }),
      ]);

      expect(getThreadsByResourceIdSpy).toBeCalledWith({ resourceId: 'test-resource' });
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
      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
        title: 'Test Thread',
      });

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      const getThreadsByResourceIdPaginatedSpy = vi.spyOn(mockMemory, 'getThreadsByResourceIdPaginated');

      const result = await getThreadsPaginatedHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 10,
        orderBy: 'createdAt',
        sortDirection: 'DESC',
      });

      expect(result.threads).toEqual([
        expect.objectContaining({
          id: 'test-thread',
          resourceId: 'test-resource',
          title: 'Test Thread',
        }),
      ]);

      expect(getThreadsByResourceIdPaginatedSpy).toBeCalledWith({
        resourceId: 'test-resource',
        page: 0,
        perPage: 10,
        orderBy: 'createdAt',
        sortDirection: 'DESC',
      });
    });

    it('should respect custom pagination parameters', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
        title: 'Test Thread',
      });

      const getThreadsByResourceIdPaginatedSpy = vi.spyOn(mockMemory, 'getThreadsByResourceIdPaginated');

      const result = await getThreadsPaginatedHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 20,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });

      expect(result.threads).toEqual([
        expect.objectContaining({
          id: 'test-thread',
          resourceId: 'test-resource',
          title: 'Test Thread',
        }),
      ]);

      expect(getThreadsByResourceIdPaginatedSpy).toBeCalledWith({
        resourceId: 'test-resource',
        page: 0,
        perPage: 20,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });
    });

    it('should handle sorting parameters correctly', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
        title: 'Test Thread',
      });

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread-2',
        title: 'Test Thread 2',
      });

      const getThreadsByResourceIdPaginatedSpy = vi.spyOn(mockMemory, 'getThreadsByResourceIdPaginated');

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

      expect(result.threads).toEqual([
        expect.objectContaining({
          id: 'test-thread',
          resourceId: 'test-resource',
          title: 'Test Thread',
        }),
        expect.objectContaining({
          id: 'test-thread-2',
          resourceId: 'test-resource',
          title: 'Test Thread 2',
        }),
      ]);

      expect(getThreadsByResourceIdPaginatedSpy).toBeCalledWith({
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
      await expect(getThreadByIdHandler({ mastra, threadId: 'non-existent', agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
    });

    it('should return thread when found', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
        title: 'Test Thread',
      });

      const getThreadByIdSpy = vi.spyOn(mockMemory, 'getThreadById');

      const result = await getThreadByIdHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-thread',
          resourceId: 'test-resource',
          title: 'Test Thread',
        }),
      );
      expect(getThreadByIdSpy).toBeCalledWith({ threadId: 'test-thread' });
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
      mockMemory.saveMessages({ messages: mockMessages });

      const result = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages: mockMessages },
      });
      expect(result).toEqual(mockMessages);
    });

    it('should accept, save, and retrieve messages', async () => {
      const threadId = 'test-thread-123';
      const resourceId = 'test-resource-123';
      const now = new Date();

      const v2MessageOne: MastraMessageV2 = {
        id: 'msg-v2-45687',
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

      // Create v2 message
      const v2MessageTwo: MastraMessageV2 = {
        id: 'msg-v2-456',
        role: 'assistant',
        createdAt: new Date(now.getTime() + 5000), // 1 second later
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

      await mockMemory.createThread({
        resourceId,
        threadId,
      });

      const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

      // Save both messages
      const saveResponse = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages: [v2MessageOne, v2MessageTwo] },
      });

      expect(saveResponse).toBeDefined();
      expect(saveMessagesSpy).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({ id: 'msg-v2-45687' }),
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

      // Verify message content
      expect(getResponse.messages[0]).toMatchObject({
        role: 'assistant',
        content: expect.objectContaining({
          content: 'Hello from v2 format!',
        }),
      });

      // Verify v2 message content
      expect(getResponse.messages[1]).toMatchObject({
        role: 'assistant',
        content: expect.objectContaining({
          content: 'Hello from v2 format!',
        }),
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
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const createThreadSpy = vi.spyOn(mockMemory, 'createThread');

      const result = await createThreadHandler({
        mastra,
        agentId: 'test-agent',
        body: {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          title: 'Test Thread',
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-thread',
          resourceId: 'test-resource',
          title: 'Test Thread',
        }),
      );

      expect(createThreadSpy).toBeCalledWith(
        expect.objectContaining({
          resourceId: 'test-resource',
          title: 'Test Thread',
        }),
      );
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
      await expect(getMessagesHandler({ mastra, threadId: 'non-existent', agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
    });

    it('should return messages for valid thread', async () => {
      const mockMessagesV2: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          threadId: 'test-thread',
          resourceId: 'test-resource',
          type: 'text',
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
      const expectedResult = {
        messages: mockMessagesV2,
        uiMessages: [],
        total: 1,
        page: 1,
        perPage: 10,
        hasMore: false,
      };
      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
      });

      await mockMemory.saveMessages({
        messages: mockMessagesV2,
        format: 'v2',
      });

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });
      console.log(result.messages, expectedResult.messages);
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
      expect(result.legacyMessages).toMatchObject([
        {
          content: 'Test message',
          createdAt: expect.any(Date),
          experimental_attachments: [],
          id: 'msg-1',
          parts: [{ text: 'Test message', type: 'text' }],
          role: 'user',
        },
      ]);
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
        messages: messagesV2,
        uiMessages: [],
        total: 1,
        page: 1,
        perPage: 10,
        hasMore: false,
      };

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
      });

      await mockMemory.saveMessages({
        messages: messagesV2,
        format: 'v2',
      });

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

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
      });

      await mockMemory.saveMessages({
        messages: messagesV2,
        format: 'v2',
      });

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

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
      });

      await mockMemory.saveMessages({
        messages: messagesV2,
        format: 'v2',
      });

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

      await mockMemory.createThread({
        resourceId: 'test-resource',
        threadId: 'test-thread',
      });

      await mockMemory.saveMessages({
        messages: messagesV2,
        format: 'v2',
      });

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

      const deleteMessagesSpy = vi.spyOn(mockMemory, 'deleteMessages');

      const result = await deleteMessagesHandler({
        mastra,
        messageIds: 'test-message-id',
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '1 message deleted successfully' });
      expect(deleteMessagesSpy).toHaveBeenCalledWith('test-message-id');
    });

    it('should delete multiple messages successfully', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const deleteMessagesSpy = vi.spyOn(mockMemory, 'deleteMessages');

      const result = await deleteMessagesHandler({
        mastra,
        messageIds: ['msg-1', 'msg-2', 'msg-3'],
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '3 messages deleted successfully' });
      expect(deleteMessagesSpy).toHaveBeenCalledWith(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should accept array of message objects with id property', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const deleteMessagesSpy = vi.spyOn(mockMemory, 'deleteMessages');

      const result = await deleteMessagesHandler({
        mastra,
        messageIds: [{ id: 'test-message-id' }],
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '1 message deleted successfully' });
      expect(deleteMessagesSpy).toHaveBeenCalledWith([{ id: 'test-message-id' }]);
    });

    it('should accept array of message objects', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const deleteMessagesSpy = vi.spyOn(mockMemory, 'deleteMessages');
      const result = await deleteMessagesHandler({
        mastra,
        messageIds: [{ id: 'msg-1' }, { id: 'msg-2' }],
        agentId: 'test-agent',
      });

      expect(result).toEqual({ success: true, message: '2 messages deleted successfully' });
      expect(deleteMessagesSpy).toHaveBeenCalledWith([{ id: 'msg-1' }, { id: 'msg-2' }]);
    });

    it('should handle errors from memory.deleteMessages', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const errorMessage = 'Database error';
      const deleteMessagesSpy = vi.spyOn(mockMemory, 'deleteMessages').mockRejectedValue(new Error(errorMessage));

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

      const deleteMessagesSpy = vi.spyOn(mockMemory, 'deleteMessages');

      await deleteMessagesHandler({
        mastra,
        messageIds: ['msg-1', 'msg-2', 'msg-3'],
        agentId: 'test-agent',
      });

      expect(deleteMessagesSpy).toHaveBeenCalledWith(['msg-1', 'msg-2', 'msg-3']);
    });
  });
});
