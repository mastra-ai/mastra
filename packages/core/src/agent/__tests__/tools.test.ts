import { openai } from '@ai-sdk/openai-v5';
import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TestIntegration } from '../../integration/openapi-toolset.mock';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const mockFindUser = vi.fn().mockImplementation(async data => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
    { name: 'Joe', email: 'joe@mail.com' },
  ];

  const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

function toolsTest(version: 'v1' | 'v2' | 'v3') {
  const integration = new TestIntegration();
  let mockModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

  beforeEach(() => {
    if (version === 'v1') {
      mockModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: undefined,
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              args: JSON.stringify({}),
            },
          ],
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-test-1',
                toolName: 'testTool',
                args: JSON.stringify({}),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });
    } else if (version === 'v2') {
      mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              input: '{}',
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              input: '{}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });
    } else {
      // v3
      mockModel = new MockLanguageModelV3({
        doGenerate: async () => ({
          finishReason: 'tool-calls',
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              input: '{}',
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              input: '{}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 20, text: 20, reasoning: undefined },
              },
            },
          ]),
        }),
      });
    }
  });

  describe(`agents using tools ${version}`, () => {
    it('should call testTool from TestIntegration', async () => {
      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'You are an agent that call testTool',
        model: mockModel,
        tools: integration.getStaticTools(),
      });

      const mastra = new Mastra({
        agents: {
          testAgent,
        },
        logger: false,
      });

      const agentOne = mastra.getAgent('testAgent');

      let response;
      let toolCall;

      if (version === 'v1') {
        response = await agentOne.generateLegacy('Call testTool', {
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'testTool');
      } else {
        response = await agentOne.generate('Call testTool');
        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'testTool').payload;
      }

      const message = toolCall?.result?.message;

      expect(message).toBe('Executed successfully');
    });

    it('runs agent hooks through the public generate path', async () => {
      const calls: Array<{ phase: 'before' | 'after'; toolName: string; input: unknown; output?: unknown }> = [];
      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'You are an agent that calls testTool',
        model: mockModel,
        tools: integration.getStaticTools(),
        hooks: {
          beforeToolCall: ({ toolName, input }) => calls.push({ phase: 'before', toolName, input }),
          afterToolCall: ({ toolName, input, output }) => calls.push({ phase: 'after', toolName, input, output }),
        },
      });

      const mastra = new Mastra({
        agents: {
          testAgent,
        },
        logger: false,
      });
      const agentOne = mastra.getAgent('testAgent');

      if (version === 'v1') {
        await agentOne.generateLegacy('Call testTool', { toolChoice: 'required' });
      } else {
        await agentOne.generate('Call testTool');
      }

      expect(calls.slice(0, 2)).toEqual([
        { phase: 'before', toolName: 'testTool', input: {} },
        {
          phase: 'after',
          toolName: 'testTool',
          input: {},
          output: { message: 'Executed successfully' },
        },
      ]);
    });

    it('uses per-execution hooks through the public generate path', async () => {
      const configBeforeToolCall = vi.fn();
      const runBeforeToolCall = vi.fn(() => ({ proceed: false as const, output: { message: 'blocked' } }));
      const execute = vi.fn(async () => ({ message: 'executed' }));
      const testTool = createTool({
        id: 'testTool',
        description: 'Test tool',
        inputSchema: z.object({}),
        execute,
      });
      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'You are an agent that calls testTool',
        model: mockModel,
        tools: { testTool },
        hooks: { beforeToolCall: configBeforeToolCall },
      });
      const mastra = new Mastra({
        agents: {
          testAgent,
        },
        logger: false,
      });
      const agentOne = mastra.getAgent('testAgent');

      let toolResult;
      if (version === 'v1') {
        const response = await agentOne.generateLegacy('Call testTool', {
          toolChoice: 'required',
          hooks: {
            beforeToolCall: runBeforeToolCall,
          },
        });
        toolResult = response.toolResults.find((result: any) => result.toolName === 'testTool');
      } else {
        const response = await agentOne.generate('Call testTool', {
          hooks: {
            beforeToolCall: runBeforeToolCall,
          },
        });
        toolResult = response.toolResults.find((result: any) => result.payload.toolName === 'testTool')?.payload;
      }

      expect(toolResult?.result?.message).toBe('blocked');
      expect(configBeforeToolCall).not.toHaveBeenCalled();
      expect(runBeforeToolCall).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'testTool', input: {} }));
      expect(execute).not.toHaveBeenCalled();
    });

    it('runs afterToolCall when a tool errors', async () => {
      const afterToolCall = vi.fn();
      const testTool = createTool({
        id: 'testTool',
        description: 'Test tool',
        inputSchema: z.object({}),
        execute: async () => {
          throw new Error('tool failed');
        },
      });
      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test agent',
        instructions: 'You are an agent that calls testTool',
        model: mockModel,
        tools: { testTool },
        hooks: { afterToolCall },
      });
      const mastra = new Mastra({
        agents: {
          testAgent,
        },
        logger: false,
      });
      const agentOne = mastra.getAgent('testAgent');

      if (version === 'v1') {
        await agentOne.generateLegacy('Call testTool', { toolChoice: 'required' }).catch(() => undefined);
      } else {
        await agentOne.generate('Call testTool').catch(() => undefined);
      }

      expect(afterToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'testTool',
          input: {},
          output: undefined,
          error: expect.any(Error),
        }),
      );
    });

    it('should call findUserTool with parameters', async () => {
      // Create a new mock model for this test that calls findUserTool
      let findUserToolModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        findUserToolModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: undefined,
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-finduser-1',
                toolName: 'findUserTool',
                args: JSON.stringify({ name: 'Dero Israel' }),
              },
            ],
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-finduser-1',
                  toolName: 'findUserTool',
                  args: JSON.stringify({ name: 'Dero Israel' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else if (version === 'v2') {
        findUserToolModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-finduser-1',
                toolName: 'findUserTool',
                input: '{"name":"Dero Israel"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-finduser-1',
                toolName: 'findUserTool',
                input: '{"name":"Dero Israel"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });
      } else {
        // v3
        findUserToolModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: 'tool-calls',
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-finduser-1',
                toolName: 'findUserTool',
                input: '{"name":"Dero Israel"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-finduser-1',
                toolName: 'findUserTool',
                input: '{"name":"Dero Israel"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 20, text: 20, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const findUserTool = createTool({
        id: 'Find user tool',
        description: 'This is a test tool that returns the name and email',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: (input, _context) => {
          return mockFindUser(input) as Promise<Record<string, any>>;
        },
      });

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using findUserTool.',
        model: findUserToolModel,
        tools: { findUserTool },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('userAgent');

      let toolCall;
      let response;
      if (version === 'v1') {
        response = await agentOne.generateLegacy('Find the user with name - Dero Israel', {
          maxSteps: 2,
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'findUserTool');
      } else {
        response = await agentOne.generate('Find the user with name - Dero Israel');
        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'findUserTool').payload;
      }

      const name = toolCall?.result?.name;

      expect(mockFindUser).toHaveBeenCalled();
      expect(name).toBe('Dero Israel');
    });

    it('should call client side tools in generate', async () => {
      // Create a mock model that calls the changeColor tool
      let clientToolModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        clientToolModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: undefined,
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-color-1',
                toolName: 'changeColor',
                args: JSON.stringify({ color: 'green' }),
              },
            ],
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-color-1',
                  toolName: 'changeColor',
                  args: JSON.stringify({ color: 'green' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else if (version === 'v2') {
        clientToolModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-color-1',
                toolName: 'changeColor',
                input: '{"color":"green"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-color-1',
                toolName: 'changeColor',
                input: '{"color":"green"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });
      } else {
        // v3
        clientToolModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: 'tool-calls',
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-color-1',
                toolName: 'changeColor',
                input: '{"color":"green"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-color-1',
                toolName: 'changeColor',
                input: '{"color":"green"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 20, text: 20, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: clientToolModel,
      });

      let result;
      if (version === 'v1') {
        result = await userAgent.generateLegacy('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
        });
      } else {
        result = await userAgent.generate('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
        });
      }

      expect(result.toolCalls.length).toBeGreaterThan(0);
    });

    it('should call client side tools in stream', async () => {
      // Reuse the same mock model for streaming
      let clientToolModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        clientToolModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: undefined,
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-color-stream-1',
                toolName: 'changeColor',
                args: JSON.stringify({ color: 'green' }),
              },
            ],
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-color-stream-1',
                  toolName: 'changeColor',
                  args: JSON.stringify({ color: 'green' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else if (version === 'v2') {
        clientToolModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [],
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-color-stream-1',
                toolName: 'changeColor',
                args: { color: 'green' },
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-color-stream-1',
                toolName: 'changeColor',
                input: '{"color":"green"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });
      } else {
        // v3
        clientToolModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: 'tool-calls',
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-color-stream-1',
                toolName: 'changeColor',
                input: '{"color":"green"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-color-stream-1',
                toolName: 'changeColor',
                input: '{"color":"green"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 20, text: 20, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        id: 'user-agent',
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: clientToolModel,
      });

      let result;

      if (version === 'v1') {
        result = await userAgent.streamLegacy('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
          onFinish: props => {
            expect(props.toolCalls.length).toBeGreaterThan(0);
          },
        });
      } else {
        result = await userAgent.stream('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that returns the name and email',
              inputSchema: z.object({
                color: z.string(),
              }),
              execute: async () => {},
            },
          },
        });
      }

      for await (const _ of result.fullStream) {
      }

      expect(await result.finishReason).toBe('tool-calls');
    });

    it('should make requestContext available to tools in generate', async () => {
      // Create a mock model that calls the testTool
      let requestContextModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        requestContextModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: undefined,
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-runtime-1',
                toolName: 'testTool',
                args: JSON.stringify({ query: 'test' }),
              },
            ],
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-runtime-1',
                  toolName: 'testTool',
                  args: JSON.stringify({ query: 'test' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else if (version === 'v2') {
        requestContextModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-runtime-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-runtime-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });
      } else {
        // v3
        requestContextModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: 'tool-calls',
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-runtime-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-runtime-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 20, text: 20, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const testRequestContext = new RequestContext([['test-value', 'requestContext-value']]);
      let capturedValue: string | null = null;

      const testTool = createTool({
        id: 'requestContext-test-tool',
        description: 'A tool that verifies requestContext is available',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: (input, context) => {
          capturedValue = context.requestContext.get('test-value')!;

          return Promise.resolve({
            success: true,
            requestContextAvailable: !!context.requestContext,
            requestContextValue: capturedValue,
          });
        },
      });

      const agent = new Agent({
        id: 'requestContext-test-agent',
        name: 'Request Context Test Agent',
        instructions: 'You are an agent that tests requestContext availability.',
        model: requestContextModel,
        tools: { testTool },
      });

      const mastra = new Mastra({
        agents: { agent },
        logger: false,
      });

      const testAgent = mastra.getAgent('agent');

      let response;
      let toolCall;
      if (version === 'v1') {
        response = await testAgent.generateLegacy('Use the requestContext-test-tool with query "test"', {
          toolChoice: 'required',
          requestContext: testRequestContext,
        });
        toolCall = response.toolResults.find(result => result.toolName === 'testTool');
      } else {
        response = await testAgent.generate('Use the requestContext-test-tool with query "test"', {
          toolChoice: 'required',
          requestContext: testRequestContext,
        });
        toolCall = response.toolResults.find(result => result.payload.toolName === 'testTool').payload;
      }

      expect(toolCall?.result?.requestContextAvailable).toBe(true);
      expect(toolCall?.result?.requestContextValue).toBe('requestContext-value');
      expect(capturedValue).toBe('requestContext-value');
    });

    it('should make requestContext available to tools in stream', async () => {
      // Create a mock model that calls the testTool
      let requestContextModel: MockLanguageModelV1 | MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v1') {
        requestContextModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: undefined,
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-runtime-stream-1',
                toolName: 'testTool',
                args: JSON.stringify({ query: 'test' }),
              },
            ],
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-runtime-stream-1',
                  toolName: 'testTool',
                  args: JSON.stringify({ query: 'test' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else if (version === 'v2') {
        requestContextModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [],
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-runtime-stream-1',
                toolName: 'testTool',
                args: { query: 'test' },
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-runtime-stream-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });
      } else {
        // v3
        requestContextModel = new MockLanguageModelV3({
          doGenerate: async () => ({
            finishReason: 'tool-calls',
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-runtime-stream-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStreamV3([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-runtime-stream-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 20, text: 20, reasoning: undefined },
                },
              },
            ]),
          }),
        });
      }

      const testRequestContext = new RequestContext([['test-value', 'requestContext-value']]);
      let capturedValue: string | null = null;

      const testTool = createTool({
        id: 'requestContext-test-tool',
        description: 'A tool that verifies requestContext is available',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: (_input, context) => {
          capturedValue = context.requestContext.get('test-value')!;

          return Promise.resolve({
            success: true,
            requestContextAvailable: !!context.requestContext,
            requestContextValue: capturedValue,
          });
        },
      });

      const agent = new Agent({
        id: 'requestContext-test-agent',
        name: 'Request Context Test Agent',
        instructions: 'You are an agent that tests requestContext availability.',
        model: requestContextModel,
        tools: { testTool },
      });

      const mastra = new Mastra({
        agents: { agent },
        logger: false,
      });

      const testAgent = mastra.getAgent('agent');

      let stream;
      let toolCall;
      if (version === 'v1') {
        stream = await testAgent.streamLegacy('Use the requestContext-test-tool with query "test"', {
          toolChoice: 'required',
          requestContext: testRequestContext,
        });

        await stream.consumeStream();

        toolCall = (await stream.toolResults).find(result => result.toolName === 'testTool');
      } else {
        stream = await testAgent.stream('Use the requestContext-test-tool with query "test"', {
          toolChoice: 'required',
          requestContext: testRequestContext,
        });

        await stream.consumeStream();

        toolCall = (await stream.toolResults).find(result => result.payload.toolName === 'testTool').payload;
      }

      expect(toolCall?.result?.requestContextAvailable).toBe(true);
      expect(toolCall?.result?.requestContextValue).toBe('requestContext-value');
      expect(capturedValue).toBe('requestContext-value');
    });
  });

  // v1 uses a different streaming format (simulateReadableStream) which doesn't apply here
  describe.skipIf(version === 'v1')(`tool calls with finishReason stop ${version}`, () => {
    it('should continue the agent loop when tool calls are present but finishReason is stop', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ result: 'success' });

      const testTool = createTool({
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({
          input: z.string(),
        }),
        execute: mockExecute,
      });

      let callCount = 0;

      let stopFinishModel: MockLanguageModelV2 | MockLanguageModelV3;

      if (version === 'v2') {
        stopFinishModel = new MockLanguageModelV2({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-0' },
                  { type: 'text-delta', id: 'text-0', delta: 'Calling the tool now. ' },
                  { type: 'text-end', id: 'text-0' },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{"input":"hello"}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            } else {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'The tool returned success.' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            }
          },
        });
      } else {
        // v3
        stopFinishModel = new MockLanguageModelV3({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                stream: convertArrayToReadableStreamV3([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-0' },
                  { type: 'text-delta', id: 'text-0', delta: 'Calling the tool now. ' },
                  { type: 'text-end', id: 'text-0' },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'testTool',
                    input: '{"input":"hello"}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: {
                      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                      outputTokens: { total: 20, text: 20, reasoning: undefined },
                    },
                  },
                ]),
              };
            } else {
              return {
                stream: convertArrayToReadableStreamV3([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'The tool returned success.' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: {
                      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                      outputTokens: { total: 20, text: 20, reasoning: undefined },
                    },
                  },
                ]),
              };
            }
          },
        });
      }

      const testAgent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent.',
        model: stopFinishModel,
        tools: { testTool },
      });

      const mastra = new Mastra({
        agents: { 'test-agent': testAgent },
        logger: false,
      });

      const agent = mastra.getAgent('test-agent');
      const response = await agent.stream('Call the test tool with input hello');

      for await (const _chunk of response.fullStream) {
        // consume the stream
      }

      // The tool should have been executed
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // The model should have been called twice:
      // 1. Returns tool call with finishReason 'stop'
      // 2. Returns final text after processing tool results
      expect(callCount).toBe(2);

      const text = await response.text;
      expect(text).toContain('The tool returned success.');
    });
  });
}

