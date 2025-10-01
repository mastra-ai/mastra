import { openai } from '@ai-sdk/openai';
import type { Task, MessageSendParams } from '@mastra/core/a2a';
import { MastraA2AError } from '@mastra/core/a2a';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { MastraStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTaskStore } from '../a2a/store';
import {
  getAgentCardByIdHandler,
  handleTaskGet,
  handleMessageSend,
  handleMessageStream,
  handleTaskCancel,
} from './a2a';

class MockAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);

    this.generate = vi.fn();
    this.stream = vi.fn();
    this.__updateInstructions = vi.fn();
  }

  generate(args: any) {
    return this.generate(args);
  }

  stream(args: any) {
    return this.stream(args);
  }

  __updateInstructions(args: any) {
    return this.__updateInstructions(args);
  }
}

function createMockMastra(agents: Record<string, Agent>) {
  return new Mastra({
    logger: false,
    agents: agents,
    storage: {
      init: vi.fn(),
      __setTelemetry: vi.fn(),
      __setLogger: vi.fn(),
      getEvalsByAgentName: vi.fn(),
      getStorage: () => {
        return {
          getEvalsByAgentName: vi.fn(),
        };
      },
    } as unknown as MastraStorage,
  });
}

describe('A2A Handler', () => {
  describe('getAgentCardByIdHandler', () => {
    let mockMastra: Mastra;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });
    });

    it('should return the agent card', async () => {
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        runtimeContext: new RuntimeContext(),
        agentId: 'test-agent',
      });
      expect(agentCard).toMatchInlineSnapshot(`
        {
          "capabilities": {
            "pushNotifications": false,
            "stateTransitionHistory": false,
            "streaming": true,
          },
          "defaultInputModes": [
            "text",
          ],
          "defaultOutputModes": [
            "text",
          ],
          "description": "test instructions",
          "name": "test-agent",
          "provider": {
            "organization": "Mastra",
            "url": "https://mastra.ai",
          },
          "skills": [],
          "url": "/a2a/test-agent",
          "version": "1.0",
        }
      `);
    });

    it('should allow custom execution URL', async () => {
      const customUrl = '/custom/execution/url';
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        runtimeContext: new RuntimeContext(),
        agentId: 'test-agent',
        executionUrl: customUrl,
      });
      expect(agentCard.url).toBe(customUrl);
    });

    it('should allow custom provider details', async () => {
      const customProvider = {
        organization: 'Custom Org',
        url: 'https://custom.org',
      };
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        runtimeContext: new RuntimeContext(),
        agentId: 'test-agent',
        provider: customProvider,
      });
      expect(agentCard.provider).toEqual(customProvider);
    });

    it('should allow custom version', async () => {
      const customVersion = '2.0';
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        runtimeContext: new RuntimeContext(),
        agentId: 'test-agent',
        version: customVersion,
      });
      expect(agentCard.version).toBe(customVersion);
    });
  });

  describe('handleMessageSend', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      vi.useFakeTimers();
      const mockAgent = new MockAgent({
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });

      mockTaskStore = new InMemoryTaskStore();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should successfully process a task and save it', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgent(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const runtimeContext = new RuntimeContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        runtimeContext,
      });

      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: expect.any(String),
          contextId: expect.any(String),
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Hello, user!',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          history: [
            {
              kind: 'message',
              messageId: 'test-message-id',
              parts: [
                {
                  text: 'Hello, agent!',
                  kind: 'text',
                },
              ],
              role: 'user',
            },
          ],
          kind: 'task',
        },
      });
    });

    it('should handle errors from agent.generate and save failed state', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const errorMessage = 'Agent failed!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgent(agentId);
      // @ts-expect-error - mockRejectedValue is not available on the Agent class
      mockAgent.generate.mockRejectedValue(new Error(errorMessage));
      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        runtimeContext: new RuntimeContext(),
      });

      // Because the a2a spec requires the server to create the the taskId, we don't know the id
      // to query the store with, so we just check the internal store directly
      const store = Array.from((mockTaskStore as any).store.values());
      expect(store.length).toBe(1);

      const task = store[0] as Task;
      expect(task?.status.state).toBe('failed');
      // @ts-expect-error - error is not always available but we know it is
      result.error.data.stack = result.error?.data.stack.split('\n')[0];
      expect(result).toMatchInlineSnapshot(`
        {
          "error": {
            "code": -32603,
            "data": {
              "stack": "Error: Agent failed!",
            },
            "message": "Agent failed!",
          },
          "id": "test-request-id",
          "jsonrpc": "2.0",
        }
      `);
    });

    it('should update an existing task and append new message/history', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Follow-up message!';
      const agentResponseText = 'Follow-up response!';
      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };
      // Existing task/history

      const existingTask: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'completed' as const,
          message: {
            messageId,
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Old response' }],
          },
          timestamp: new Date('2025-05-07T12:00:00.000Z').toISOString(),
        },
        artifacts: [],
        history: [
          {
            kind: 'message',
            messageId: 'test-history-message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Old message' }],
          },
          {
            kind: 'message',
            messageId: 'test-history-response',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Old response' }],
          },
        ],
        metadata: undefined,
        kind: 'task',
      };

      // Use real InMemoryTaskStore
      await mockTaskStore.save({ agentId, data: existingTask });

      const mockAgent = mockMastra.getAgent(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });
      vi.setSystemTime(new Date('2025-05-08T12:00:00.000Z'));

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        runtimeContext: new RuntimeContext(),
      });

      const task = await mockTaskStore.load({ agentId, taskId });
      expect(task?.status.state).toBe('completed');
      expect(result?.result?.status.timestamp).not.toBe(existingTask.status.timestamp);
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: expect.any(String),
          contextId: expect.any(String),
          history: [
            {
              kind: 'message',
              messageId: 'test-message-id',
              parts: [
                {
                  kind: 'text',
                  text: 'Follow-up message!',
                },
              ],
              role: 'user',
            },
          ],
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Follow-up response!',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'completed',
            timestamp: '2025-05-08T12:00:00.000Z',
          },
          kind: 'task',
        },
      });
    });
  });

  describe('handleMessageStream', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });
      mockMastra = createMockMastra({ 'test-agent': mockAgent });
      mockTaskStore = new InMemoryTaskStore();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should yield working state and then completed result', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgent(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        runtimeContext: new RuntimeContext(),
      });

      const first = await gen.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          message: {
            messageId: expect.any(String),
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Generating response...' }],
          },
          state: 'working',
        },
      });

      const second = await gen.next();
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: expect.any(String),
          contextId: expect.any(String),
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Hello, user!',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          history: [
            {
              kind: 'message',
              messageId: 'test-message-id',
              parts: [
                {
                  kind: 'text',
                  text: 'Hello, agent!',
                },
              ],
              role: 'user',
            },
          ],
          kind: 'task',
        },
      });
      expect(second.done).toBe(false);

      // The generator should be done after two yields
      const done = await gen.next();
      expect(done.done).toBe(true);
    });

    it('should yield working state and then error if agent fails', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const errorMessage = 'Agent failed!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgent(agentId);
      // @ts-expect-error - mockRejectedValue is not available on the Agent class
      mockAgent.generate.mockRejectedValue(new Error(errorMessage));

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        runtimeContext: new RuntimeContext(),
      });

      const first = await gen.next();
      expect(first.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          state: 'working',
          message: {
            role: 'agent',
            parts: [{ kind: 'text', text: 'Generating response...' }],
          },
        },
      });

      const second = await gen.next();
      expect(second.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        error: {
          message: errorMessage,
        },
      });
      expect(second.done).toBe(false);

      const done = await gen.next();
      expect(done.done).toBe(true);
    });
  });

  describe('handleTaskGet', () => {
    it('should return the task', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const mockTaskStore = new InMemoryTaskStore();
      const task: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'completed',
          message: {
            messageId,
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Hello, user!' }],
          },
          timestamp: new Date('2025-05-08T11:47:38.458Z').toISOString(),
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };
      await mockTaskStore.save({ agentId, data: task });

      const result = await handleTaskGet({
        requestId,
        taskStore: mockTaskStore,
        agentId,
        taskId,
      });

      expect(result!.result).toEqual(task);
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: 'test-task-id',
          contextId: expect.any(String),
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Hello, user!',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          kind: 'task',
        },
      });
    });

    it('should return an error when task cannot be found', async () => {
      const requestId = 'test-request-id';
      const nonExistentTaskId = 'non-existent-task-id';
      const agentId = 'test-agent';

      const mockTaskStore = new InMemoryTaskStore();
      await expect(
        handleTaskGet({
          requestId,
          taskStore: mockTaskStore,
          agentId,
          taskId: nonExistentTaskId,
        }),
      ).rejects.toThrow(MastraA2AError.taskNotFound(nonExistentTaskId));
    });
  });

  describe('handleTaskCancel', () => {
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      mockTaskStore = new InMemoryTaskStore();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should successfully cancel a task in a non-final state', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const task: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'working',
          message: { messageId, kind: 'message', role: 'agent', parts: [{ kind: 'text', text: 'Working...' }] },
          timestamp: new Date('2025-05-08T11:47:38.458Z').toISOString(),
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId, data: task });
      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const result = await handleTaskCancel({
        requestId,
        taskStore: mockTaskStore,
        agentId,
        taskId,
      });

      // Verify task was updated to canceled state
      const updatedData = await mockTaskStore.load({ agentId, taskId });
      expect(updatedData?.status.state).toBe('canceled');
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: expect.any(String),
          contextId: expect.any(String),
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Task cancelled by request.',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'canceled',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          kind: 'task',
        },
      });
    });

    it('should not cancel a task in a final state', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const task: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'completed',
          message: { messageId, kind: 'message', role: 'agent', parts: [{ kind: 'text', text: 'Done!' }] },
          timestamp: new Date('2025-05-08T11:47:38.458Z').toISOString(),
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId, data: task });

      const result = await handleTaskCancel({
        requestId,
        taskStore: mockTaskStore,
        agentId,
        taskId,
      });

      // Verify task remained in completed state
      const updatedData = await mockTaskStore.load({ agentId, taskId });
      expect(updatedData?.status.state).toBe('completed');
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: expect.any(String),
          contextId: expect.any(String),
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Done!',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          kind: 'task',
        },
      });
    });

    it('should throw error when canceling non-existent task', async () => {
      const requestId = 'test-request-id';
      const nonExistentTaskId = 'non-existent-task-id';
      const agentId = 'test-agent';

      await expect(
        handleTaskCancel({
          requestId,
          taskStore: mockTaskStore,
          agentId,
          taskId: nonExistentTaskId,
        }),
      ).rejects.toThrow(MastraA2AError.taskNotFound(nonExistentTaskId));
    });
  });
});
