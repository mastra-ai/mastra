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
  let mockAgent: Agent;
  let storage: MockStore;

  beforeEach(() => {
    // @ts-ignore
    mockMemory = new MastraMemory();
    mockMemory.getThreadsByResourceId = vi.fn();
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
        new HTTPException(500, { message: 'Memory is not initialized' }),
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
        new HTTPException(500, { message: 'Memory is not initialized' }),
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
      ).rejects.toThrow(new HTTPException(500, { message: 'Memory is not initialized' }));
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
      ).rejects.toThrow(new HTTPException(500, { message: 'Memory is not initialized' }));
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
        new HTTPException(500, { message: 'Memory is not initialized' }),
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
      const mastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent,
        },
      });
      const expectedResult = { messages: mockMessages, uiMessages: [] };
      mockMemory.getThreadById.mockResolvedValue(createThread({}));
      mockMemory.query.mockResolvedValue(expectedResult);

      const result = await getMessagesHandler({ mastra, threadId: 'test-thread', agentId: 'test-agent' });
      expect(result).toEqual(expectedResult);
    });
  });
});
