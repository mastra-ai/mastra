import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import type { MessageType } from '@mastra/core/memory';
import { MastraMemory } from '@mastra/core/memory';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  getMemoryStatusHandler,
  getThreadsHandler,
  getThreadByIdHandler,
  saveMessagesHandler,
  createThreadHandler,
  getMessagesHandler,
} from './memory';

vi.mock('@mastra/core/memory');

type MockedAbstractFn = {
  getThreadsByResourceId: Mock<MastraMemory['getThreadsByResourceId']>;
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

  beforeEach(() => {
    // @ts-ignore
    mockMemory = new MastraMemory();
    mockMemory.getThreadsByResourceId = vi.fn();
    mockMemory.getThreadById = vi.fn();
    mockMemory.query = vi.fn();
    mockMemory.saveMessages = vi.fn();
    mockMemory.createThread = vi.fn();
  });

  describe('getMemoryStatusHandler', () => {
    it('should return false when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
      });

      const result = await getMemoryStatusHandler({ mastra });
      expect(result).toEqual({ result: false });
    });

    it('should return true when memory is initialized', async () => {
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });

      const result = await getMemoryStatusHandler({ mastra });
      expect(result).toEqual({ result: true });
    });

    it('should use agent memory when agentId is provided', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test-instructions',
        model: {} as any,
        memory: mockMemory as unknown as MastraMemory,
      });
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': agent,
        },
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
      });
      await expect(getThreadsHandler({ mastra, resourceId: 'test-resource' })).rejects.toThrow(
        new HTTPException(500, { message: 'Memory is not initialized' }),
      );
    });

    it('should throw error when resourceId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      await expect(getThreadsHandler({ mastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "resourceId" is required' }),
      );
    });

    it('should return threads for valid resourceId', async () => {
      const mockThreads = [createThread({ resourceId: 'test-resource' })];
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });

      mockMemory.getThreadsByResourceId.mockResolvedValue(mockThreads);

      const result = await getThreadsHandler({ mastra, resourceId: 'test-resource' });
      expect(result).toEqual(mockThreads);
      expect(mockMemory.getThreadsByResourceId).toBeCalledWith({ resourceId: 'test-resource' });
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
      });
      await expect(getThreadByIdHandler({ mastra, threadId: 'test-thread' })).rejects.toThrow(
        new HTTPException(500, { message: 'Memory is not initialized' }),
      );
    });

    it('should throw 404 when thread is not found', async () => {
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      mockMemory.getThreadById.mockResolvedValue(null);
      await expect(getThreadByIdHandler({ mastra, threadId: 'non-existent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
    });

    it('should return thread when found', async () => {
      const mockThread = createThread({
        id: 'test-thread',
      });
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      mockMemory.getThreadById.mockResolvedValue(mockThread);

      const result = await getThreadByIdHandler({ mastra, threadId: 'test-thread' });
      expect(result).toEqual(mockThread);
      expect(mockMemory.getThreadById).toBeCalledWith({ threadId: 'test-thread' });
    });
  });

  describe('saveMessagesHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
      });
      await expect(
        saveMessagesHandler({
          mastra,
          body: { messages: [] },
        }),
      ).rejects.toThrow(new HTTPException(500, { message: 'Memory is not initialized' }));
    });

    it('should throw error when messages are not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      await expect(
        saveMessagesHandler({
          mastra,
          body: {} as { messages: MessageType[] },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Messages are required' }));
    });

    it('should throw error when messages is not an array', async () => {
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      await expect(
        saveMessagesHandler({
          mastra,
          body: { messages: 'not-an-array' as unknown as MessageType[] },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Messages should be an array' }));
    });

    it('should save messages successfully', async () => {
      const mockMessages: MessageType[] = [
        {
          id: 'test-id',
          content: 'Test message',
          role: 'user',
          createdAt: new Date(),
          threadId: 'test-thread',
          type: 'text',
        },
      ];

      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      mockMemory.saveMessages.mockResolvedValue(mockMessages);

      const result = await saveMessagesHandler({
        mastra,
        body: { messages: mockMessages },
      });
      expect(result).toEqual(mockMessages);
    });
  });

  describe('createThreadHandler', () => {
    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
      });
      await expect(
        createThreadHandler({
          mastra,
          body: { resourceId: 'test-resource' },
        }),
      ).rejects.toThrow(new HTTPException(500, { message: 'Memory is not initialized' }));
    });

    it('should throw error when resourceId is not provided', async () => {
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      await expect(
        createThreadHandler({
          mastra,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "resourceId" is required' }));
    });

    it('should create thread successfully', async () => {
      const mockThread = createThread({});
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      mockMemory.createThread.mockResolvedValue(mockThread);

      const result = await createThreadHandler({
        mastra,
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
        memory: mockMemory as unknown as MastraMemory,
      });
      await expect(getMessagesHandler({ mastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Argument "threadId" is required' }),
      );
    });

    it('should throw error when memory is not initialized', async () => {
      const mastra = new Mastra({
        logger: false,
      });
      await expect(getMessagesHandler({ mastra, threadId: 'test-thread' })).rejects.toThrow(
        new HTTPException(500, { message: 'Memory is not initialized' }),
      );
    });

    it('should throw 404 when thread is not found', async () => {
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      mockMemory.getThreadById.mockResolvedValue(null);
      await expect(getMessagesHandler({ mastra, threadId: 'non-existent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Thread not found' }),
      );
    });

    it('should return messages for valid thread', async () => {
      const mockMessages: CoreMessage[] = [{ role: 'user', content: 'Test message' }];
      const mastra = new Mastra({
        logger: false,
        memory: mockMemory as unknown as MastraMemory,
      });
      const expectedResult = { messages: mockMessages, uiMessages: [] };
      mockMemory.getThreadById.mockResolvedValue(createThread({}));
      mockMemory.query.mockResolvedValue(expectedResult);

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread' });
      expect(result).toEqual(expectedResult);
    });
  });
});
