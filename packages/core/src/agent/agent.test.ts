import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LanguageModelV2CallOptions, LanguageModelV2TextPart } from '@ai-sdk/provider-v5';
import type { CoreMessage, CoreSystemMessage } from '@internal/ai-sdk-v4';
import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { APICallError, tool } from '@internal/ai-sdk-v5';
import type { SystemModelMessage } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { config } from 'dotenv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { TestIntegration } from '../integration/openapi-toolset.mock';
import { noopLogger } from '../logger';
import { Mastra } from '../mastra';
import type { MastraDBMessage, StorageThreadType } from '../memory';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import type { MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools';
import { delay } from '../utils';
import { Workspace, LocalFilesystem } from '../workspace';
import { MessageList } from './message-list/index';
import { Agent } from './index';

config();

function agentTests({ version }: { version: 'v1' | 'v2' }) {
  const _integration = new TestIntegration();
  let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
  let electionModel: MockLanguageModelV1 | MockLanguageModelV2;
  let obamaObjectModel: MockLanguageModelV1 | MockLanguageModelV2;

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
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
            { type: 'text-end', id: 'text-1' },
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
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Donald Trump' },
            { type: 'text-delta', id: 'text-1', delta: ` won` },
            { type: 'text-delta', id: 'text-1', delta: ` the` },
            { type: 'text-delta', id: 'text-1', delta: ` ` },
            { type: 'text-delta', id: 'text-1', delta: `201` },
            { type: 'text-delta', id: 'text-1', delta: `6` },
            { type: 'text-delta', id: 'text-1', delta: ` US` },
            { type: 'text-delta', id: 'text-1', delta: ` presidential` },
            { type: 'text-delta', id: 'text-1', delta: ` election` },
            { type: 'text-end', id: 'text-1' },
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
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: '{"winner":"Barack Obama"}' }],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{"winner":"Barack Obama"}' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });
    }
  });

  describe(`${version} - agent`, () => {
    it('should get a text response from the agent', async () => {
      const electionAgent = new Agent({
        id: 'us-election-agent',
        name: 'US Election Agent',
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
        id: 'us-election-agent',
        name: 'US Election Agent',
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
        id: 'us-election-agent',
        name: 'US Election Agent',
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
        id: 'us-election-agent',
        name: 'US Election Agent',
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Agent model response' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Custom Title Model Response' },
                { type: 'text-end', id: 'text-1' },
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
        id: 'title-test-agent',
        name: 'Title Test Agent',
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
              title: '', // Empty title triggers title generation
            },
          },
        });
      } else {
        await agent.generate('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              title: '', // Empty title triggers title generation
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Standard Title' },
                { type: 'text-end', id: 'text-1' },
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
        id: 'dynamic-title-test-agent',
        name: 'Dynamic Title Agent',
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
              title: '',
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
              title: '',
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
              title: '',
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
              title: '',
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Standard Title' },
                { type: 'text-end', id: 'text-1' },
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
        id: 'update-model-agent',
        name: 'Update Model Agent',
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
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Generated Title' },
                  { type: 'text-end', id: 'text-1' },
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
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Agent Response' },
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
      }

      const agent = new Agent({
        id: 'boolean-title-agent',
        name: 'Boolean Title Agent',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-bool',
              title: '',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-bool-false',
              title: '',
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
        id: 'error-title-agent',
        name: 'Error Title Agent',
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
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Should not be called' },
                  { type: 'text-end', id: 'text-1' },
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
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Agent Response' },
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
      }

      const agent = new Agent({
        id: 'undefined-config-agent',
        name: 'Undefined Config Agent',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-undefined',
              title: '',
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
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: '日本語のタイトル' },
                  { type: 'text-end', id: 'text-1' },
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
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'English Title' },
                  { type: 'text-end', id: 'text-1' },
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
        id: 'dynamic-instructions-agent',
        name: 'Dynamic Instructions Agent',
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
              title: '',
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
              title: '',
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
              title: '',
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
              title: '',
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Creative Custom Title' },
                { type: 'text-end', id: 'text-1' },
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
        id: 'custom-instructions-test-agent',
        name: 'Custom Instructions Test Agent',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-custom-instructions',
              title: '',
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Default Title' },
                { type: 'text-end', id: 'text-1' },
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
        id: 'default-instructions-test-agent',
        name: 'Default Instructions Test Agent',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-default',
              title: '',
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Title with error handling' },
                { type: 'text-end', id: 'text-1' },
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
        id: 'error-instructions-test-agent',
        name: 'Error Instructions Test Agent',
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Title with default instructions' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Title with null instructions' },
                { type: 'text-end', id: 'text-1' },
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
        id: 'empty-instructions-test-agent',
        name: 'Empty Instructions Test Agent',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-empty-instructions',
              title: '',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-null-instructions',
              title: '',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that default instructions were used when null was returned
      expect(capturedPrompt).toContain('you will generate a short title');
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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
              { type: 'text-end', id: 'text-1' },
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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

    it.skipIf(version !== 'v1')(
      'generate - should still work with deprecated threadId and resourceId (legacy only)',
      async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'test',
          model: dummyModel,
          memory: mockMemory,
        });

        await agent.generateLegacy('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });

        const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
        expect(thread).toBeDefined();
        expect(thread?.id).toBe('thread-1');
        expect(thread?.resourceId).toBe('user-1');
      },
    );

    it.skipIf(version !== 'v1')(
      'stream - should still work with deprecated threadId and resourceId (legacy only)',
      async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'test',
          model: dummyModel,
          memory: mockMemory,
        });

        const stream = await agent.streamLegacy('hello', {
          resourceId: 'user-1',
          threadId: 'thread-1',
        });

        await stream.consumeStream();

        const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
        expect(thread).toBeDefined();
        expect(thread?.id).toBe('thread-1');
        expect(thread?.resourceId).toBe('user-1');
      },
    );
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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Logger test response' },
              { type: 'text-end', id: 'text-1' },
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: systemMessage,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(systemMessage);
    });

    it('should support array of string instructions', async () => {
      const instructionsArray = ['You are a helpful assistant.', 'Always be polite.', 'Provide detailed answers.'];

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should support dynamic instructions returning string', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: '',
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toBe('');
    });

    it('should handle empty array instructions', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: [],
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual([]);
    });

    it('should allow override instructions in generate options', async () => {
      const agent = new Agent({
        id: 'override-agent',
        name: 'Override Agent',
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
        id: 'voice-agent',
        name: 'Voice Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
        instructions: instructionsArray,
        model: dummyModel,
      });

      const instructions = await agent.getInstructions();
      expect(instructions).toEqual(instructionsArray);
    });

    it('should combine instructions with system option in stream', async () => {
      if (version === 'v2') {
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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
        id: 'override-array-agent',
        name: 'Override Array Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
        id: 'test-agent',
        name: 'Test Agent',
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
              { type: 'text-start', id: 'text-1' },
              ...Array.from({ length: 10 }, (_, count) => ({
                type: 'text-delta' as const,
                id: '1',
                delta: `Dummy response ${count} `,
              })),
              { type: 'text-end', id: 'text-1' },
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
      it('should persist the full message after a successful run', async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'test-agent-generate',
          name: 'Test Agent Generate',
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
            memory: {
              thread: 'thread-1-generate',
              resource: 'resource-1-generate',
            },
          });
        }

        const result = await mockMemory.recall({
          threadId: 'thread-1-generate',
          resourceId: 'resource-1-generate',
        });
        const messages = result.messages;
        // Check that the last message matches the expected final output
        expect(
          messages[messages.length - 1]?.content?.parts?.some(
            p => p.type === 'text' && p.text?.includes('Dummy response'),
          ),
        ).toBe(true);
      });

      it.skip('should only call saveMessages for the user message when no assistant parts are generated', async () => {
        const mockMemory = new MockMemory();

        let saveCallCount = 0;

        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const agent = new Agent({
          id: 'no-progress-agent-generate',
          name: 'No Progress Agent Generate',
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
            memory: {
              thread: `thread-2-${version}-generate`,
              resource: `resource-2-${version}-generate`,
            },
          });
        }

        expect(saveCallCount).toBe(1);

        const result = await mockMemory.recall({
          threadId: `thread-2-${version}-generate`,
          resourceId: `resource-2-${version}-generate`,
        });
        const messages = result?.messages ?? [];

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
        id: 'immediate-interrupt-agent-generate',
        name: 'Immediate Interrupt Agent Generate',
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
            memory: {
              thread: 'thread-3-generate',
              resource: 'resource-3-generate',
            },
          });
        }
      } catch (err: any) {
        expect(err.message).toBe('Immediate interruption');
      }

      const result = await mockMemory.recall({
        threadId: 'thread-3-generate',
        resourceId: 'resource-3-generate',
      });

      // TODO: output processors in v2 still run when the model throws an error! that doesn't seem right.
      // it means in v2 our message history processor saves the input message.
      if (version === `v1`) {
        expect(result.messages.length).toBe(0);
        expect(saveCallCount).toBe(0);
      }
    });

    it('should save thread but not messages if error occurs during LLM generation', async () => {
      // v2: Threads are now created upfront to prevent race conditions with storage backends
      // like PostgresStore that validate thread existence before saving messages.
      // When an error occurs during LLM generation, the thread will exist but no messages
      // will be saved since the response never completed.
      //
      // v1 (legacy): Does not use memory processors, so the old behavior applies where
      // threads are not saved until the request completes successfully.
      const mockMemory = new MockMemory();
      const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

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
        id: 'error-agent',
        name: 'Error Agent',
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

      const thread = await mockMemory.getThreadById({ threadId: 'thread-err' });

      // Thread should exist (created upfront to prevent race condition with storage
      // backends like PostgresStore that validate thread existence before saving messages).
      // This applies to all versions: v1 was fixed in Issue #12566, v2/v3 in PR #10881.
      expect(thread).not.toBeNull();
      expect(thread?.id).toBe('thread-err');
      // But no messages should be saved since the LLM call failed
      expect(saveMessagesSpy).not.toHaveBeenCalled();
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
          doGenerate: async () => {
            throw testAPICallError;
          },
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
          doGenerate() {
            throw testError;
          },
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
          doGenerate() {
            throw testError;
          },
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

      // Helper to create a model that calls a non-existent tool
      function createModelWithNonExistentToolCall() {
        return new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [
              { type: 'tool-call', toolCallId: '123', toolName: 'nonExistentTool', input: '{"input": "test"}' },
            ],
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolCallType: 'function',
                toolName: 'nonExistentTool', // This tool doesn't exist in the agent's tools
                input: '{"input": "test"}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      }

      // Helper to create an agent with a tool that exists but the model will call a non-existent one
      function createAgentWithMismatchedTool(model: MockLanguageModelV2) {
        const existingTool = createTool({
          id: 'existingTool',
          description: 'A tool that exists',
          inputSchema: z.object({ input: z.string() }),
          execute: async () => ({ result: 'success' }),
        });

        return new Agent({
          id: 'test-tool-not-found-error',
          name: 'Test Tool Not Found Error',
          model,
          instructions: 'You are a helpful assistant.',
          tools: { existingTool },
        });
      }

      it('should not throw in generate when model calls non-existent tool (returns error to model)', async () => {
        const model = createModelWithNonExistentToolCall();
        const agent = createAgentWithMismatchedTool(model);

        // With the fix, tool-not-found errors no longer throw.
        // The error is returned to the model as a tool result, and the loop continues
        // until maxSteps is reached. The agent completes normally.
        const result = await agent.generate('Please use a tool', { maxSteps: 2 });

        // Should complete without throwing
        expect(result).toBeDefined();

        // The steps should contain the tool-not-found error with available tool names
        const toolResults = result.steps.flatMap(s => s.toolResults ?? []);
        const notFoundResult = toolResults.find(
          (tr: any) => (tr.payload?.toolName ?? tr.toolName) === 'nonExistentTool',
        );
        if (notFoundResult) {
          const resultValue = (notFoundResult as any).payload?.result ?? (notFoundResult as any).result;
          expect(String(resultValue)).toMatch(/not found/i);
          expect(String(resultValue)).toMatch(/existingTool/);
        }
      });

      it('should emit tool-error chunks in stream when model calls non-existent tool', async () => {
        const model = createModelWithNonExistentToolCall();
        const agent = createAgentWithMismatchedTool(model);

        const output = await agent.stream('Please use a tool', { maxSteps: 2 });

        const toolErrorChunks: any[] = [];
        for await (const chunk of output.fullStream) {
          if (chunk.type === 'tool-error') {
            toolErrorChunks.push(chunk);
          }
        }

        // Should have tool-error chunks with the "not found" message and available tool names
        expect(toolErrorChunks.length).toBeGreaterThan(0);
        const notFoundChunk = toolErrorChunks.find(
          (c: any) => c.payload.toolName === 'nonExistentTool' || c.payload.error.message.match(/nonExistentTool/i),
        );
        expect(notFoundChunk).toBeDefined();
        expect(notFoundChunk.payload.error.message).toMatch(/Tool "nonExistentTool" not found/i);
        expect(notFoundChunk.payload.error.message).toMatch(/existingTool/);
        expect(notFoundChunk.payload.error.name).toBe('ToolNotFoundError');
      });

      it('should allow model to self-correct after calling non-existent tool in generate', async () => {
        // Model first calls wrong tool, then self-corrects, then returns text
        let callCount = 0;
        const selfCorrectingModel = new MockLanguageModelV2({
          doGenerate: async () => {
            callCount++;
            if (callCount === 1) {
              // First call: model hallucinates a prefixed tool name
              return {
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'creating:existingTool',
                    input: '{"input": "test"}',
                  },
                ],
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                warnings: [],
              };
            }
            if (callCount === 2) {
              // Second call: model self-corrects and calls the correct tool
              return {
                content: [
                  { type: 'tool-call', toolCallId: 'call-2', toolName: 'existingTool', input: '{"input": "test"}' },
                ],
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                warnings: [],
              };
            }
            // Third call: model returns text (ends the loop)
            return {
              content: [{ type: 'text', text: 'Done!' }],
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              warnings: [],
            };
          },
        });
        const agent = createAgentWithMismatchedTool(selfCorrectingModel);

        const result = await agent.generate('Please use a tool', { maxSteps: 5 });

        // Should complete successfully — the model self-corrected
        expect(result).toBeDefined();
        expect(callCount).toBe(3); // 1 wrong + 1 correct + 1 text response
      });

      it('should allow model to self-correct after calling non-existent tool in stream', async () => {
        // Model first calls wrong tool, then self-corrects, then returns text
        let callCount = 0;
        const selfCorrectingModel = new MockLanguageModelV2({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
              // First call: model hallucinates a prefixed tool name
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolCallType: 'function',
                    toolName: 'creating:existingTool',
                    input: '{"input": "test"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
                rawCall: { rawPrompt: null, rawSettings: {} },
              };
            }
            if (callCount === 2) {
              // Second call: model self-corrects
              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call',
                    toolCallId: 'call-2',
                    toolCallType: 'function',
                    toolName: 'existingTool',
                    input: '{"input": "test"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
                rawCall: { rawPrompt: null, rawSettings: {} },
              };
            }
            // Third call: model returns text (ends the loop)
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: 'Done!' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
            };
          },
        });
        const agent = createAgentWithMismatchedTool(selfCorrectingModel);

        const output = await agent.stream('Please use a tool', { maxSteps: 5 });

        const toolErrorChunks: any[] = [];
        const toolResultChunks: any[] = [];
        for await (const chunk of output.fullStream) {
          if (chunk.type === 'tool-error') toolErrorChunks.push(chunk);
          if (chunk.type === 'tool-result') toolResultChunks.push(chunk);
        }

        // Should have a tool-error for the first (wrong) call
        expect(toolErrorChunks.length).toBeGreaterThan(0);
        expect(toolErrorChunks[0].payload.error.message).toMatch(/not found/i);

        // Should have a tool-result for the second (correct) call
        expect(toolResultChunks.length).toBeGreaterThan(0);
        expect(toolResultChunks[0].payload.toolName).toBe('existingTool');

        expect(callCount).toBe(3); // 1 wrong + 1 correct + 1 text response
      });
    });

    describe('stream options', () => {
      it('should call options.onError when stream error occurs in stream', async () => {
        const errorModel = new MockLanguageModelV2({
          doGenerate() {
            throw new Error('Simulated stream error');
          },
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
          // @ts-expect-error - error
          doGenerate: async () => {
            await new Promise(resolve => setImmediate(resolve));
            abortController.abort();
          },
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
  }

  describe(`${version} - Input Processors`, () => {
    let mockModel: MockLanguageModelV1 | MockLanguageModelV2;

    // Helper function to create a MastraDBMessage
    const createMessage = (text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage => ({
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
          doGenerate: async ({ prompt }: LanguageModelV2CallOptions) => {
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
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [{ type: 'text', text: `processed: ${textContent}` }],
              warnings: [],
            };
          },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'processed: ' },
                { type: 'text-delta', id: 'text-1', delta: textContent },
                { type: 'text-end', id: 'text-1' },
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
          id: 'test-processor',
          name: 'Test Processor',
          processInput: async ({ messages }) => {
            messages.push(createMessage('Processor was here!'));
            return messages;
          },
        };

        const agentWithProcessor = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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
          id: 'processor-1',
          name: 'Processor 1',
          processInput: async ({ messages }) => {
            messages.push(createMessage('First processor'));
            return messages;
          },
        };

        const processor2 = {
          id: 'processor-2',
          name: 'Processor 2',
          processInput: async ({ messages }) => {
            messages.push(createMessage('Second processor'));
            return messages;
          },
        };

        const agentWithProcessors = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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
          id: 'async-processor-1',
          name: 'Async Processor 1',
          processInput: async ({ messages }) => {
            messages.push(createMessage('First processor'));
            return messages;
          },
        };

        const processor2 = {
          id: 'async-processor-2',
          name: 'Async Processor 2',
          processInput: async ({ messages }) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            messages.push(createMessage('Second processor'));
            return messages;
          },
        };

        const agentWithAsyncProcessors = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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
          id: 'abort-processor',
          name: 'Abort Processor',
          processInput: async ({ abort, messages }) => {
            abort();
            return messages;
          },
        };

        const agentWithAbortProcessor = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Tripwire triggered by abort-processor');
        expect(await result.text).toBe('');
        expect(await result.finishReason).toBe('other');
      });

      it('should handle processor abort with custom message', async () => {
        const customAbortProcessor = {
          id: 'custom-abort',
          name: 'Custom Abort',
          processInput: async ({ abort, messages }) => {
            abort('Custom abort reason');
            return messages;
          },
        };

        const agentWithCustomAbort = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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

        expect(result.tripwire).toBeDefined();
        expect(result.tripwire?.reason).toBe('Custom abort reason');
        expect(await result.text).toBe('');
      });

      it('should not execute subsequent processors after abort', async () => {
        let secondProcessorExecuted = false;

        const abortProcessor = {
          id: 'abort-first',
          name: 'Abort First',
          processInput: async ({ abort, messages }) => {
            abort('Stop here');
            return messages;
          },
        };

        const shouldNotRunProcessor = {
          id: 'should-not-run',
          name: 'Should Not Run',
          processInput: async ({ messages }) => {
            secondProcessorExecuted = true;
            messages.push(createMessage('This should not be added'));
            return messages;
          },
        };

        const agentWithAbortSequence = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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

        expect(result.tripwire).toBeDefined();
        expect(secondProcessorExecuted).toBe(false);
      });
    });

    describe('streaming with input processors', () => {
      it('should handle input processors with streaming', async () => {
        const streamProcessor = {
          id: 'stream-processor',
          name: 'Stream Processor',
          processInput: async ({ messages }) => {
            messages.push(createMessage('Stream processor active'));
            return messages;
          },
        };

        const agentWithStreamProcessor = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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
          id: 'stream-abort',
          name: 'Stream Abort',
          processInput: async ({ abort, messages }) => {
            abort('Stream aborted');
            return messages;
          },
        };

        const agentWithStreamAbort = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: [streamAbortProcessor],
        });

        let stream;
        if (version === 'v1') {
          stream = await agentWithStreamAbort.streamLegacy('Stream abort test');
          expect(stream.tripwire).toBeDefined();
          expect(stream.tripwire?.reason).toBe('Stream aborted');
        } else {
          stream = await agentWithStreamAbort.stream('Stream abort test');

          for await (const chunk of stream.fullStream) {
            expect(chunk.type).toBe('tripwire');
            expect(chunk.payload?.reason).toBe('Stream aborted');
          }
          const fullOutput = await (stream as MastraModelOutput<any>).getFullOutput();
          expect(fullOutput.tripwire).toBeDefined();
          expect(fullOutput.tripwire?.reason).toBe('Stream aborted');
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
          id: 'deployer-abort',
          name: 'Deployer Abort',
          processInput: async ({ abort, messages }) => {
            abort('Deployer test abort');
            return messages;
          },
        };

        const agentWithDeployerAbort = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
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
          expect(stream.tripwire).toBeDefined();
          expect(stream.tripwire?.reason).toBe('Deployer test abort');
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
          expect(fullOutput.tripwire).toBeDefined();
          expect(fullOutput.tripwire?.reason).toBe('Deployer test abort');
        }
      });
    });

    describe('dynamic input processors', () => {
      it('should support function-based input processors', async () => {
        const requestContext = new RequestContext<{ processorMessage: string }>();
        requestContext.set('processorMessage', 'Dynamic message');

        const agentWithDynamicProcessors = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: mockModel,
          inputProcessors: ({ requestContext }) => {
            const message: string = requestContext.get('processorMessage') || 'Default message';
            return [
              {
                id: 'dynamic-processor',
                name: 'Dynamic Processor',
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
          id: 'test-agent',
          name: 'Test Agent',
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
          id: 'message-modifier',
          name: 'Message Modifier',
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
          id: 'test-agent',
          name: 'Test Agent',
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
          id: 'validator',
          name: 'Validator',
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
          id: 'test-agent',
          name: 'Test Agent',
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
        expect(invalidResult.tripwire).toBeDefined();
        expect(invalidResult.tripwire?.reason).toBe('Content validation failed');
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
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            content: [{ type: 'text', text: 'Response acknowledging metadata' }],
            warnings: [],
          }),
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Response' },
              { type: 'text-delta', id: 'text-1', delta: ' acknowledging' },
              { type: 'text-delta', id: 'text-1', delta: ' metadata' },
              { type: 'text-end', id: 'text-1' },
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
        id: 'metadata-test-agent',
        name: 'Metadata Test Agent',
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
        await agent.generateLegacy(messagesWithMetadata, {
          memory: {
            resource: 'customer-12345',
            thread: {
              id: 'support-thread',
            },
          },
        });
      } else {
        await agent.generate(messagesWithMetadata, {
          memory: {
            resource: 'customer-12345',
            thread: {
              id: 'support-thread',
            },
          },
        });
      }
      // Verify messages were saved with metadata
      const result = await mockMemory.recall({
        threadId: 'support-thread',
        resourceId: 'customer-12345',
        perPage: 10,
      });
      const savedMessages = result.messages;

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
        id: 'metadata-stream-agent',
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
        stream = await agent.streamLegacy(messagesWithMetadata, {
          memory: {
            resource: 'user-mobile',
            thread: {
              id: 'mobile-thread',
            },
          },
        });
      } else {
        stream = await agent.stream(messagesWithMetadata, {
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
      const result = await mockMemory.recall({
        threadId: 'mobile-thread',
        resourceId: 'user-mobile',
        perPage: 10,
      });
      const savedMessages = result.messages;

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
        await agent.generateLegacy(mixedMessages, {
          memory: {
            resource: 'mixed-user',
            thread: {
              id: 'mixed-thread',
            },
          },
        });
      } else {
        await agent.generate(mixedMessages, {
          memory: {
            resource: 'mixed-user',
            thread: {
              id: 'mixed-thread',
            },
          },
        });
      }
      // Verify messages were saved correctly
      const result = await mockMemory.recall({
        threadId: 'mixed-thread',
        resourceId: 'mixed-user',
        perPage: 10,
      });
      const savedMessages = result.messages;

      expect(savedMessages.length).toBeGreaterThan(0);

      // Find messages and check metadata
      const messagesAsV2 = savedMessages as MastraDBMessage[];
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

  describe('defaultOptions onFinish callback bug', () => {
    it(`${version} - should call onFinish from defaultOptions when no options are passed to stream`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish',
        name: 'Test Default onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptionsLegacy: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }
          : {
              defaultOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }),
      });

      // Call stream without passing any options - should use defaultOptions
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

    it(`${version} - should call onFinish from defaultOptions when empty options are passed to stream`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish-empty',
        name: 'Test Default onFinish Empty',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptionsLegacy: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }
          : {
              defaultOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }),
      });

      // Call stream with empty options - should still use defaultOptions
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

    it(`${version} - should prioritize passed onFinish over defaultOptions onFinish`, async () => {
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
              defaultStreamOptionsLegacy: {
                onFinish: () => {
                  defaultOnFinishCalled = true;
                },
              },
            }
          : {
              defaultOptions: {
                onFinish: () => {
                  defaultOnFinishCalled = true;
                },
              },
            }),
      });

      // Call stream with explicit onFinish - should override defaultOptions
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
  describe('prepareStep', () => {
    it('should allow adding new tools via prepareStep', async () => {
      let capturedTools: any;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async options => {
          capturedTools = options.tools;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text' as const, text: 'Done' }],
            warnings: [],
          };
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        tools: {
          existingTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'existing result',
          }),
        },
      });
      agent.__setLogger(noopLogger);

      await agent.generate('Hello', {
        prepareStep: ({ tools }) => {
          return {
            tools: {
              ...tools,
              dynamicTool: tool({
                inputSchema: z.object({ query: z.string() }),
                execute: async () => 'dynamic result',
              }),
            },
          };
        },
      });

      // Both tools should be passed to the model
      expect(capturedTools).toHaveLength(2);
      const toolNames = capturedTools.map((t: any) => t.name);
      expect(toolNames).toContain('existingTool');
      expect(toolNames).toContain('dynamicTool');
    });

    it('should allow replacing all tools via prepareStep', async () => {
      let capturedTools: any;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async options => {
          capturedTools = options.tools;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text' as const, text: 'Done' }],
            warnings: [],
          };
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        tools: {
          originalTool: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'original result',
          }),
        },
      });
      agent.__setLogger(noopLogger);

      await agent.generate('Hello', {
        prepareStep: () => {
          return {
            tools: {
              replacementTool: tool({
                inputSchema: z.object({ data: z.string() }),
                execute: async () => 'replacement result',
              }),
            },
          };
        },
      });

      // Only the replacement tool should be passed to the model
      expect(capturedTools).toHaveLength(1);
      expect(capturedTools[0].name).toBe('replacementTool');
    });

    it('should allow adding structuredOutput schema via prepareStep', async () => {
      const structuredOutputSchema = z.object({
        analysis: z.string(),
        confidence: z.number(),
      });

      let capturedCallOptions: Array<{ stepNumber: number; responseFormat: any }> = [];
      let callCount = 0;

      const mockModel = new MockLanguageModelV2({
        doGenerate: async options => {
          callCount++;
          capturedCallOptions.push({
            stepNumber: callCount - 1,
            responseFormat: options.responseFormat,
          });

          // Return valid structured output that matches the schema
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ analysis: 'Test analysis', confidence: 0.95 }),
              },
            ],
            warnings: [],
          };
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
      });
      agent.__setLogger(noopLogger);

      const structuredOutputConfigs: Array<{ stepNumber: number; hasStructuredOutput: boolean }> = [];

      const result = await agent.generate('Analyze this data', {
        prepareStep: async ({ stepNumber, structuredOutput }) => {
          structuredOutputConfigs.push({
            stepNumber,
            hasStructuredOutput: !!structuredOutput?.schema,
          });

          if (stepNumber === 0) {
            // Add structuredOutput dynamically for step 0
            return {
              structuredOutput: {
                schema: structuredOutputSchema,
              },
            };
          }
          return {};
        },
      });

      // Verify prepareStep was called
      expect(structuredOutputConfigs).toEqual([{ stepNumber: 0, hasStructuredOutput: false }]);
      // Verify the model was called with json responseFormat containing our schema
      expect(capturedCallOptions.length).toBe(1);
      expect(capturedCallOptions[0].stepNumber).toBe(0);
      expect(capturedCallOptions[0].responseFormat?.type).toBe('json');
      expect(capturedCallOptions[0].responseFormat?.schema?.properties?.analysis?.type).toBe('string');
      expect(capturedCallOptions[0].responseFormat?.schema?.properties?.confidence?.type).toBe('number');

      // Verify we got an object result
      expect(result.object).toEqual({ analysis: 'Test analysis', confidence: 0.95 });
    });

    it('should allow modifying existing structuredOutput schema via prepareStep', async () => {
      const initialSchema = z.object({
        name: z.string(),
      });

      const modifiedSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      let capturedStructuredOutput: any;

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ name: 'John', age: 30 }),
              },
            ],
            warnings: [],
          };
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
      });
      agent.__setLogger(noopLogger);

      const result = await agent.generate('Get user info', {
        structuredOutput: { schema: initialSchema },
        prepareStep: async ({ stepNumber, structuredOutput }) => {
          capturedStructuredOutput = structuredOutput;

          if (stepNumber === 0) {
            // Modify the structuredOutput to use a different schema
            return {
              structuredOutput: {
                schema: modifiedSchema,
              },
            };
          }
          return {};
        },
      });

      // Verify prepareStep received the initial structuredOutput config
      expect(capturedStructuredOutput?.schema).toBeDefined();

      // The result should match the modified schema (with age)
      expect(result.object).toEqual({ name: 'John', age: 30 });
    });

    it('should get text on step without structuredOutput and object on step with structuredOutput', async () => {
      const structuredOutputSchema = z.object({
        sentiment: z.string(),
        score: z.number(),
      });

      let callCount = 0;
      let capturedResponseFormats: Array<{ stepNumber: number; responseFormat: any }> = [];

      const mockModel = new MockLanguageModelV2({
        doGenerate: async options => {
          callCount++;
          const stepNumber = callCount - 1;

          capturedResponseFormats.push({
            stepNumber,
            responseFormat: options.responseFormat,
          });

          if (stepNumber === 0) {
            // Step 0: No structuredOutput - tool call to trigger multi-step
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'analyzeSentiment',
                  args: { text: 'Hello world' },
                },
              ],
              warnings: [],
            };
          } else {
            // Step 1: With structuredOutput - return object
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ sentiment: 'positive', score: 0.9 }),
                },
              ],
              warnings: [],
            };
          }
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const analyzeTool = createTool({
        id: 'analyzeSentiment',
        description: 'Analyze sentiment',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'analyzed' }),
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant.',
        model: mockModel,
        tools: { analyzeSentiment: analyzeTool },
      });
      agent.__setLogger(noopLogger);

      const result = await agent.generate('Analyze this text', {
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 0) {
            // Step 0: Force tool call with toolChoice
            return {
              toolChoice: 'required' as const,
            };
          }
          // Step 1: Remove toolChoice and add structuredOutput
          return {
            toolChoice: 'none' as const,
            structuredOutput: { schema: structuredOutputSchema },
          };
        },
      });

      // Verify step 0 had no responseFormat (tool call step)
      expect(capturedResponseFormats[0].responseFormat).toBeUndefined();

      // Verify step 1 had json responseFormat (structuredOutput step)
      expect(capturedResponseFormats[1].responseFormat?.type).toBe('json');
      expect(capturedResponseFormats[1].responseFormat?.schema?.properties?.sentiment?.type).toBe('string');

      // Verify we got the object result from the final step
      expect(result.object).toEqual({ sentiment: 'positive', score: 0.9 });

      // Verify step 0 was a tool call
      expect(result.steps[0].toolCalls?.length).toBe(1);
    });

    it.skip('should dynamically add structuredOutput with real model', async () => {
      const structuredOutputSchema = z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral']),
        score: z.number().min(0).max(1),
        summary: z.string(),
      });

      const analyzeTool = createTool({
        id: 'analyzeSentiment',
        description: 'Analyze the sentiment of the given text and return raw analysis data',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ rawAnalysis: z.string() }),
        execute: async ({ text }) => {
          console.log('executing analyzeSentiment', text);
          return {
            rawAnalysis: `Analyzed: "${text}" - This text appears to have positive sentiment with high confidence.`,
          };
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions:
          'You are a sentiment analysis assistant. When asked to analyze text, first use the analyzeSentiment tool, then provide structured output based on the tool result.',
        model: 'anthropic/claude-3-7-sonnet-latest',
      });

      const result = await agent.generate('Analyze the sentiment of: "I love this product!"', {
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 0) {
            return {
              tools: { analyzeSentiment: analyzeTool },
              toolChoice: 'required' as const,
            };
          }
          // Disable tools and add structuredOutput
          return {
            structuredOutput: { schema: structuredOutputSchema },
          };
        },
      });

      console.log('Steps:', result.steps.length);
      console.log('Step 0 tool calls:', result.steps[0]?.toolCalls);
      console.log('Step 0 tool results:', result.steps[0]?.toolResults);
      console.log('Final object:', result.object);
      console.log('Final text:', result.text);

      // Verify we got tool call in step 0
      expect(result.steps[0].toolCalls?.length).toBe(1);

      // Verify we got structured output in the final result
      expect(result.object).toBeDefined();
      expect(result.object?.sentiment).toMatch(/positive|negative|neutral/);
      expect(typeof result.object?.score).toBe('number');
      expect(typeof result.object?.summary).toBe('string');
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

  // NOTE: Memory processor deduplication tests have been moved to @mastra/memory integration tests
  // since MessageHistory and WorkingMemory processors now live in @mastra/memory package.
  // See packages/memory/integration-tests-v5/src/input-processors.test.ts for comprehensive tests.

  describe('prepareStep MessageList persistence across steps (v2 only)', () => {
    it('system message modifications in prepareStep should not persist across steps', async () => {
      const systemMessagesSeenAtEachStep: string[][] = [];
      let callCount = 0;

      // Create a model that makes a tool call on first step, then stops
      const toolCallModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            // First call: return a tool call
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'testTool',
                  input: '{ "input": "test" }',
                },
              ],
              warnings: [],
            };
          } else {
            // Second call: return text (stop)
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [{ type: 'text' as const, text: 'Done' }],
              warnings: [],
            };
          }
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const testTool = createTool({
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async () => ({ output: 'tool result' }),
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Original agent instructions',
        model: toolCallModel,
        tools: { testTool },
      });
      agent.__setLogger(noopLogger);

      await agent.generate('Hello', {
        prepareStep: async ({ messageList, stepNumber }) => {
          // Record what system messages we see at the start of this step
          const currentSystemMessages = messageList.getAllSystemMessages();
          systemMessagesSeenAtEachStep.push(currentSystemMessages.map(m => (m.content as string) || ''));

          // On step 0, replace all system messages with a custom one
          if (stepNumber === 0) {
            messageList.replaceAllSystemMessages([
              {
                role: 'system',
                content: `Modified system message from step ${stepNumber}`,
              },
            ]);
            return { messageList };
          }
        },
      });

      // We should have been called at least twice (step 0 and step 1)
      expect(systemMessagesSeenAtEachStep.length).toBeGreaterThanOrEqual(2);

      // Step 0 should see the original agent instructions
      expect(systemMessagesSeenAtEachStep[0]).toContain('Original agent instructions');

      // Step 1 should see the modified system message (NOT the original)
      // This proves MessageList persists across steps
      expect(systemMessagesSeenAtEachStep[1]).not.toContain('Modified system message from step 0');
      expect(systemMessagesSeenAtEachStep[1]).toContain('Original agent instructions');
    });

    it('providerOptions can be modified via prepareStep', async () => {
      let capturedProviderOptions: any = null;
      let capturedPrepareStepProviderOptions: any = null;

      // Create a model that captures the providerOptions it receives
      const mockModel = new MockLanguageModelV2({
        doGenerate: async ({ providerOptions }) => {
          capturedProviderOptions = providerOptions;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text' as const, text: 'Done' }],
            warnings: [],
          };
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel,
      });
      agent.__setLogger(noopLogger);

      await agent.generate('Hello', {
        providerOptions: {
          somethingElse: {
            test: 'test',
          },
        },
        prepareStep: async ({ stepNumber, providerOptions }) => {
          capturedPrepareStepProviderOptions = providerOptions;
          if (stepNumber === 0) {
            return {
              providerOptions: {
                anthropic: {
                  cacheControl: { type: 'ephemeral' },
                },
              },
            };
          }
        },
      });

      expect(capturedPrepareStepProviderOptions).toBeDefined();
      expect(capturedPrepareStepProviderOptions?.somethingElse?.test).toBe('test');
      // Verify the model received the modified providerOptions
      expect(capturedProviderOptions).toBeDefined();
      expect(capturedProviderOptions?.anthropic?.cacheControl?.type).toBe('ephemeral');
    });

    it('modelSettings can be modified via prepareStep', async () => {
      let capturedOptions: any = null;

      // Create a model that captures all options passed to doGenerate
      const mockModel = new MockLanguageModelV2({
        doGenerate: async options => {
          // Capture the full options object to inspect modelSettings
          capturedOptions = options;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text' as const, text: 'Done' }],
            warnings: [],
          };
        },
        doStream: async () => {
          throw new Error('Not implemented');
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model: mockModel,
      });
      agent.__setLogger(noopLogger);

      await agent.generate('Hello', {
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 0) {
            return {
              modelSettings: {
                maxTokens: 500,
                temperature: 0.7,
              },
            };
          }
        },
      });

      expect(capturedOptions).toBeDefined();
      // ModelSettings are spread into the options passed to doGenerate
      expect((capturedOptions as any)?.maxTokens).toBe(500);
      expect((capturedOptions as any)?.temperature).toBe(0.7);
    });
  });

  describe('prepareStep workspace', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preparestep-workspace-test-'));
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    const createWorkspace = (id: string) => {
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      return new Workspace({
        id,
        name: `Test Workspace ${id}`,
        filesystem,
      });
    };

    it('should pass workspace returned from prepareStep to tool execution', async () => {
      const workspace = createWorkspace('preparestep-workspace');
      let capturedWorkspace: Workspace | undefined;

      const workspaceCaptureTool = createTool({
        id: 'capture_workspace',
        description: 'Captures the workspace from execution context',
        inputSchema: z.object({}),
        execute: async (_input, context) => {
          capturedWorkspace = context.workspace;
          return { captured: true };
        },
      });

      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallType: 'function' as const,
                  toolCallId: 'call_1',
                  toolName: 'capture_workspace',
                  input: '{}',
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text' as const, text: 'Done' }],
            warnings: [],
          };
        },
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallId: 'call_1',
              toolName: 'capture_workspace',
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

      const agent = new Agent({
        name: 'workspace-preparestep-agent',
        instructions: 'test',
        model: mockModel,
        tools: { capture_workspace: workspaceCaptureTool },
      });

      await agent.generate('Test workspace from prepareStep', {
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 0) {
            return { workspace };
          }
        },
      });

      expect(capturedWorkspace).toBe(workspace);
      expect(capturedWorkspace?.id).toBe('preparestep-workspace');
    });

    it('should allow prepareStep to override agent workspace dynamically', async () => {
      const agentWorkspace = createWorkspace('agent-workspace');
      const stepWorkspace = createWorkspace('step-workspace');
      let capturedWorkspaceId: string | undefined;

      const workspaceCaptureTool = createTool({
        id: 'capture_workspace',
        description: 'Captures the workspace from execution context',
        inputSchema: z.object({}),
        execute: async (_input, context) => {
          capturedWorkspaceId = context.workspace?.id;
          return { captured: true };
        },
      });

      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallType: 'function' as const,
                  toolCallId: 'call_1',
                  toolName: 'capture_workspace',
                  input: '{}',
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text' as const, text: 'Done' }],
            warnings: [],
          };
        },
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallId: 'call_1',
              toolName: 'capture_workspace',
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

      const agent = new Agent({
        name: 'workspace-override-agent',
        instructions: 'test',
        model: mockModel,
        tools: { capture_workspace: workspaceCaptureTool },
        workspace: agentWorkspace,
      });

      await agent.generate('Test workspace override', {
        prepareStep: async ({ stepNumber }) => {
          if (stepNumber === 0) {
            // Override the agent's workspace with a different one
            return { workspace: stepWorkspace };
          }
        },
      });

      // prepareStep workspace should override agent workspace
      expect(capturedWorkspaceId).toBe('step-workspace');
    });
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
//       // @ts-expect-error
//       await (agent.listTools() as Agent['tools']).mastraTool.execute!({ name: 'test' });
//       // @ts-expect-error
//       await (agent.listTools() as Agent['tools']).vercelTool.execute!({ name: 'test' });

//       expect(mastraExecute).toHaveBeenCalled();
//       expect(vercelExecute).toHaveBeenCalled();
//     });
// });
