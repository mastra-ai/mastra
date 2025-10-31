import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2, LanguageModelV2TextPart } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import type { CoreMessage, LanguageModelV1, CoreSystemMessage } from 'ai';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { APICallError, stepCountIs } from 'ai-v5';
import type { SystemModelMessage } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { config } from 'dotenv';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TestIntegration } from '../integration/openapi-toolset.mock';
import { noopLogger } from '../logger';
import { Mastra } from '../mastra';
import type { MastraMessageV2, StorageThreadType } from '../memory';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { MockStore } from '../storage';
import type { MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools';
import { delay } from '../utils';
import { MessageList } from './message-list/index';
import { assertNoDuplicateParts } from './test-utils';
import { Agent } from './index';

config();

const mockStorage = new MockStore();

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
        response = await agentOne.generateLegacy('Who won the 2016 US presidential election?');
      } else {
        response = await agentOne.generate('Who won the 2016 US presidential election?');
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
        response = await agentOne.streamLegacy('Who won the 2016 US presidential election?');
      } else {
        response = await agentOne.stream('Who won the 2016 US presidential election?');
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
        response = await agentOne.generateLegacy('Who won the 2012 US presidential election?', {
          output: z.object({
            winner: z.string(),
          }),
        });
      } else {
        response = await agentOne.generate('Who won the 2012 US presidential election?', {
          structuredOutput: {
            schema: z.object({
              winner: z.string(),
            }),
          },
        });
      }

      const { object } = response;
      expect(object.winner).toContain('Barack Obama');
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
        response = await agentOne.streamLegacy('Who won the 2012 US presidential election?', {
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
        response = await agentOne.stream('Who won the 2012 US presidential election?', {
          structuredOutput: {
            schema: z.object({
              winner: z.string(),
            }),
          },
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

    describe('tool approval and suspension', () => {
      describe.skipIf(version === 'v1')('requireToolApproval', () => {
        it('should call findUserTool with requireToolApproval on tool and be able to reject the tool call', async () => {
          mockFindUser.mockClear(); // Reset mock call count before this test

          const findUserTool = createTool({
            id: 'Find user tool',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              name: z.string(),
            }),
            // requireApproval: true,
            execute: async input => {
              return mockFindUser(input) as Promise<Record<string, any>>;
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
            storage: mockStorage,
          });

          const agentOne = mastra.getAgent('userAgent');

          const stream = await agentOne.stream('Find the user with name - Dero Israel', { requireToolApproval: true });
          let toolCallId = '';
          for await (const _chunk of stream.fullStream) {
            if (_chunk.type === 'tool-call-approval') {
              toolCallId = _chunk.payload.toolCallId;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          const resumeStream = await agentOne.declineToolCall({ runId: stream.runId, toolCallId });
          for await (const _chunk of resumeStream.fullStream) {
            console.log(_chunk);
          }

          const toolResults = await resumeStream.toolResults;

          expect((await resumeStream.toolCalls).length).toBe(1);
          expect(toolResults.length).toBe(1);
          expect(toolResults[0].payload?.result).toBe('Tool call was not approved by the user');
          expect(mockFindUser).toHaveBeenCalledTimes(0);
        }, 500000);

        it('should call findUserTool with requireToolApproval on agent', async () => {
          const findUserTool = createTool({
            id: 'Find user tool',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              name: z.string(),
            }),
            execute: async input => {
              return mockFindUser(input) as Promise<Record<string, any>>;
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
            storage: mockStorage,
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
            const stream = await agentOne.stream('Find the user with name - Dero Israel', {
              requireToolApproval: true,
            });
            let toolCallId = '';
            for await (const _chunk of stream.fullStream) {
              if (_chunk.type === 'tool-call-approval') {
                toolCallId = _chunk.payload.toolCallId;
              }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const resumeStream = await agentOne.approveToolCall({ runId: stream.runId, toolCallId });
            for await (const _chunk of resumeStream.fullStream) {
            }

            toolCall = (await resumeStream.toolResults).find(
              (result: any) => result.payload.toolName === 'findUserTool',
            ).payload;
          }

          const name = toolCall?.result?.name;

          expect(mockFindUser).toHaveBeenCalled();
          expect(name).toBe('Dero Israel');
        }, 500000);

        it('should call findUserTool with requireToolApproval on tool', async () => {
          const findUserTool = createTool({
            id: 'Find user tool',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              name: z.string(),
            }),
            requireApproval: true,
            execute: async input => {
              return mockFindUser(input) as Promise<Record<string, any>>;
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
            storage: mockStorage,
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
            const stream = await agentOne.stream('Find the user with name - Dero Israel');
            let toolCallId = '';
            for await (const _chunk of stream.fullStream) {
              if (_chunk.type === 'tool-call-approval') {
                toolCallId = _chunk.payload.toolCallId;
              }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const resumeStream = await agentOne.approveToolCall({ runId: stream.runId, toolCallId });
            for await (const _chunk of resumeStream.fullStream) {
            }

            toolCall = (await resumeStream.toolResults).find(
              (result: any) => result.payload.toolName === 'findUserTool',
            ).payload;
          }

          const name = toolCall?.result?.name;

          expect(mockFindUser).toHaveBeenCalled();
          expect(name).toBe('Dero Israel');
        }, 500000);
      });

      describe.skipIf(version === 'v1')('suspension', () => {
        it('should call findUserTool with suspend and resume', async () => {
          const findUserTool = createTool({
            id: 'Find user tool',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              name: z.string(),
            }),
            suspendSchema: z.object({
              message: z.string(),
            }),
            resumeSchema: z.object({
              name: z.string(),
            }),
            execute: async (input, context) => {
              console.log('context', context);
              if (!context?.agent?.resumeData) {
                return await context?.agent?.suspend({ message: 'Please provide the name of the user' });
              }

              return {
                name: context?.agent?.resumeData?.name,
                email: 'test@test.com',
              };
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
            storage: mockStorage,
          });

          const agentOne = mastra.getAgent('userAgent');

          let toolCall;
          const stream = await agentOne.stream('Find the user with name - Dero Israel');
          for await (const _chunk of stream.fullStream) {
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          const resumeStream = await agentOne.resumeStream({ name: 'Dero Israel' }, { runId: stream.runId });
          for await (const _chunk of resumeStream.fullStream) {
          }

          toolCall = (await resumeStream.toolResults).find(
            (result: any) => result.payload.toolName === 'findUserTool',
          ).payload;

          const name = toolCall?.result?.name;
          const email = toolCall?.result?.email;

          expect(name).toBe('Dero Israel');
          expect(email).toBe('test@test.com');
        }, 10000);
      });

      describe.skipIf(version === 'v1')('persist model output stream state', () => {
        it('should persist text stream state', async () => {
          const findUserTool = createTool({
            id: 'Find user tool',
            description: 'This is a test tool that returns the name and email',
            inputSchema: z.object({
              name: z.string(),
            }),
            execute: async input => {
              return mockFindUser(input) as Promise<Record<string, any>>;
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
            storage: mockStorage,
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
            const stream = await agentOne.stream(
              'First tell me about what tools you have. Then call the user tool to find the user with name - Dero Israel. Then tell me about what format you received the data and tell me what it would look like in human readable form.',
              {
                requireToolApproval: true,
              },
            );
            let firstText = '';
            let toolCallId = '';
            for await (const chunk of stream.fullStream) {
              if (chunk.type === 'text-delta') {
                firstText += chunk.payload.text;
              }
              if (chunk.type === 'tool-call-approval') {
                toolCallId = chunk.payload.toolCallId;
              }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const resumeStream = await agentOne.resumeStream({ approved: true }, { runId: stream.runId, toolCallId });
            let secondText = '';
            for await (const chunk of resumeStream.fullStream) {
              if (chunk.type === 'text-delta') {
                secondText += chunk.payload.text;
              }
            }

            const finalText = await resumeStream.text;

            const steps = await resumeStream.steps;
            const textBySteps = steps.map(step => step.text);

            expect(finalText).toBe(firstText + secondText);
            expect(steps.length).toBe(2);
            expect(textBySteps.join('')).toBe(firstText + secondText);
            toolCall = (await resumeStream.toolResults).find(
              (result: any) => result.payload.toolName === 'findUserTool',
            ).payload;
          }

          const name = toolCall?.result?.name;

          expect(mockFindUser).toHaveBeenCalled();
          expect(name).toBe('Dero Israel');
        }, 500000);
      });
    });

    it('should call findUserTool', async () => {
      const findUserTool = createTool({
        id: 'Find user tool',
        description: 'This is a test tool that returns the name and email',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: (input, context) => {
          return mockFindUser(input) as Promise<Record<string, any>>;
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
    }, 500000);

    it('generate - should pass and call client side tools', async () => {
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
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
    }, 500000);

    it('stream - should pass and call client side tools', async () => {
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
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

    it('should generate with default max steps', { timeout: 10000 }, async () => {
      const findUserTool = createTool({
        id: 'Find user tool',
        description: 'This is a test tool that returns the name and email',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async input => {
          return mockFindUser(input) as Promise<Record<string, any>>;
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
        res = await agentOne.generateLegacy(
          'Use the \"findUserTool\" to Find the user with name - Joe and return the name and email',
        );
        toolCall = res.steps[0].toolResults.find((result: any) => result.toolName === 'findUserTool');
      } else {
        res = await agentOne.generate(
          'Use the \"findUserTool\" to Find the user with name - Joe and return the name and email',
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
        response = await agent.generateLegacy('Call testTool 10 times.', {
          toolChoice: 'required',
        });
      } else {
        response = await agent.generate('Call testTool 10 times.', {
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
        response = await agent.generateLegacy('Call testTool 10 times.', {
          toolChoice: 'required',
          maxSteps: 7,
        });
      } else {
        response = await agent.generate('Call testTool 10 times.', {
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
        execute: async input => {
          toolCallCount++;
          if (toolCallCount <= failuresBeforeSuccess) {
            throw new Error(`Tool failed! Attempt ${toolCallCount}. Please try again.`);
          }
          return { output: `Success on attempt ${toolCallCount}: ${input.input}` };
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
        response = await agent.generateLegacy('Please call the flakey tool with input "test data"', {
          maxSteps: 5,
        });
      } else {
        response = await agent.generate('Please call the flakey tool with input "test data"', {
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
          generateTitle: {
            model: titleModel,
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
        await agent.generateLegacy('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              title: 'New Thread 2024-01-01T00:00:00.000Z', // Starts with "New Thread" to trigger title generation
            },
          },
        });
      } else {
        await agent.generate('What is the weather like today?', {
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
          generateTitle: {
            model: ({ requestContext }: { requestContext: RequestContext }) => {
              const userTier = requestContext.get('userTier');
              return userTier === 'premium' ? premiumModel : standardModel;
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
      const requestContext = new RequestContext();
      requestContext.set('userTier', 'premium');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-premium',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-premium',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('premium');

      // Reset and test with standard tier
      usedModelName = '';
      const standardContext = new RequestContext();
      standardContext.set('userTier', 'standard');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-standard',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: standardContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-standard',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: standardContext,
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
        await agent.generateLegacy('Test message');
      } else {
        await agent.generate('Test message');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('standard');

      agent.__updateModel({ model: premiumModel });
      usedModelName = '';

      if (version === 'v1') {
        await agent.generateLegacy('Test message');
      } else {
        await agent.generate('Test message');
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
          generateTitle: true,
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
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-bool',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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
          generateTitle: false,
        };
      };

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-bool-false',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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
          generateTitle: {
            model: errorModel,
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
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-error',
              title: originalTitle,
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-undefined',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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
          generateTitle: {
            model: titleModel,
            instructions: ({ requestContext }: { requestContext: RequestContext }) => {
              const language = requestContext.get('language');
              return language === 'ja'
                ? '会話内容に基づいて簡潔なタイトルを生成してください'
                : 'Generate a concise title based on the conversation';
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
      const japaneseContext = new RequestContext();
      japaneseContext.set('language', 'ja');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-ja',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: japaneseContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-ja',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: japaneseContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedLanguage).toBe('ja');
      expect(capturedPrompt).toContain('簡潔なタイトル');

      // Reset and test with English context
      capturedPrompt = '';
      usedLanguage = '';
      const englishContext = new RequestContext();
      englishContext.set('language', 'en');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-en',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: englishContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-en',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: englishContext,
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
          generateTitle: {
            model: titleModel,
            instructions: customInstructions,
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
        await agent.generateLegacy('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-custom-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('What is the weather like today?', {
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
          generateTitle: {
            model: titleModel,
            // instructions field is intentionally omitted
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
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-default',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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
          generateTitle: {
            model: titleModel,
            instructions: () => {
              throw new Error('Instructions selection failed');
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
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-instructions-error',
              title: originalTitle,
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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
          generateTitle: {
            model: titleModel1,
            instructions: '', // Empty string
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
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-empty-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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
          generateTitle: {
            model: titleModel2,
            instructions: () => '', // Function returning empty string
          },
        };
      };

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-null-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
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

  describe(`${version} - context parameter handling`, () => {
    const formatArray: ('mastra' | 'aisdk')[] = version === 'v1' ? ['mastra'] : ['mastra', 'aisdk'];
    formatArray.forEach(format => {
      it(`should handle system messages in context parameter ${version === 'v2' ? `format: ${format}` : ''}`, async () => {
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
          result = await agent.streamLegacy('Tell me about yourself', {
            context: [systemMessage, userMessage, complexSystemMessage],
          });
        } else {
          result = await agent.stream('Tell me about yourself', {
            context: [systemMessage, userMessage, complexSystemMessage],
            format,
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
          const requestData = await (result as any).getFullOutput();
          messages = requestData.request.body.input;
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
      }, 20000);

      it(`should handle mixed message types in context parameter ${version === 'v2' ? `format: ${format}` : ''}`, async () => {
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
          result = await agent.streamLegacy('Current question', {
            context: contextMessages,
          });
        } else {
          result = await agent.stream('Current question', {
            context: contextMessages,
            format,
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
          const requestData = await (result as any).getFullOutput();
          messages = requestData.request.body.input;
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
        await agent.generateLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test' },
            },
          },
        });
      } else {
        await agent.generate('hello', {
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
        await agent.generateLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'updated' },
            },
          },
        });
      } else {
        await agent.generate('hello', {
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
        await agent.generateLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'same' },
            },
          },
        });
      } else {
        await agent.generate('hello', {
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
        res = await agent.streamLegacy('hello', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              metadata: { client: 'test-stream' },
            },
          },
        });
      } else {
        res = await agent.stream('hello', {
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
        await agent.generateLegacy('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });
      } else {
        await agent.generate('hello', {
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
        stream = await agent.streamLegacy('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });
      } else {
        stream = await agent.stream('hello', {
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
      let capturedRequestContext: RequestContext | undefined;

      const agent = new Agent({
        name: 'test-agent',
        instructions: ({ requestContext, mastra }) => {
          capturedRequestContext = requestContext;
          capturedMastra = mastra;

          const logger = mastra?.getLogger();
          logger?.debug('Running with context', { info: requestContext.get('info') });

          return 'You are a helpful assistant.';
        },
        model: dummyModel,
        mastra,
      });

      const requestContext = new RequestContext();
      requestContext.set('info', 'test-info');

      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('hello', { requestContext });
      } else {
        response = await agent.generate('hello', { requestContext });
      }

      expect(response.text).toBe('Logger test response');
      expect(capturedMastra).toBe(mastra);
      expect(capturedRequestContext).toBe(requestContext);
      expect(capturedRequestContext?.get('info')).toBe('test-info');
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
        response = await agent.generateLegacy('hello');
      } else {
        response = await agent.generate('hello');
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
        response = await agent.generateLegacy('hello');
      } else {
        response = await agent.generate('hello');
      }

      expect(response.text).toBe('Logger test response');
      expect(capturedMastra).toBeUndefined();
    });
  });

  describe(`${version} - Agent instructions with SystemMessage types`, () => {
    it('should support string instructions (backward compatibility)', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toBe('You are a helpful assistant.');
    });

    it('should support CoreSystemMessage instructions', async () => {
      const systemMessage: CoreSystemMessage = {
        role: 'system',
        content: 'You are an expert programmer.',
      };

      const agent = new Agent({
        name: 'test-agent',
        instructions: systemMessage,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(systemMessage);
    });

    it('should support SystemModelMessage instructions', async () => {
      const systemMessage: SystemModelMessage = {
        role: 'system',
        content: 'You are a data analyst.',
      };

      const agent = new Agent({
        name: 'test-agent',
        instructions: systemMessage,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(systemMessage);
    });

    it('should support array of string instructions', async () => {
      const instructionsArray = ['You are a helpful assistant.', 'Always be polite.', 'Provide detailed answers.'];

      const agent = new Agent({
        name: 'test-agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should support array of CoreSystemMessage instructions', async () => {
      const instructionsArray: CoreSystemMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'system', content: 'Always be polite.' },
      ];

      const agent = new Agent({
        name: 'test-agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should support array of CoreSystemMessage with provider metadata', async () => {
      const instructionsArray: CoreSystemMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'system',
          content: 'Always be polite.',
          experimental_providerMetadata: { anthropic: { cache_control: { type: 'ephemeral' } } },
        },
        {
          role: 'system',
          content: 'Use technical language.',
          providerOptions: { openai: { reasoning_effort: 'medium' } },
        },
      ];

      const agent = new Agent({
        name: 'test-agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should support dynamic instructions returning string', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: ({ requestContext }) => {
          const role = requestContext?.get('role') || 'assistant';
          return `You are a helpful ${role}.`;
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('role', 'teacher');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toBe('You are a helpful teacher.');
    });

    it('should support dynamic instructions returning CoreSystemMessage', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: ({ requestContext }) => {
          const role = requestContext?.get('role') || 'assistant';
          return {
            role: 'system',
            content: `You are a helpful ${role}.`,
          };
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('role', 'doctor');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual({
        role: 'system',
        content: 'You are a helpful doctor.',
      });
    });

    it('should support dynamic instructions returning array', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: ({ requestContext }) => {
          const expertise = (requestContext?.get('expertise') as string[]) || [];
          const expertiseMessages: CoreSystemMessage[] = expertise.map((exp: string) => ({
            role: 'system',
            content: `You have expertise in ${exp}.`,
          }));
          const messages: CoreSystemMessage[] = [
            { role: 'system', content: 'You are a helpful assistant.' },
            ...expertiseMessages,
          ];
          return messages;
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('expertise', ['Python', 'JavaScript']);

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'system', content: 'You have expertise in Python.' },
        { role: 'system', content: 'You have expertise in JavaScript.' },
      ]);
    });

    it('should support async dynamic instructions', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: async ({ requestContext }) => {
          // Simulate async operation
          await delay(10);
          const role = requestContext?.get('role') || 'assistant';
          return {
            role: 'system',
            content: `You are an async ${role}.`,
          };
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('role', 'consultant');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual({
        role: 'system',
        content: 'You are an async consultant.',
      });
    });

    it('should combine instructions with system option in generate', async () => {
      // This test verifies that both agent instructions and user-provided system messages
      // are properly combined when using generate
      // For now, we're just testing that the functionality doesn't break
      // Full integration testing would require checking the actual messages sent to the LLM

      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: dummyModel,
      });

      const additionalSystem: CoreSystemMessage = {
        role: 'system',
        content: 'Be concise in your responses.',
      };

      if (version === 'v2') {
        // This test only applies to V2
        // Simply verify that generate works with the system option
        // without throwing errors
        const response = await agent.generate('Hello', {
          system: additionalSystem,
        });

        // Basic check that response was generated
        expect(response.text).toBe('Dummy response');
      } else {
        // Skip for V1
        expect(true).toBe(true);
      }
    });

    it('should combine array instructions with array system option', async () => {
      // This test verifies that array instructions and array system messages
      // are properly combined when using generate

      // Use CoreSystemMessage array instead of mixed array
      const agentInstructions: CoreSystemMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'system', content: 'You are an expert.' },
      ];

      const agent = new Agent({
        name: 'test-agent',
        instructions: agentInstructions,
        model: dummyModel,
      });

      // Use string array for additional system messages
      const additionalSystem: string[] = ['Be concise.', 'Use examples.'];

      if (version === 'v2') {
        // This test only applies to V2
        // Simply verify that generate works with array system option
        // without throwing errors
        const response = await agent.generate('Hello', {
          system: additionalSystem,
        });

        // Basic check that response was generated
        expect(response.text).toBe('Dummy response');
      } else {
        // Skip for V1
        expect(true).toBe(true);
      }
    });

    it('should handle empty instructions gracefully', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: '',
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toBe('');
    });

    it('should handle empty array instructions', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: [],
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual([]);
    });

    it('should allow override instructions in generate options', async () => {
      const agent = new Agent({
        name: 'override-agent',
        instructions: 'Default instructions',
        model: dummyModel,
      });

      if (version === 'v1') {
        const response = await agent.generateLegacy('Hello', {
          instructions: {
            role: 'system',
            content: 'Override instructions',
          },
        });
        expect(response.text).toBe('Dummy response');
      } else {
        // For v2, use generate
        const response = await agent.generate('Hello', {
          instructions: {
            role: 'system',
            content: 'Override instructions',
          },
        });
        expect(response.text).toBe('Dummy response');
      }
    });

    it('should convert CoreSystemMessage instructions for voice', async () => {
      const mockVoice = {
        addInstructions: vi.fn(),
        addTools: vi.fn(),
      };

      const agent = new Agent({
        name: 'voice-agent',
        instructions: {
          role: 'system',
          content: 'You are a helpful voice assistant.',
        },
        model: dummyModel,
        voice: mockVoice as any,
      });

      await agent.getVoice();

      // Verify voice received the instruction text
      expect(mockVoice.addInstructions).toHaveBeenCalledWith('You are a helpful voice assistant.');
    });

    it('should support SystemModelMessage with providerOptions', async () => {
      const systemMessage: SystemModelMessage = {
        role: 'system',
        content: 'You are an expert programmer.',
        providerOptions: {
          openai: { reasoning_effort: 'high' },
        },
      };

      const agent = new Agent({
        name: 'test-agent',
        instructions: systemMessage,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(systemMessage);
    });

    it('should support array of SystemModelMessage', async () => {
      const instructionsArray: SystemModelMessage[] = [
        {
          role: 'system',
          content: 'You are an expert.',
          providerOptions: { openai: { temperature: 0.7 } },
        },
        {
          role: 'system',
          content: 'Be concise.',
          providerOptions: { openai: { max_tokens: 100 } },
        },
      ];

      const agent = new Agent({
        name: 'test-agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should combine instructions with system option in stream', async () => {
      if (version === 'v2') {
        const agent = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant.',
          model: dummyModel,
        });

        const additionalSystem = {
          role: 'system' as const,
          content: 'Be concise in your responses.',
        };

        const stream = await agent.stream('Hello', {
          system: additionalSystem,
        });

        // Verify stream completes without error
        const result = await stream.getFullOutput();
        expect(result).toBeDefined();
      } else {
        expect(true).toBe(true);
      }
    });

    it('should allow override with array instructions in generate options', async () => {
      const agent = new Agent({
        name: 'override-array-agent',
        instructions: 'Default instructions',
        model: dummyModel,
      });

      if (version === 'v1') {
        const response = await agent.generateLegacy('Hello', {
          instructions: ['Override instruction 1', 'Override instruction 2'],
        });
        expect(response.text).toBe('Dummy response');
      } else {
        // For v2, use generate
        const response = await agent.generate('Hello', {
          instructions: ['Override instruction 1', 'Override instruction 2'],
        });
        expect(response.text).toBe('Dummy response');
      }
    });

    it('should support dynamic instructions returning SystemModelMessage', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: ({ requestContext }) => {
          const mode = requestContext?.get('mode') || 'default';
          return {
            role: 'system' as const,
            content: `You are in ${mode} mode.`,
            providerOptions: {
              openai: { temperature: mode === 'creative' ? 0.9 : 0.3 },
            },
          } as SystemModelMessage;
        },
        model: dummyModel,
      });

      const requestContext = new RequestContext();
      requestContext.set('mode', 'creative');

      const instructions = await agent.getInstructions({ requestContext });
      expect(instructions).toEqual({
        role: 'system',
        content: 'You are in creative mode.',
        providerOptions: { openai: { temperature: 0.9 } },
      });
    });

    it('should preserve provider options when building message list', async () => {
      // This test verifies that provider options (like Anthropic caching) are preserved
      // when instructions are added to the message list
      const agent = new Agent({
        name: 'test-agent',
        instructions: {
          role: 'system',
          content: 'You are a helpful assistant with caching.',
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        } as SystemModelMessage,
        model: dummyModel,
      });

      // Spy on MessageList.addSystem to capture what's being added
      const addSystemSpy = vi.spyOn(MessageList.prototype, 'addSystem');

      if (version === 'v2') {
        try {
          // This will trigger the message list building
          await agent.generate('Hello');

          // Check all addSystem calls
          const systemMessageCalls = addSystemSpy.mock.calls.filter(call => {
            const msg = call[0];
            return typeof msg === 'object' && msg !== null && 'role' in msg && msg.role === 'system';
          });

          // Find calls that have provider options
          const messagesWithProviderOptions = systemMessageCalls
            .map(call => call[0])
            .filter((msg): msg is SystemModelMessage => {
              return (
                typeof msg === 'object' && msg !== null && 'providerOptions' in msg && msg.providerOptions !== undefined
              );
            });

          // Verify provider options are preserved
          expect(messagesWithProviderOptions.length).toBeGreaterThan(0);
          expect(messagesWithProviderOptions?.[0]?.providerOptions).toEqual({
            anthropic: { cacheControl: { type: 'ephemeral' } },
          });
        } finally {
          // Restore the spy
          addSystemSpy.mockRestore();
        }
      } else {
        // Skip for v1
        expect(true).toBe(true);
      }
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
          execute: async input => ({ output: input.input }),
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
            await agent.generateLegacy(
              'Please echo this and then use the error tool. Be verbose and take multiple steps.',
              {
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
              },
            );
          } else {
            await agent.generate('Please echo this and then use the error tool. Be verbose and take multiple steps.', {
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
            });
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
          execute: async input => ({ output: input.input }),
        });

        const agent = new Agent({
          name: 'test-agent-generate',
          instructions: 'If the user prompt contains "Echo:", always call the echoTool. Be verbose in your response.',
          model: openaiModel,
          memory: mockMemory,
          tools: { echoTool },
        });

        if (version === 'v1') {
          await agent.generateLegacy('Echo: Please echo this long message and explain why.', {
            threadId: 'thread-echo-generate',
            resourceId: 'resource-echo-generate',
            savePerStep: true,
          });
        } else {
          await agent.generate('Echo: Please echo this long message and explain why.', {
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
          execute: async input => ({ output: input.input }),
        });

        const uppercaseTool = createTool({
          id: 'uppercaseTool',
          description: 'Converts input to uppercase.',
          inputSchema: z.object({ input: z.string() }),
          outputSchema: z.object({ output: z.string() }),
          execute: async input => ({ output: input.input.toUpperCase() }),
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
          await agent.generateLegacy(
            'Echo: Please echo this message. Uppercase: please also uppercase this message. Explain both results.',
            {
              threadId: 'thread-multi-generate',
              resourceId: 'resource-multi-generate',
              savePerStep: true,
            },
          );
        } else {
          await agent.generate(
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
          await agent.generateLegacy('repeat tool calls', {
            threadId: 'thread-1-generate',
            resourceId: 'resource-1-generate',
          });
        } else {
          await agent.generate('repeat tool calls', {
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
          await agent.generateLegacy('no progress', {
            threadId: `thread-2-${version}-generate`,
            resourceId: `resource-2-${version}-generate`,
          });
        } else {
          await agent.generate('no progress', {
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
          await agent.generateLegacy('interrupt before step', {
            threadId: 'thread-3-generate',
            resourceId: 'resource-3-generate',
          });
        } else {
          await agent.generate('interrupt before step', {
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
          await agent.generateLegacy('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err',
              },
            },
          });
        } else {
          await agent.generate('trigger error', {
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
  });

  if (version === 'v2') {
    describe('error handling consistency', () => {
      it('should preserve full APICallError in fullStream chunk, onError callback, and result.error', async () => {
        let onErrorCallbackError: any = null;
        let fullStreamError: any = null;

        const testAPICallError = new APICallError({
          message: 'Test API error',
          url: 'https://test.api.com',
          requestBodyValues: { test: 'test' },
          statusCode: 401,
          isRetryable: false,
          responseBody: 'Test API error response',
        });

        const errorModel = new MockLanguageModelV2({
          doStream: async () => {
            throw testAPICallError;
          },
        });

        const agent = new Agent({
          id: 'test-apicall-error-consistency',
          name: 'Test APICallError Consistency',
          model: errorModel,
          instructions: 'You are a helpful assistant.',
        });

        const result = await agent.stream('Hello', {
          onError: ({ error }) => {
            onErrorCallbackError = error;
          },
          modelSettings: {
            maxRetries: 0,
          },
        });

        // Consume fullStream to capture error chunk
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'error') {
            fullStreamError = chunk.payload.error;
          }
        }

        const resultError = result.error;

        // All three should be the exact same APICallError instance (reference equality)
        expect(onErrorCallbackError).toBe(testAPICallError);
        expect(fullStreamError).toBe(testAPICallError);
        expect(resultError).toBe(testAPICallError);

        // Verify it's an APICallError instance
        expect(onErrorCallbackError).toBeInstanceOf(APICallError);
      });

      it('should preserve the error.cause in fullStream error chunks, onError callback, and result.error', async () => {
        const testErrorCauseMessage = 'Test error cause message';
        const testErrorCause = new Error(testErrorCauseMessage);

        const testErrorMessage = 'Test API error';
        const testErrorStatusCode = 401;
        const testErrorRequestId = 'req_123';
        const testError = new Error(testErrorMessage, { cause: testErrorCause });
        // Add some custom properties to verify they're preserved
        (testError as any).statusCode = testErrorStatusCode;
        (testError as any).requestId = testErrorRequestId;

        const errorModel = new MockLanguageModelV2({
          doStream: async () => {
            throw testError;
          },
        });

        const agent = new Agent({
          id: 'test-error-consistency',
          name: 'Test Error Consistency',
          model: errorModel,
          instructions: 'You are a helpful assistant.',
        });

        let onErrorCallbackError: any = null;
        let fullStreamError: any = null;

        const result = await agent.stream('Hello', {
          onError: ({ error }) => {
            onErrorCallbackError = error;
          },
          modelSettings: {
            maxRetries: 0,
          },
        });

        // Consume fullStream to capture error chunk
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'error') {
            fullStreamError = chunk.payload.error;
          }
        }

        // Get result.error
        const resultError = result.error;

        // All three should be defined
        expect(onErrorCallbackError).toBeDefined();
        expect(fullStreamError).toBeDefined();
        expect(resultError).toBeDefined();

        // All three should be Error instances
        expect(onErrorCallbackError instanceof Error).toBe(true);
        expect(fullStreamError instanceof Error).toBe(true);
        expect(resultError instanceof Error).toBe(true);

        expect(onErrorCallbackError).toBe(testError);
        expect(fullStreamError).toBe(testError);
        expect(resultError).toBe(testError);

        expect(onErrorCallbackError.message).toBe(testErrorMessage);
        expect(fullStreamError.message).toBe(testErrorMessage);
        expect((resultError as Error).message).toBe(testErrorMessage);

        // should preserve custom properties
        expect(onErrorCallbackError.statusCode).toBe(testErrorStatusCode);
        expect(onErrorCallbackError.requestId).toBe(testErrorRequestId);
        expect(fullStreamError.statusCode).toBe(testErrorStatusCode);
        expect(fullStreamError.requestId).toBe(testErrorRequestId);
        expect((resultError as any).statusCode).toBe(testErrorStatusCode);
        expect((resultError as any).requestId).toBe(testErrorRequestId);

        // should preserve the error cause
        expect(onErrorCallbackError.cause).toBe(testErrorCause);
        expect(fullStreamError.cause).toBe(testErrorCause);
        expect((resultError as Error).cause).toBe(testErrorCause);
      });

      it('should expose the same error in fullStream error chunks, onError callback, and result.error', async () => {
        const testErrorMessage = 'Test API error';
        const testErrorStatusCode = 401;
        const testErrorRequestId = 'req_123';
        const testError = new Error(testErrorMessage);
        // Add some custom properties to verify they're preserved
        (testError as any).statusCode = testErrorStatusCode;
        (testError as any).requestId = testErrorRequestId;

        const errorModel = new MockLanguageModelV2({
          doStream: async () => {
            throw testError;
          },
        });

        const agent = new Agent({
          id: 'test-error-consistency',
          name: 'Test Error Consistency',
          model: errorModel,
          instructions: 'You are a helpful assistant.',
        });

        let onErrorCallbackError: any = null;
        let fullStreamError: any = null;

        const result = await agent.stream('Hello', {
          onError: ({ error }) => {
            onErrorCallbackError = error;
          },
          modelSettings: {
            maxRetries: 0,
          },
        });

        // Consume fullStream to capture error chunk
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'error') {
            fullStreamError = chunk.payload.error;
          }
        }

        // Get result.error
        const resultError = result.error;

        // should be defined
        expect(onErrorCallbackError).toBeDefined();
        expect(fullStreamError).toBeDefined();
        expect(resultError).toBeDefined();

        // should be Error instances
        expect(onErrorCallbackError instanceof Error).toBe(true);
        expect(fullStreamError instanceof Error).toBe(true);
        expect(resultError instanceof Error).toBe(true);

        expect(onErrorCallbackError).toBe(testError);
        expect(fullStreamError).toBe(testError);
        expect(resultError).toBe(testError);

        // should have the same message
        expect(onErrorCallbackError.message).toBe(testErrorMessage);
        expect(fullStreamError.message).toBe(testErrorMessage);
        expect((resultError as Error).message).toBe(testErrorMessage);

        // should preserve custom properties
        expect(onErrorCallbackError.statusCode).toBe(testErrorStatusCode);
        expect(onErrorCallbackError.requestId).toBe(testErrorRequestId);
        expect(fullStreamError.statusCode).toBe(testErrorStatusCode);
        expect(fullStreamError.requestId).toBe(testErrorRequestId);
        expect((resultError as any).statusCode).toBe(testErrorStatusCode);
        expect((resultError as any).requestId).toBe(testErrorRequestId);
      });
    });

    describe('stream options', () => {
      it('should call options.onError when stream error occurs in stream', async () => {
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

        const stream = await agent.stream('Hello', {
          onError: ({ error }) => {
            errorCaught = true;
            caughtError = error;
          },
          modelSettings: {
            maxRetries: 0,
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

      it('should call options.onChunk when streaming in stream', async () => {
        const agent = new Agent({
          id: 'test-options-onchunk',
          name: 'Test Options OnChunk',
          model: dummyModel,
          instructions: 'You are a helpful assistant.',
        });

        const chunks: any[] = [];

        const stream = await agent.stream('Hello', {
          onChunk: chunk => {
            chunks.push(chunk);
          },
        });

        // Consume the stream to trigger chunks
        await stream.consumeStream();

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0]).toHaveProperty('type');
      });

      it('should call options.onAbort when stream is aborted in stream', async () => {
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

        const stream = await agent.stream('Hello', {
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
    describe(`${version} - stream destructuring support`, () => {
      it('should support destructuring of stream properties and methods', async () => {
        const agent = new Agent({
          id: 'test-destructuring',
          name: 'Test Destructuring',
          model: openaiModel,
          instructions: 'You are a helpful assistant.',
        });

        const result = await agent.stream('Say hello');

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
          result = await agentWithProcessor.generateLegacy('Hello world');
        } else {
          result = await agentWithProcessor.generate('Hello world');
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
          result = await agentWithProcessors.generateLegacy('Hello');
        } else {
          result = await agentWithProcessors.generate('Hello');
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
          result = await agentWithAsyncProcessors.generateLegacy('Test async');
        } else {
          result = await agentWithAsyncProcessors.generate('Test async');
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
          result = await agentWithAbortProcessor.generateLegacy('This should be aborted');
        } else {
          result = await agentWithAbortProcessor.generate('This should be aborted');
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
          result = await agentWithCustomAbort.generateLegacy('Custom abort test');
        } else {
          result = await agentWithCustomAbort.generate('Custom abort test');
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
          result = await agentWithAbortSequence.generateLegacy('Abort sequence test');
        } else {
          result = await agentWithAbortSequence.generate('Abort sequence test');
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
          stream = await agentWithStreamProcessor.streamLegacy('Stream test');
        } else {
          stream = await agentWithStreamProcessor.stream('Stream test');
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
          stream = await agentWithStreamAbort.streamLegacy('Stream abort test');
          expect(stream.tripwire).toBe(true);
          expect(stream.tripwireReason).toBe('Stream aborted');
        } else {
          stream = await agentWithStreamAbort.stream('Stream abort test');

          for await (const chunk of stream.fullStream) {
            expect(chunk.type).toBe('tripwire');
            expect(chunk.payload.tripwireReason).toBe('Stream aborted');
          }
          const fullOutput = await (stream as MastraModelOutput<any>).getFullOutput();
          expect(fullOutput.tripwire).toBe(true);
          expect(fullOutput.tripwireReason).toBe('Stream aborted');
        }

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
          stream = await agentWithDeployerAbort.streamLegacy('Deployer abort test');
        } else {
          stream = await agentWithDeployerAbort.stream('Deployer abort test');
        }

        if (version === 'v1') {
          expect(stream.tripwire).toBe(true);
          expect(stream.tripwireReason).toBe('Deployer test abort');
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
        } else if (version === 'v2') {
          const fullOutput = await (stream as MastraModelOutput<any>).getFullOutput();
          expect(fullOutput.tripwire).toBe(true);
          expect(fullOutput.tripwireReason).toBe('Deployer test abort');
        }
      });
    });

    describe('dynamic input processors', () => {
      it('should support function-based input processors', async () => {
        const requestContext = new RequestContext<{ processorMessage: string }>();
        requestContext.set('processorMessage', 'Dynamic message');

        const agentWithDynamicProcessors = new Agent({
          name: 'test-agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: ({ requestContext }) => {
            const message: string = requestContext.get('processorMessage') || 'Default message';
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
          result = await agentWithDynamicProcessors.generateLegacy('Test dynamic', {
            requestContext,
          });
        } else {
          result = await agentWithDynamicProcessors.generate('Test dynamic', {
            requestContext,
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
          result = await agentWithEmptyProcessors.generateLegacy('No processors test');
        } else {
          result = await agentWithEmptyProcessors.generate('No processors test');
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
          result = await agentWithModifier.generateLegacy('Original user message');
        } else {
          result = await agentWithModifier.generate('Original user message');
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
          validResult = await agentWithValidator.generateLegacy('This is appropriate content');
        } else {
          validResult = await agentWithValidator.generate('This is appropriate content');
        }
        expect(validResult.text).toContain('Content validated');

        // Test invalid content
        let invalidResult;
        if (version === 'v1') {
          invalidResult = await agentWithValidator.generateLegacy('This contains inappropriate content');
        } else {
          invalidResult = await agentWithValidator.generate('This contains inappropriate content');
        }
        expect(invalidResult.tripwire).toBe(true);
        expect(invalidResult.tripwireReason).toBe('Content validation failed');
      });
    });
  });

  it(`${version} - stream - should pass and call client side tools with experimental output`, async () => {
    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using client side tools.',
      model: openaiModel,
    });

    if (version === 'v1') {
      const result = await userAgent.streamLegacy('Make it green', {
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
        structuredOutput: {
          schema: z.object({
            color: z.string(),
          }),
        },
      });

      await result.consumeStream();
    }
  }, 10000);

  // TODO: This test is flakey, but it's blocking PR merges
  it.skipIf(version === 'v2')(
    `${version} - generate - should pass and call client side tools with experimental output`,
    async () => {
      const userAgent = new Agent({
        name: 'User agent',
        instructions: 'You are an agent that can get list of users using client side tools.',
        model: openaiModel,
      });

      if (version === 'v1') {
        const result = await userAgent.generateLegacy('Make it green', {
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
        const result = await userAgent.generate('Make it green', {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'This is a test tool that changes the color of the text',
              inputSchema: z.object({
                color: z.string(),
              }),
            },
          },
          structuredOutput: {
            schema: z.object({
              color: z.string(),
            }),
          },
        });

        expect(result.toolCalls.length).toBeGreaterThan(0);
      }
    },
    30000,
  );

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
      const result = version === 'v1' ? await agent.streamLegacy('How are you?') : await agent.stream('How are you?');

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
        version === 'v1' ? await agent.streamLegacy('How are you?', {}) : await agent.stream('How are you?', {});

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
          ? await agent.streamLegacy('How are you?', {
              onFinish: data => {
                passedOnFinishCalled = true;
                finishData = data;
              },
            })
          : await agent.stream('How are you?', {
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

  describe(`${version} - stream onFinish usage bug`, () => {
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
        result = await agent.streamLegacy('How are you?', {
          onFinish,
        });
      } else {
        result = await agent.stream('How are you?', {
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
//       expect((agent.listTools() as Agent['tools']).mastraTool).toBeDefined();
//       expect((agent.listTools() as Agent['tools']).vercelTool).toBeDefined();

//       // Verify both tools can be executed
//       // @ts-ignore
//       await (agent.listTools() as Agent['tools']).mastraTool.execute!({ name: 'test' });
//       // @ts-ignore
//       await (agent.listTools() as Agent['tools']).vercelTool.execute!({ name: 'test' });

//       expect(mastraExecute).toHaveBeenCalled();
//       expect(vercelExecute).toHaveBeenCalled();
//     });
// });