toolsTest('v1');
toolsTest('v2');
toolsTest('v3');

describe('requireApproval property preservation', () => {
  it('should preserve requireApproval property from tools passed via toolsets', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'ok',
        content: [
          {
            type: 'text',
            text: 'ok',
          },
        ],
        warnings: [],
      }),
    });

    // Create a tool with requireApproval: true
    const deleteUserTool = createTool({
      id: 'delete-user',
      description: 'Delete a user from the system',
      inputSchema: z.object({ userId: z.string() }),
      requireApproval: true,
      execute: async ({ userId }) => {
        return { success: true, userId };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent for requireApproval',
      model: mockModel,
    });

    // Convert tools with toolsets parameter
    const tools = await agent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
      toolsets: {
        admin: {
          deleteUser: deleteUserTool,
        },
      },
    });

    // Check that the converted tool has requireApproval property set
    expect(tools.deleteUser).toBeDefined();
    expect((tools.deleteUser as any).requireApproval).toBe(true);
  });

  it('should preserve requireApproval property from tools passed via clientTools', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'ok',
        content: [
          {
            type: 'text',
            text: 'ok',
          },
        ],
        warnings: [],
      }),
    });

    // Create a tool with requireApproval: true
    const sensitiveActionTool = createTool({
      id: 'sensitive-action',
      description: 'Perform a sensitive action',
      inputSchema: z.object({ action: z.string() }),
      requireApproval: true,
      execute: async ({ action }) => {
        return { success: true, action };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent for requireApproval',
      model: mockModel,
    });

    // Convert tools with clientTools parameter
    const tools = await agent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
      clientTools: {
        sensitiveAction: sensitiveActionTool,
      },
    });

    // Check that the converted tool has requireApproval property set
    expect(tools.sensitiveAction).toBeDefined();
    expect((tools.sensitiveAction as any).requireApproval).toBe(true);
  });

  it('should preserve requireApproval property from assigned tools', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'ok',
        content: [
          {
            type: 'text',
            text: 'ok',
          },
        ],
        warnings: [],
      }),
    });

    // Create a tool with requireApproval: true
    const criticalTool = createTool({
      id: 'critical-action',
      description: 'Perform a critical action',
      inputSchema: z.object({ data: z.string() }),
      requireApproval: true,
      execute: async ({ data }) => {
        return { success: true, data };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent for requireApproval',
      model: mockModel,
      tools: {
        criticalAction: criticalTool,
      },
    });

    // Convert tools
    const tools = await agent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
    });

    // Check that the converted tool has requireApproval property set
    expect(tools.criticalAction).toBeDefined();
    expect((tools.criticalAction as any).requireApproval).toBe(true);
  });

  it('should suspend when requireApproval is true', async () => {
    // Create a tool with requireApproval: true
    const criticalTool = createTool({
      id: 'critical-action',
      description: 'Perform a critical action',
      inputSchema: z.object({ data: z.string() }),
      requireApproval: true,
      execute: async ({ data }) => {
        return { success: true, data };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent for requireApproval',
      model: openai('gpt-4.1'),
    });

    const result = await agent.stream('Use the critical-action tool with data "test"', {
      toolsets: {
        actions: {
          criticalAction: criticalTool,
        },
      },
    });

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        expect(chunk.payload.toolName).toBe('criticalAction');
      }
    }
  });

  it('should preserve a needsApprovalFn attached directly to a tool (MCP shape) through convertTools', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'ok',
        content: [{ type: 'text', text: 'ok' }],
        warnings: [],
      }),
    });

    // Mirror how the MCP client builds tools: boolean requireApproval plus a
    // server-level approval function attached directly as needsApprovalFn.
    const needsApprovalFn = (args: any) => args.amount > 100;
    const mcpStyleTool = createTool({
      id: 'transfer-funds',
      description: 'Transfer funds',
      inputSchema: z.object({ amount: z.number() }),
      requireApproval: true,
      execute: async ({ amount }) => ({ success: true, amount }),
    });
    mcpStyleTool.needsApprovalFn = needsApprovalFn;

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent for conditional approval',
      model: mockModel,
    });

    const tools = await agent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
      toolsets: {
        banking: {
          transferFunds: mcpStyleTool,
        },
      },
    });

    expect(tools.transferFunds).toBeDefined();
    expect((tools.transferFunds as any).requireApproval).toBe(true);
    // The conditional approval function must survive conversion so tool-call-step
    // can evaluate it per call instead of falling back to the boolean flag.
    expect((tools.transferFunds as any).needsApprovalFn).toBe(needsApprovalFn);
  });

  it('runs configured hooks around agent tool execution', async () => {
    const calls: Array<{ phase: string; toolName: string; input: unknown; output?: unknown }> = [];
    const testTool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => ({ value }),
    });
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent for hooks',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        }),
      }),
      tools: { testTool },
      hooks: {
        beforeToolCall: ({ toolName, input }) => calls.push({ phase: 'before', toolName, input }),
        afterToolCall: ({ toolName, input, output }) => calls.push({ phase: 'after', toolName, input, output }),
      },
    });

    const tools = await agent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
    });
    const input = { value: 'ok' };
    const output = await tools.testTool.execute?.(input, {} as any);

    expect(output).toEqual({ value: 'ok' });
    expect(calls).toEqual([
      { phase: 'before', toolName: 'testTool', input },
      { phase: 'after', toolName: 'testTool', input, output: { value: 'ok' } },
    ]);
  });

  it('allows per-execution hooks to short-circuit agent tool execution', async () => {
    const execute = vi.fn(async () => ({ value: 'executed' }));
    const testTool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ value: z.string() }),
      execute,
    });
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test agent for hooks',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'ok' }],
          warnings: [],
        }),
      }),
      tools: { testTool },
    });

    const tools = await agent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
      hooks: {
        beforeToolCall: () => ({ proceed: false, output: { value: 'blocked' } }),
      },
    });
    const output = await tools.testTool.execute?.({ value: 'ok' }, {} as any);

    expect(output).toEqual({ value: 'blocked' });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('sub-agent prompt input normalization (GitHub #14154)', () => {
  // The agentInputSchema defined inside listAgentTools uses z.string() for "prompt".
  // When an LLM drifts to sending "query" instead, validateToolInput (called
  // by CoreToolBuilder.createExecute) must normalize it before validation fails.
  const agentInputSchema = z.object({
    prompt: z.string().describe('The prompt to send to the agent'),
    threadId: z.string().nullish().describe('Thread ID'),
    resourceId: z.string().nullish().describe('Resource ID'),
    instructions: z.string().nullish().describe('Additional instructions'),
    maxSteps: z.number().min(3).nullish().describe('Max steps'),
  });

  it('should normalize "query" to "prompt" through validateToolInput', async () => {
    const { validateToolInput } = await import('../../tools/validation');
    const result = validateToolInput(agentInputSchema, { query: 'give me insights into target USA' });
    expect(result.error).toBeUndefined();
    expect(result.data?.prompt).toBe('give me insights into target USA');
  });

  it('should normalize "message" to "prompt" through validateToolInput', async () => {
    const { validateToolInput } = await import('../../tools/validation');
    const result = validateToolInput(agentInputSchema, { message: 'hello world' });
    expect(result.error).toBeUndefined();
    expect(result.data?.prompt).toBe('hello world');
  });

  it('should prefer "prompt" over alias when both present', async () => {
    const { validateToolInput } = await import('../../tools/validation');
    const result = validateToolInput(agentInputSchema, { prompt: 'real prompt', query: 'drifted query' });
    expect(result.error).toBeUndefined();
    expect(result.data?.prompt).toBe('real prompt');
  });

  it('sub-agent tool is created with correct schema', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'ok',
        content: [{ type: 'text', text: 'ok' }],
        warnings: [],
      }),
    });

    const subAgent = new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      instructions: 'You are a sub-agent',
      model: mockModel,
    });

    const parentAgent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'You are a parent agent',
      model: mockModel,
      agents: { subAgent: subAgent },
    });

    const tools = await parentAgent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
    });

    const subAgentTool = tools['agent-subAgent'];
    expect(subAgentTool).toBeDefined();
    expect(subAgentTool.description).toContain('subAgent');
  });

  it('reuses sub-agent tool schemas across conversions', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'ok',
        content: [{ type: 'text', text: 'ok' }],
        warnings: [],
      }),
    });

    const subAgent = new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      instructions: 'You are a sub-agent',
      model: mockModel,
    });

    const parentAgent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'You are a parent agent',
      model: mockModel,
      agents: { subAgent },
    });

    const getSubAgentToolSchemasSpy = vi.spyOn(parentAgent as any, 'getSubAgentToolSchemas');
    let firstTools!: Record<string, any>;
    let secondTools!: Record<string, any>;
    let firstSchemas: any;
    let secondSchemas: any;

    try {
      firstTools = await parentAgent['convertTools']({
        requestContext: new RequestContext(),
        methodType: 'generate',
      });
      secondTools = await parentAgent['convertTools']({
        requestContext: new RequestContext(),
        methodType: 'generate',
      });

      expect(getSubAgentToolSchemasSpy).toHaveBeenCalledTimes(2);
      firstSchemas = getSubAgentToolSchemasSpy.mock.results[0]?.value;
      secondSchemas = getSubAgentToolSchemasSpy.mock.results[1]?.value;
    } finally {
      getSubAgentToolSchemasSpy.mockRestore();
    }

    const firstSubAgentTool = firstTools['agent-subAgent'];
    const secondSubAgentTool = secondTools['agent-subAgent'];

    expect(secondSubAgentTool).not.toBe(firstSubAgentTool);
    expect(secondSchemas.inputSchema).toBe(firstSchemas.inputSchema);
    expect(secondSchemas.outputSchema).toBe(firstSchemas.outputSchema);
  });
});
