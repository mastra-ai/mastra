import { PassThrough } from 'stream';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';
import { jsonSchema, simulateReadableStream } from 'ai';
import type { CoreMessage } from 'ai';
import { MockLanguageModelV2 } from 'ai/test';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TestIntegration } from '../integration/openapi-toolset.mock';
import { Mastra } from '../mastra';
import { MastraMemory } from '../memory';
import type { StorageThreadType, MemoryConfig, WorkingMemoryTemplate } from '../memory';
import { RuntimeContext } from '../runtime-context';
import { createTool } from '../tools';
import { CompositeVoice, MastraVoice } from '../voice';
import { MessageList } from './message-list/index';
import { Agent } from '.';

// const mockClientToolModel = new MockLanguageModelV2({
//   doGenerate: async _options => {
//     return Promise.resolve({
//       content: [
//         {
//           type: 'tool-call',
//           toolCallId: 'mock-tool-call-id',
//           toolName: 'changeColor',
//           toolCallType: 'function',
//           args: JSON.stringify({ color: 'green' }),
//         },
//       ],
//       finishReason: 'tool-calls',
//       usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
//       providerMetadata: undefined,
//       request: undefined,
//       response: { id: 'mock-client-tool-response', timestamp: new Date(), modelId: 'mock-client-model' },
//       warnings: [],
//     });
//   },
//   doStream: async _options => {
//     // Simplified: always return a tool call stream
//     return Promise.resolve({
//       stream: simulateReadableStream({
//         chunks: [
//           {
//             type: 'tool-call-delta',
//             toolCallId: 'mock-tool-call-id-stream',
//             toolName: 'changeColor',
//             toolCallType: 'function',
//             argsTextDelta: '{',
//           },
//           {
//             type: 'tool-call-delta',
//             toolCallId: 'mock-tool-call-id-stream',
//             toolName: 'changeColor',
//             toolCallType: 'function',
//             argsTextDelta: '"color":"',
//           },
//           {
//             type: 'tool-call-delta',
//             toolCallId: 'mock-tool-call-id-stream',
//             toolName: 'changeColor',
//             toolCallType: 'function',
//             argsTextDelta: 'green"',
//           },
//           {
//             type: 'tool-call-delta',
//             toolCallId: 'mock-tool-call-id-stream',
//             toolName: 'changeColor',
//             toolCallType: 'function',
//             argsTextDelta: '}',
//           },
//           {
//             type: 'finish',
//             finishReason: 'tool-calls',
//             usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
//             providerMetadata: undefined,
//           },
//         ] as const,
//         chunkDelayInMs: 10,
//       }),
//       request: undefined,
//       response: { headers: undefined },
//     });
//   },
// });

config();

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

