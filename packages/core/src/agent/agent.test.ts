import { randomUUID } from 'crypto';
import { PassThrough } from 'stream';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2, LanguageModelV2TextPart } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import type { CoreMessage, LanguageModelV1 } from 'ai';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { stepCountIs } from 'ai-v5';
import type { UIMessageChunk } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TestIntegration } from '../integration/openapi-toolset.mock';
import { noopLogger } from '../logger';
import { Mastra } from '../mastra';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '../memory';
import { RuntimeContext } from '../runtime-context';
import { createScorer } from '../scores';
import { runScorer } from '../scores/hooks';
import type { AIV5FullStreamPart } from '../stream/aisdk/v5/output';
import type { ChunkType } from '../stream/types';
import { createTool } from '../tools';
import { delay } from '../utils';
import { CompositeVoice, MastraVoice } from '../voice';
import { MessageList } from './message-list/index';
import { assertNoDuplicateParts, MockMemory } from './test-utils';
import { Agent } from './index';

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

vi.mock('../scores/hooks', () => ({
  runScorer: vi.fn(),
}));

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openai_v5 = createOpenAIV5({ apiKey: process.env.OPENAI_API_KEY });

function agentTests({ version }: { version: 'v1' | 'v2' }) {
  const integration = new TestIntegration();
  let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
  let electionModel: MockLanguageModelV1 | MockLanguageModelV2;
  let obamaObjectModel: MockLanguageModelV1 | MockLanguageModelV2;
  let openaiModel: LanguageModelV1 | LanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      dummyModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Dummy response`,
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [{ type: 'text-delta', textDelta: 'Dummy response' }],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      electionModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Donald Trump won the 2016 U.S. presidential election, defeating Hillary Clinton.`,
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'Donald' },
              { type: 'text-delta', textDelta: ' Trump' },
              { type: 'text-delta', textDelta: ` won` },
              { type: 'text-delta', textDelta: ` the` },
              { type: 'text-delta', textDelta: ` ` },
              { type: 'text-delta', textDelta: `201` },
              { type: 'text-delta', textDelta: `6` },
              { type: 'text-delta', textDelta: ` US` },
              { type: 'text-delta', textDelta: ` presidential` },
              { type: 'text-delta', textDelta: ` election` },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      obamaObjectModel = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `{"winner":"Barack Obama"}`,
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: '{' },
              { type: 'text-delta', textDelta: '"winner":' },
              { type: 'text-delta', textDelta: `"Barack Obama"` },
              { type: 'text-delta', textDelta: `}` },
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      openaiModel = openai('gpt-4o');
    } else {
      dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: 'Dummy response',
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Dummy response' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      });

      electionModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: 'Donald Trump won the 2016 U.S. presidential election, defeating Hillary Clinton.',
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Donald Trump' },
            { type: 'text-delta', id: '1', delta: ` won` },
            { type: 'text-delta', id: '1', delta: ` the` },
            { type: 'text-delta', id: '1', delta: ` ` },
            { type: 'text-delta', id: '1', delta: `201` },
            { type: 'text-delta', id: '1', delta: `6` },
            { type: 'text-delta', id: '1', delta: ` US` },
            { type: 'text-delta', id: '1', delta: ` presidential` },
            { type: 'text-delta', id: '1', delta: ` election` },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      obamaObjectModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{"winner":"Barack Obama"}' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      openaiModel = openai_v5('gpt-4o');
    }
  });

  if (version === 'v2') {
    describe('Writable Stream from Tool', () => {
      it('should get a text response from the agent', async () => {
        const tool = createTool({
          description: 'A tool that returns the winner of the 2016 US presidential election',
          id: 'election-tool',
          inputSchema: z.object({
            year: z.number(),
          }),
          execute: async props => {
            props?.writer.write({
              type: 'election-data',
              args: {
                year: props.year,
              },
              status: 'pending',
            });

            await delay(1000);

            props?.writer.write({
              type: 'election-data',
              args: {
                year: props.year,
              },
              result: {
                winner: 'Donald Trump',
              },
              status: 'success',
            });

            return { winner: 'Donald Trump' };
          },
        });

        const electionAgent = new Agent({
          name: 'US Election agent',
          instructions: 'You know about the past US elections',
          model: openaiModel,
          tools: {
            electionTool: tool,
          },
        });

        const mastraStream = await electionAgent.streamVNext('Call the election-tool and tell me what it says.');

        const chunks: ChunkType[] = [];
        for await (const chunk of mastraStream.fullStream) {
          chunks.push(chunk);
        }

        // our types are broken, we do output these tool-output types when a tool writes
        // but adding this to the ai sdk output stream part types breaks 100 other types
        // so cast as any
        expect(chunks.find((chunk: any) => chunk.type === 'tool-output')).toBeDefined();

        const aiSdkParts: AIV5FullStreamPart[] = [];

        const aiSdkStream = await electionAgent.streamVNext('Call the election-tool and tell me what it says.', {
          format: 'aisdk',
        });

        for await (const chunk of aiSdkStream.fullStream) {
          aiSdkParts.push(chunk);
        }

        // our types are broken, we do output these tool-output types when a tool writes
        // but adding this to the ai sdk output stream part types breaks 100 other types
        // so cast as any
        const toolOutputChunk = aiSdkParts.find((chunk: any) => chunk.type === 'tool-output');

        expect(toolOutputChunk).toBeDefined();
      });
    }, 50000);
  }

  describe(`${version} - agent`, () => {
    it('should get a text response from the agent', async () => {
      const electionAgent = new Agent({
        name: 'US Election agent',
        instructions: 'You know about the past US elections',
        model: electionModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;

      if (version === 'v1') {
        response = await agentOne.generate('Who won the 2016 US presidential election?');
      } else {
        response = await agentOne.generateVNext('Who won the 2016 US presidential election?');
      }

      const { text, toolCalls } = response;

      expect(text).toContain('Donald Trump');
      expect(toolCalls.length).toBeLessThan(1);
    });

    it('should get a streamed text response from the agent', async () => {
      const electionAgent = new Agent({
        name: 'US Election agent',
        instructions: 'You know about the past US elections',
        model: electionModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;

      if (version === 'v1') {
        response = await agentOne.stream('Who won the 2016 US presidential election?');
      } else {
        response = await agentOne.streamVNext('Who won the 2016 US presidential election?');
      }

      let previousText = '';
      let finalText = '';
      for await (const textPart of response.textStream) {
        expect(textPart === previousText).toBe(false);
        previousText = textPart;
        finalText = finalText + previousText;
        expect(textPart).toBeDefined();
      }

      expect(finalText).toContain('Donald Trump');
    });

    it('should get a structured response from the agent with', async () => {
      const electionAgent = new Agent({
        name: 'US Election agent',
        instructions: 'You know about the past US elections',
        model: obamaObjectModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;
      if (version === 'v1') {
        response = await agentOne.generate('Who won the 2012 US presidential election?', {
          output: z.object({
            winner: z.string(),
          }),
        });
      } else {
        response = await agentOne.generateVNext('Who won the 2012 US presidential election?', {
          output: z.object({
            winner: z.string(),
          }),
        });
      }

      const { object } = response;
      expect(object.winner).toContain('Barack Obama');
    });

    it('should support ZodSchema structured output type', async () => {
      const electionAgent = new Agent({
        name: 'US Election agent',
        instructions: 'You know about the past US elections',
        model: openaiModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;
      if (version === 'v1') {
        response = await agentOne.generate('Give me the winners of 2012 and 2016 US presidential elections', {
          output: z.array(
            z.object({
              winner: z.string(),
              year: z.string(),
            }),
          ),
        });
      } else {
        response = await agentOne.generateVNext('Give me the winners of 2012 and 2016 US presidential elections', {
          output: z.array(
            z.object({
              winner: z.string(),
              year: z.string(),
            }),
          ),
        });
      }

      expect(response.object.length).toBeGreaterThan(1);
      expect(response.object).toMatchObject([
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
    it('should support JSONSchema7 structured output type', async () => {
      const electionAgent = new Agent({
        name: 'US Election agent',
        instructions: 'You know about the past US elections',
        model: openaiModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;
      if (version === 'v1') {
        response = await agentOne.generate('Give me the winners of 2012 and 2016 US presidential elections', {
          output: {
            type: 'object',
            properties: {
              winners: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { winner: { type: 'string' }, year: { type: 'string' } },
                  required: ['winner', 'year'],
                },
              },
            },
            required: ['winners'],
          },
        });
      } else {
        response = await agentOne.generateVNext('Give me the winners of 2012 and 2016 US presidential elections', {
          output: {
            type: 'object',
            properties: {
              winners: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { winner: { type: 'string' }, year: { type: 'string' } },
                  required: ['winner', 'year'],
                },
              },
            },
            required: ['winners'],
          },
        });
      }

      expect(response.object.winners.length).toBeGreaterThan(1);
      expect(response.object.winners).toMatchObject([
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
        model: obamaObjectModel,
      });

      const mastra = new Mastra({
        agents: { electionAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('electionAgent');

      let response;
      if (version === 'v1') {
        response = await agentOne.stream('Who won the 2012 US presidential election?', {
          output: z.object({
            winner: z.string(),
          }),
        });
        const { partialObjectStream } = response;

        let previousPartialObject = {} as { winner: string };
        for await (const partialObject of partialObjectStream) {
          if (partialObject!['winner'] && previousPartialObject['winner']) {
            expect(partialObject!['winner'] === previousPartialObject['winner']).toBe(false);
          }
          previousPartialObject = partialObject! as { winner: string };
          expect(partialObject).toBeDefined();
        }

        expect(previousPartialObject['winner']).toBe('Barack Obama');
      } else {
        response = await agentOne.streamVNext('Who won the 2012 US presidential election?', {
          output: z.object({
            winner: z.string(),
          }),
        });
        const { objectStream } = response;

        let previousPartialObject = {} as { winner: string };
        for await (const partialObject of objectStream) {
          previousPartialObject = partialObject! as { winner: string };
          expect(partialObject).toBeDefined();
        }

        expect(previousPartialObject['winner']).toBe('Barack Obama');
      }
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
        model: openaiModel,
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
        response = await agentOne.generate('Find the user with name - Dero Israel', {
          maxSteps: 2,
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'findUserTool');
      } else {
        response = await agentOne.generateVNext('Find the user with name - Dero Israel');
        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'findUserTool').payload;
      }

      const name = toolCall?.result?.name;

      expect(mockFindUser).toHaveBeenCalled();
      expect(name).toBe('Dero Israel');
    }, 500000);

    it('generate - should pass and call client side tools', async () => {
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
      });

      let result;
      if (version === 'v1') {
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
      } else {
        result = await userAgent.generateVNext('Make it green', {
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
    }, 500000);

    it('stream - should pass and call client side tools', async () => {
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
      });

      let result;

      if (version === 'v1') {
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
          onFinish: props => {
            expect(props.toolCalls.length).toBeGreaterThan(0);
          },
        });
      } else {
        result = await userAgent.streamVNext('Make it green', {
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
        model: openaiModel,
        tools: { findUserTool },
      });

      const mastra = new Mastra({
        agents: { userAgent },
        logger: false,
      });

      const agentOne = mastra.getAgent('userAgent');

      let res;
      let toolCall;

      if (version === 'v1') {
        res = await agentOne.generate(
          'Use the "findUserTool" to Find the user with name - Joe and return the name and email',
        );
        toolCall = res.steps[0].toolResults.find((result: any) => result.toolName === 'findUserTool');
      } else {
        res = await agentOne.generateVNext(
          'Use the "findUserTool" to Find the user with name - Joe and return the name and email',
        );
        toolCall = res.toolResults.find((result: any) => result.payload.toolName === 'findUserTool').payload;
      }

      expect(res.steps.length > 1);
      expect(res.text.includes('joe@mail.com'));
      expect(toolCall?.result?.email).toBe('joe@mail.com');
      expect(mockFindUser).toHaveBeenCalled();
    });

    it('should reach default max steps', async () => {
      const agent = new Agent({
        name: 'Test agent',
        instructions: 'Test agent',
        model: openaiModel,
        tools: integration.getStaticTools(),
        defaultGenerateOptions: {
          maxSteps: 7,
        },
        defaultVNextStreamOptions: {
          maxSteps: 7,
        },
      });

      let response;

      if (version === 'v1') {
        response = await agent.generate('Call testTool 10 times.', {
          toolChoice: 'required',
        });
      } else {
        response = await agent.generateVNext('Call testTool 10 times.', {
          toolChoice: 'required',
        });
      }

      expect(response.steps.length).toBe(7);
    }, 500000);

    it('should reach default max steps / stopWhen', async () => {
      const agent = new Agent({
        name: 'Test agent',
        instructions: 'Test agent',
        model: openaiModel,
        tools: integration.getStaticTools(),
      });

      let response;

      if (version === 'v1') {
        response = await agent.generate('Call testTool 10 times.', {
          toolChoice: 'required',
          maxSteps: 7,
        });
      } else {
        response = await agent.generateVNext('Call testTool 10 times.', {
          toolChoice: 'required',
          stopWhen: stepCountIs(7),
        });
      }

      expect(response.steps.length).toBe(7);
    }, 500000);

    it('should retry when tool fails and eventually succeed with maxSteps=5', async () => {
      let toolCallCount = 0;
      const failuresBeforeSuccess = 2; // Tool will fail 2 times then succeed

      const flakeyTool = createTool({
        id: 'flakeyTool',
        description: 'A tool that fails initially but eventually succeeds',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ context }) => {
          toolCallCount++;
          if (toolCallCount <= failuresBeforeSuccess) {
            throw new Error(`Tool failed! Attempt ${toolCallCount}. Please try again.`);
          }
          return { output: `Success on attempt ${toolCallCount}: ${context.input}` };
        },
      });

      const agent = new Agent({
        name: 'retry-agent',
        instructions: 'Call the flakey tool with input "test data".',
        model: openaiModel,
        tools: { flakeyTool },
      });
      agent.__setLogger(noopLogger);

      let response;
      if (version === 'v1') {
        response = await agent.generate('Please call the flakey tool with input "test data"', {
          maxSteps: 5,
        });
      } else {
        response = await agent.generateVNext('Please call the flakey tool with input "test data"', {
          maxSteps: 5,
        });
      }

      // Should have made multiple attempts
      expect(response.steps.length).toBeGreaterThan(1);
      expect(response.steps.length).toBeLessThanOrEqual(5);

      // Should have at least 3 tool calls total (2 failures + 1 success)
      expect(toolCallCount).toBeGreaterThanOrEqual(3);

      // Check that we eventually get a success result
      let foundSuccess = false;
      if (version === 'v1') {
        for (const step of response.steps) {
          if (step.toolResults) {
            for (const result of step.toolResults) {
              if (result.toolName === 'flakeyTool' && result.result && result.result.output?.includes('Success')) {
                foundSuccess = true;
                break;
              }
            }
          }
        }
      } else {
        for (const step of response.steps) {
          if (step.toolResults) {
            for (const result of step.toolResults) {
              if (
                result.payload.toolName === 'flakeyTool' &&
                result.payload.result &&
                result.payload.result.output?.includes('Success')
              ) {
                foundSuccess = true;
                break;
              }
            }
          }
        }
      }

      expect(foundSuccess).toBe(true);
    }, 500000);

    it('should call testTool from TestIntegration', async () => {
      const testAgent = new Agent({
        name: 'Test agent',
        instructions: 'You are an agent that call testTool',
        model: openaiModel,
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
        response = await agentOne.generate('Call testTool', {
          toolChoice: 'required',
        });
        toolCall = response.toolResults.find((result: any) => result.toolName === 'testTool');
      } else {
        response = await agentOne.generateVNext('Call testTool');
        toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'testTool').payload;
      }

      const message = toolCall?.result?.message;

      expect(message).toBe('Executed successfully');
    }, 500000);

    it('should use custom model for title generation when provided in generateTitle config', async () => {
      // Track which model was used for title generation
      let titleModelUsed = false;
      let agentModelUsed = false;

      let agentModel;
      let titleModel;

      if (version === 'v1') {
        // Create a mock model for the agent's main model
        agentModel = new MockLanguageModelV1({
          doGenerate: async () => {
            agentModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: `Agent model response`,
            };
          },
        });

        titleModel = new MockLanguageModelV1({
          doGenerate: async () => {
            titleModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Custom Title Model Response`,
            };
          },
        });
      } else {
        agentModel = new MockLanguageModelV2({
          doGenerate: async () => {
            agentModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: `Agent model response`,
              content: [
                {
                  type: 'text',
                  text: `Agent model response`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            agentModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Agent model response' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          },
        });

        titleModel = new MockLanguageModelV2({
          doGenerate: async () => {
            titleModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Custom Title Model Response`,
              content: [
                {
                  type: 'text',
                  text: `Custom Title Model Response`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            titleModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Custom Title Model Response' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      // Create memory with generateTitle config using custom model
      const mockMemory = new MockMemory();

      // Override getMergedThreadConfig to return our test config
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: titleModel,
            },
          },
        };
      };

      const agent = new Agent({
        name: 'title-test-agent',
        instructions: 'test agent for title generation',
        model: agentModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        // Generate a response that will trigger title generation
        await agent.generate('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              title: 'New Thread 2024-01-01T00:00:00.000Z', // Starts with "New Thread" to trigger title generation
            },
          },
        });
      } else {
        await agent.generateVNext('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              title: 'New Thread 2024-01-01T00:00:00.000Z', // Starts with "New Thread" to trigger title generation
            },
          },
        });
      }

      // The agent's main model should have been used for the response
      expect(agentModelUsed).toBe(true);

      // Give some time for the async title generation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // The custom title model should have been used for title generation
      expect(titleModelUsed).toBe(true);

      // Verify the thread was created
      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
      expect(thread?.title).toBe('Custom Title Model Response');
    });

    it('should support dynamic model selection for title generation', async () => {
      let usedModelName = '';

      // Create two different models
      let premiumModel: MockLanguageModelV1 | MockLanguageModelV2;
      let standardModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        premiumModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Premium Title`,
            };
          },
        });

        standardModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Standard Title`,
            };
          },
        });
      } else {
        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Standard Title`,
              content: [
                {
                  type: 'text',
                  text: `Standard Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Standard Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const mockMemory = new MockMemory();

      // Override getMergedThreadConfig to return dynamic model selection
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
                const userTier = runtimeContext.get('userTier');
                return userTier === 'premium' ? premiumModel : standardModel;
              },
            },
          },
        };
      };

      const agent = new Agent({
        name: 'dynamic-title-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      // Generate with premium context
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('userTier', 'premium');

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-premium',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext,
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-premium',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('premium');

      // Reset and test with standard tier
      usedModelName = '';
      const standardContext = new RuntimeContext();
      standardContext.set('userTier', 'standard');

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-standard',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext: standardContext,
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-standard',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext: standardContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('standard');
    });

    it('should allow agent model to be updated', async () => {
      let usedModelName = '';

      // Create two different models
      let premiumModel: MockLanguageModelV1 | MockLanguageModelV2;
      let standardModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        premiumModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Premium Title`,
            };
          },
        });

        standardModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Standard Title`,
            };
          },
        });
      } else {
        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Standard Title`,
              content: [
                {
                  type: 'text',
                  text: `Standard Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Standard Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        name: 'update-model-agent',
        instructions: 'test agent',
        model: standardModel,
      });

      if (version === 'v1') {
        await agent.generate('Test message');
      } else {
        await agent.generateVNext('Test message');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('standard');

      agent.__updateModel({ model: premiumModel });
      usedModelName = '';

      if (version === 'v1') {
        await agent.generate('Test message');
      } else {
        await agent.generateVNext('Test message');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('premium');
    });

    it('should handle boolean generateTitle config for backward compatibility', async () => {
      let titleGenerationCallCount = 0;
      let agentCallCount = 0;

      const mockMemory = new MockMemory();

      // Test with generateTitle: true
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: true,
          },
        };
      };

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `Generated Title`,
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                text: `Agent Response`,
              };
            }
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `Generated Title`,
                content: [
                  {
                    type: 'text',
                    text: `Generated Title`,
                  },
                ],
                warnings: [],
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: `Agent Response`,
                content: [
                  {
                    type: 'text',
                    text: `Agent Response`,
                  },
                ],
                warnings: [],
              };
            }
          },
          doStream: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Generated Title' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Agent Response' },
                  { type: 'text-end', id: '1' },
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
      }

      const agent = new Agent({
        name: 'boolean-title-agent',
        instructions: 'test agent',
        model: testModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-bool',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-bool',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(1);

      // Test with generateTitle: false
      titleGenerationCallCount = 0;
      agentCallCount = 0;
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: false,
          },
        };
      };

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-bool-false',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-bool-false',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(0); // No title generation should happen
      expect(agentCallCount).toBe(1); // But main agent should still be called
    });

    it('should handle errors in title generation gracefully', async () => {
      const mockMemory = new MockMemory();

      // Pre-create the thread with the expected title
      const originalTitle = 'New Thread 2024-01-01T00:00:00.000Z';
      await mockMemory.saveThread({
        thread: {
          id: 'thread-error',
          title: originalTitle,
          resourceId: 'user-1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      });

      let errorModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        errorModel = new MockLanguageModelV1({
          doGenerate: async () => {
            throw new Error('Title generation failed');
          },
        });
      } else {
        errorModel = new MockLanguageModelV2({
          doGenerate: async () => {
            throw new Error('Title generation failed');
          },
          doStream: async () => {
            throw new Error('Title generation failed');
          },
        });
      }

      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: errorModel,
            },
          },
        };
      };

      const agent = new Agent({
        name: 'error-title-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });
      agent.__setLogger(noopLogger);

      // This should not throw, title generation happens async
      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-error',
              title: originalTitle,
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-error',
              title: originalTitle,
            },
          },
        });
      }

      // Give time for async title generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Thread should still exist with the original title (preserved when generation fails)
      const thread = await mockMemory.getThreadById({ threadId: 'thread-error' });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe(originalTitle);
    });

    it('should not generate title when config is undefined or null', async () => {
      let titleGenerationCallCount = 0;
      let agentCallCount = 0;
      const mockMemory = new MockMemory();

      // Test with undefined config
      mockMemory.getMergedThreadConfig = () => {
        return {};
      };

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `Should not be called`,
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                text: `Agent Response`,
              };
            }
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `Should not be called`,
                content: [
                  {
                    type: 'text',
                    text: `Should not be called`,
                  },
                ],
                warnings: [],
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: `Agent Response`,
                content: [
                  {
                    type: 'text',
                    text: `Agent Response`,
                  },
                ],
                warnings: [],
              };
            }
          },
          doStream: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Should not be called' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Agent Response' },
                  { type: 'text-end', id: '1' },
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
      }

      const agent = new Agent({
        name: 'undefined-config-agent',
        instructions: 'test agent',
        model: testModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-undefined',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-undefined',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(0); // No title generation should happen
      expect(agentCallCount).toBe(1); // But main agent should still be called
    });

    it('should support dynamic instructions selection for title generation', async () => {
      let capturedPrompt = '';
      let usedLanguage = '';

      const mockMemory = new MockMemory();

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }

            if (capturedPrompt.includes('簡潔なタイトル')) {
              usedLanguage = 'ja';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `日本語のタイトル`,
              };
            } else {
              usedLanguage = 'en';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `English Title`,
              };
            }
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }

            if (capturedPrompt.includes('簡潔なタイトル')) {
              usedLanguage = 'ja';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `日本語のタイトル`,
                content: [
                  {
                    type: 'text',
                    text: `日本語のタイトル`,
                  },
                ],
                warnings: [],
              };
            } else {
              usedLanguage = 'en';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `English Title`,
                content: [
                  {
                    type: 'text',
                    text: `English Title`,
                  },
                ],
                warnings: [],
              };
            }
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }

            if (capturedPrompt.includes('簡潔なタイトル')) {
              usedLanguage = 'ja';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: '日本語のタイトル' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            } else {
              usedLanguage = 'en';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  {
                    type: 'stream-start',
                    warnings: [],
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'English Title' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            }
          },
        });
      }

      // Override getMergedThreadConfig to return dynamic instructions selection
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: titleModel,
              instructions: ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
                const language = runtimeContext.get('language');
                return language === 'ja'
                  ? '会話内容に基づいて簡潔なタイトルを生成してください'
                  : 'Generate a concise title based on the conversation';
              },
            },
          },
        };
      };

      const agent = new Agent({
        name: 'dynamic-instructions-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      // Test with Japanese context
      const japaneseContext = new RuntimeContext();
      japaneseContext.set('language', 'ja');

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-ja',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext: japaneseContext,
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-ja',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext: japaneseContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedLanguage).toBe('ja');
      expect(capturedPrompt).toContain('簡潔なタイトル');

      // Reset and test with English context
      capturedPrompt = '';
      usedLanguage = '';
      const englishContext = new RuntimeContext();
      englishContext.set('language', 'en');

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-en',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext: englishContext,
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-en',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          runtimeContext: englishContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedLanguage).toBe('en');
      expect(capturedPrompt).toContain('Generate a concise title based on the conversation');
    });

    it('should use custom instructions for title generation when provided in generateTitle config', async () => {
      let capturedPrompt = '';
      const customInstructions = 'Generate a creative and engaging title based on the conversation';

      const mockMemory = new MockMemory();

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            // Capture the prompt to verify custom instructions are used
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Creative Custom Title`,
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            // Capture the prompt to verify custom instructions are used
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Creative Custom Title`,
              content: [
                {
                  type: 'text',
                  text: `Creative Custom Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            // Capture the prompt to verify custom instructions are used
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Creative Custom Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      // Override getMergedThreadConfig to return our test config with custom instructions
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: titleModel,
              instructions: customInstructions,
            },
          },
        };
      };

      const agent = new Agent({
        name: 'custom-instructions-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generate('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-custom-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generateVNext('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-custom-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      // Give some time for the async title generation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the custom instructions were used
      expect(capturedPrompt).toBe(customInstructions);

      // Verify the thread was updated with the custom title
      const thread = await mockMemory.getThreadById({ threadId: 'thread-custom-instructions' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
      expect(thread?.title).toBe('Creative Custom Title');
    });

    it('should use default instructions when instructions config is undefined', async () => {
      let capturedPrompt = '';

      const mockMemory = new MockMemory();

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Default Title`,
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Default Title`,
              content: [
                {
                  type: 'text',
                  text: `Default Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Default Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: titleModel,
              // instructions field is intentionally omitted
            },
          },
        };
      };

      const agent = new Agent({
        name: 'default-instructions-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-default',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-default',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that default instructions were used
      expect(capturedPrompt).toContain('you will generate a short title');
      expect(capturedPrompt).toContain('ensure it is not more than 80 characters long');

      const thread = await mockMemory.getThreadById({ threadId: 'thread-default' });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe('Default Title');
    });

    it('should handle errors in dynamic instructions gracefully', async () => {
      const mockMemory = new MockMemory();

      // Pre-create the thread with the expected title
      const originalTitle = 'New Thread 2024-01-01T00:00:00.000Z';
      await mockMemory.saveThread({
        thread: {
          id: 'thread-instructions-error',
          title: originalTitle,
          resourceId: 'user-1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      });

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Title with error handling`,
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Title with error handling`,
              content: [
                {
                  type: 'text',
                  text: `Title with error handling`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Title with error handling' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: titleModel,
              instructions: () => {
                throw new Error('Instructions selection failed');
              },
            },
          },
        };
      };

      const agent = new Agent({
        name: 'error-instructions-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });
      agent.__setLogger(noopLogger);

      // This should not throw, title generation happens async
      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-instructions-error',
              title: originalTitle,
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-instructions-error',
              title: originalTitle,
            },
          },
        });
      }

      // Give time for async title generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Thread should still exist with the original title (preserved when generation fails)
      const thread = await mockMemory.getThreadById({ threadId: 'thread-instructions-error' });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe(originalTitle);
    });

    it('should handle empty or null instructions appropriately', async () => {
      let capturedPrompt = '';

      const mockMemory = new MockMemory();

      let titleModel1: MockLanguageModelV1 | MockLanguageModelV2;
      let titleModel2: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel1 = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Title with default instructions`,
            };
          },
        });

        titleModel2 = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Title with null instructions`,
            };
          },
        });
      } else {
        titleModel1 = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Title with default instructions`,
              content: [
                {
                  type: 'text',
                  text: `Title with default instructions`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Title with default instructions' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        titleModel2 = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Title with null instructions`,
              content: [
                {
                  type: 'text',
                  text: `Title with null instructions`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Title with null instructions' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      // Test with empty string instructions
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: titleModel1,
              instructions: '', // Empty string
            },
          },
        };
      };

      const agent = new Agent({
        name: 'empty-instructions-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      agent.__setLogger(noopLogger);

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-empty-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-empty-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that default instructions were used when empty string was provided
      expect(capturedPrompt).toContain('you will generate a short title');

      // Test with null instructions (via dynamic function)
      capturedPrompt = '';
      mockMemory.getMergedThreadConfig = () => {
        return {
          threads: {
            generateTitle: {
              model: titleModel2,
              instructions: () => '', // Function returning empty string
            },
          },
        };
      };

      if (version === 'v1') {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-null-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generateVNext('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-null-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that default instructions were used when null was returned
      expect(capturedPrompt).toContain('you will generate a short title');
    });
  });

  describe(`${version} - agent llmPrompt`, () => {
    it('should download assets from messages', async () => {
      const agent = new Agent({
        name: 'llmPrompt-agent',
        instructions: 'test agent',
        model: openaiModel,
      });

      let result;

      if (version === 'v1') {
        result = await agent.generate([
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
                mimeType: 'image/png',
              },
              {
                type: 'text',
                text: 'What is the photo?',
              },
            ],
          },
        ]);
      } else {
        result = await agent.generateVNext([
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
                mimeType: 'image/png',
              },
              {
                type: 'text',
                text: 'What is the photo?',
              },
            ],
          },
        ]);
      }

      expect(result.text.toLowerCase()).toContain('google');
    });
  });

  describe(`${version} - agent tool handling`, () => {
    it('should handle tool name collisions caused by formatting', async () => {
      // Create two tool names that will collide after truncation to 63 chars
      const base = 'a'.repeat(63);
      const toolName1 = base + 'X'; // 64 chars
      const toolName2 = base + 'Y'; // 64 chars, but will be truncated to same as toolName1

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
        testModel = new MockLanguageModelV2({
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
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name collision.',
        model: testModel,
        tools: {
          [toolName1]: {
            id: toolName1,
            description: 'Tool 1',
            inputSchema: z.object({}),
            execute: async () => {},
          },
          [toolName2]: {
            id: toolName2,
            description: 'Tool 2',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      await expect(userAgent['convertTools']({ runtimeContext: new RuntimeContext() })).rejects.toThrow(/same name/i);
    });

    it('should sanitize tool names with invalid characters', async () => {
      const badName = 'bad!@#tool$name';

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
        testModel = new MockLanguageModelV2({
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
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name sanitization.',
        model: testModel,
        tools: {
          [badName]: {
            id: badName,
            description: 'Tool with bad chars',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ runtimeContext: new RuntimeContext() });
      expect(Object.keys(tools)).toContain('bad___tool_name');
      expect(Object.keys(tools)).not.toContain(badName);
    });

    it('should prefix tool names that do not start with a letter or underscore', async () => {
      const badStart = '1tool';

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
        testModel = new MockLanguageModelV2({
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
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name prefix.',
        model: testModel,
        tools: {
          [badStart]: {
            id: badStart,
            description: 'Tool with bad start',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ runtimeContext: new RuntimeContext() });
      expect(Object.keys(tools)).toContain('_1tool');
      expect(Object.keys(tools)).not.toContain(badStart);
    });

    it('should truncate tool names longer than 63 characters', async () => {
      const longName = 'a'.repeat(70);

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1 },
            text: 'ok',
          }),
        });
      } else {
        testModel = new MockLanguageModelV2({
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
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'ok' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          }),
        });
      }

      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'Test tool name truncation.',
        model: testModel,
        tools: {
          [longName]: {
            id: longName,
            description: 'Tool with long name',
            inputSchema: z.object({}),
            execute: async () => {},
          },
        },
      });
      const tools = await userAgent['convertTools']({ runtimeContext: new RuntimeContext() });
      expect(Object.keys(tools).some(k => k.length === 63)).toBe(true);
      expect(Object.keys(tools)).not.toContain(longName);
    });

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
        model: openaiModel,
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
        response = await testAgent.generate('Use the runtimeContext-test-tool with query "test"', {
          toolChoice: 'required',
          runtimeContext: testRuntimeContext,
        });
        toolCall = response.toolResults.find(result => result.toolName === 'testTool');
      } else {
        response = await testAgent.generateVNext('Use the runtimeContext-test-tool with query "test"', {
          toolChoice: 'required',
          runtimeContext: testRuntimeContext,
        });
        toolCall = response.toolResults.find(result => result.payload.toolName === 'testTool').payload;
      }

      expect(toolCall?.result?.runtimeContextAvailable).toBe(true);
      expect(toolCall?.result?.runtimeContextValue).toBe('runtimeContext-value');
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
        model: openaiModel,
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
        stream = await testAgent.stream('Use the runtimeContext-test-tool with query "test"', {
          toolChoice: 'required',
          runtimeContext: testRuntimeContext,
        });

        await stream.consumeStream();

        toolCall = (await stream.toolResults).find(result => result.toolName === 'testTool');
      } else {
        stream = await testAgent.streamVNext('Use the runtimeContext-test-tool with query "test"', {
          toolChoice: 'required',
          runtimeContext: testRuntimeContext,
        });

        await stream.consumeStream();

        toolCall = (await stream.toolResults).find(result => result.payload.toolName === 'testTool').payload;
      }

      expect(toolCall?.result?.runtimeContextAvailable).toBe(true);
      expect(toolCall?.result?.runtimeContextValue).toBe('runtimeContext-value');
      expect(capturedValue).toBe('runtimeContext-value');
    }, 500000);
  });

  describe(`${version} - context parameter handling`, () => {
    it('should handle system messages in context parameter', async () => {
      const agent = new Agent({
        id: 'test-system-context',
        name: 'Test System Context',
        model: openaiModel,
        instructions: 'You are a helpful assistant.',
      });

      const systemMessage = {
        role: 'system' as const,
        content: 'Additional system instructions from context',
      };

      const userMessage = {
        role: 'user' as const,
        content: 'What are your instructions?',
      };

      // Test with complex system message content (only for v2 as v1 doesn't support array content)
      const complexSystemMessage =
        version === 'v2'
          ? {
              role: 'system' as const,
              content: [{ type: 'text' as const, text: 'Complex system message from context' }],
            }
          : {
              role: 'system' as const,
              content: 'Complex system message from context',
            };

      let result;
      if (version === 'v1') {
        result = await agent.stream('Tell me about yourself', {
          context: [systemMessage, userMessage, complexSystemMessage],
        });
      } else {
        result = await agent.streamVNext('Tell me about yourself', {
          context: [systemMessage, userMessage, complexSystemMessage],
        });
      }

      // Consume the stream
      const parts: any[] = [];
      for await (const part of result.fullStream) {
        parts.push(part);
      }

      // Check the request format based on version
      let messages: any[];
      if (version === 'v1') {
        const requestData = await result.request;
        // v1 might not have body in test mocks
        if (!requestData?.body) {
          // We can't validate the exact request format in v1 mock
          // but the test passes if no errors are thrown
          return;
        }
        messages = JSON.parse(requestData.body).messages;
      } else {
        messages = (await result.request).body.input;
      }

      // Count system messages
      const systemMessages = messages.filter((m: any) => m.role === 'system');

      // Should have exactly 3 system messages (default + 2 from context)
      expect(systemMessages.length).toBe(3);

      // Should have the agent's default instructions as first system message
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('You are a helpful assistant.');

      // Should have the context system messages
      expect(
        systemMessages.find((m: any) => m.content === 'Additional system instructions from context'),
      ).toBeDefined();

      expect(
        systemMessages.find(
          (m: any) =>
            m.content === 'Complex system message from context' ||
            m.content?.[0]?.text === 'Complex system message from context',
        ),
      ).toBeDefined();

      // Should have the context user message
      const userMessages = messages.filter((m: any) => m.role === 'user');
      expect(userMessages.length).toBe(2);

      // Check for context user message
      if (version === 'v1') {
        expect(
          userMessages.find(
            (m: any) =>
              m.content?.[0]?.text === 'What are your instructions?' || m.content === 'What are your instructions?',
          ),
        ).toBeDefined();
      } else {
        expect(userMessages.find((m: any) => m.content?.[0]?.text === 'What are your instructions?')).toBeDefined();
      }
    });

    it('should handle mixed message types in context parameter', async () => {
      const agent = new Agent({
        id: 'test-mixed-context',
        name: 'Test Mixed Context',
        model: openaiModel,
        instructions: 'You are a helpful assistant.',
      });

      const contextMessages = [
        {
          role: 'user' as const,
          content: 'Previous user question',
        },
        {
          role: 'assistant' as const,
          content: 'Previous assistant response',
        },
        {
          role: 'system' as const,
          content: 'Additional context instructions',
        },
      ];

      let result;
      if (version === 'v1') {
        result = await agent.stream('Current question', {
          context: contextMessages,
        });
      } else {
        result = await agent.streamVNext('Current question', {
          context: contextMessages,
        });
      }

      // Consume the stream
      for await (const _part of result.fullStream) {
        // Just consume the stream
      }

      // Check the request format based on version
      let messages: any[];
      if (version === 'v1') {
        const requestData = await result.request;
        if (!requestData?.body) {
          return; // Can't validate in mock
        }
        messages = JSON.parse(requestData.body).messages;
      } else {
        messages = (await result.request).body.input;
      }

      // Verify message order and content
      const systemMessages = messages.filter((m: any) => m.role === 'system');
      const userMessages = messages.filter((m: any) => m.role === 'user');
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant');

      // Should have 2 system messages (default + context)
      expect(systemMessages.length).toBe(2);

      // Should have 2 user messages (context + current)
      expect(userMessages.length).toBe(2);

      // Should have 1 assistant message (from context)
      expect(assistantMessages.length).toBe(1);
    });
  });

  describe(`${version} - agent memory with metadata`, () => {
    let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
    beforeEach(() => {
      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `Dummy response`,
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [{ type: 'text-delta', textDelta: 'dummy' }],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Dummy response`,
            content: [
              {
                type: 'text',
                text: 'Dummy response',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Dummy response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        });
      }
    });

    it('should create a new thread with metadata using generate', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generate('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test' },
            },
          },
        });
      } else {
        await agent.generateVNext('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test' },
            },
          },
        });
      }

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

      if (version === 'v1') {
        await agent.generate('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'updated' },
            },
          },
        });
      } else {
        await agent.generateVNext('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'updated' },
            },
          },
        });
      }

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

      if (version === 'v1') {
        await agent.generate('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'same' },
            },
          },
        });
      } else {
        await agent.generateVNext('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'same' },
            },
          },
        });
      }

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

      let res;
      if (version === 'v1') {
        res = await agent.stream('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test-stream' },
            },
          },
        });
      } else {
        res = await agent.streamVNext('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test-stream' },
            },
          },
        });
      }

      await res.consumeStream();

      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.metadata).toEqual({ client: 'test-stream' });
      expect(thread?.resourceId).toBe('user-1');
    });

    it('generate - should still work with deprecated threadId and resourceId', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generate('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });
      } else {
        await agent.generateVNext('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });
      }

      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.id).toBe('thread-1');
      expect(thread?.resourceId).toBe('user-1');
    });

    it('stream - should still work with deprecated threadId and resourceId', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      let stream;
      if (version === 'v1') {
        stream = await agent.stream('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });
      } else {
        stream = await agent.streamVNext('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });
      }

      await stream.consumeStream();

      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.id).toBe('thread-1');
      expect(thread?.resourceId).toBe('user-1');
    });
  });

  describe(`${version} - Dynamic instructions with mastra instance`, () => {
    let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
    let mastra: Mastra;

    beforeEach(() => {
      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: `Logger test response`,
          }),
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Logger test response`,
            content: [
              {
                type: 'text',
                text: 'Logger test response',
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Logger test response' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
          }),
        });
      }
      mastra = new Mastra({
        logger: noopLogger,
      });
    });

    it('should expose mastra instance in dynamic instructions', async () => {
      let capturedMastra: Mastra | undefined;
      let capturedRuntimeContext: RuntimeContext | undefined;

      const agent = new Agent({
        name: 'test-agent',
        instructions: ({ runtimeContext, mastra }) => {
          capturedRuntimeContext = runtimeContext;
          capturedMastra = mastra;

          const logger = mastra?.getLogger();
          logger?.debug('Running with context', { info: runtimeContext.get('info') });

          return 'You are a helpful assistant.';
        },
        model: dummyModel,
        mastra,
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('info', 'test-info');

      let response;
      if (version === 'v1') {
        response = await agent.generate('hello', { runtimeContext });
      } else {
        response = await agent.generateVNext('hello', { runtimeContext });
      }

      expect(response.text).toBe('Logger test response');
      expect(capturedMastra).toBe(mastra);
      expect(capturedRuntimeContext).toBe(runtimeContext);
      expect(capturedRuntimeContext?.get('info')).toBe('test-info');
    });

    it('should work with static instructions (backward compatibility)', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: dummyModel,
        mastra,
      });

      let response;
      if (version === 'v1') {
        response = await agent.generate('hello');
      } else {
        response = await agent.generateVNext('hello');
      }

      expect(response.text).toBe('Logger test response');
    });

    it('should handle dynamic instructions when mastra is undefined', async () => {
      let capturedMastra: Mastra | undefined;

      const agent = new Agent({
        name: 'test-agent',
        instructions: ({ mastra }) => {
          capturedMastra = mastra;
          return 'You are a helpful assistant.';
        },
        model: dummyModel,
        // No mastra provided
      });

      let response;
      if (version === 'v1') {
        response = await agent.generate('hello');
      } else {
        response = await agent.generateVNext('hello');
      }

      expect(response.text).toBe('Logger test response');
      expect(capturedMastra).toBeUndefined();
    });
  });

  describe(`${version} - Agent save message parts`, () => {
    // Model that emits 10 parts
    let dummyResponseModel: MockLanguageModelV1 | MockLanguageModelV2;
    let emptyResponseModel: MockLanguageModelV1 | MockLanguageModelV2;
    let errorResponseModel: MockLanguageModelV1 | MockLanguageModelV2;

    beforeEach(() => {
      if (version === 'v1') {
        dummyResponseModel = new MockLanguageModelV1({
          doGenerate: async _options => ({
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async _options => {
            let count = 0;
            const stream = new ReadableStream({
              pull(controller) {
                if (count < 10) {
                  controller.enqueue({
                    type: 'text-delta',
                    textDelta: `Dummy response ${count}`,
                    createdAt: new Date(Date.now() + count * 1000).toISOString(),
                  });
                  count++;
                } else {
                  controller.close();
                }
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        // Model never emits any parts
        emptyResponseModel = new MockLanguageModelV1({
          doGenerate: async _options => ({
            text: undefined,
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });

        // Model throws immediately before emitting any part
        errorResponseModel = new MockLanguageModelV1({
          doGenerate: async _options => {
            throw new Error('Immediate interruption');
          },
          doStream: async _options => {
            const stream = new ReadableStream({
              pull() {
                throw new Error('Immediate interruption');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });
      } else {
        dummyResponseModel = new MockLanguageModelV2({
          doGenerate: async _options => ({
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            content: [
              {
                type: 'text',
                text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
              },
            ],
            warnings: [],
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async _options => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              ...Array.from({ length: 10 }, (_, count) => ({
                type: 'text-delta' as const,
                id: '1',
                delta: `Dummy response ${count} `,
              })),
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
              },
            ]),
          }),
        });

        // Model never emits any parts
        emptyResponseModel = new MockLanguageModelV2({
          doGenerate: async _options => ({
            text: undefined,
            finishReason: 'stop',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            content: [],
            warnings: [],
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              },
            ]),
          }),
        });

        // Model throws immediately before emitting any part
        errorResponseModel = new MockLanguageModelV2({
          doGenerate: async _options => {
            throw new Error('Immediate interruption');
          },
          doStream: async _options => {
            throw new Error('Immediate interruption');
          },
        });
      }
    });

    describe('generate', () => {
      it('should rescue partial messages (including tool calls) if generate is aborted/interrupted', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        let savedMessages: any[] = [];
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          savedMessages.push(...args[0].messages);
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const errorTool = createTool({
          id: 'errorTool',
          description: 'Always throws an error.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async () => {
            throw new Error('Tool failed!');
          },
        });

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input }),
        });

        const agent = new Agent({
          name: 'partial-rescue-agent-generate',
          instructions:
            'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
          model: openaiModel,
          memory: mockMemory,
          tools: { errorTool, echoTool },
        });
        agent.__setLogger(noopLogger);

        let stepCount = 0;
        let caught = false;
        try {
          if (version === 'v1') {
            await agent.generate('Please echo this and then use the error tool. Be verbose and take multiple steps.', {
              threadId: 'thread-partial-rescue-generate',
              resourceId: 'resource-partial-rescue-generate',
              experimental_continueSteps: true,
              savePerStep: true,
              onStepFinish: (result: any) => {
                if (result.toolCalls && result.toolCalls.length > 1) {
                  throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
                }
                stepCount++;
                if (stepCount === 2) {
                  throw new Error('Simulated error in onStepFinish');
                }
              },
            });
          } else {
            await agent.generateVNext(
              'Please echo this and then use the error tool. Be verbose and take multiple steps.',
              {
                threadId: 'thread-partial-rescue-generate',
                resourceId: 'resource-partial-rescue-generate',
                savePerStep: true,
                onStepFinish: (result: any) => {
                  if (result.toolCalls && result.toolCalls.length > 1) {
                    throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
                  }
                  stepCount++;
                  if (stepCount === 2) {
                    throw new Error('Simulated error in onStepFinish');
                  }
                },
              },
            );
          }
        } catch (err: any) {
          caught = true;
          expect(err.message).toMatch(/Simulated error in onStepFinish/i);
        }

        expect(caught).toBe(true);

        // After interruption, check what was saved
        const messages = await mockMemory.getMessages({
          threadId: 'thread-partial-rescue-generate',
          resourceId: 'resource-partial-rescue-generate',
          format: 'v2',
        });

        // User message should be saved
        expect(messages.find(m => m.role === 'user')).toBeTruthy();
        // At least one assistant message (could be partial) should be saved
        expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
        // At least one tool call (echoTool or errorTool) should be saved if the model got that far
        const assistantWithToolInvocation = messages.find(
          m =>
            m.role === 'assistant' &&
            m.content &&
            Array.isArray(m.content.parts) &&
            m.content.parts.some(
              part =>
                part.type === 'tool-invocation' &&
                part.toolInvocation &&
                (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
            ),
        );
        expect(assistantWithToolInvocation).toBeTruthy();
        // There should be at least one save call (user and partial assistant/tool)
        expect(saveCallCount).toBeGreaterThanOrEqual(1);
      });

      it('should incrementally save messages across steps and tool calls', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input }),
        });

        const agent = new Agent({
          name: 'test-agent-generate',
          instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
          model: openaiModel,
          memory: mockMemory,
          tools: { echoTool },
        });

        if (version === 'v1') {
          await agent.generate('Echo: Please echo this long message and explain why.', {
            threadId: 'thread-echo-generate',
            resourceId: 'resource-echo-generate',
            savePerStep: true,
          });
        } else {
          await agent.generateVNext('Echo: Please echo this long message and explain why.', {
            threadId: 'thread-echo-generate',
            resourceId: 'resource-echo-generate',
            savePerStep: true,
          });
        }

        expect(saveCallCount).toBeGreaterThan(1);
        const messages = await mockMemory.getMessages({
          threadId: 'thread-echo-generate',
          resourceId: 'resource-echo-generate',
          format: 'v2',
        });
        expect(messages.length).toBeGreaterThan(0);

        const assistantMsg = messages.find(m => m.role === 'assistant');
        expect(assistantMsg).toBeDefined();
        assertNoDuplicateParts(assistantMsg!.content.parts);

        const toolResultIds = new Set(
          assistantMsg!.content.parts
            .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
            .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
        );
        expect(assistantMsg!.content.toolInvocations?.length).toBe(toolResultIds.size);
      }, 500000);

      it('should incrementally save messages with multiple tools and multi-step generation', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input }),
        });

        const uppercaseTool = createTool({
          id: 'uppercaseTool',
          description: 'Converts input to uppercase.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input.toUpperCase() }),
        });

        const agent = new Agent({
          name: 'test-agent-multi-generate',
          instructions: [
            'If the user prompt contains "Echo:", call the echoTool.',
            'If the user prompt contains "Uppercase:", call the uppercaseTool.',
            'If both are present, call both tools and explain the results.',
            'Be verbose in your response.',
          ].join(' '),
          model: openaiModel,
          memory: mockMemory,
          tools: { echoTool, uppercaseTool },
        });

        if (version === 'v1') {
          await agent.generate(
            'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
            {
              threadId: 'thread-multi-generate',
              resourceId: 'resource-multi-generate',
              savePerStep: true,
            },
          );
        } else {
          await agent.generateVNext(
            'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
            {
              threadId: 'thread-multi-generate',
              resourceId: 'resource-multi-generate',
              savePerStep: true,
            },
          );
        }
        expect(saveCallCount).toBeGreaterThan(1);
        const messages = await mockMemory.getMessages({
          threadId: 'thread-multi-generate',
          resourceId: 'resource-multi-generate',
          format: 'v2',
        });
        expect(messages.length).toBeGreaterThan(0);
        const assistantMsg = messages.find(m => m.role === 'assistant');
        expect(assistantMsg).toBeDefined();
        assertNoDuplicateParts(assistantMsg!.content.parts);

        const toolResultIds = new Set(
          assistantMsg!.content.parts
            .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
            .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
        );
        expect(assistantMsg!.content.toolInvocations?.length).toBe(toolResultIds.size);
      }, 500000);

      it('should persist the full message after a successful run', async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          name: 'test-agent-generate',
          instructions: 'test',
          model: dummyResponseModel,
          memory: mockMemory,
        });
        if (version === 'v1') {
          await agent.generate('repeat tool calls', {
            threadId: 'thread-1-generate',
            resourceId: 'resource-1-generate',
          });
        } else {
          await agent.generateVNext('repeat tool calls', {
            threadId: 'thread-1-generate',
            resourceId: 'resource-1-generate',
          });
        }

        const messages = await mockMemory.getMessages({
          threadId: 'thread-1-generate',
          resourceId: 'resource-1-generate',
          format: 'v2',
        });
        // Check that the last message matches the expected final output
        expect(
          messages[messages.length - 1]?.content?.parts?.some(
            p => p.type === 'text' && p.text?.includes('Dummy response'),
          ),
        ).toBe(true);
      });

      it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
        const mockMemory = new MockMemory();

        let messages = await mockMemory.getMessages({
          threadId: `thread-2-${version}-generate`,
          resourceId: `resource-2-${version}-generate`,
          format: 'v2',
        });

        let saveCallCount = 0;

        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const agent = new Agent({
          name: 'no-progress-agent-generate',
          instructions: 'test',
          model: emptyResponseModel,
          memory: mockMemory,
        });

        if (version === 'v1') {
          await agent.generate('no progress', {
            threadId: `thread-2-${version}-generate`,
            resourceId: `resource-2-${version}-generate`,
          });
        } else {
          await agent.generateVNext('no progress', {
            threadId: `thread-2-${version}-generate`,
            resourceId: `resource-2-${version}-generate`,
          });
        }

        expect(saveCallCount).toBe(1);

        messages = await mockMemory.getMessages({
          threadId: `thread-2-${version}-generate`,
          resourceId: `resource-2-${version}-generate`,
          format: 'v2',
        });

        expect(messages.length).toBe(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content.content).toBe('no progress');
      });
    }, 500000);

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        name: 'immediate-interrupt-agent-generate',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      try {
        if (version === 'v1') {
          await agent.generate('interrupt before step', {
            threadId: 'thread-3-generate',
            resourceId: 'resource-3-generate',
          });
        } else {
          await agent.generateVNext('interrupt before step', {
            threadId: 'thread-3-generate',
            resourceId: 'resource-3-generate',
          });
        }
      } catch (err: any) {
        expect(err.message).toBe('Immediate interruption');
      }

      const messages = await mockMemory.getMessages({
        threadId: 'thread-3-generate',
        resourceId: 'resource-3-generate',
      });

      expect(messages.length).toBe(0);

      expect(saveCallCount).toBe(0);
    });

    it('should not save thread if error occurs after starting response but before completion', async () => {
      const mockMemory = new MockMemory();
      const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

      let errorModel: MockLanguageModelV1 | MockLanguageModelV2;
      if (version === 'v1') {
        errorModel = new MockLanguageModelV1({
          doGenerate: async () => {
            throw new Error('Simulated error during response');
          },
        });
      } else {
        errorModel = new MockLanguageModelV2({
          doGenerate: async () => {
            throw new Error('Simulated error during response');
          },
          doStream: async () => {
            throw new Error('Simulated error during response');
          },
        });
      }

      const agent = new Agent({
        name: 'error-agent',
        instructions: 'test',
        model: errorModel,
        memory: mockMemory,
      });

      let errorCaught = false;
      try {
        if (version === 'v1') {
          await agent.generate('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err',
              },
            },
          });
        } else {
          await agent.generateVNext('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err',
              },
            },
          });
        }
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toMatch(/Simulated error/);
      }
      expect(errorCaught).toBe(true);

      expect(saveThreadSpy).not.toHaveBeenCalled();
      const thread = await mockMemory.getThreadById({ threadId: 'thread-err' });
      expect(thread).toBeNull();
    });

    describe(`${version} - stream`, () => {
      it('should rescue partial messages (including tool calls) if stream is aborted/interrupted', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        let savedMessages: any[] = [];
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          savedMessages.push(...args[0].messages);

          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const errorTool = createTool({
          id: 'errorTool',
          description: 'Always throws an error.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async () => {
            throw new Error('Tool failed!');
          },
        });

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input }),
        });

        const agent = new Agent({
          name: 'partial-rescue-agent',
          instructions:
            'Call each tool in a separate step. Do not use parallel tool calls. Always wait for the result of one tool before calling the next.',
          model: openaiModel,
          memory: mockMemory,
          tools: { errorTool, echoTool },
        });

        agent.__setLogger(noopLogger);

        let stepCount = 0;

        let stream;
        if (version === 'v1') {
          stream = await agent.stream(
            'Please echo this and then use the error tool. Be verbose and take multiple steps.',
            {
              threadId: 'thread-partial-rescue',
              resourceId: 'resource-partial-rescue',
              experimental_continueSteps: true,
              savePerStep: true,
              onStepFinish: (result: any) => {
                if (result.toolCalls && result.toolCalls.length > 1) {
                  throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
                }
                stepCount++;
                if (stepCount === 2) {
                  throw new Error('Simulated error in onStepFinish');
                }
              },
            },
          );
        } else {
          stream = await agent.streamVNext(
            'Please echo this and then use the error tool. Be verbose and you must take multiple steps. Call tools 2x in parallel.',
            {
              threadId: 'thread-partial-rescue',
              resourceId: 'resource-partial-rescue',
              savePerStep: true,
              onStepFinish: (result: any) => {
                if (result.toolCalls && result.toolCalls.length > 1) {
                  throw new Error('Model attempted parallel tool calls; test requires sequential tool calls');
                }
                stepCount++;
                if (stepCount === 2) {
                  throw new Error('Simulated error in onStepFinish');
                }
              },
            },
          );
        }

        let caught = false;

        await stream.consumeStream({
          onError: err => {
            caught = true;
            expect(err.message).toMatch(/Simulated error in onStepFinish/i);
          },
        });

        expect(caught).toBe(true);

        // After interruption, check what was saved
        let messages = await mockMemory.getMessages({
          threadId: 'thread-partial-rescue',
          resourceId: 'resource-partial-rescue',
          format: 'v2',
        });

        // User message should be saved
        expect(messages.find(m => m.role === 'user')).toBeTruthy();
        // At least one assistant message (could be partial) should be saved
        expect(messages.find(m => m.role === 'assistant')).toBeTruthy();
        // At least one tool call (echoTool or errorTool) should be saved if the model got that far
        const assistantWithToolInvocation = messages.find(
          m =>
            m.role === 'assistant' &&
            m.content &&
            Array.isArray(m.content.parts) &&
            m.content.parts.some(
              part =>
                part.type === 'tool-invocation' &&
                part.toolInvocation &&
                (part.toolInvocation.toolName === 'echoTool' || part.toolInvocation.toolName === 'errorTool'),
            ),
        );
        expect(assistantWithToolInvocation).toBeTruthy();
        // There should be at least one save call (user and partial assistant/tool)
        expect(saveCallCount).toBeGreaterThanOrEqual(1);
      }, 500000);

      it('should incrementally save messages across steps and tool calls', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input }),
        });

        const agent = new Agent({
          name: 'test-agent',
          instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
          model: openaiModel,
          memory: mockMemory,
          tools: { echoTool },
        });

        let stream;

        if (version === 'v1') {
          stream = await agent.stream('Echo: Please echo this long message and explain why.', {
            threadId: 'thread-echo',
            resourceId: 'resource-echo',
            savePerStep: true,
          });
        } else {
          stream = await agent.streamVNext('Echo: Please echo this long message and explain why.', {
            threadId: 'thread-echo',
            resourceId: 'resource-echo',
            savePerStep: true,
          });
        }

        await stream.consumeStream();

        expect(saveCallCount).toBeGreaterThan(1);
        const messages = await mockMemory.getMessages({
          threadId: 'thread-echo',
          resourceId: 'resource-echo',
          format: 'v2',
        });
        expect(messages.length).toBeGreaterThan(0);
        const assistantMsg = messages.find(m => m.role === 'assistant');
        expect(assistantMsg).toBeDefined();
        assertNoDuplicateParts(assistantMsg!.content.parts);

        const toolResultIds = new Set(
          assistantMsg!.content.parts
            .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
            .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
        );
        expect(assistantMsg!.content?.toolInvocations?.length).toBe(toolResultIds.size);
      }, 500000);

      it('should incrementally save messages with multiple tools and multi-step streaming', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;
        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echoes the input string.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input }),
        });

        const uppercaseTool = createTool({
          id: 'uppercaseTool',
          description: 'Converts input to uppercase.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async ({ context }) => ({ output: context.input.toUpperCase() }),
        });

        const agent = new Agent({
          name: 'test-agent-multi',
          instructions: [
            'If the user prompt contains "Echo:", call the echoTool.',
            'If the user prompt contains "Uppercase:", call the uppercaseTool.',
            'If both are present, call both tools and explain the results.',
            'Be verbose in your response.',
          ].join(' '),
          model: openaiModel,
          memory: mockMemory,
          tools: { echoTool, uppercaseTool },
        });

        let stream;
        if (version === 'v1') {
          stream = await agent.stream(
            'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
            {
              threadId: 'thread-multi',
              resourceId: 'resource-multi',
              savePerStep: true,
            },
          );
        } else {
          stream = await agent.streamVNext(
            'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
            {
              threadId: 'thread-multi',
              resourceId: 'resource-multi',
              savePerStep: true,
            },
          );
        }

        await stream.consumeStream();

        expect(saveCallCount).toBeGreaterThan(1);
        const messages = await mockMemory.getMessages({
          threadId: 'thread-multi',
          resourceId: 'resource-multi',
          format: 'v2',
        });
        expect(messages.length).toBeGreaterThan(0);
        const assistantMsg = messages.find(m => m.role === 'assistant');
        expect(assistantMsg).toBeDefined();
        assertNoDuplicateParts(assistantMsg!.content.parts);

        const toolResultIds = new Set(
          assistantMsg!.content.parts
            .filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result')
            .map(p => (p as ToolInvocationUIPart).toolInvocation.toolCallId),
        );
        expect(assistantMsg!.content?.toolInvocations?.length).toBe(toolResultIds.size);
      }, 500000);

      it('should persist the full message after a successful run', async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          name: 'test-agent',
          instructions: 'test',
          model: dummyResponseModel,
          memory: mockMemory,
        });

        let stream;
        if (version === 'v1') {
          stream = await agent.stream('repeat tool calls', {
            threadId: 'thread-1',
            resourceId: 'resource-1',
          });
        } else {
          stream = await agent.streamVNext('repeat tool calls', {
            threadId: 'thread-1',
            resourceId: 'resource-1',
          });
        }

        await stream.consumeStream();

        const messages = await mockMemory.getMessages({ threadId: 'thread-1', resourceId: 'resource-1', format: 'v2' });
        // Check that the last message matches the expected final output
        expect(
          messages[messages.length - 1]?.content?.parts?.some(
            p => p.type === 'text' && p.text?.includes('Dummy response'),
          ),
        ).toBe(true);
      });

      it('should format messages correctly in onStepFinish when provider sends multiple response-metadata chunks (Issue #7050)', async () => {
        // This test reproduces the bug where real LLM providers (like OpenRouter)
        // send multiple response-metadata chunks (after each text-delta)
        // which causes the message to have multiple text parts, one for each chunks
        // [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }]
        // instead of properly formatted messages like:
        // [{ role: 'assistant', content: [{ type: 'text', text: 'Hello world' }] }]
        const mockModel =
          version === 'v1'
            ? new MockLanguageModelV1({
                doStream: async () => ({
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
                  stream: convertArrayToReadableStream([
                    { type: 'text-delta', textDelta: 'Hello' },
                    { type: 'text-delta', textDelta: ' world' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
                    },
                  ]),
                }),
              })
            : new MockLanguageModelV2({
                doStream: async () => ({
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Hello' },
                    // add response-metadata in the middle to trigger bug where response metadata is added after each text-delta, splitting text into multiple parts, one per text delta chunk
                    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                    { type: 'text-delta', id: '1', delta: ' world' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                      // Real providers DON'T include formatted messages here
                    },
                  ]),
                }),
              });

        const agent = new Agent({
          name: 'test-agent-7050',
          instructions: 'test',
          model: mockModel,
        });

        let capturedStep: any = null;

        if (version === 'v1') {
          const stream = await agent.stream('test message', {
            threadId: 'test-thread-7050',
            resourceId: 'test-resource-7050',
            savePerStep: true,
            onStepFinish: async (step: any) => {
              capturedStep = step;
            },
          });

          // Consume the v1 stream (StreamTextResult has textStream property)
          for await (const _chunk of stream.textStream) {
            // Just consume the stream
          }
        } else {
          const result = await agent.streamVNext('test message', {
            format: 'aisdk',
            memory: {
              thread: 'test-thread-7050',
              resource: 'test-resource-7050',
            },
            onStepFinish: async (step: any) => {
              capturedStep = step;
            },
          });

          // Consume the v2 stream
          const reader = result.textStream.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }

        // Verify that onStepFinish was called with properly formatted messages
        expect(capturedStep).toBeDefined();
        expect(capturedStep.response).toBeDefined();
        expect(capturedStep.response.messages).toBeDefined();
        expect(Array.isArray(capturedStep.response.messages)).toBe(true);
        expect(capturedStep.response.messages.length).toBeGreaterThan(0);

        // Check that messages have the correct CoreMessage structure
        const firstMessage = capturedStep.response.messages[0];
        expect(firstMessage).toHaveProperty('role');
        expect(firstMessage).toHaveProperty('content');
        expect(typeof firstMessage.role).toBe('string');
        expect(['assistant', 'system', 'user'].includes(firstMessage.role)).toBe(true);

        if (version === `v2`) {
          // The bug would cause messages to be multiple text parts for each chunk like;
          // [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }]
          // Instead of: [{ role: 'assistant', content: [{ type: 'text', text: 'Hello world' }] }]
          // should only have a single text part of combined text delta chunks
          expect(firstMessage.content?.filter(p => p.type === `text`)).toHaveLength(1);
        }
      });

      it('should only call saveMessages for the user message when no assistant parts are generated', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;

        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const agent = new Agent({
          name: 'no-progress-agent',
          instructions: 'test',
          model: emptyResponseModel,
          memory: mockMemory,
        });

        let stream;
        if (version === 'v1') {
          stream = await agent.stream('no progress', {
            threadId: 'thread-2',
            resourceId: 'resource-2',
          });
        } else {
          stream = await agent.streamVNext('no progress', {
            threadId: 'thread-2',
            resourceId: 'resource-2',
          });
        }

        await stream.consumeStream();

        expect(saveCallCount).toBe(1);

        const messages = await mockMemory.getMessages({ threadId: 'thread-2', resourceId: 'resource-2', format: 'v2' });
        expect(messages.length).toBe(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content.content).toBe('no progress');
      });

      it('should not save any message if interrupted before any part is emitted', async () => {
        const mockMemory = new MockMemory();
        let saveCallCount = 0;

        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const agent = new Agent({
          name: 'immediate-interrupt-agent',
          instructions: 'test',
          model: errorResponseModel,
          memory: mockMemory,
        });

        let stream;
        if (version === 'v1') {
          stream = await agent.stream('interrupt before step', {
            threadId: 'thread-3',
            resourceId: 'resource-3',
          });
        } else {
          stream = await agent.streamVNext('interrupt before step', {
            threadId: 'thread-3',
            resourceId: 'resource-3',
          });
        }

        await stream.consumeStream({
          onError: err => {
            expect(err.message).toBe('Immediate interruption');
          },
        });

        expect(saveCallCount).toBe(0);
        const messages = await mockMemory.getMessages({ threadId: 'thread-3', resourceId: 'resource-3' });
        expect(messages.length).toBe(0);
      });

      it('should not save thread if error occurs after starting response but before completion', async () => {
        const mockMemory = new MockMemory();
        const saveThreadSpy = vi.spyOn(mockMemory, 'saveThread');

        let errorModel: MockLanguageModelV1 | MockLanguageModelV2;
        if (version === 'v1') {
          errorModel = new MockLanguageModelV1({
            doStream: async () => {
              const stream = new ReadableStream({
                pull() {
                  throw new Error('Simulated stream error');
                },
              });
              return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
            },
          });
        } else {
          errorModel = new MockLanguageModelV2({
            doStream: async () => {
              const stream = new ReadableStream({
                pull() {
                  throw new Error('Simulated stream error');
                },
              });
              return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
            },
          });
        }

        const agent = new Agent({
          name: 'error-agent-stream',
          instructions: 'test',
          model: errorModel,
          memory: mockMemory,
        });

        let errorCaught = false;

        let stream;
        try {
          if (version === 'v1') {
            stream = await agent.stream('trigger error', {
              memory: {
                resource: 'user-err',
                thread: {
                  id: 'thread-err-stream',
                },
              },
            });

            for await (const _ of stream.textStream) {
              // Should throw
            }
          } else {
            stream = await agent.streamVNext('trigger error', {
              memory: {
                resource: 'user-err',
                thread: {
                  id: 'thread-err-stream',
                },
              },
            });

            await stream.consumeStream();
            expect(stream.error).toBeDefined();
            expect(stream.error.message).toMatch(/Simulated stream error/);
            errorCaught = true;
          }
        } catch (err: any) {
          errorCaught = true;
          expect(err.message).toMatch(/Simulated stream error/);
        }

        expect(errorCaught).toBe(true);

        expect(saveThreadSpy).not.toHaveBeenCalled();
        const thread = await mockMemory.getThreadById({ threadId: 'thread-err-stream' });
        expect(thread).toBeNull();
      });
    });

    describe(`streamVNext`, () => {
      it(`should stream from LLM`, async () => {
        const agent = new Agent({
          id: 'test',
          name: 'test',
          model: openaiModel,
          instructions: `test!`,
        });

        let result;
        let request;

        if (version === 'v1') {
          result = await agent.stream(`hello!`);
        } else {
          result = await agent.streamVNext(`hello!`);
        }

        const parts: any[] = [];
        for await (const part of result.fullStream) {
          parts.push(part);
        }

        if (version === 'v1') {
          request = JSON.parse((await result.request).body).messages;
          expect(request).toEqual([
            {
              role: 'system',
              content: 'test!',
            },
            {
              role: 'user',
              content: 'hello!',
            },
          ]);
        } else {
          request = (await result.request).body.input;
          expect(request).toEqual([
            {
              role: 'system',
              content: 'test!',
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'hello!' }],
            },
          ]);
        }
      });

      it(`should show correct request input for multi-turn inputs`, async () => {
        const agent = new Agent({
          id: 'test',
          name: 'test',
          model: openaiModel,
          instructions: `test!`,
        });

        let result;
        if (version === 'v1') {
          result = await agent.stream([
            { role: `user`, content: `hello!` },
            { role: 'assistant', content: 'hi, how are you?' },
            { role: 'user', content: "I'm good, how are you?" },
          ]);
        } else {
          result = await agent.streamVNext([
            { role: `user`, content: `hello!` },
            { role: 'assistant', content: 'hi, how are you?' },
            { role: 'user', content: "I'm good, how are you?" },
          ]);
        }

        const parts: any[] = [];
        for await (const part of result.fullStream) {
          parts.push(part);
        }

        let request;
        if (version === 'v1') {
          request = JSON.parse((await result.request).body).messages;
          expect(request).toEqual([
            {
              role: 'system',
              content: 'test!',
            },
            {
              role: 'user',
              content: 'hello!',
            },
            { role: 'assistant', content: 'hi, how are you?' },
            { role: 'user', content: "I'm good, how are you?" },
          ]);
        } else {
          request = (await result.request).body.input;
          expect(request).toEqual([
            {
              role: 'system',
              content: 'test!',
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'hello!' }],
            },
            { role: 'assistant', content: [{ type: 'output_text', text: 'hi, how are you?' }] },
            { role: 'user', content: [{ type: 'input_text', text: "I'm good, how are you?" }] },
          ]);
        }
      });

      it(`should show correct request input for multi-turn inputs with memory`, async () => {
        const mockMemory = new MockMemory();
        const threadId = '1';
        const resourceId = '2';
        // @ts-ignore
        mockMemory.rememberMessages = async function rememberMessages() {
          const list = new MessageList({ threadId, resourceId }).add(
            [
              { role: `user`, content: `hello!`, threadId, resourceId },
              { role: 'assistant', content: 'hi, how are you?', threadId, resourceId },
            ],
            `memory`,
          );
          return { messages: list.get.remembered.aiV4.core(), messagesV2: list.get.remembered.v2() };
        };

        mockMemory.getThreadById = async function getThreadById() {
          return { id: '1', createdAt: new Date(), resourceId: '2', updatedAt: new Date() } satisfies StorageThreadType;
        };

        const agent = new Agent({
          id: 'test',
          name: 'test',
          model: openaiModel,
          instructions: `test!`,
          memory: mockMemory,
        });

        let result;
        if (version === 'v1') {
          result = await agent.stream([{ role: 'user', content: "I'm good, how are you?" }], {
            memory: {
              thread: '1',
              resource: '2',
              options: {
                lastMessages: 10,
              },
            },
          });
        } else {
          result = await agent.streamVNext([{ role: 'user', content: "I'm good, how are you?" }], {
            memory: {
              thread: '1',
              resource: '2',
              options: {
                lastMessages: 10,
              },
            },
          });
        }

        for await (const _part of result.fullStream) {
        }

        let request;
        if (version === 'v1') {
          request = JSON.parse((await result.request).body).messages;
          expect(request).toEqual([
            {
              role: 'system',
              content: 'test!',
            },
            {
              role: 'user',
              content: 'hello!',
            },
            { role: 'assistant', content: 'hi, how are you?' },
            { role: 'user', content: "I'm good, how are you?" },
          ]);
        } else {
          request = (await result.request).body.input;
          expect(request).toEqual([
            {
              role: 'system',
              content: 'test!',
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'hello!' }],
            },
            { role: 'assistant', content: [{ type: 'output_text', text: 'hi, how are you?' }] },
            { role: 'user', content: [{ type: 'input_text', text: "I'm good, how are you?" }] },
          ]);
        }
      });

      it(`should order tool calls/results and response text properly`, async () => {
        const mockMemory = new MockMemory();

        const weatherTool = createTool({
          id: 'get_weather',
          description: 'Get the weather for a given location',
          inputSchema: z.object({
            postalCode: z.string().describe('The location to get the weather for'),
          }),
          execute: async ({ context: { postalCode } }) => {
            return `The weather in ${postalCode} is sunny. It is currently 70 degrees and feels like 65 degrees.`;
          },
        });

        const threadId = randomUUID();
        const resourceId = 'ordering';

        const agent = new Agent({
          id: 'test',
          name: 'test',
          model: openaiModel,
          instructions: `Testing tool calls! Please respond in a pirate accent`,
          tools: {
            get_weather: weatherTool,
          },
          memory: mockMemory,
        });

        let firstResponse;
        if (version === 'v1') {
          firstResponse = await agent.generate('What is the weather in London?', {
            threadId,
            resourceId,
            onStepFinish: args => {
              args;
            },
          });
          // The response should contain the weather.
          expect(firstResponse.response.messages).toEqual([
            expect.objectContaining({
              role: 'assistant',
              content: [expect.objectContaining({ type: 'tool-call' })],
            }),
            expect.objectContaining({
              role: 'tool',
              content: [expect.objectContaining({ type: 'tool-result' })],
            }),
            expect.objectContaining({
              role: 'assistant',
              content: expect.any(String),
            }),
          ]);
        } else {
          firstResponse = await agent.generateVNext('What is the weather in London?', {
            threadId,
            resourceId,
            onStepFinish: args => {
              args;
            },
          });

          // The response should contain the weather.
          expect(firstResponse.response.messages).toEqual([
            expect.objectContaining({
              role: 'assistant',
              content: [expect.objectContaining({ type: 'tool-call' })],
            }),
            expect.objectContaining({
              role: 'tool',
              content: [expect.objectContaining({ type: 'tool-result' })],
            }),
            expect.objectContaining({
              role: 'assistant',
              content: [expect.objectContaining({ type: 'text' })],
            }),
          ]);
        }

        expect(firstResponse.text).toContain('65');

        let secondResponse;
        if (version === 'v1') {
          secondResponse = await agent.generate('What was the tool you just used?', {
            memory: {
              thread: threadId,
              resource: resourceId,
              options: {
                lastMessages: 10,
              },
            },
          });
        } else {
          secondResponse = await agent.generateVNext('What was the tool you just used?', {
            memory: {
              thread: threadId,
              resource: resourceId,
              options: {
                lastMessages: 10,
              },
            },
          });

          expect(secondResponse.request.body.input).toEqual([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
            expect.objectContaining({ type: 'function_call' }),
            expect.objectContaining({ type: 'function_call_output' }),
            expect.objectContaining({ role: 'assistant' }),
            expect.objectContaining({ role: 'user' }),
          ]);
        }

        expect(secondResponse.response.messages).toEqual([expect.objectContaining({ role: 'assistant' })]);
      }, 30_000);

      it('should include assistant messages in onFinish callback with aisdk format', async () => {
        const mockModel = new MockLanguageModelV2({
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            stream: convertArrayToReadableStream([
              { type: 'text-delta', id: '1', delta: 'Hello! ' },
              { type: 'text-delta', id: '2', delta: 'Nice to meet you!' },
              {
                type: 'finish',
                id: '3',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            warnings: [],
          }),
        });

        const agent = new Agent({
          id: 'test-aisdk-onfinish',
          name: 'Test AISDK onFinish',
          model: mockModel,
          instructions: 'You are a helpful assistant.',
        });

        let messagesInOnFinish: any[] | undefined;
        let hasUserMessage = false;
        let hasAssistantMessage = false;

        const result = await agent.streamVNext('Hello, please respond with a greeting.', {
          format: 'aisdk',
          onFinish: props => {
            // Store the messages from onFinish
            messagesInOnFinish = props.messages;

            if (props.messages) {
              props.messages.forEach((msg: any) => {
                if (msg.role === 'user') hasUserMessage = true;
                if (msg.role === 'assistant') hasAssistantMessage = true;
              });
            }
          },
        });

        // Consume the stream
        await result.consumeStream();

        // Verify that messages were provided in onFinish
        expect(messagesInOnFinish).toBeDefined();
        expect(messagesInOnFinish).toBeInstanceOf(Array);

        // response messages should not be user messages
        expect(hasUserMessage).toBe(false);
        // Verify that we have assistant messages
        expect(hasAssistantMessage).toBe(true);

        // Verify the assistant message content
        const assistantMessage = messagesInOnFinish?.find((m: any) => m.role === 'assistant');
        expect(assistantMessage).toBeDefined();
        expect(assistantMessage?.content).toBeDefined();

        // For the v2 model, the assistant message should contain the streamed text
        if (typeof assistantMessage?.content === 'string') {
          expect(assistantMessage.content).toContain('Hello!');
        } else if (Array.isArray(assistantMessage?.content)) {
          const textContent = assistantMessage.content.find((c: any) => c.type === 'text');
          expect(textContent?.text).toContain('Hello!');
        }
      });
    });
  });

  if (version === 'v2') {
    describe('streamVNext options', () => {
      it('should call options.onError when stream error occurs in streamVNext', async () => {
        const errorModel = new MockLanguageModelV2({
          doStream: async () => {
            throw new Error('Simulated stream error');
          },
        });

        const agent = new Agent({
          id: 'test-options-onerror',
          name: 'Test Options OnError',
          model: errorModel,
          instructions: 'You are a helpful assistant.',
        });

        let errorCaught = false;
        let caughtError: any = null;

        const stream = await agent.streamVNext('Hello', {
          onError: ({ error }) => {
            errorCaught = true;
            caughtError = error;
          },
        });

        // Consume the stream to trigger the error
        try {
          await stream.consumeStream();
        } catch {}

        expect(errorCaught).toBe(true);
        expect(caughtError).toBeDefined();
        expect(caughtError.message).toMatch(/Simulated stream error/);
      });

      it('should call options.onChunk when streaming in streamVNext', async () => {
        const agent = new Agent({
          id: 'test-options-onchunk',
          name: 'Test Options OnChunk',
          model: dummyModel,
          instructions: 'You are a helpful assistant.',
        });

        const chunks: any[] = [];

        const stream = await agent.streamVNext('Hello', {
          onChunk: (event: any) => {
            chunks.push(event.chunk);
          },
        });

        // Consume the stream to trigger chunks
        await stream.consumeStream();

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0]).toHaveProperty('type');
      });

      it('should call options.onAbort when stream is aborted in streamVNext', async () => {
        const abortController = new AbortController();
        let pullCalls = 0;

        const abortModel = new MockLanguageModelV2({
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              pull(controller) {
                switch (pullCalls++) {
                  case 0:
                    controller.enqueue({
                      type: 'stream-start',
                      warnings: [],
                    });
                    break;
                  case 1:
                    controller.enqueue({
                      type: 'text-start',
                      id: '1',
                    });
                    break;
                  case 2:
                    // Abort during streaming
                    abortController.abort();
                    controller.error(new DOMException('The user aborted a request.', 'AbortError'));
                    break;
                }
              },
            }),
          }),
        });

        const agent = new Agent({
          id: 'test-options-onabort',
          name: 'Test Options OnAbort',
          model: abortModel,
          instructions: 'You are a helpful assistant.',
        });

        let abortCalled = false;
        let abortEvent: any = null;

        const stream = await agent.streamVNext('Hello', {
          onAbort: event => {
            abortCalled = true;
            abortEvent = event;
          },
          abortSignal: abortController.signal,
        });

        // Consume the stream to trigger the abort
        try {
          await stream.consumeStream();
        } catch {}

        expect(abortCalled).toBe(true);
        expect(abortEvent).toBeDefined();
      });
    });
    describe(`${version} - streamVNext destructuring support`, () => {
      it('should support destructuring of stream properties and methods', async () => {
        const agent = new Agent({
          id: 'test-destructuring',
          name: 'Test Destructuring',
          model: openaiModel,
          instructions: 'You are a helpful assistant.',
        });

        const result = await agent.streamVNext('Say hello');

        // Test destructuring of various properties
        const { fullStream, textStream, text, usage, consumeStream, toolCalls, finishReason, request } = result;

        // These should all work without throwing errors
        try {
          // Test async method
          await consumeStream();

          // Test promise getters
          const textResult = await text;
          expect(typeof textResult).toBe('string');

          const usageResult = await usage;
          expect(usageResult).toBeDefined();

          const toolCallsResult = await toolCalls;
          expect(Array.isArray(toolCallsResult)).toBe(true);

          const finishReasonResult = await finishReason;
          expect(finishReasonResult).toBeDefined();

          const requestResult = await request;
          expect(requestResult).toBeDefined();

          // Test stream getters (just check they exist without consuming)
          expect(fullStream).toBeDefined();
          expect(textStream).toBeDefined();
        } catch (error) {
          // If this fails before the fix, we expect it to throw
          console.error('Destructuring test failed:', error);
          throw error;
        }
      });
    });
  }

  describe(`${version} - dynamic memory configuration`, () => {
    let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
    if (version === 'v1') {
      dummyModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Dummy response`,
        }),
      });
    } else {
      dummyModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stream: convertArrayToReadableStream([
            { type: 'text-delta', id: '1', delta: 'Dummy response' },
            {
              type: 'finish',
              id: '2',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          warnings: [],
        }),
      });
    }

    it('should support static memory configuration', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        name: 'static-memory-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      const memory = await agent.getMemory();
      expect(memory).toBe(mockMemory);
    });

    it('should support dynamic memory configuration with runtimeContext', async () => {
      const premiumMemory = new MockMemory();
      const standardMemory = new MockMemory();

      const agent = new Agent({
        name: 'dynamic-memory-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: ({ runtimeContext }) => {
          const userTier = runtimeContext.get('userTier');
          return userTier === 'premium' ? premiumMemory : standardMemory;
        },
      });

      // Test with premium context
      const premiumContext = new RuntimeContext();
      premiumContext.set('userTier', 'premium');
      const premiumResult = await agent.getMemory({ runtimeContext: premiumContext });
      expect(premiumResult).toBe(premiumMemory);

      // Test with standard context
      const standardContext = new RuntimeContext();
      standardContext.set('userTier', 'standard');
      const standardResult = await agent.getMemory({ runtimeContext: standardContext });
      expect(standardResult).toBe(standardMemory);
    });

    it('should support async dynamic memory configuration', async () => {
      const mockMemory = new MockMemory();

      const agent = new Agent({
        name: 'async-memory-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: async ({ runtimeContext }) => {
          const userId = runtimeContext.get('userId') as string;
          // Simulate async memory creation/retrieval
          await new Promise(resolve => setTimeout(resolve, 10));
          (mockMemory as any).threads[`user-${userId}`] = {
            id: `user-${userId}`,
            resourceId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return mockMemory;
        },
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('userId', 'user123');

      const memory = await agent.getMemory({ runtimeContext });
      expect(memory).toBe(mockMemory);
      expect((memory as any)?.threads['user-user123']).toBeDefined();
    });

    it('should throw error when dynamic memory function returns empty value', async () => {
      const agent = new Agent({
        name: 'invalid-memory-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: () => null as any,
      });

      await expect(agent.getMemory()).rejects.toThrow('Function-based memory returned empty value');
    });

    it('should work with memory in generate method with dynamic configuration', async () => {
      const mockMemory = new MockMemory();

      const agent = new Agent({
        name: 'generate-memory-agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: ({ runtimeContext }) => {
          const environment = runtimeContext.get('environment');
          if (environment === 'test') {
            return mockMemory;
          }
          // Return a default mock memory instead of undefined
          return new MockMemory();
        },
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('environment', 'test');

      let response;
      if (version === 'v1') {
        response = await agent.generate('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
            },
          },
          runtimeContext,
        });
      } else {
        response = await agent.generateVNext('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
            },
          },
          runtimeContext,
        });
      }

      expect(response.text).toBe('Dummy response');

      // Verify that thread was created in memory
      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
    });

    it('should work with memory in stream method with dynamic configuration', async () => {
      const mockMemory = new MockMemory();

      let model;
      if (version === 'v1') {
        model = new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'Dynamic' },
                { type: 'text-delta', textDelta: ' memory' },
                { type: 'text-delta', textDelta: ' response' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else {
        model = new MockLanguageModelV2({
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Dynamic' },
              { type: 'text-delta', id: '1', delta: ' memory' },
              { type: 'text-delta', id: '1', delta: ' response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        });
      }

      const agent = new Agent({
        name: 'stream-memory-agent',
        instructions: 'test agent',
        model,
        memory: ({ runtimeContext }) => {
          const enableMemory = runtimeContext.get('enableMemory');
          return enableMemory ? mockMemory : new MockMemory();
        },
      });

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('enableMemory', true);

      let stream;

      if (version === 'v1') {
        stream = await agent.stream('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-stream',
            },
          },
          runtimeContext,
        });
      } else {
        stream = await agent.streamVNext('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-stream',
            },
          },
          runtimeContext,
        });
      }

      let finalText = '';
      for await (const textPart of stream.textStream) {
        finalText += textPart;
      }

      expect(finalText).toBe('Dynamic memory response');

      // Verify that thread was created in memory
      const thread = await mockMemory.getThreadById({ threadId: 'thread-stream' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
    });

    it('should preserve system messages from user input when memory is enabled', async () => {
      const mockMemory = new MockMemory();

      // Mock the LLM to capture what messages it receives
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              text: 'Test response with jokes! Super!!!!',
              usage: { promptTokens: 10, completionTokens: 5 },
              finishReason: 'stop',
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              content: [{ type: 'text', text: 'Test response with jokes! Super!!!!' }],
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              finishReason: 'stop',
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        name: 'system-message-test-agent',
        instructions: 'You are a test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        await agent.generate(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
      } else {
        await agent.generateVNext(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
      }

      // Check if system message from user input is preserved in the final prompt
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });

    it('should preserve system messages from user input when memory is enabled (stream)', async () => {
      const mockMemory = new MockMemory();
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: prompt, rawSettings: {} },
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-delta', textDelta: 'Test response with jokes! Super!!!!' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        name: 'system-message-test-agent-stream',
        instructions: 'You are a test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        const stream = await agent.stream(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.textStream) {
          // Just consume the stream
        }
      } else {
        const stream = await agent.streamVNext(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.fullStream) {
          // Just consume the stream
        }
      }

      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });

    it('should preserve system messages from user input without memory (stream)', async () => {
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: prompt, rawSettings: {} },
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-delta', textDelta: 'Test response with jokes! Super!!!!' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id-3',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        name: 'system-message-test-agent-stream-no-memory',
        instructions: 'You are a test agent',
        model: dummyModel,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        const stream = await agent.stream(testMessages);
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.textStream) {
          // Just consume the stream
        }
      } else {
        const stream = await agent.streamVNext(testMessages);
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.fullStream) {
          // Just consume the stream
        }
      }

      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });

    it('should preserve system messages from user input without memory', async () => {
      // Mock the LLM to capture what messages it receives
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              text: 'Test response with jokes! Super!!!!',
              usage: { promptTokens: 10, completionTokens: 5 },
              finishReason: 'stop',
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              content: [{ type: 'text', text: 'Test response with jokes! Super!!!!' }],
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              finishReason: 'stop',
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id-2',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        name: 'system-message-test-agent-no-memory',
        instructions: 'You are a test agent',
        model: dummyModel,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        await agent.generate(testMessages);
      } else {
        await agent.generateVNext(testMessages);
      }

      // Check if system message from user input is preserved in the final prompt
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });
  });

  describe(`${version} - Input Processors`, () => {
    let mockModel: MockLanguageModelV1 | MockLanguageModelV2;

    // Helper function to create a MastraMessageV2
    const createMessage = (text: string, role: 'user' | 'assistant' = 'user'): MastraMessageV2 => ({
      id: crypto.randomUUID(),
      role,
      content: {
        format: 2,
        parts: [{ type: 'text', text }],
      },
      createdAt: new Date(),
    });

    beforeEach(() => {
      if (version === 'v1') {
        mockModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            // Extract text content from the prompt messages
            const messages = Array.isArray(prompt) ? prompt : [];
            const textContent = messages
              .map(msg => {
                if (typeof msg.content === 'string') {
                  return msg.content;
                } else if (Array.isArray(msg.content)) {
                  return msg.content
                    .filter(part => part.type === 'text')
                    .map(part => part.text)
                    .join(' ');
                }
                return '';
              })
              .filter(Boolean)
              .join(' ');

            return {
              text: `processed: ${textContent}`,
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              rawCall: { rawPrompt: prompt, rawSettings: {} },
            };
          },
          doStream: async ({ prompt }) => {
            // Extract text content from the prompt messages
            const messages = Array.isArray(prompt) ? prompt : [];
            const textContent = messages
              .map(msg => {
                if (typeof msg.content === 'string') {
                  return msg.content;
                } else if (Array.isArray(msg.content)) {
                  return msg.content
                    .filter(part => part.type === 'text')
                    .map(part => part.text)
                    .join(' ');
                }
                return '';
              })
              .filter(Boolean)
              .join(' ');

            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'processed: ' },
                  { type: 'text-delta', textDelta: textContent },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { promptTokens: 10, completionTokens: 20 },
                  },
                ],
              }),
              rawCall: { rawPrompt: prompt, rawSettings: {} },
            };
          },
        });
      } else {
        mockModel = new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            const messages = Array.isArray(prompt) ? prompt : [];
            const textContent = messages
              .map(msg => {
                if (typeof msg.content === 'string') {
                  return msg.content;
                } else if (Array.isArray(msg.content)) {
                  return msg.content
                    .filter(part => part.type === 'text')
                    .map(part => (part as LanguageModelV2TextPart).text)
                    .join(' ');
                }
                return '';
              })
              .filter(Boolean)
              .join(' ');

            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'processed: ' },
                { type: 'text-delta', id: '1', delta: textContent },
                { type: 'text-end', id: '1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
              ]),
              rawCall: { rawPrompt: prompt, rawSettings: {} },
              warnings: [],
            };
          },
        });
      }
    });

    describe('basic functionality', () => {
      it('should run input processors before generation', async () => {
        const processor = {
          name: 'test-processor',
          processInput: async ({ messages }) => {
            messages.push(createMessage('Processor was here!'));
            return messages;
          },
        };

        const agentWithProcessor = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [processor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithProcessor.generate('Hello world');
        } else {
          result = await agentWithProcessor.generateVNext('Hello world');
        }

        // The processor should have added a message
        expect(result.text).toContain('processed:');
        expect(result.text).toContain('Processor was here!');
      });

      it('should run multiple processors in order', async () => {
        const processor1 = {
          name: 'processor-1',
          processInput: async ({ messages }) => {
            messages.push(createMessage('First processor'));
            return messages;
          },
        };

        const processor2 = {
          name: 'processor-2',
          processInput: async ({ messages }) => {
            messages.push(createMessage('Second processor'));
            return messages;
          },
        };

        const agentWithProcessors = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [processor1, processor2],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithProcessors.generate('Hello');
        } else {
          result = await agentWithProcessors.generateVNext('Hello');
        }

        expect(result.text).toContain('First processor');
        expect(result.text).toContain('Second processor');
      });

      it('should support async processors running in sequence', async () => {
        const processor1 = {
          name: 'async-processor-1',
          processInput: async ({ messages }) => {
            messages.push(createMessage('First processor'));
            return messages;
          },
        };

        const processor2 = {
          name: 'async-processor-2',
          processInput: async ({ messages }) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            messages.push(createMessage('Second processor'));
            return messages;
          },
        };

        const agentWithAsyncProcessors = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [processor1, processor2],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithAsyncProcessors.generate('Test async');
        } else {
          result = await agentWithAsyncProcessors.generateVNext('Test async');
        }

        // Processors run sequentially, so "First processor" should appear before "Second processor"
        expect(result.text).toContain('First processor');
        expect(result.text).toContain('Second processor');
      });
    });

    describe('tripwire functionality', () => {
      it('should handle processor abort with default message', async () => {
        const abortProcessor = {
          name: 'abort-processor',
          processInput: async ({ abort, messages }) => {
            abort();
            return messages;
          },
        };

        const agentWithAbortProcessor = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [abortProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithAbortProcessor.generate('This should be aborted');
        } else {
          result = await agentWithAbortProcessor.generateVNext('This should be aborted');
        }

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Tripwire triggered by abort-processor');
        expect(await result.text).toBe('');
        expect(await result.finishReason).toBe('other');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          name: 'custom-abort',
          processInput: async ({ abort, messages }) => {
            abort('Custom abort reason');
            return messages;
          },
        };

        const agentWithCustomAbort = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [customAbortProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithCustomAbort.generate('Custom abort test');
        } else {
          result = await agentWithCustomAbort.generateVNext('Custom abort test');
        }

        expect(result.tripwire).toBe(true);
        expect(result.tripwireReason).toBe('Custom abort reason');
        expect(await result.text).toBe('');
      });

      it('should not execute subsequent processors after abort', async () => {
        let secondProcessorExecuted = false;

        const abortProcessor = {
          name: 'abort-first',
          processInput: async ({ abort, messages }) => {
            abort('Stop here');
            return messages;
          },
        };

        const shouldNotRunProcessor = {
          name: 'should-not-run',
          processInput: async ({ messages }) => {
            secondProcessorExecuted = true;
            messages.push(createMessage('This should not be added'));
            return messages;
          },
        };

        const agentWithAbortSequence = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [abortProcessor, shouldNotRunProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithAbortSequence.generate('Abort sequence test');
        } else {
          result = await agentWithAbortSequence.generateVNext('Abort sequence test');
        }

        expect(result.tripwire).toBe(true);
        expect(secondProcessorExecuted).toBe(false);
      });
    });

    describe('streaming with input processors', () => {
      it('should handle input processors with streaming', async () => {
        const streamProcessor = {
          name: 'stream-processor',
          processInput: async ({ messages }) => {
            messages.push(createMessage('Stream processor active'));
            return messages;
          },
        };

        const agentWithStreamProcessor = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [streamProcessor],
        });

        let stream;
        if (version === 'v1') {
          stream = await agentWithStreamProcessor.stream('Stream test');
        } else {
          stream = await agentWithStreamProcessor.streamVNext('Stream test');
        }

        let fullText = '';
        for await (const textPart of stream.textStream) {
          fullText += textPart;
        }

        expect(fullText).toContain('Stream processor active');
      });

      it('should handle abort in streaming with tripwire response', async () => {
        const streamAbortProcessor = {
          name: 'stream-abort',
          processInput: async ({ abort, messages }) => {
            abort('Stream aborted');
            return messages;
          },
        };

        const agentWithStreamAbort = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [streamAbortProcessor],
        });

        let stream;
        if (version === 'v1') {
          stream = await agentWithStreamAbort.stream('Stream abort test');
        } else {
          stream = await agentWithStreamAbort.streamVNext('Stream abort test');

          for await (const chunk of stream.fullStream) {
            expect(chunk.type).toBe('tripwire');
            expect(chunk.payload.tripwireReason).toBe('Stream aborted');
          }
        }

        expect(stream.tripwire).toBe(true);
        expect(stream.tripwireReason).toBe('Stream aborted');

        // Stream should be empty
        let textReceived = '';
        for await (const textPart of stream.textStream) {
          textReceived += textPart;
        }
        expect(textReceived).toBe('');
      });

      it('should include deployer methods when tripwire is triggered in streaming', async () => {
        const deployerAbortProcessor = {
          name: 'deployer-abort',
          processInput: async ({ abort, messages }) => {
            abort('Deployer test abort');
            return messages;
          },
        };

        const agentWithDeployerAbort = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [deployerAbortProcessor],
        });

        let stream;
        if (version === 'v1') {
          stream = await agentWithDeployerAbort.stream('Deployer abort test');
        } else {
          stream = await agentWithDeployerAbort.streamVNext('Deployer abort test');
        }

        expect(stream.tripwire).toBe(true);
        expect(stream.tripwireReason).toBe('Deployer test abort');

        if (version === 'v1') {
          // Verify deployer methods exist and return Response objects
          expect(typeof stream.toDataStreamResponse).toBe('function');
          expect(typeof stream.toTextStreamResponse).toBe('function');

          const dataStreamResponse = stream.toDataStreamResponse();
          const textStreamResponse = stream.toTextStreamResponse();

          expect(dataStreamResponse).toBeInstanceOf(Response);
          expect(textStreamResponse).toBeInstanceOf(Response);
          expect(dataStreamResponse.status).toBe(200);
          expect(textStreamResponse.status).toBe(200);

          // Verify other required methods are present
          expect(typeof stream.pipeDataStreamToResponse).toBe('function');
          expect(typeof stream.pipeTextStreamToResponse).toBe('function');
          expect(stream.experimental_partialOutputStream).toBeDefined();
          expect(typeof stream.experimental_partialOutputStream[Symbol.asyncIterator]).toBe('function');
        }
      });
    });

    describe('dynamic input processors', () => {
      it('should support function-based input processors', async () => {
        const runtimeContext = new RuntimeContext<{ processorMessage: string }>();
        runtimeContext.set('processorMessage', 'Dynamic message');

        const agentWithDynamicProcessors = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: ({ runtimeContext }) => {
            const message: string = runtimeContext.get('processorMessage') || 'Default message';
            return [
              {
                name: 'dynamic-processor',
                processInput: async ({ messages }) => {
                  messages.push(createMessage(message));
                  return messages;
                },
              },
            ];
          },
        });

        let result;
        if (version === 'v1') {
          result = await agentWithDynamicProcessors.generate('Test dynamic', {
            runtimeContext,
          });
        } else {
          result = await agentWithDynamicProcessors.generateVNext('Test dynamic', {
            runtimeContext,
          });
        }

        expect(result.text).toContain('Dynamic message');
      });

      it('should handle empty processors array', async () => {
        const agentWithEmptyProcessors = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithEmptyProcessors.generate('No processors test');
        } else {
          result = await agentWithEmptyProcessors.generateVNext('No processors test');
        }

        expect(result.text).toContain('processed:');
        expect(result.text).toContain('No processors test');
      });
    });

    describe('message manipulation', () => {
      it('should allow processors to modify message content', async () => {
        const messageModifierProcessor = {
          name: 'message-modifier',
          processInput: async ({ messages }) => {
            // Access existing messages and modify them
            const lastMessage = messages[messages.length - 1];

            if (lastMessage && lastMessage.content.parts.length > 0) {
              // Add a prefix to user messages
              messages.push(createMessage('MODIFIED: Original message was received'));
            }
            return messages;
          },
        };

        const agentWithModifier = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [messageModifierProcessor],
        });

        let result;
        if (version === 'v1') {
          result = await agentWithModifier.generate('Original user message');
        } else {
          result = await agentWithModifier.generateVNext('Original user message');
        }

        expect(result.text).toContain('MODIFIED: Original message was received');
        expect(result.text).toContain('Original user message');
      });

      it('should allow processors to filter or validate messages', async () => {
        const validationProcessor = {
          name: 'validator',
          processInput: async ({ messages, abort }) => {
            // Extract text content from all messages
            const textContent = messages
              .map(msg =>
                msg.content.parts
                  .filter(part => part.type === 'text')
                  .map(part => part.text)
                  .join(' '),
              )
              .join(' ');

            const hasInappropriateContent = textContent.includes('inappropriate');

            if (hasInappropriateContent) {
              abort('Content validation failed');
            } else {
              messages.push(createMessage('Content validated'));
            }
            return messages;
          },
        };

        const agentWithValidator = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [validationProcessor],
        });

        // Test valid content
        let validResult;
        if (version === 'v1') {
          validResult = await agentWithValidator.generate('This is appropriate content');
        } else {
          validResult = await agentWithValidator.generateVNext('This is appropriate content');
        }
        expect(validResult.text).toContain('Content validated');

        // Test invalid content
        let invalidResult;
        if (version === 'v1') {
          invalidResult = await agentWithValidator.generate('This contains inappropriate content');
        } else {
          invalidResult = await agentWithValidator.generateVNext('This contains inappropriate content');
        }
        expect(invalidResult.tripwire).toBe(true);
        expect(invalidResult.tripwireReason).toBe('Content validation failed');
      });
    });
  });

  describe(`${version} - UIMessageWithMetadata support`, () => {
    let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
    const mockMemory = new MockMemory();

    beforeEach(() => {
      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            finishReason: 'stop',
            usage: { completionTokens: 10, promptTokens: 3 },
            text: 'Response acknowledging metadata',
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'Response' },
                { type: 'text-delta', textDelta: ' acknowledging' },
                { type: 'text-delta', textDelta: ' metadata' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Response' },
              { type: 'text-delta', id: '1', delta: ' acknowledging' },
              { type: 'text-delta', id: '1', delta: ' metadata' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });
      }
    });

    it('should preserve metadata in generate method', async () => {
      const agent = new Agent({
        name: 'metadata-test-agent',
        instructions: 'You are a helpful assistant',
        model: dummyModel,
        memory: mockMemory,
      });

      const messagesWithMetadata = [
        {
          role: 'user' as const,
          content: 'Hello with metadata',
          parts: [{ type: 'text' as const, text: 'Hello with metadata' }],
          metadata: {
            source: 'web-ui',
            customerId: '12345',
            context: { orderId: 'ORDER-789', status: 'pending' },
          },
        },
      ];

      if (version === 'v1') {
        await agent.generate(messagesWithMetadata, {
          memory: {
            resource: 'customer-12345',
            thread: {
              id: 'support-thread',
            },
          },
        });
      } else {
        await agent.generateVNext(messagesWithMetadata, {
          memory: {
            resource: 'customer-12345',
            thread: {
              id: 'support-thread',
            },
          },
        });
      }
      // Verify messages were saved with metadata
      const savedMessages = await mockMemory.getMessages({
        threadId: 'support-thread',
        resourceId: 'customer-12345',
        format: 'v2',
        selectBy: {
          last: 10,
        },
      });

      expect(savedMessages.length).toBeGreaterThan(0);

      // Find the user message
      const userMessage = savedMessages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();

      // Check that metadata was preserved in v2 format
      if (
        userMessage &&
        'content' in userMessage &&
        typeof userMessage.content === 'object' &&
        'metadata' in userMessage.content
      ) {
        expect(userMessage.content.metadata).toEqual({
          source: 'web-ui',
          customerId: '12345',
          context: { orderId: 'ORDER-789', status: 'pending' },
        });
      }
    });

    it('should preserve metadata in stream method', async () => {
      const agent = new Agent({
        name: 'metadata-stream-agent',
        instructions: 'You are a helpful assistant',
        model: dummyModel,
        memory: mockMemory,
      });

      const messagesWithMetadata = [
        {
          role: 'user' as const,
          content: 'Stream with metadata',
          parts: [{ type: 'text' as const, text: 'Stream with metadata' }],
          metadata: {
            source: 'mobile-app',
            sessionId: 'session-123',
            deviceInfo: { platform: 'iOS', version: '17.0' },
          },
        },
      ];

      let stream;
      if (version === 'v1') {
        stream = await agent.stream(messagesWithMetadata, {
          memory: {
            resource: 'user-mobile',
            thread: {
              id: 'mobile-thread',
            },
          },
        });
      } else {
        stream = await agent.streamVNext(messagesWithMetadata, {
          memory: {
            resource: 'user-mobile',
            thread: {
              id: 'mobile-thread',
            },
          },
        });
      }

      // Consume the stream
      let finalText = '';
      for await (const textPart of stream.textStream) {
        finalText += textPart;
      }

      expect(finalText).toBe('Response acknowledging metadata');

      // Verify messages were saved with metadata
      const savedMessages = await mockMemory.getMessages({
        threadId: 'mobile-thread',
        resourceId: 'user-mobile',
        format: 'v2',
        selectBy: {
          last: 10,
        },
      });

      expect(savedMessages.length).toBeGreaterThan(0);

      // Find the user message
      const userMessage = savedMessages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();

      // Check that metadata was preserved
      if (
        userMessage &&
        'content' in userMessage &&
        typeof userMessage.content === 'object' &&
        'metadata' in userMessage.content
      ) {
        expect(userMessage.content.metadata).toEqual({
          source: 'mobile-app',
          sessionId: 'session-123',
          deviceInfo: { platform: 'iOS', version: '17.0' },
        });
      }
    });

    it('should handle mixed messages with and without metadata', async () => {
      const agent = new Agent({
        name: 'mixed-metadata-agent',
        instructions: 'You are a helpful assistant',
        model: dummyModel,
        memory: mockMemory,
      });

      const mixedMessages = [
        {
          role: 'user' as const,
          content: 'First message with metadata',
          parts: [{ type: 'text' as const, text: 'First message with metadata' }],
          metadata: {
            messageType: 'initial',
            priority: 'high',
          },
        },
        {
          role: 'assistant' as const,
          content: 'Response without metadata',
          parts: [{ type: 'text' as const, text: 'Response without metadata' }],
        },
        {
          role: 'user' as const,
          content: 'Second user message',
          parts: [{ type: 'text' as const, text: 'Second user message' }],
          // No metadata on this message
        },
      ];

      if (version === 'v1') {
        await agent.generate(mixedMessages, {
          memory: {
            resource: 'mixed-user',
            thread: {
              id: 'mixed-thread',
            },
          },
        });
      } else {
        await agent.generateVNext(mixedMessages, {
          memory: {
            resource: 'mixed-user',
            thread: {
              id: 'mixed-thread',
            },
          },
        });
      }
      // Verify messages were saved correctly
      const savedMessages = await mockMemory.getMessages({
        threadId: 'mixed-thread',
        resourceId: 'mixed-user',
        format: 'v2',
        selectBy: {
          last: 10,
        },
      });

      expect(savedMessages.length).toBeGreaterThan(0);

      // Find messages and check metadata
      const messagesAsV2 = savedMessages as MastraMessageV2[];
      const firstUserMessage = messagesAsV2.find(
        m =>
          m.role === 'user' &&
          m.content.parts?.[0]?.type === 'text' &&
          m.content.parts[0].text.includes('First message'),
      );
      const secondUserMessage = messagesAsV2.find(
        m =>
          m.role === 'user' && m.content.parts?.[0]?.type === 'text' && m.content.parts[0].text.includes('Second user'),
      );

      // First message should have metadata
      expect(firstUserMessage?.content.metadata).toEqual({
        messageType: 'initial',
        priority: 'high',
      });

      // Second message should not have metadata
      expect(secondUserMessage?.content.metadata).toBeUndefined();
    });
  });

  it(`${version} - stream - should pass and call client side tools with experimental output`, async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openaiModel,
    });

    if (version === 'v1') {
      const result = await userAgent.stream('Make it green', {
        clientTools: {
          changeColor: {
            id: 'changeColor',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              color: z.string(),
            }),
          },
        },
        onFinish: props => {
          expect(props.toolCalls.length).toBeGreaterThan(0);
        },
        experimental_output: z.object({
          color: z.string(),
        }),
      });

      for await (const _ of result.fullStream) {
      }
    } else {
      const result = await userAgent.streamVNext('Make it green', {
        clientTools: {
          changeColor: {
            id: 'changeColor',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              color: z.string(),
            }),
          },
        },
        onFinish: props => {
          expect(props.toolCalls.length).toBeGreaterThan(0);
        },
        output: z.object({
          color: z.string(),
        }),
      });

      await result.consumeStream();
    }
  }, 10000);

  it(`${version} - generate - should pass and call client side tools with experimental output`, async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openaiModel,
    });

    if (version === 'v1') {
      const result = await userAgent.generate('Make it green', {
        clientTools: {
          changeColor: {
            id: 'changeColor',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              color: z.string(),
            }),
          },
        },
        experimental_output: z.object({
          color: z.string(),
        }),
      });

      expect(result.toolCalls.length).toBeGreaterThan(0);
    } else {
      const result = await userAgent.generateVNext('Make it green', {
        clientTools: {
          changeColor: {
            id: 'changeColor',
            description: 'This is a test tool that changes the color of the text',
            inputSchema: z.object({
              color: z.string(),
            }),
          },
        },
        output: z.object({
          color: z.string(),
        }),
      });

      expect(result.toolCalls.length).toBeGreaterThan(0);
    }
  }, 10000);

  describe(
    'model list',
    {
      skip: version === 'v1',
    },
    () => {
      it('should take and return model list', async () => {
        const agent = new Agent({
          name: 'test',
          instructions: 'test agent instructions',
          model: [
            {
              model: openai_v5('gpt-4o'),
            },
            {
              model: openai_v5('gpt-4o-mini'),
            },
            {
              model: openai_v5('gpt-4.1'),
            },
          ],
        });

        const modelList = await agent.getModelList();
        expect(modelList?.length).toBe(3);
        const model0 = modelList?.[0].model as LanguageModelV2;
        expect(model0.modelId).toBe('gpt-4o');
        const model1 = modelList?.[1].model as LanguageModelV2;
        expect(model1.modelId).toBe('gpt-4o-mini');
        const model2 = modelList?.[2].model as LanguageModelV2;
        expect(model2.modelId).toBe('gpt-4.1');
      });

      it('should reorder model list', async () => {
        const agent = new Agent({
          name: 'test',
          instructions: 'test agent instructions',
          model: [
            {
              model: openai_v5('gpt-4o'),
            },
            {
              model: openai_v5('gpt-4o-mini'),
            },
            {
              model: openai_v5('gpt-4.1'),
            },
          ],
        });

        const modelList = await agent.getModelList();

        const modelIds = modelList?.map(m => m.id) || [];
        const reversedModelIds = [...modelIds].reverse();

        agent.reorderModels(reversedModelIds);

        const reorderedModelList = await agent.getModelList();

        expect(reorderedModelList).toBeDefined();
        expect(reorderedModelList?.length).toBe(3);
        expect(reorderedModelList?.[0].id).toBe(reversedModelIds[0]);
        expect(reorderedModelList?.[1].id).toBe(reversedModelIds[1]);

        const model0 = reorderedModelList?.[0].model as LanguageModelV2;
        expect(model0.modelId).toBe('gpt-4.1');
        const model1 = reorderedModelList?.[1].model as LanguageModelV2;
        expect(model1.modelId).toBe('gpt-4o-mini');
      });

      it(`should update model list`, async () => {
        const agent = new Agent({
          name: 'test',
          instructions: 'test agent instructions',
          model: [
            {
              model: openai_v5('gpt-4o'),
            },
            {
              model: openai_v5('gpt-4o-mini'),
            },
            {
              model: openai_v5('gpt-4.1'),
            },
          ],
        });

        const modelList = await agent.getModelList();
        const model1Id = modelList?.[1].id || '';

        agent.updateModelInModelList({
          id: model1Id,
          model: openai_v5('gpt-4'),
          maxRetries: 5,
        });
        const updatedModelList = await agent.getModelList();

        expect(updatedModelList).toBeDefined();
        expect(updatedModelList?.length).toBe(3);
        const updatedModel1 = updatedModelList?.[1].model as LanguageModelV2;
        expect(updatedModel1.modelId).toBe('gpt-4');
        expect(updatedModelList?.[1]?.maxRetries).toBe(5);
        const updatedModel2 = updatedModelList?.[2].model as LanguageModelV2;
        expect(updatedModel2.modelId).toBe('gpt-4.1');
      });

      it('should use model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                throw new Error('Simulated stream error');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          name: 'update-model-agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
            },
            {
              model: premiumModel,
            },
          ],
        });

        const streamResult = await agent.streamVNext('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');

        expect(usedModelName).toBe('premium');
      });

      it('should use maxRetries in model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          name: 'update-model-agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: premiumModel,
            },
          ],
        });

        const streamResult = await agent.streamVNext('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(usedModelName).toBe('premium');
      });

      it('should default to agent maxRetries when not provided in model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;
        let standardModel2: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });
        const streamErrorFn2 = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        standardModel2 = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard2';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn2();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          name: 'update-model-agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: standardModel2,
            },
            {
              model: premiumModel,
            },
          ],
          maxRetries: 2,
        });

        const streamResult = await agent.streamVNext('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(streamErrorFn2).toHaveBeenCalledTimes(3);
        expect(usedModelName).toBe('premium');
      });

      it('should skip models with enabled:false in model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;
        let standardModel2: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });
        const streamErrorFn2 = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        standardModel2 = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard2';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn2();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          name: 'update-model-agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: standardModel2,
              enabled: false,
            },
            {
              model: premiumModel,
            },
          ],
          maxRetries: 2,
        });

        const streamResult = await agent.streamVNext('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(streamErrorFn2).toHaveBeenCalledTimes(0);
        expect(usedModelName).toBe('premium');
      });

      it('should skip rest of the models in the list after getting a successful stream', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let premiumModel2: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        const premiumModel2Fn = vi.fn(() => {
          console.log('premium model 2 called');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Hello, Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Hello, Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        premiumModel2 = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Second Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Second Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium2';
            premiumModel2Fn();
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', Second' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          name: 'update-model-agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: premiumModel,
            },
            {
              model: premiumModel2,
            },
          ],
          maxRetries: 2,
        });

        const streamResult = await agent.streamVNext('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(premiumModel2Fn).toHaveBeenCalledTimes(0);
        expect(usedModelName).toBe('premium');
      });

      it('should throw an error if a v1 model is provided in an array of models', async () => {
        const v1Model = new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              initialDelayInMs: 0,
              chunkDelayInMs: 1,
              chunks: [
                { type: 'text-delta', textDelta: 'Hello! ' },
                { type: 'text-delta', textDelta: 'I am ' },
                { type: 'text-delta', textDelta: 'a helpful assistant.' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 20 },
                },
              ],
            }),
            rawCall: { rawPrompt: [], rawSettings: {} },
          }),
        });
        const v2Model = new MockLanguageModelV2({
          doGenerate: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Hello, Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Hello, Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
        const agent = new Agent({
          name: 'update-model-agent',
          instructions: 'test agent',
          model: [{ model: v2Model }, { model: v1Model }],
        });

        try {
          await agent.getLLM();
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.generate('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.stream('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.generateVNext('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.streamVNext('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }
      });
    },
  );

  describe('scorer output data', () => {
    it(`${version} - should return scoring data from generate when returnScorerData is true`, async () => {
      const agent = new Agent({
        name: 'Scorer Agent',
        instructions: 'You are an agent that can score things',
        model: dummyModel,
      });

      let result;
      if (version === 'v1') {
        result = await agent.generate('Make it green', {
          returnScorerData: true,
        });
      } else {
        result = await agent.generateVNext('Make it green', {
          returnScorerData: true,
        });
      }

      expect(result.scoringData).toBeDefined();
      expect(result.scoringData.input).toMatchObject({
        inputMessages: expect.any(Array),
        rememberedMessages: expect.any(Array),
        systemMessages: expect.any(Array),
        taggedSystemMessages: expect.any(Object),
      });
      expect(result.scoringData.output).toBeInstanceOf(Array);
    });

    it(`${version} - should not return scoring data from generate when returnScorerData is false`, async () => {
      const agent = new Agent({
        name: 'Scorer Agent',
        instructions: 'You are an agent that can score things',
        model: dummyModel,
      });

      let result;
      if (version === 'v1') {
        result = await agent.generate('Make it green', {
          returnScorerData: false,
        });
      } else {
        result = await agent.generateVNext('Make it green', {
          returnScorerData: false,
        });
      }

      expect(result.scoringData).toBeUndefined();
    });

    it(`${version} - should not return scoring data from generate when returnScorerData is not specified`, async () => {
      const agent = new Agent({
        name: 'Scorer Agent',
        instructions: 'You are an agent that can score things',
        model: dummyModel,
      });

      let result;
      if (version === 'v1') {
        result = await agent.generate('Make it green');
      } else {
        result = await agent.generateVNext('Make it green');
      }

      expect(result.scoringData).toBeUndefined();
    });
  });

  describe('scorer override functionality', () => {
    let agent: Agent;
    let mastra: Mastra;
    let scorerTest: any;
    let scorer1: any;

    beforeEach(() => {
      vi.clearAllMocks();
      scorerTest = createScorer({
        name: 'scorerTest',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      scorer1 = createScorer({
        name: 'scorer1',
        description: 'Test Scorer 1',
      }).generateScore(() => 0.95);

      agent = new Agent({
        name: 'Test Agent',
        instructions: 'You are a test agent.',
        model: dummyModel,
        scorers: {
          scorerTest: {
            scorer: scorerTest,
          },
        },
      });

      mastra = new Mastra({
        agents: { agent },
        logger: false,
        scorers: { scorer1 },
      });
    });

    it(`${version} - should call scorerTest when no override is provided`, async () => {
      if (version === 'v1') {
        await agent.generate('Hello world');
      } else {
        await agent.generateVNext('Hello world');
      }

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorerTest',
          scorerObject: expect.objectContaining({
            scorer: scorerTest,
          }),
        }),
      );
    });

    it(`${version} - should use override scorers when provided in generate options`, async () => {
      if (version === 'v1') {
        await agent.generate('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      } else {
        await agent.generateVNext('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      }

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer1',
          scorerObject: expect.objectContaining({
            scorer: expect.any(Object),
          }),
        }),
      );

      expect(runScorer).not.toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorerTest',
          scorerObject: expect.objectContaining({
            scorer: scorerTest,
          }),
        }),
      );

      expect(runScorer).toHaveBeenCalledTimes(1);
    });

    it(`${version} - should call scorers when provided in stream options`, async () => {
      let result: any;
      if (version === 'v1') {
        result = await agent.stream('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      } else {
        result = await agent.streamVNext('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      }
      await result.consumeStream();

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer1',
          scorerObject: expect.objectContaining({
            scorer: expect.any(Object),
          }),
        }),
      );
    });

    it(`${version} - can use scorer name for scorer config for generate`, async () => {
      if (version === 'v1') {
        await agent.generate('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      } else {
        await agent.generateVNext('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      }

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer1',
          scorerObject: expect.objectContaining({
            scorer: scorer1,
          }),
        }),
      );
    });

    it(`${version} - should call runScorer with correct parameters`, async () => {
      if (version === 'v1') {
        await agent.generate('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      } else {
        await agent.generateVNext('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      }

      // Verify the exact call parameters
      expect(runScorer).toHaveBeenCalledWith({
        scorerId: 'scorer1',
        scorerObject: { scorer: scorer1 },
        runId: expect.any(String),
        input: expect.any(Object),
        output: expect.any(Object),
        runtimeContext: expect.any(Object),
        entity: expect.objectContaining({
          id: 'Test Agent',
          name: 'Test Agent',
        }),
        source: 'LIVE',
        entityType: 'AGENT',
        structuredOutput: false,
        threadId: undefined,
        resourceId: undefined,
        tracingContext: expect.any(Object),
      });
    });
  });

  describe('defaultStreamOptions onFinish callback bug', () => {
    it(`${version} - should call onFinish from defaultStreamOptions when no options are passed to stream`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish',
        name: 'Test Default onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }
          : {
              defaultVNextStreamOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }),
      });

      // Call stream without passing any options - should use defaultStreamOptions
      const result = version === 'v1' ? await agent.stream('How are you?') : await agent.streamVNext('How are you?');

      // Consume the stream to trigger onFinish
      if (version === 'v1') {
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }
        expect(fullText).toBe('Dummy response');
      } else {
        await result.consumeStream();
      }

      expect(onFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
    });

    it(`${version} - should call onFinish from defaultStreamOptions when empty options are passed to stream`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish-empty',
        name: 'Test Default onFinish Empty',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }
          : {
              defaultVNextStreamOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }),
      });

      // Call stream with empty options - should still use defaultStreamOptions
      const result =
        version === 'v1' ? await agent.stream('How are you?', {}) : await agent.streamVNext('How are you?', {});

      // Consume the stream to trigger onFinish
      if (version === 'v1') {
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }
        expect(fullText).toBe('Dummy response');
      } else {
        await result.consumeStream();
      }

      expect(onFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
    });

    it(`${version} - should prioritize passed onFinish over defaultStreamOptions onFinish`, async () => {
      let defaultOnFinishCalled = false;
      let passedOnFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-override-onfinish',
        name: 'Test Override onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptions: {
                onFinish: () => {
                  defaultOnFinishCalled = true;
                },
              },
            }
          : {
              defaultVNextStreamOptions: {
                onFinish: () => {
                  defaultOnFinishCalled = true;
                },
              },
            }),
      });

      // Call stream with explicit onFinish - should override defaultStreamOptions
      const result =
        version === 'v1'
          ? await agent.stream('How are you?', {
              onFinish: data => {
                passedOnFinishCalled = true;
                finishData = data;
              },
            })
          : await agent.streamVNext('How are you?', {
              onFinish: data => {
                passedOnFinishCalled = true;
                finishData = data;
              },
            });

      // Consume the stream to trigger onFinish
      if (version === 'v1') {
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }
        expect(fullText).toBe('Dummy response');
      } else {
        await result.consumeStream();
      }

      expect(defaultOnFinishCalled).toBe(false);
      expect(passedOnFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
    });
  });

  describe(`${version} - streamVNext onFinish usage bug`, () => {
    it(`should include usage property in onFinish callback for ${version}`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-usage-onfinish',
        name: 'Test Usage onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
      });

      let result: any;

      const onFinish = (data: any) => {
        onFinishCalled = true;
        finishData = data;
      };

      if (version === 'v1') {
        result = await agent.stream('How are you?', {
          onFinish,
        });
      } else {
        result = await agent.streamVNext('How are you?', {
          onFinish,
        });
      }

      // Consume the stream to trigger onFinish
      await result.consumeStream();

      expect(onFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
      expect(finishData).toHaveProperty('usage');
      expect(finishData.usage).toBeDefined();
      expect(typeof finishData.usage).toBe('object');

      // Check for expected usage properties
      if (finishData.usage) {
        expect(finishData.usage).toHaveProperty('totalTokens');
        expect(typeof finishData.usage.totalTokens).toBe('number');
      }
    });
  });
}

describe('Agent Tests', () => {
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
        model: openai_v5('gpt-4o'),
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
          model: openai_v5('gpt-4o'),
        });

        await expect(agentWithoutVoice.voice.getSpeakers()).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.speak('Test')).rejects.toThrow('No voice provider configured');
        await expect(agentWithoutVoice.voice.listen(new PassThrough())).rejects.toThrow('No voice provider configured');
      });
    });
  });

  it('should preserve empty assistant messages after tool use', () => {
    const messageList = new MessageList();

    const assistantToolCall_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'testTool', toolCallId: 'tool-1', args: {} }],
    };
    const toolMessage_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'testTool', toolCallId: 'tool-1', result: 'res1' }],
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

    const finalCoreMessages = messageList.get.all.core();

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

  it('should properly sanitize incomplete tool calls from memory messages', () => {
    const messageList = new MessageList();
    // Original CoreMessages for context, but we'll test the output of list.get.all.core()
    const toolResultOne_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'test-tool-1', toolCallId: 'tool-1', result: 'res1' }],
    };
    const toolCallTwo_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'test-tool-2', toolCallId: 'tool-2', args: {} }],
    };
    const toolResultTwo_Core: CoreMessage = {
      role: 'tool',
      content: [{ type: 'tool-result', toolName: 'test-tool-2', toolCallId: 'tool-2', result: 'res2' }],
    };
    const toolCallThree_Core: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolName: 'test-tool-3', toolCallId: 'tool-3', args: {} }],
    };

    // Add messages. addOne will merge toolCallTwo and toolResultTwo.
    // toolCallThree is orphaned.
    messageList.add(toolResultOne_Core, 'memory');
    messageList.add(toolCallTwo_Core, 'memory');
    messageList.add(toolResultTwo_Core, 'memory');
    messageList.add(toolCallThree_Core, 'memory');

    const finalCoreMessages = messageList.get.all.core();

    // Expected: toolCallThree (orphaned assistant call) should be gone.
    // toolResultOne assumes the tool call was completed, so should be present
    // toolCallTwo and toolResultTwo should be present and correctly paired by convertToCoreMessages.

    // Check that tool-1 is present, as a result assumes the tool call was completed
    expect(
      finalCoreMessages.find(
        m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-1'),
      ),
    ).toBeDefined();

    // Check that tool-2 call and result are present
    const assistantCallForTool2 = finalCoreMessages.find(
      m =>
        m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-2'),
    );
    expect(assistantCallForTool2).toBeDefined();
    expect(assistantCallForTool2?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-call', toolCallId: 'tool-2', toolName: 'test-tool-2' }),
      ]),
    );

    const toolResultForTool2 = finalCoreMessages.find(
      m => m.role === 'tool' && (m.content as any[]).some(p => p.type === 'tool-result' && p.toolCallId === 'tool-2'),
    );
    expect(toolResultForTool2).toBeDefined();
    expect(toolResultForTool2?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-result', toolCallId: 'tool-2', toolName: 'test-tool-2', result: 'res2' }),
      ]),
    );

    // Check that tool-3 (orphaned call) is not present
    expect(
      finalCoreMessages.find(
        m =>
          m.role === 'assistant' && (m.content as any[]).some(p => p.type === 'tool-call' && p.toolCallId === 'tool-3'),
      ),
    ).toBeUndefined();

    expect(finalCoreMessages.length).toBe(4); // Assistant call for tool-1, Tool result for tool-1, Assistant call for tool-2, Tool result for tool-2
  });

  agentTests({ version: 'v1' });
  agentTests({ version: 'v2' });

  describe('agent.stopWhen', () => {
    const weatherTool = createTool({
      id: 'weather-tool',
      description: 'Get weather for a location',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async context => {
        const { location } = context;
        return {
          temperature: 70,
          feelsLike: 65,
          humidity: 50,
          windSpeed: 10,
          windGust: 15,
          conditions: 'sunny',
          location,
        };
      },
    });

    const planActivities = createTool({
      id: 'plan-activities',
      description: 'Plan activities based on the weather',
      inputSchema: z.object({
        temperature: z.string(),
      }),
      execute: async () => {
        return { activities: 'Plan activities based on the weather' };
      },
    });

    const agent = new Agent({
      name: 'test-step-boundaries',
      instructions:
        'You are a helpful assistant. Figure out the weather and then using that weather plan some activities. Always use the weather tool first, and then the plan activities tool with the result of the weather tool',
      model: openai_v5('gpt-4o-mini'),
      tools: {
        weatherTool,
        planActivities,
      },
    });

    it('should demonstrate that stopWhen gets the proper step results in the first step', async () => {
      let stopWhenCallCount = 0;
      const stopWhenCalls: { callNumber: number; steps: any[] }[] = [];

      const stream = await agent.streamVNext('What should i be doing in Toronto today?', {
        stopWhen: ({ steps }) => {
          stopWhenCallCount++;
          // Store the call details
          stopWhenCalls.push({
            callNumber: stopWhenCallCount,
            steps: JSON.parse(JSON.stringify(steps)), // Deep copy to preserve state
          });

          // Check if any step has tool calls
          const hasToolCalls = steps.some(step => {
            return step.content && step.content.some(item => item.type === 'tool-call' || item.type === 'tool-result');
          });

          if (hasToolCalls) {
            console.log(`Found tool calls in steps, attempting to stop...`);
            // Try to stop immediately after finding tool calls
            return true;
          }

          return false;
        },
      });

      const chunks: ChunkType[] = [];
      let stepStartCount = 0;
      let foundToolCallChunk = false;
      let foundTextChunk = false;
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);

        if (chunk.type === 'step-start') {
          stepStartCount++;
        } else if (chunk.type === 'tool-call') {
          foundToolCallChunk = true;
        } else if (chunk.type === 'text-delta' && chunk.payload.text.trim()) {
          foundTextChunk = true;
        }
      }

      expect(foundToolCallChunk).toBe(true);

      expect(stepStartCount).toBe(1);
      expect(foundTextChunk).toBe(false);

      expect(stopWhenCallCount).toBe(1);
    }, 10000);

    it('should not call stopWhen on the final step', async () => {
      let stopWhenCallCount = 0;
      const stopWhenCalls: { callNumber: number; stepCount: number }[] = [];

      const trackStopWhenCalls = ({ steps }: { steps: any[] }) => {
        stopWhenCallCount++;
        stopWhenCalls.push({
          callNumber: stopWhenCallCount,
          stepCount: steps.length,
        });

        return false;
      };

      const stream = await agent.streamVNext('What should i be doing in Toronto today?', {
        stopWhen: trackStopWhenCalls,
      });

      let stepStartCount = 0;
      let stepFinishCount = 0;

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'step-start') {
          stepStartCount++;
          console.log(`Step ${stepStartCount} started`);
        } else if (chunk.type === 'step-finish') {
          stepFinishCount++;
          console.log(`Step ${stepFinishCount} finished`);
        }
      }

      await stream.consumeStream();

      // Verify that stopWhen is called n-1 times for n steps
      expect(stepStartCount).toBe(stepFinishCount);
      expect(stepStartCount).toBeGreaterThanOrEqual(2);

      expect(stopWhenCallCount).toBe(stepStartCount - 1);

      stopWhenCalls.forEach((call, index) => {
        expect(call.stepCount).toBe(index + 1);
      });
    }, 10000);

    it('should contain the correct content in the step results for both stopWhen and stream.steps', async () => {
      const stopWhenContent: any[] = [];
      const stream = await agent.streamVNext('What should i be doing in Toronto today?', {
        stopWhen: ({ steps }) => {
          stopWhenContent.push(steps.at(-1)?.content);
          return false;
        },
      });

      await stream.consumeStream();

      const steps = await stream.steps;

      expect(stopWhenContent[0].length).toBe(2);
      expect(stopWhenContent[1].length).toBe(2);

      expect(steps[0].content.length).toBe(2);
      expect(steps[1].content.length).toBe(2);
      expect(steps[2].content.length).toBe(1);

      expect(stopWhenContent[1]).not.toEqual(stopWhenContent[0]);
    }, 10000);

    it('should contain the correct content in the step results for both stopWhen and stream.steps with text and tool calls in the same step', async () => {
      const agent = new Agent({
        name: 'test-step-boundaries',
        instructions:
          'You are a helpful assistant. Figure out the weather and then using that weather plan some activities. Always use the weather tool first, and then the plan activities tool with the result of the weather tool. Every tool call you make IMMEDIATELY explain the tool results after executing the tool, before moving on to other steps or tool calls',
        model: openai_v5('gpt-4o-mini'),
        tools: {
          weatherTool,
          planActivities,
        },
      });

      const stopWhenContent: any[] = [];
      const stream = await agent.streamVNext('What should i be doing in Toronto today?', {
        stopWhen: ({ steps }) => {
          stopWhenContent.push(steps.at(-1)?.content);
          return false;
        },
      });

      await stream.consumeStream();
      const steps = await stream.steps;

      expect(stopWhenContent[0].length).toBe(2);
      expect(stopWhenContent[1].length).toBe(3); // text explaining the previous tool-call-results, tool-call, tool-result

      expect(steps[0].content.length).toBe(2);
      expect(steps[1].content.length).toBe(3); // text explaining the previous tool-call-results, tool-call, tool-result
      expect(steps[2].content.length).toBe(1);

      expect(stopWhenContent[1]).not.toEqual(stopWhenContent[0]);
    }, 10000);
  });
});

//     it('should accept and execute both Mastra and Vercel tools in Agent constructor', async () => {
//       const mastraExecute = vi.fn().mockResolvedValue({ result: 'mastra' });
//       const vercelExecute = vi.fn().mockResolvedValue({ result: 'vercel' });

//       const agent = new Agent({
//         name: 'test',
//         instructions: 'test agent instructions',
//         model: openai('gpt-4'),
//         tools: {
//           mastraTool: createTool({
//             id: 'test',
//             description: 'test',
//             inputSchema: z.object({ name: z.string() }),
//             execute: mastraExecute,
//           }),
//           vercelTool: {
//             description: 'test',
//             parameters: {
//               type: 'object',
//               properties: {
//                 name: { type: 'string' },
//               },
//             },
//             execute: vercelExecute,
//           },
//         },
//       });

//       // Verify tools exist
//       expect((agent.getTools() as Agent['tools']).mastraTool).toBeDefined();
//       expect((agent.getTools() as Agent['tools']).vercelTool).toBeDefined();

//       // Verify both tools can be executed
//       // @ts-ignore
//       await (agent.getTools() as Agent['tools']).mastraTool.execute!({ name: 'test' });
//       // @ts-ignore
//       await (agent.getTools() as Agent['tools']).vercelTool.execute!({ name: 'test' });

//       expect(mastraExecute).toHaveBeenCalled();
//       expect(vercelExecute).toHaveBeenCalled();
//     });

// });

describe('Stream ID Consistency', () => {
  /**
   * Test to verify that stream response IDs match database-saved message IDs
   */

  let memory: MockMemory;
  let mastra: Mastra;

  beforeEach(() => {
    memory = new MockMemory();
    mastra = new Mastra();
  });

  it('should return stream response IDs that can fetch saved messages from database', async () => {
    const model = new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          initialDelayInMs: 0,
          chunkDelayInMs: 1,
          chunks: [
            { type: 'text-delta', textDelta: 'Hello! ' },
            { type: 'text-delta', textDelta: 'I am ' },
            { type: 'text-delta', textDelta: 'a helpful assistant.' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
            },
          ],
        }),
        rawCall: { rawPrompt: [], rawSettings: {} },
      }),
    });

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model,
      // model: openai('gpt-4o'),
      memory,
    });

    agent.__registerMastra(mastra);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const streamResult = await agent.stream('Hello!', {
      threadId,
      resourceId,
    });

    let streamResponseId: string | undefined;
    for await (const _chunk of streamResult.fullStream) {
      console.log('DEBUG chunk', _chunk);
    }
    await streamResult.consumeStream();

    const finishedResult = streamResult;
    const response = await finishedResult.response;

    streamResponseId = response?.messages?.[0]?.id;

    console.log('DEBUG streamResponseId', streamResponseId);
    expect(streamResponseId).toBeDefined();

    const savedMessages = await memory.getMessages({ threadId });

    const messageById = savedMessages.find(m => m.id === streamResponseId);

    expect(messageById).toBeDefined();
    expect(messageById!.id).toBe(streamResponseId);
  });

  it('should use custom ID generator for streaming and keep stream response IDs consistent with database', async () => {
    let customIdCounter = 0;
    const customIdGenerator = vi.fn(() => `custom-id-${++customIdCounter}`);

    const model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Hello! I am a helpful assistant.',
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          initialDelayInMs: 0,
          chunkDelayInMs: 1,
          chunks: [
            { type: 'text-delta', textDelta: 'Hello! ' },
            { type: 'text-delta', textDelta: 'I am ' },
            { type: 'text-delta', textDelta: 'a helpful assistant.' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
            },
          ],
        }),
        rawCall: { rawPrompt: [], rawSettings: {} },
      }),
    });

    const mastraWithCustomId = new Mastra({
      idGenerator: customIdGenerator,
      logger: false,
    });

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastraWithCustomId);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const stream = await agent.stream('Hello!', { threadId, resourceId });

    await stream.consumeStream();
    const res = await stream.response;
    const messageId = res.messages[0].id;

    const savedMessages = await memory.getMessages({ threadId, selectBy: { include: [{ id: messageId }] } });

    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0].id).toBe(messageId);
    expect(customIdGenerator).toHaveBeenCalled();
  });

  it('should return streamVNext response IDs that can fetch saved messages from database', async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'v2-msg-xyz123',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello! ' },
          { type: 'text-delta', id: '1', delta: 'I am a ' },
          { type: 'text-delta', id: '1', delta: 'helpful assistant.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastra);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const streamResult = await agent.streamVNext('Hello!', {
      threadId,
      resourceId,
    });

    await streamResult.consumeStream();

    let streamResponseId: string | undefined;
    const res = await streamResult.response;
    streamResponseId = res.uiMessages[0].id;

    expect(streamResponseId).toBeDefined();

    const savedMessages = await memory.getMessages({ threadId, selectBy: { include: [{ id: streamResponseId! }] } });
    const messageById = savedMessages.find(m => m.id === streamResponseId);

    expect(messageById).toBeDefined();
    expect(messageById!.id).toBe(streamResponseId);
  });

  it('should use custom ID generator for streamVNext and keep stream response IDs consistent with database', async () => {
    let customIdCounter = 0;
    const customIdGenerator = vi.fn(() => `custom-v2-id-${++customIdCounter}`);

    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'text',
            text: 'Hello! I am a helpful assistant.',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'custom-v2-msg-xyz123',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello! ' },
          { type: 'text-delta', id: '1', delta: 'I am a ' },
          { type: 'text-delta', id: '1', delta: 'helpful assistant.' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const mastraWithCustomId = new Mastra({
      idGenerator: customIdGenerator,
      logger: false,
    });

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    agent.__registerMastra(mastraWithCustomId);

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    const stream = await agent.streamVNext('Hello!', { threadId, resourceId });

    await stream.consumeStream();
    const res = await stream.response;
    const messageId = res.uiMessages[0].id;
    const savedMessages = await memory.getMessages({ threadId, selectBy: { include: [{ id: messageId }] } });
    expect(savedMessages).toHaveLength(1);
    expect(savedMessages[0].id).toBe(messageId);
    expect(customIdGenerator).toHaveBeenCalled();
  });

  describe('onFinish callback with structured output', () => {
    it('should include object field in onFinish callback when using structured output', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{"name":"John","age":30}' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      });

      const agent = new Agent({
        name: 'test-structured-output-onfinish',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
      });

      let onFinishResult: any = null;
      let onFinishCalled = false;

      const outputSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const response = await agent.generateVNext(
        [
          {
            role: 'user',
            content: 'Extract the person data',
          },
        ],
        {
          output: outputSchema,
          onFinish: async result => {
            onFinishCalled = true;
            onFinishResult = result;
          },
        },
      );

      // Wait a bit to ensure onFinish is called
      await new Promise(resolve => setTimeout(resolve, 100));

      // The main function should return the structured data correctly
      expect(response.object).toBeDefined();
      expect(response.object).toEqual({ name: 'John', age: 30 });

      // onFinish should have been called
      expect(onFinishCalled).toBe(true);
      expect(onFinishResult).toBeDefined();

      // The fix: onFinish result should now include the object field
      expect(onFinishResult.object).toBeDefined();
      expect(onFinishResult.object).toEqual({ name: 'John', age: 30 });
    }, 10000); // Increase timeout to 10 seconds
  });

  it('should include object field in onFinish callback when using structuredOutput key', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'The person is John who is 30 years old' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const structuringModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: '{"name":"John","age":30}' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      name: 'test-structured-output-processor-onfinish',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
    });

    let onFinishResult: any = null;
    let onFinishCalled = false;

    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const response = await agent.generateVNext(
      [
        {
          role: 'user',
          content: 'Extract the person data',
        },
      ],
      {
        structuredOutput: {
          schema: outputSchema,
          model: structuringModel,
        },
        onFinish: async result => {
          onFinishCalled = true;
          onFinishResult = result;
        },
      },
    );

    // Wait a bit to ensure onFinish is called
    await new Promise(resolve => setTimeout(resolve, 100));

    // The main function should return the structured data correctly
    expect(response.object).toBeDefined();
    expect(response.object).toEqual({ name: 'John', age: 30 });

    // onFinish should have been called
    expect(onFinishCalled).toBe(true);
    expect(onFinishResult).toBeDefined();

    // The fix: onFinish result should now include the object field
    expect(onFinishResult.object).toBeDefined();
    expect(onFinishResult.object).toEqual({ name: 'John', age: 30 });
  }, 10000); // Increase timeout to 10 seconds

  it('should have messageIds when using toUIMessageStream', async () => {
    const mockMemory = new MockMemory();
    const threadId = randomUUID();
    const resourceId = 'user-1';
    const initialThread: StorageThreadType = {
      id: threadId,
      resourceId,
      metadata: { client: 'initial' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: openai_v5('gpt-4o'),
      memory: mockMemory,
    });

    const mastra = new Mastra({ agents: { test: agent } });
    agent.__registerMastra(mastra);

    const stream = await agent.streamVNext('Hello!', { threadId, resourceId, format: 'aisdk' });

    // Get the UI message stream
    const uiStream = stream.toUIMessageStream();

    // Collect all chunks from the UI stream to verify message ID is present
    const chunks: UIMessageChunk[] = [];
    const reader = uiStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const messages = await mockMemory.getMessages({ threadId });
    console.log('messages', messages);

    const assistantMessage = messages.find((m: MastraMessageV1) => m.role === 'assistant');
    console.log('assistantMessage', assistantMessage);
    const startEvent = chunks.find(chunk => chunk.type === 'start');
    console.log('startEvent', startEvent);

    expect(assistantMessage?.id).toBe(startEvent?.messageId);
  });
});

describe('Agent structuredOutput to output deprecation mapping', () => {
  const structuredOutputPrompt = 'Extract and structure the key information';

  it('should map structuredOutput to output when maxSteps is 1', async () => {
    let structuredOutputProcessorGotCalled = false;
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          content: [
            {
              type: 'text',
              text: '{"name": "John", "age": 30}',
            },
          ],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          warnings: [],
        };
      },
      doStream: async options => {
        if (
          options.prompt.some(
            p =>
              Array.isArray(p.content) &&
              p.content.some(c => c.type === 'text' && c.text.includes(structuredOutputPrompt)),
          )
        ) {
          structuredOutputProcessorGotCalled = true;
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{"name": "John", "age": 30}' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      name: 'test-structured-deprecation',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
    });

    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = await agent.streamVNext(
      [
        {
          role: 'user',
          content: 'Generate a person',
        },
      ],
      {
        structuredOutput: {
          schema: outputSchema,
        },
        maxSteps: 1,
      },
    );

    expect(structuredOutputProcessorGotCalled).toBe(false);
    expect(await result.object).toEqual({ name: 'John', age: 30 });
  });

  it('should NOT map structuredOutput to output when maxSteps is not 1', async () => {
    let structuredOutputProcessorGotCalled = false;

    const structuringModel = new MockLanguageModelV2({
      doGenerate: async options => {
        if (
          options.prompt.some(
            p =>
              Array.isArray(p.content) &&
              p.content.some(c => c.type === 'text' && c.text.includes(structuredOutputPrompt)),
          )
        ) {
          structuredOutputProcessorGotCalled = true;
        }
        return {
          content: [
            {
              type: 'text',
              text: '{"name": "John", "age": 30}',
            },
          ],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          warnings: [],
        };
      },
      doStream: async options => {
        if (
          options.prompt.some(
            p =>
              Array.isArray(p.content) &&
              p.content.some(c => c.type === 'text' && c.text.includes(structuredOutputPrompt)),
          )
        ) {
          structuredOutputProcessorGotCalled = true;
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{"name": "John", "age": 30}' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          content: [
            {
              type: 'text',
              text: 'Response text',
            },
          ],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          warnings: [],
        };
      },
      doStream: async () => {
        return {
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Response text' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      name: 'test-structured-no-deprecation',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
    });

    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = await agent.streamVNext(
      [
        {
          role: 'user',
          content: 'Generate a person',
        },
      ],
      {
        structuredOutput: {
          schema: outputSchema,
          model: structuringModel,
        },
        maxSteps: 2,
      },
    );

    await result.consumeStream();

    expect(structuredOutputProcessorGotCalled).toBe(true);
    expect(await result.object).toEqual({ name: 'John', age: 30 });
  });

  it('should use model override from structuredOutput when maxSteps is 1', async () => {
    let defaultModelGotCalled = false;
    let overrideModelGotCalled = false;
    const defaultModel = new MockLanguageModelV2({
      modelId: 'default-model',
      doGenerate: async () => ({
        content: [
          {
            type: 'text',
            text: 'Default model response',
          },
        ],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        warnings: [],
      }),

      doStream: async () => {
        defaultModelGotCalled = true;
        return {
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{"name": "Default", "age": 1}' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const overrideModel = new MockLanguageModelV2({
      modelId: 'override-model',
      doGenerate: async () => ({
        content: [
          {
            type: 'text',
            text: 'Override model response',
          },
        ],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        warnings: [],
      }),
      doStream: async () => {
        overrideModelGotCalled = true;
        return {
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{"name": "Override", "age": 99}' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      name: 'test-model-override',
      instructions: 'You are a helpful assistant.',
      model: defaultModel,
    });

    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = await agent.streamVNext(
      [
        {
          role: 'user',
          content: 'Generate a person',
        },
      ],
      {
        structuredOutput: {
          schema: outputSchema,
          model: overrideModel,
        },
        maxSteps: 1,
      },
    );

    await result.consumeStream();

    expect(defaultModelGotCalled).toBe(false);
    expect(overrideModelGotCalled).toBe(true);
    expect(await result.object).toEqual({ name: 'Override', age: 99 });
  });
});
