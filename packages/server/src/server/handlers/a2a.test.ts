import { openai } from '@ai-sdk/openai';
import type { Task, MessageSendParams } from '@mastra/core/a2a';
import { MastraA2AError } from '@mastra/core/a2a';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTaskStore } from '../a2a/store';
import {
  AGENT_EXECUTION_ROUTE,
  GET_AGENT_CARD_ROUTE,
  getAgentCardByIdHandler,
  getAgentExecutionHandler,
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
        id: 'test-agent',
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
        requestContext: new RequestContext(),
        agentId: 'test-agent',
      });
      expect(agentCard).toMatchInlineSnapshot(`
        {
          "additionalInterfaces": [],
          "capabilities": {
            "extensions": [],
            "pushNotifications": false,
            "stateTransitionHistory": false,
            "streaming": true,
          },
          "defaultInputModes": [
            "text/plain",
          ],
          "defaultOutputModes": [
            "text/plain",
          ],
          "description": "test instructions",
          "name": "test-agent",
          "protocolVersion": "0.3.0",
          "provider": {
            "organization": "Mastra",
            "url": "https://mastra.ai",
          },
          "security": [],
          "securitySchemes": {},
          "skills": [],
          "supportsAuthenticatedExtendedCard": false,
          "url": "/a2a/test-agent",
          "version": "1.0",
        }
      `);
    });

    it('should allow custom execution URL', async () => {
      const customUrl = '/custom/execution/url';
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
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
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        provider: customProvider,
      });
      expect(agentCard.provider).toEqual(customProvider);
    });

    it('should allow custom version', async () => {
      const customVersion = '2.0';
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        version: customVersion,
      });
      expect(agentCard.version).toBe(customVersion);
    });

    it('should build an absolute execution url when request context is available', async () => {
      const response = await GET_AGENT_CARD_ROUTE.handler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        abortSignal: AbortSignal.abort(),
        routePrefix: '/api',
        request: new Request('http://localhost:4111/api/.well-known/test-agent/agent-card.json', {
          headers: {
            host: 'localhost:4111',
          },
        }),
      } as any);

      expect(response.url).toBe('http://localhost:4111/api/a2a/test-agent');
    });
  });

  describe('handleMessageSend', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      vi.useFakeTimers();
      const mockAgent = new MockAgent({
        id: 'test-agent',
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

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const requestContext = new RequestContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [
            {
              artifactId: expect.stringContaining(':response'),
              name: 'response.txt',
              parts: [
                {
                  text: 'Hello, user!',
                  kind: 'text',
                },
              ],
            },
          ],
          id: expect.any(String),
          contextId: expect.any(String),
          metadata: {
            execution: {
              toolCalls: undefined,
              toolResults: undefined,
              usage: undefined,
              finishReason: undefined,
            },
          },
          status: {
            message: undefined,
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

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockRejectedValue is not available on the Agent class
      mockAgent.generate.mockRejectedValue(new Error(errorMessage));
      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
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

    it('should pass contextId as threadId and agentId as resourceId to agent.generate for memory', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId, // Include contextId to test memory integration
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with threadId and resourceId (defaults to agentId)
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: agentId,
        }),
      );
    });

    it('should allow user to pass resourceId via params metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'custom-user-resource';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
        },
        metadata: {
          resourceId: customResourceId, // User-provided resourceId
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with user-provided resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should allow user to pass resourceId via message metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'custom-message-resource';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
          metadata: {
            resourceId: customResourceId, // User-provided resourceId in message
          },
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with user-provided resourceId from message
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should prefer params metadata resourceId over message metadata resourceId', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const paramsResourceId = 'params-resource';
      const messageResourceId = 'message-resource';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
          metadata: {
            resourceId: messageResourceId,
          },
        },
        metadata: {
          resourceId: paramsResourceId, // Should take precedence
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that params metadata resourceId takes precedence
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: paramsResourceId,
        }),
      );
    });

    it('should allow user to pass custom resourceId via params metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'custom-user-resource-id';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
        },
        metadata: {
          resourceId: customResourceId, // User-provided resourceId
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with the custom resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should allow user to pass custom resourceId via message metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'message-level-resource-id';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
          metadata: {
            resourceId: customResourceId, // User-provided resourceId at message level
          },
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with the custom resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should not pass threadId/resourceId when contextId is not provided', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          // No contextId
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was NOT called with threadId/resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.not.objectContaining({
          threadId: expect.any(String),
        }),
      );
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

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });
      vi.setSystemTime(new Date('2025-05-08T12:00:00.000Z'));

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const task = await mockTaskStore.load({ agentId, taskId });
      expect(task?.status.state).toBe('completed');
      expect(result?.result?.status.timestamp).not.toBe(existingTask.status.timestamp);
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [
            {
              artifactId: expect.stringContaining(':response'),
              name: 'response.txt',
              parts: [
                {
                  text: 'Follow-up response!',
                  kind: 'text',
                },
              ],
            },
          ],
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
          metadata: {
            execution: {
              toolCalls: undefined,
              toolResults: undefined,
              usage: undefined,
              finishReason: undefined,
            },
          },
          status: {
            message: undefined,
            state: 'completed',
            timestamp: '2025-05-08T12:00:00.000Z',
          },
          kind: 'task',
        },
      });
    });

    it('should store execution details (toolCalls, toolResults, usage) in task metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Create a chart';
      const agentResponseText = 'Here is your chart';

      const mockExecutionData = {
        text: agentResponseText,
        toolCalls: [
          {
            toolCallId: 'call_123',
            toolName: 'createChart',
            args: { data: 'sales data' },
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_123',
            toolName: 'createChart',
            result: { chartUrl: 'https://example.com/chart.png' },
          },
        ],
        usage: {
          promptTokens: 150,
          completionTokens: 200,
          totalTokens: 350,
        },
        finishReason: 'stop',
      };

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue(mockExecutionData);

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const requestContext = new RequestContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify the execution metadata is stored
      expect(result.result?.metadata).toEqual({
        execution: {
          toolCalls: mockExecutionData.toolCalls,
          toolResults: mockExecutionData.toolResults,
          usage: mockExecutionData.usage,
          finishReason: mockExecutionData.finishReason,
        },
      });

      // Verify the task was saved with the metadata
      const taskId = result.result?.id;
      if (!taskId) {
        throw new Error('Task ID is required');
      }
      const savedTask = await mockTaskStore.load({ agentId, taskId });
      expect(savedTask?.metadata).toEqual({
        execution: {
          toolCalls: mockExecutionData.toolCalls,
          toolResults: mockExecutionData.toolResults,
          usage: mockExecutionData.usage,
          finishReason: mockExecutionData.finishReason,
        },
      });
    });

    it('should preserve existing metadata when adding execution details', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello';
      const agentResponseText = 'Hi there';

      const existingMetadata = {
        customField: 'custom value',
        anotherField: 123,
      };

      const mockExecutionData = {
        text: agentResponseText,
        toolCalls: [],
        toolResults: [],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
      };

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
        metadata: existingMetadata,
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue(mockExecutionData);

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const requestContext = new RequestContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify both existing metadata and execution metadata are present
      expect(result.result?.metadata).toEqual({
        ...existingMetadata,
        execution: {
          toolCalls: mockExecutionData.toolCalls,
          toolResults: mockExecutionData.toolResults,
          usage: mockExecutionData.usage,
          finishReason: mockExecutionData.finishReason,
        },
      });
    });
  });

  describe('handleMessageStream', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        id: 'test-agent',
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

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const first = await gen.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          contextId: expect.any(String),
          history: [
            {
              kind: 'message',
              messageId: 'test-message-id',
              parts: [{ kind: 'text', text: 'Hello, agent!' }],
              role: 'user',
            },
          ],
          id: expect.any(String),
          kind: 'task',
          metadata: undefined,
          status: {
            message: {
              kind: 'message',
              messageId: expect.any(String),
              parts: [{ kind: 'text', text: 'Generating response...' }],
              role: 'agent',
            },
            state: 'working',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
        },
      });

      const second = await gen.next();
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: expect.stringContaining(':response'),
            name: 'response.txt',
            parts: [
              {
                text: 'Hello, user!',
                kind: 'text',
              },
            ],
          },
          contextId: first.value?.result.contextId,
          kind: 'artifact-update',
          lastChunk: true,
          taskId: first.value?.result.id,
        },
      });
      expect(second.done).toBe(false);

      const third = await gen.next();
      expect(third.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: first.value?.result.contextId,
          final: true,
          kind: 'status-update',
          status: {
            message: undefined,
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          taskId: first.value?.result.id,
        },
      });
      expect(third.done).toBe(false);

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

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockRejectedValue is not available on the Agent class
      mockAgent.generate.mockRejectedValue(new Error(errorMessage));

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const first = await gen.next();
      expect(first.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          kind: 'task',
          status: {
            state: 'working',
            message: {
              role: 'agent',
              parts: [{ kind: 'text', text: 'Generating response...' }],
            },
          },
        },
      });

      const second = await gen.next();
      expect(second.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          final: true,
          kind: 'status-update',
          status: {
            state: 'failed',
            message: {
              parts: [{ kind: 'text', text: `Handler failed: ${errorMessage}` }],
            },
          },
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

  describe('getAgentExecutionHandler', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });
      mockTaskStore = new InMemoryTaskStore();
    });

    it('returns push notification not supported for new push config methods', async () => {
      const methods = [
        {
          method: 'tasks/pushNotificationConfig/set',
          params: { taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com' } },
        },
        { method: 'tasks/pushNotificationConfig/get', params: { id: 'task-1' } },
        { method: 'tasks/pushNotificationConfig/list', params: { id: 'task-1' } },
        { method: 'tasks/pushNotificationConfig/delete', params: { id: 'task-1', pushNotificationConfigId: 'push-1' } },
      ] as const;

      for (const entry of methods) {
        const result = await getAgentExecutionHandler({
          requestId: 'test-request-id',
          mastra: mockMastra,
          agentId: 'test-agent',
          requestContext: new RequestContext(),
          method: entry.method as any,
          params: entry.params as any,
          taskStore: mockTaskStore,
        });

        expect(result).toMatchObject({
          error: {
            code: -32003,
            message: 'Push Notification is not supported',
          },
          id: 'test-request-id',
          jsonrpc: '2.0',
        });
      }
    });

    it('returns authenticated extended card not configured for agent/getAuthenticatedExtendedCard', async () => {
      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'agent/getAuthenticatedExtendedCard' as any,
        params: undefined as any,
        taskStore: mockTaskStore,
      });

      expect(result).toMatchObject({
        error: {
          code: -32007,
          message: 'Extended agent card is not configured',
        },
        id: 'test-request-id',
        jsonrpc: '2.0',
      });
    });

    it('resubscribes to an existing terminal task as a final status update event', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'completed',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Done!' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
      });

      const first = await result.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: 'context-1',
          final: true,
          kind: 'status-update',
          status: {
            message: {
              kind: 'message',
              messageId: 'message-1',
              parts: [{ kind: 'text', text: 'Done!' }],
              role: 'agent',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          taskId: 'task-1',
        },
      });

      const done = await result.next();
      expect(done.done).toBe(true);
    });

    it('keeps the stream open for non-terminal tasks until a later update is saved', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'working',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Still working...' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
      });

      const first = await result.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: 'context-1',
          final: false,
          kind: 'status-update',
          status: {
            message: {
              kind: 'message',
              messageId: 'message-1',
              parts: [{ kind: 'text', text: 'Still working...' }],
              role: 'agent',
            },
            state: 'working',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          taskId: 'task-1',
        },
      });

      const secondPromise = result.next();
      await expect(Promise.race([secondPromise.then(() => 'resolved'), Promise.resolve('pending')])).resolves.toBe(
        'pending',
      );

      await mockTaskStore.save({
        agentId: 'test-agent',
        data: {
          ...task,
          status: {
            state: 'completed',
            message: {
              messageId: 'message-2',
              kind: 'message',
              role: 'agent',
              parts: [{ kind: 'text', text: 'Done!' }],
            },
            timestamp: '2025-05-08T11:48:38.458Z',
          },
        },
      });

      const second = await secondPromise;
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: 'context-1',
          final: true,
          kind: 'status-update',
          status: {
            message: {
              kind: 'message',
              messageId: 'message-2',
              parts: [{ kind: 'text', text: 'Done!' }],
              role: 'agent',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:48:38.458Z',
          },
          taskId: 'task-1',
        },
      });

      const done = await result.next();
      expect(done.done).toBe(true);
    });

    it('unregisters resubscribe listeners when the abort signal is triggered', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'working',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Still working...' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const abortController = new AbortController();
      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
        abortSignal: abortController.signal,
      });

      const first = await result.next();
      expect(first.value).toMatchObject({
        result: {
          final: false,
          kind: 'status-update',
          taskId: 'task-1',
        },
      });

      const pendingNext = result.next();
      expect(((mockTaskStore as any).listeners.get('test-agent-task-1') as Set<unknown> | undefined)?.size).toBe(1);

      abortController.abort();

      await expect(pendingNext).rejects.toMatchObject({ name: 'AbortError' });
      expect(((mockTaskStore as any).listeners.get('test-agent-task-1') as Set<unknown> | undefined)?.size).toBe(
        undefined,
      );
    });
  });

  describe('AGENT_EXECUTION_ROUTE', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });
      mockTaskStore = new InMemoryTaskStore();
    });

    it('returns JSON for non-streaming A2A methods', async () => {
      const response = await AGENT_EXECUTION_ROUTE.handler({
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        taskStore: mockTaskStore,
        abortSignal: AbortSignal.abort(),
        id: 1,
        method: 'tasks/get',
        params: { id: 'missing-task' },
      });

      expect(response.headers.get('Content-Type')).toContain('application/json');

      const payload = await response.json();
      expect(payload).toMatchObject({
        id: 1,
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Task not found: missing-task',
        },
      });
    });

    it('returns SSE for streaming A2A methods', async () => {
      const mockAgent = mockMastra.getAgentById('test-agent');
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: 'Hello from SSE' });

      const response = await AGENT_EXECUTION_ROUTE.handler({
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        taskStore: mockTaskStore,
        abortSignal: AbortSignal.abort(),
        id: 42,
        method: 'message/stream',
        params: {
          message: {
            messageId: 'user-message-id',
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Hello' }],
          },
          configuration: {
            blocking: true,
          },
        },
      });

      expect(response.headers.get('Content-Type')).toContain('text/event-stream');

      const body = await response.text();
      expect(body).toContain('data: {"jsonrpc":"2.0","id":42,"result":{"id":');
      expect(body).toContain('"kind":"task"');
      expect(body).toContain('"kind":"status-update"');
      expect(body).toContain('Hello from SSE');
    });
  });
});