const mockFindUserToolModel = new MockLanguageModelV2({
  doGenerate: async _options => {
    // Simulate a tool call response
    return {
      content: [
        {
          type: 'tool-call',
          toolCallId: 'mock-find-user-call-id',
          toolName: 'findUserTool',
          toolCallType: 'function',
          input: JSON.stringify({ name: 'Dero Israel' }),
        },
      ],
      finishReason: 'tool-calls',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      providerMetadata: undefined,
      request: undefined,
      response: { id: 'mock-find-user-gen-response-id', timestamp: new Date(), modelId: 'mock-find-user-model' },
      warnings: [],
      steps: [
        {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'mock-find-user-call-id',
              toolName: 'findUserTool',
              input: { name: 'Dero Israel' },
            },
          ],
          text: '',
          reasoning: [],
          reasoningText: undefined,
          files: [],
          sources: [],
          toolCalls: [
            {
              type: 'tool-call',
              toolCallId: 'mock-find-user-call-id',
              toolName: 'findUserTool',
              args: { name: 'Dero Israel' },
            },
          ],
          toolResults: [],
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          warnings: [],
          request: undefined,
          response: {
            id: 'mock-find-user-gen-response-id-step1',
            timestamp: new Date(),
            modelId: 'mock-find-user-model',
          },
          providerMetadata: undefined,
        },
        {
          content: [
            {
              type: 'tool-result',
              toolCallId: 'mock-find-user-call-id',
              toolName: 'findUserTool',
              result: { name: 'Dero Israel' },
            },
            { type: 'text', text: 'Found user Dero Israel.' },
          ],
          text: 'Found user Dero Israel.',
          reasoning: [],
          reasoningText: undefined,
          files: [],
          sources: [],
          toolCalls: [],
          toolResults: [
            {
              type: 'tool-result',
              toolCallId: 'mock-find-user-call-id',
              toolName: 'findUserTool',
              args: { name: 'Dero Israel' },
              result: { name: 'Dero Israel' },
            },
          ],
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          warnings: [],
          request: undefined,
          response: {
            id: 'mock-find-user-gen-response-id-step2',
            timestamp: new Date(),
            modelId: 'mock-find-user-model',
          },
          providerMetadata: undefined,
        },
      ],
    };
  },
  doStream: async _options => {
    // Simulate a tool call stream followed by a tool result stream
    return Promise.resolve({
      stream: simulateReadableStream({
        chunks: [
          {
            type: 'tool-call-delta',
            toolCallId: 'mock-find-user-call-id-stream',
            toolName: 'findUserTool',
            toolCallType: 'function',
            inputTextDelta: '{',
          },
          {
            type: 'tool-call-delta',
            toolCallId: 'mock-find-user-call-id-stream',
            toolName: 'findUserTool',
            toolCallType: 'function',
            inputTextDelta: '"name":"',
          },
          {
            type: 'tool-call-delta',
            toolCallId: 'mock-find-user-call-id-stream',
            toolName: 'findUserTool',
            toolCallType: 'function',
            inputTextDelta: 'Dero Israel"',
          },
          {
            type: 'tool-call-delta',
            toolCallId: 'mock-find-user-call-id-stream',
            toolName: 'findUserTool',
            toolCallType: 'function',
            inputTextDelta: '}',
          },
          { type: 'text', text: 'Found user Dero Israel.' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
            providerMetadata: undefined,
          },
        ] as const,
        chunkDelayInMs: 10,
      }),
      request: undefined,
      response: { headers: undefined },
    });
  },
});

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('agent', () => {
  const integration = new TestIntegration();

  let dummyModel;
  beforeEach(() => {
    dummyModel = new MockLanguageModelV2({
      doGenerate: async _options => ({
        content: [{ type: 'text', text: 'Dummy response' }], // text moved to content
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        providerMetadata: undefined, // Add providerMetadata
        request: undefined, // Add request
        response: { id: 'mock-response-id', timestamp: new Date(), modelId: 'mock-model' }, // Add response
        warnings: [], // Add warnings
      }),
    });
  });

  it('should get a text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [
            { type: 'text', text: `Donald Trump won the 2016 U.S. presidential election, defeating Hillary Clinton.` },
          ], // text moved to content
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          providerMetadata: undefined, // Add providerMetadata
          request: undefined, // Add request
          response: { id: 'mock-response-id-2', timestamp: new Date(), modelId: 'mock-model-2' }, // Add response
          warnings: [], // Add warnings
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Who won the 2016 US presidential election?');

    const { text, toolCalls } = response;

    expect(text).toContain('Donald Trump');
    expect(toolCalls.length).toBeLessThan(1);
  });

  it('should get a streamed text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text', text: 'Donald' },
              { type: 'text', text: ' Trump' },
              { type: 'text', text: ' won' },
              { type: 'text', text: ' the' },
              { type: 'text', text: ' ' },
              { type: 'text', text: '201' },
              { type: 'text', text: '6' },
              { type: 'text', text: ' US' },
              { type: 'text', text: ' presidential' },
              { type: 'text', text: ' election' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 3 },
                providerMetadata: undefined,
              },
            ] as LanguageModelV2StreamPart[], // Added type assertion
          }),
          request: undefined, // Add request
          response: { headers: undefined }, // Add response
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.stream('Who won the 2016 US presidential election?');

    const { textStream } = response;

    let previousText = '';
    let finalText = '';
    for await (const textPart of textStream) {
      expect(textPart === previousText).toBe(false);
      previousText = textPart;
      finalText = finalText + previousText;
      expect(textPart).toBeDefined();
    }

    expect(finalText).toContain('Donald Trump');
  }, 500000);

  it('should get a structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'text', text: `{"winner":"Barack Obama"}` }], // text moved to content
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          providerMetadata: undefined, // Add providerMetadata
          request: undefined, // Add request
          response: { id: 'mock-response-id-3', timestamp: new Date(), modelId: 'mock-model-3' }, // Add response
          warnings: [], // Add warnings
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Who won the 2012 US presidential election?', {
      output: z.object({
        winner: z.string(),
      }),
    });

    const { object } = response;
    expect(object.winner).toContain('Barack Obama');
  });

  it('should support ZodSchema structured output type', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      // model: openai('gpt-4o'),
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [
            {
              type: 'text',
              text: `{"elements":[{"winner":"Barack Obama","year":"2012"},{"winner":"Donald Trump","year":"2016"}]}`,
            },
          ], // text moved to content
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          providerMetadata: undefined, // Add providerMetadata
          request: undefined, // Add request
          response: { id: 'mock-response-id-4', timestamp: new Date(), modelId: 'mock-model-4' }, // Add response
          warnings: [], // Add warnings
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.generate('Give me the winners of 2012 and 2016 US presidential elections', {
      output: z.array(
        z.object({
          winner: z.string(),
          year: z.string(),
        }),
      ),
    });

    const { object } = response;

    expect(object.length).toBeGreaterThan(1);
    expect(object).toMatchObject([
      {
        year: '2012',
        winner: 'Barack Obama',
      },
      {
        year: '2016',
        winner: 'Donald Trump',
      },
    ]);
  });

  it('should get a streamed structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text', text: '{' },
              { type: 'text', text: '"winner":' },
              { type: 'text', text: `"Barack Obama"` },
              { type: 'text', text: `}` },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 3, outputTokens: 10, totalTokens: 13 }, // Corrected usage
                providerMetadata: undefined,
              },
            ] as LanguageModelV2StreamPart[], // Added type assertion
            chunkDelayInMs: 10, // Added delay
          }),
          request: undefined, // Add request
          response: { headers: undefined }, // Add response
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { electionAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('electionAgent');

    const response = await agentOne.stream('Who won the 2012 US presidential election?', {
      output: z.object({
        winner: z.string(),
      }),
    });

    const { partialObjectStream } = response;

    let previousPartialObject = {} as { winner: string };
    for await (const partialObject of partialObjectStream) {
      if (partialObject['winner'] && previousPartialObject['winner']) {
        expect(partialObject['winner'] === previousPartialObject['winner']).toBe(false);
      }
      previousPartialObject = partialObject as { winner: string };
      expect(partialObject).toBeDefined();
    }

    expect(previousPartialObject['winner']).toBe('Barack Obama');
  });

  it('should call findUserTool', async () => {
    const findUserTool = createTool({
      id: 'Find user tool',
      description: 'This is a test tool that returns the name and email',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: ({ context }) => {
        return mockFindUser(context) as Promise<Record<string, any>>;
      },
    });

    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using findUserTool.',
      model: mockFindUserToolModel,
      tools: { findUserTool },
    });

    const mastra = new Mastra({
      agents: { userAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('userAgent');

    const response = await agentOne.generate('Find the user with name - Dero Israel', {
      maxSteps: 2,
      toolChoice: 'required',
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'findUserTool');

    const name = toolCall?.output?.name;

    expect(mockFindUser).toHaveBeenCalled();
    expect(name).toBe('Dero Israel');
  }, 500000);

  it('generate - should pass and call client side tools', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that calls tools when requested.',
      model: openai('gpt-4.1-mini'),
    });

    const result = await userAgent.generate('Change the color to green using the "changeColor" tool!', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that changes the colour',
          inputSchema: z.object({
            color: z.string(),
          }),
        },
      },
    });

    const toolCalls = result.steps.filter(s =>
      s.content.some(c => c.type === `tool-call` && c.toolName === `changeColor`),
    );
    expect(toolCalls).toHaveLength(1);
  });

  it('stream - should pass and call client side tools', async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can call tools.',
      // TODO: why isn't this mock working? it works with the real openai model
      // model: mockClientToolModel,
      model: openai(`gpt-4.1-mini`),
    });

    const result = await userAgent.stream('Make it green', {
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'This is a test tool that changes the color',
          inputSchema: z.object({
            color: z.string(),
          }),
        },
      },
      onFinish: props => {
        expect(props.toolCalls.length).toBeGreaterThan(0);
      },
    });

    for await (const _ of result.fullStream) {
    }
  });

  it('should generate with default max steps', { timeout: 10000 }, async () => {
    const findUserTool = createTool({
      id: 'Find user tool',
      description: 'This is a test tool that returns the name and email',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: async ({ context }) => {
        return mockFindUser(context) as Promise<Record<string, any>>;
      },
    });

    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using findUserTool.',
      model: openai('gpt-4o'),
      tools: { findUserTool },
    });

    const mastra = new Mastra({
      agents: { userAgent },
      logger: false,
    });

    const agentOne = mastra.getAgent('userAgent');

    const res = await agentOne.generate(
      'Use the "findUserTool" to Find the user with name - Joe and return the name and email',
    );

    const toolCall: any = res.steps[0].toolResults.find((result: any) => result.toolName === 'findUserTool');

    expect(res.steps.length > 1);
    expect(res.text.includes('joe@mail.com'));
    expect(toolCall?.output?.email).toBe('joe@mail.com');
    expect(mockFindUser).toHaveBeenCalled();
  });

  it('should call testTool from TestIntegration', async () => {
    const testAgent = new Agent({
      name: 'Test agent',
      instructions: 'You are an agent that call testTool',
      model: openai('gpt-4o'),
      tools: integration.getStaticTools(),
    });

    const mastra = new Mastra({
      agents: {
        testAgent,
      },
      logger: false,
    });

    const agentOne = mastra.getAgent('testAgent');

    const response = await agentOne.generate('Call testTool', {
      toolChoice: 'required',
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'testTool');

    const message = toolCall?.output?.message;

    expect(message).toBe('Executed successfully');
  }, 500000);

  it('should reach default max steps', async () => {
    const agent = new Agent({
      name: 'Test agent',
      instructions: 'Test agent',
      model: openai('gpt-4o'),
      tools: integration.getStaticTools(),
      defaultGenerateOptions: {
        maxSteps: 7,
      },
    });

    const response = await agent.generate('Call testTool 10 times.', {
      toolChoice: 'required',
    });
    expect(response.steps.length).toBe(7);
  }, 500000);

  it('should properly sanitize incomplete tool calls from memory messages', () => {
    const messageList = new MessageList();
    // Original CoreMessages for context, but we'll test the output of list.get.all.core()
    const toolResultOne_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'testTool1', toolCallId: 'tool-1', output: 'res1' }],
    };
    const toolCallTwo_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'testTool2', toolCallId: 'tool-2', input: {} }],
    };
    const toolResultTwo_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'testTool2', toolCallId: 'tool-2', output: 'res2' }],
    };
    const toolCallThree_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'testTool3', toolCallId: 'tool-3', input: {} }],
    };

    // Add messages. addOne will merge toolCallTwo and toolResultTwo.
    // toolResultOne is orphaned. toolCallThree is orphaned.
    messageList.add(toolResultOne_Core, 'memory');
    messageList.add(toolCallTwo_Core, 'memory');
    messageList.add(toolResultTwo_Core, 'memory');
    messageList.add(toolCallThree_Core, 'memory');

    const finalCoreMessages = messageList.get.all.aiV5.model();

    // Expected: toolResultOne (orphaned tool result) should be gone.
    // toolCallThree (orphaned assistant call) should be gone.
    // toolCallTwo and toolResultTwo should be present and correctly paired by convertToCoreMessages.

    // Check that tool-1 (orphaned result) is not present
    expect(
      finalCoreMessages.find(
        m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-1'),
      ),
    ).toBeUndefined();
    // Also check no lingering assistant message for tool-1 if it was an assistant message that only contained an orphaned result
    expect(
      finalCoreMessages.find(
        m =>
          m.role === 'assistant' &&
          (m.content as any[]).some(p => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === 'tool-1') &&
          (m.content as any[]).every(
            p => p.type === 'tool-invocation' || p.type === 'step-start' || p.type === 'step-end',
          ),
      ),
    ).toBeUndefined();

    // Check that tool-2 call and result are present
    const assistantCallForTool2 = finalCoreMessages.find(
      m =>
        m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-2'),
    );
    expect(assistantCallForTool2).toBeDefined();
    expect(assistantCallForTool2?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-call', toolCallId: 'tool-2', toolName: 'testTool2', input: {} }),
      ]),
    );

    const toolResultForTool2 = finalCoreMessages.find(
      m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-2'),
    );
    expect(toolResultForTool2).toBeDefined();
    expect(toolResultForTool2?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-result', toolCallId: 'tool-2', toolName: 'testTool2', output: 'res2' }),
      ]),
    );

    // Check that tool-3 (orphaned call) is not present
    expect(
      finalCoreMessages.find(
        m =>
          m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-3'),
      ),
    ).toBeUndefined();

    expect(finalCoreMessages.length).toBe(2); // Assistant call for tool-2, Tool result for tool-2
  });

  it('should preserve empty assistant messages after tool use', () => {
    const messageList = new MessageList();

    const assistantToolCall_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'testTool', toolCallId: 'tool-1', input: {} }],
    };
    const toolMessage_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'testTool', toolCallId: 'tool-1', output: 'res1' }],
    };
    const emptyAssistant_Core: CoreMessage = {
      role: 'assistant',
      content: '',
    };
    const userMessage_Core: CoreMessage = {
      role: 'user',
      content: 'Hello',
    };

    messageList.add(assistantToolCall_Core, 'memory');
    messageList.add(toolMessage_Core, 'memory');
    messageList.add(emptyAssistant_Core, 'memory');
    messageList.add(userMessage_Core, 'memory');

    const finalCoreMessages = messageList.get.all.aiV5.model();

    // Expected:
    // 1. Assistant message with tool-1 call.
    // 2. Tool message with tool-1 result.
    // 3. Empty assistant message.
    // 4. User message.
    expect(finalCoreMessages.length).toBe(4);

    const assistantCallMsg = finalCoreMessages.find(
      m =>
        m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-1'),
    );
    expect(assistantCallMsg).toBeDefined();

    const toolResultMsg = finalCoreMessages.find(
      m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-1'),
    );
    expect(toolResultMsg).toBeDefined();

    expect(finalCoreMessages).toEqual(
      expect.arrayContaining([
        {
          role: 'assistant',
          content: [{ type: 'text', text: '' }],
        },
      ]),
    );

    const userMsg = finalCoreMessages.find(m => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg?.content).toEqual([{ type: 'text', text: 'Hello' }]); // convertToCoreMessages makes text content an array
  });

  describe('voice capabilities', () => {
    class MockVoice extends MastraVoice {
      async speak(): Promise<NodeJS.ReadableStream> {
        const stream = new PassThrough();
        stream.end('mock audio');
        return stream;
      }

      async listen(): Promise<string> {
        return 'mock transcription';
      }

      async getSpeakers() {
        return [{ voiceId: 'mock-voice' }];
      }
    }

    let voiceAgent: Agent;
    beforeEach(() => {
      voiceAgent = new Agent({
        name: 'Voice Agent',
        instructions: 'You are an agent with voice capabilities',
        model: dummyModel,
        voice: new CompositeVoice({
          output: new MockVoice({
            speaker: 'mock-voice',
          }),
          input: new MockVoice({
            speaker: 'mock-voice',
          }),
        }),
      });
    });

    describe('getSpeakers', () => {
      it('should list available voices', async () => {
        const speakers = await voiceAgent.voice?.getSpeakers();
        expect(speakers).toEqual([{ voiceId: 'mock-voice' }]);
      });
    });

    describe('speak', () => {
      it('should generate audio stream from text', async () => {
        const audioStream = await voiceAgent.voice?.speak('Hello World', {
          speaker: 'mock-voice',
        });

        if (!audioStream) {
          expect(audioStream).toBeDefined();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);

        expect(audioBuffer.toString()).toBe('mock audio');
      });

      it('should work with different parameters', async () => {
        const audioStream = await voiceAgent.voice?.speak('Test with parameters', {
          speaker: 'mock-voice',
          speed: 0.5,
        });

        if (!audioStream) {
          expect(audioStream).toBeDefined();
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);

        expect(audioBuffer.toString()).toBe('mock audio');
      });
    });

    describe('listen', () => {
      it('should transcribe audio', async () => {
        const audioStream = new PassThrough();
        audioStream.end('test audio data');

        const text = await voiceAgent.voice?.listen(audioStream);
        expect(text).toBe('mock transcription');
      });

      it('should accept options', async () => {
        const audioStream = new PassThrough();
        audioStream.end('test audio data');

        const text = await voiceAgent.voice?.listen(audioStream, {
          language: 'en',
        });
        expect(text).toBe('mock transcription');
      });
    });

    describe('error handling', () => {
      it('should throw error when no voice provider is configured', async () => {
        const agentWithoutVoice = new Agent({
          name: 'No Voice Agent',
          instructions: 'You are an agent without voice capabilities',
          model: dummyModel,
        });

        await expect(agentWithoutVoice.voice.getSpeakers()).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.speak('Test')).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.listen(new PassThrough())).rejects.toThrow('No voice provider configured');
      });
    });
  });

  it('should accept and execute both Mastra and Vercel tools in Agent constructor', async () => {
    const mastraExecute = vi.fn().mockResolvedValue({ result: 'mastra' });
    const vercelExecute = vi.fn().mockResolvedValue({ result: 'vercel' });

    const agent = new Agent({
      name: 'test',
      instructions: 'test agent instructions',
      model: openai('gpt-4'),
      tools: {
        mastraTool: createTool({
          id: 'test',
          description: 'test',
          inputSchema: z.object({ name: z.string() }),
          execute: mastraExecute,
        }),
        vercelTool: {
          description: 'test',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          }),
          execute: vercelExecute,
        },
      },
    });

    // Verify tools exist
    expect((agent.getTools() as Agent['tools']).mastraTool).toBeDefined();
    expect((agent.getTools() as Agent['tools']).vercelTool).toBeDefined();

    const tools: Agent['tools'] = agent.getTools() as Agent['tools']; // Explicitly type and cast

    await tools.mastraTool?.execute?.({ name: 'test' }, { toolCallId: '1', messages: [] });
    await tools.vercelTool?.execute?.({ name: 'test' }, { toolCallId: '1', messages: [] });

    expect(mastraExecute).toHaveBeenCalled();
    expect(vercelExecute).toHaveBeenCalled();
  });

  // const mockFindUserToolModel = new MockLanguageModelV2({
  //   doGenerate: async () => {
  //     // Simulate a tool call response
  //     return Promise.resolve({
  //       content: [
  //         {
  //           type: 'tool-call',
  //           toolCallId: 'mock-find-user-call-id',
  //           toolName: 'findUserTool',
  //           args: { name: 'Dero Israel' },
  //         },
  //       ],
  //       finishReason: 'tool-calls',
  //       usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  //       providerMetadata: undefined,
  //       request: undefined,
  //       response: { id: 'mock-find-user-gen-response-id', timestamp: new Date(), modelId: 'mock-find-user-model' },
  //       warnings: [],
  //       steps: [
  //         {
  //           content: [
  //             {
  //               type: 'tool-call',
  //               toolCallId: 'mock-find-user-call-id',
  //               toolName: 'findUserTool',
  //               args: { name: 'Dero Israel' },
  //             },
  //           ],
  //           text: '',
  //           reasoning: [],
  //           reasoningText: undefined,
  //           files: [],
  //           sources: [],
  //           toolCalls: [
  //             {
  //               type: 'tool-call',
  //               toolCallId: 'mock-find-user-call-id',
  //               toolName: 'findUserTool',
  //               args: { name: 'Dero Israel' },
  //             },
  //           ],
  //           toolResults: [], // Tool result is added in the next step in real scenario, but we can simulate it here for simplicity
  //           finishReason: 'tool-calls',
  //           usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  //           warnings: [],
  //           request: undefined,
  //           response: {
  //             id: 'mock-find-user-gen-response-id-step1',
  //             timestamp: new Date(),
  //             modelId: 'mock-find-user-model',
  //           },
  //           providerMetadata: undefined,
  //         },
  //         {
  //           content: [
  //             {
  //               type: 'tool-result',
  //               toolCallId: 'mock-find-user-call-id',
  //               toolName: 'findUserTool',
  //               result: { name: 'Dero Israel' },
  //             },
  //             { type: 'text', text: 'Found user Dero Israel.' },
  //           ],
  //           text: 'Found user Dero Israel.',
  //         },
  //       ],
  //     });
  //   },
  // });

  it('should make runtimeContext available to tools when injected in generate', async () => {
    const testRuntimeContext = new RuntimeContext([['test-value', 'runtimeContext-value']]);
    let capturedValue: string | null = null;

    const testTool = createTool({
      id: 'runtimeContext-test-tool',
      description: 'A tool that verifies runtimeContext is available',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: ({ runtimeContext }) => {
        capturedValue = runtimeContext.get('test-value')!;

        return Promise.resolve({
          success: true,
          runtimeContextAvailable: !!runtimeContext,
          runtimeContextValue: capturedValue,
        });
      },
    });

    const agent = new Agent({
      name: 'runtimeContext-test-agent',
      instructions: 'You are an agent that tests runtimeContext availability.',
      model: openai('gpt-4o'),
      tools: { testTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const response = await testAgent.generate('Use the runtimeContext-test-tool with query "test"', {
      toolChoice: 'required',
      runtimeContext: testRuntimeContext,
    });

    const toolCall = response.toolResults.find(result => result.toolName === 'testTool');

    expect(toolCall?.output?.runtimeContextAvailable).toBe(true);
    expect(toolCall?.output?.runtimeContextValue).toBe('runtimeContext-value');
    expect(capturedValue).toBe('runtimeContext-value');
  }, 500000);

  it('should make runtimeContext available to tools when injected in stream', async () => {
    const testRuntimeContext = new RuntimeContext([['test-value', 'runtimeContext-value']]);
    let capturedValue: string | null = null;

    const testTool = createTool({
      id: 'runtimeContext-test-tool',
      description: 'A tool that verifies runtimeContext is available',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: ({ runtimeContext }) => {
        capturedValue = runtimeContext.get('test-value')!;

        return Promise.resolve({
          success: true,
          runtimeContextAvailable: !!runtimeContext,
          runtimeContextValue: capturedValue,
        });
      },
    });

    const agent = new Agent({
      name: 'runtimeContext-test-agent',
      instructions: 'You are an agent that tests runtimeContext availability.',
      model: openai('gpt-4o'),
      tools: { testTool },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    const testAgent = mastra.getAgent('agent');

    const stream = await testAgent.stream('Use the runtimeContext-test-tool with query "test"', {
      toolChoice: 'required',
      runtimeContext: testRuntimeContext,
    });

    for await (const _chunk of stream.textStream) {
      // empty line
    }

    const toolCall = (await stream.toolResults).find(result => result.toolName === 'testTool');

    expect(toolCall?.output?.runtimeContextAvailable).toBe(true);
    expect(toolCall?.output?.runtimeContextValue).toBe('runtimeContext-value');
    expect(capturedValue).toBe('runtimeContext-value');
  }, 500000);
});

describe('agent memory with metadata', () => {
  class MockMemory extends MastraMemory {
    threads: Record<string, StorageThreadType> = {};

    constructor() {
      super({ name: 'mock' });
      Object.defineProperty(this, 'storage', {
        get: () => ({
          init: async () => {},
          getThreadById: this.getThreadById.bind(this),
          saveThread: async ({ thread }: { thread: StorageThreadType }) => {
            return this.saveThread({ thread });
          },
        }),
      });
      this._hasOwnStorage = true;
    }

    getWorkingMemory(_: {
      threadId: string;
      format?: 'json' | 'markdown';
    }): Promise<Record<string, any> | string | null> {
      throw new Error('Method not implemented.');
    }
    getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate | null> {
      throw new Error('Method not implemented.');
    }

    async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
      return this.threads[threadId] || null;
    }

    async saveThread({
      thread,
    }: {
      thread: StorageThreadType;
      memoryConfig?: MemoryConfig;
    }): Promise<StorageThreadType> {
      const newThread = { ...thread, updatedAt: new Date() };
      if (!newThread.createdAt) {
        newThread.createdAt = new Date();
      }
      this.threads[thread.id] = newThread;
      return this.threads[thread.id];
    }

    async rememberMessages() {
      return { messages: [], messagesV2: [] };
    }
    async getThreadsByResourceId() {
      return [];
    }
    async saveMessages() {
      return [];
    }
    async query() {
      return { messages: [], uiMessages: [] };
    }
    async deleteThread(threadId: string) {
      delete this.threads[threadId];
    }
  }

  let dummyModel;
  beforeEach(() => {
    dummyModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        warnings: [],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          cachedInputTokens: 0,
          inputTokens: 10,
          outputTokens: 100,
          reasoningTokens: 0,
          totalTokens: 110,
        },
        content: [{ type: 'text', text: `Dummy response` }],
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [{ type: 'text', text: 'dummy' }],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  });

  it('should create a new thread with metadata using generate', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'test' },
        },
      },
    });

    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.metadata).toEqual({ client: 'test' });
    expect(thread?.resourceId).toBe('user-1');
  });

  it('should update metadata for an existing thread using generate', async () => {
    const mockMemory = new MockMemory();
    const initialThread: StorageThreadType = {
      id: 'thread-1',
      resourceId: 'user-1',
      metadata: { client: 'initial' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'updated' },
        },
      },
    });

    expect(saveThreadSpy).toHaveBeenCalledTimes(1);
    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread?.metadata).toEqual({ client: 'updated' });
  });

  it('should not update metadata if it is the same using generate', async () => {
    const mockMemory = new MockMemory();
    const initialThread: StorageThreadType = {
      id: 'thread-1',
      resourceId: 'user-1',
      metadata: { client: 'same' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'same' },
        },
      },
    });

    expect(saveThreadSpy).not.toHaveBeenCalled();
  });

  it('should create a new thread with metadata using stream', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    const res = await agent.stream('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-1',
          metadata: { client: 'test-stream' },
        },
      },
    });

    for await (const _ of res.fullStream) {
    }

    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.metadata).toEqual({ client: 'test-stream' });
    expect(thread?.resourceId).toBe('user-1');
  });

  it('should still work with deprecated threadId and resourceId', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    await agent.generate('hello', {
      resourceId: 'user-1',
      threadId: 'thread-1',
    });

    const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.id).toBe('thread-1');
    expect(thread?.resourceId).toBe('user-1');
  });
});
