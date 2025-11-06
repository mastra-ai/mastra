import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { MastraMessageV1, MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  getMemoryStatusHandler,
  listThreadsHandler,
  getThreadByIdHandler,
  saveMessagesHandler,
  createThreadHandler,
  listMessagesHandler,
  deleteMessagesHandler,
} from './memory';

function createThread(overrides?: Partial<StorageThreadType>): StorageThreadType {
  const now = new Date();
  return {
    id: 'test-thread-id',
    resourceId: 'test-resource',
    title: 'Test Thread',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function getTextContent(message: MastraDBMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content && typeof message.content === 'object' && 'parts' in message.content) {
    const textPart = message.content.parts.find((p: any) => p.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

describe('Memory Handlers', () => {
  let mockMemory: MockMemory;
  let mockAgent: Agent;
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
    mockMemory = new MockMemory({ storage });

    mockAgent = new Agent({
      id: 'test-agent',
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

  describe('listThreadsHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': new Agent({
            id: 'test-agent',
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(
        listThreadsHandler({
          mastra,
          resourceId: 'test-resource',
          agentId: 'test-agent',
          page: 0,
          perPage: 10,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Memory is not initialized' }));
    });

    it('should throw error when resourceId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });
      await expect(
        listThreadsHandler({
          mastra,
          agentId: 'test-agent',
          page: 0,
          perPage: 10,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "resourceId" is required' }));
    });

    it('should return paginated threads with default parameters', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      await mockMemory.createThread({ resourceId: 'test-resource' });

      const spy = vi.spyOn(mockMemory, 'listThreadsByResourceId');

      const result = await listThreadsHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 10,
      });

      expect(result.total).toEqual(1);
      expect(result.page).toEqual(0);
      expect(result.perPage).toEqual(10);
      expect(result.hasMore).toEqual(false);
      expect(result.threads).toHaveLength(1);

      expect(spy).toBeCalledWith({
        resourceId: 'test-resource',
        page: 0,
        perPage: 10,
        orderBy: undefined,
      });
    });

    it('should respect custom pagination parameters', async () => {
      // Create a thread via mockMemory
      await mockMemory.createThread({ threadId: 'test-thread-1', resourceId: 'test-resource' });

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      const spy = vi.spyOn(mockMemory, 'listThreadsByResourceId');

      const result = await listThreadsHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 20,
        orderBy: { field: 'updatedAt', direction: 'ASC' },
      });

      expect(result.threads).toHaveLength(1);
      expect(spy).toHaveBeenCalledWith({
        resourceId: 'test-resource',
        page: 0,
        perPage: 20,
        orderBy: { field: 'updatedAt', direction: 'ASC' },
      });
    });

    it('should handle sorting parameters correctly', async () => {
      // Create threads via mockMemory
      await mockMemory.createThread({ threadId: '1', resourceId: 'test-resource', title: 'Thread 1' });
      await mockMemory.createThread({ threadId: '2', resourceId: 'test-resource', title: 'Thread 2' });

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      const spy = vi.spyOn(mockMemory, 'listThreadsByResourceId');

      // Test updatedAt DESC sorting
      const result = await listThreadsHandler({
        mastra,
        resourceId: 'test-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 10,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });

      expect(result.threads).toHaveLength(2);
      expect(spy).toHaveBeenCalledWith({
        resourceId: 'test-resource',
        page: 0,
        perPage: 10,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });
    });

    it('should handle edge cases with no threads', async () => {
      // Don't create any threads - test empty result
      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': mockAgent },
      });

      const spy = vi.spyOn(mockMemory, 'listThreadsByResourceId');

      const result = await listThreadsHandler({
        mastra,
        resourceId: 'non-existent-resource',
        agentId: 'test-agent',
        page: 0,
        perPage: 10,
      });

      expect(result.threads).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(spy).toHaveBeenCalled();
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
            id: 'test-agent',
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
      const spy = vi.spyOn(mockMemory, 'getThreadById');

      await expect(getThreadByIdHandler({ mastra, threadId: 'non-existent', agentId: 'test-agent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
      expect(spy).toHaveBeenCalledWith({ threadId: 'non-existent' });
    });

    it('should return thread when found', async () => {
      // Create thread via mockMemory
      const createdThread = await mockMemory.createThread({ threadId: 'test-thread', resourceId: 'test-resource' });

      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      const spy = vi.spyOn(mockMemory, 'getThreadById');

      const result = await getThreadByIdHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });
      expect(result).toEqual(createdThread);
      expect(spy).toHaveBeenCalledWith({ threadId: 'test-thread' });
    });
  });

  describe('saveMessagesHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': new Agent({
            id: 'test-agent',
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
          body: {} as { messages: MastraDBMessage[] },
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
          body: { messages: 'not-an-array' as unknown as MastraDBMessage[] },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Messages should be an array' }));
    });

    it('should save messages successfully', async () => {
      // Create thread first
      await mockMemory.createThread({ threadId: 'test-thread', resourceId: 'test-resource' });

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
      const spy = vi.spyOn(mockMemory, 'saveMessages');

      const result = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages: mockMessages },
      });
      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalled();
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
      const v2Message: MastraDBMessage = {
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

      // Create thread first
      await mockMemory.createThread({ threadId, resourceId });

      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });

      const saveSpy = vi.spyOn(mockMemory, 'saveMessages');
      vi.spyOn(mockMemory, 'getThreadById');
      vi.spyOn(mockMemory, 'recall');

      // Save both messages
      const saveResponse = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages: [v1Message, v2Message] },
      });

      expect(saveResponse).toBeDefined();
      expect(saveSpy).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({ id: 'msg-v1-123' }),
          expect.objectContaining({ id: 'msg-v2-456' }),
        ]),
        memoryConfig: {},
      });

      // Retrieve messages
      const getResponse = await listMessagesHandler({
        mastra,
        threadId,
        resourceId,
        agentId: 'test-agent',
      });

      // Verify both messages are returned
      expect(getResponse.messages).toHaveLength(2);

      // Verify v1 message content
      expect(getResponse.messages[0].role).toBe('user');
      expect(getTextContent(getResponse.messages[0])).toBe('Hello from v1 format!');

      // Verify v2 message content
      expect(getResponse.messages[1].role).toBe('assistant');
      expect(getTextContent(getResponse.messages[1])).toBe('Hello from v2 format!');
    });

    it('should handle mixed v1 and v2 messages in single request', async () => {
      const threadId = 'test-thread-mixed';
      const resourceId = 'test-resource-mixed';
      const baseTime = new Date();

      // Create thread first
      await mockMemory.createThread({ threadId, resourceId });

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
        } as MastraDBMessage,
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
        } as MastraDBMessage,
      ];

      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });

      const spy = vi.spyOn(mockMemory, 'saveMessages');

      // Save mixed messages
      const saveResponse = await saveMessagesHandler({
        mastra,
        agentId: 'test-agent',
        body: { messages },
      });

      expect(saveResponse).toBeDefined();
      expect(spy).toHaveBeenCalledWith({
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
            id: 'test-agent',
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
      const spy = vi.spyOn(mockMemory, 'createThread');

      const result = await createThreadHandler({
        mastra,
        agentId: 'test-agent',
        body: {
          resourceId: 'test-resource',
          title: 'Test Thread',
        },
      });
      expect(result).toBeDefined();
      expect(result.resourceId).toBe('test-resource');
      expect(result.title).toBe('Test Thread');
      expect(spy).toHaveBeenCalledWith({
        resourceId: 'test-resource',
        title: 'Test Thread',
      });
    });
  });

  describe('listMessagesHandler', () => {
    it('should throw error when threadId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });
      await expect(listMessagesHandler({ mastra, threadId: undefined as any })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "threadId" is required' }),
      );
    });

    it('should throw error when storage is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          testAgent: new Agent({
            id: 'test-agent',
            name: 'test-agent',
            instructions: 'test-instructions',
            model: {} as any,
          }),
        },
      });
      await expect(listMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'testAgent' })).rejects.toThrow(
        new HTTPException(400, { message: 'Memory is not initialized' }),
      );
    });

    it('should throw 404 when thread is not found', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });
      vi.spyOn(storage, 'getThreadById').mockResolvedValue(null);
      await expect(listMessagesHandler({ mastra, threadId: 'non-existent', agentId: 'test-agent' })).rejects.toThrow(
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
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });

      vi.spyOn(storage, 'getThreadById').mockResolvedValue(createThread({}));
      vi.spyOn(storage, 'listMessages').mockResolvedValue(mockResult);

      const result = await listMessagesHandler({
        mastra,
        threadId: 'test-thread',
        resourceId: 'test-resource',
        agentId: 'test-agent',
        perPage: 10,
        page: 0,
        orderBy: undefined,
        include: undefined,
        filter: undefined,
      });

      expect(result).toEqual(mockResult);
      expect(storage.getThreadById).toHaveBeenCalledWith({ threadId: 'test-thread' });
      expect(storage.listMessages).toHaveBeenCalledWith({
        threadId: 'test-thread',
        resourceId: 'test-resource',
        perPage: 10,
        page: 0,
        orderBy: undefined,
        include: undefined,
        filter: undefined,
      });
    });

    it('should preserve custom metadata in messages when loading messages with metadata', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });

      // Create a V2 message with custom metadata (simulating what the client sends)
      const messagesV2: MastraDBMessage[] = [
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

      const threadId = 'test-thread';
      const resourceId = 'test-resource';

      // Create thread and save messages
      await mockMemory.createThread({ threadId, resourceId });
      await mockMemory.saveMessages({
        messages: messagesV2,
      });

      vi.spyOn(mockMemory, 'getThreadById');
      vi.spyOn(mockMemory, 'recall');

      const result = await listMessagesHandler({
        mastra,
        threadId,
        resourceId: 'test-resource',
        agentId: 'test-agent',
      });

      // Verify that messages contains the custom metadata
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.content.metadata).toMatchObject({
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
      expect(result.messages[0]).toHaveProperty('createdAt');
      expect(result.messages[0]).toHaveProperty('threadId', 'test-thread');
      expect(result.messages[0]).toHaveProperty('resourceId', 'test-resource');
    });

    it('should handle messages with tool invocations correctly', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });

      const messagesV2: MastraDBMessage[] = [
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

      const threadId = 'test-thread';
      const resourceId = 'test-resource';

      // Create thread and save messages
      await mockMemory.createThread({ threadId, resourceId });
      await mockMemory.saveMessages({
        messages: messagesV2,
      });

      vi.spyOn(mockMemory, 'getThreadById');
      vi.spyOn(mockMemory, 'recall');

      const result = await listMessagesHandler({
        mastra,
        threadId,
        resourceId: 'test-resource',
        agentId: 'test-agent',
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe('assistant');
      expect(result.messages[0]?.content.parts).toHaveLength(1);
      expect(result.messages[0]?.content.parts[0]?.type).toBe('tool-invocation');
      expect(result.messages[0]?.content.toolInvocations).toHaveLength(1);
      expect(result.messages[0]?.content.toolInvocations?.[0]?.toolName).toBe('searchTool');
    });

    it('should handle multi-part messages (text + images) correctly', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });

      const messagesV2: MastraDBMessage[] = [
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
              { type: 'file', mimeType: 'image/png', data: 'data:image/png;base64,base64data' },
            ],
            content: 'Check this image',
            metadata: {
              imageSource: 'upload',
            },
          },
        },
      ];

      const threadId = 'test-thread';
      const resourceId = 'test-resource';

      // Create thread and save messages
      await mockMemory.createThread({ threadId, resourceId });
      await mockMemory.saveMessages({
        messages: messagesV2,
      });

      vi.spyOn(mockMemory, 'getThreadById');
      vi.spyOn(mockMemory, 'recall');

      const result = await listMessagesHandler({
        mastra,
        threadId,
        resourceId: 'test-resource',
        agentId: 'test-agent',
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.content.parts).toHaveLength(2);
      expect(result.messages[0]?.content.parts[0]?.type).toBe('text');
      expect(result.messages[0]?.content.parts[1]?.type).toBe('file');
      // Custom metadata should be preserved
      expect(result.messages[0]?.content.metadata).toHaveProperty('imageSource', 'upload');
    });

    it('should handle conversation with multiple messages and mixed metadata', async () => {
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
        storage,
      });

      const messagesV2: MastraDBMessage[] = [
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

      const threadId = 'test-thread';
      const resourceId = 'test-resource';

      // Create thread and save messages
      await mockMemory.createThread({ threadId, resourceId });
      await mockMemory.saveMessages({
        messages: messagesV2,
      });

      vi.spyOn(mockMemory, 'getThreadById');
      vi.spyOn(mockMemory, 'recall');

      const result = await listMessagesHandler({
        mastra,
        threadId,
        resourceId: 'test-resource',
        agentId: 'test-agent',
      });

      expect(result.messages).toHaveLength(3);

      // First message should have custom metadata
      expect(result.messages[0]?.content.metadata).toHaveProperty('sessionId', 'session-1');

      // Second message should NOT have custom metadata
      expect(result.messages[1]?.content.metadata).toBeUndefined();

      // Third message should have its own custom metadata
      expect(result.messages[2]?.content.metadata).toHaveProperty('referenceId', 'ref-123');
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
