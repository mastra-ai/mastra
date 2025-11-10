import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
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

function toolsTest(version: 'v1' | 'v2') {
  const integration = new TestIntegration();
  let mockModel: MockLanguageModelV1 | MockLanguageModelV2;

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
    } else {
      mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [],
          toolCalls: [
            {
              toolCallType: 'function',
              toolCallId: 'call-test-1',
              toolName: 'testTool',
              args: {},
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

    it('should call findUserTool with parameters', async () => {
      // Create a new mock model for this test that calls findUserTool
      let findUserToolModel: MockLanguageModelV1 | MockLanguageModelV2;

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
      } else {
        findUserToolModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [],
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-finduser-1',
                toolName: 'findUserTool',
                args: { name: 'Dero Israel' },
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
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
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
      let clientToolModel: MockLanguageModelV1 | MockLanguageModelV2;

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
      } else {
        clientToolModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [],
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-color-1',
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
                toolCallId: 'call-color-1',
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
      let clientToolModel: MockLanguageModelV1 | MockLanguageModelV2;

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
      } else {
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
      let requestContextModel: MockLanguageModelV1 | MockLanguageModelV2;

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
      } else {
        requestContextModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [],
            toolCalls: [
              {
                toolCallType: 'function',
                toolCallId: 'call-runtime-1',
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
                toolCallId: 'call-runtime-1',
                toolName: 'testTool',
                input: '{"query":"test"}',
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
      let requestContextModel: MockLanguageModelV1 | MockLanguageModelV2;

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
      } else {
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
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
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
}

toolsTest('v1');
toolsTest('v2');
