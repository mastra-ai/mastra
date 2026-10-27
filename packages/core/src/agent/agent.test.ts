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
import { z } from 'zod/v4';
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
        finalText += previousText;
        expect(textPart).toBeDefined();
      }

      expect(finalText).toContain('Donald Trump');
    });

    it('should use the request-scoped model override for generate', async () => {
      let configuredModelUsed = false;
      let overrideModelUsed = false;

      const configuredModel =
        version === 'v1'
          ? new MockLanguageModelV1({
              doGenerate: async () => {
                configuredModelUsed = true;
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 20 },
                  text: 'configured model',
                };
              },
            })
          : new MockLanguageModelV2({
              doGenerate: async () => {
                configuredModelUsed = true;
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  content: [{ type: 'text', text: 'configured model' }],
                  warnings: [],
                };
              },
            });

      const overrideModel =
        version === 'v1'
          ? new MockLanguageModelV1({
              doGenerate: async () => {
                overrideModelUsed = true;
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 20 },
                  text: 'override model',
                };
              },
            })
          : new MockLanguageModelV2({
              doGenerate: async () => {
                overrideModelUsed = true;
                return {
                  rawCall: { rawPrompt: null, rawSettings: {} },
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  content: [{ type: 'text', text: 'override model' }],
                  warnings: [],
                };
              },
            });

      const agent = new Agent({
        id: 'override-agent',
        name: 'Override Agent',
        instructions: 'test agent',
        model: configuredModel,
      });

      const result =
        version === 'v1'
          ? await agent.generateLegacy('Hello', { model: overrideModel })
          : await agent.generate('Hello', { model: overrideModel });

      expect(result.text).toBe('override model');
      expect(overrideModelUsed).toBe(true);
      expect(configuredModelUsed).toBe(false);
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

    it('persists a v2 terminal error when interrupted before any normal part is emitted', async () => {
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

      if (version === 'v1') {
        expect(result.messages.length).toBe(0);
        expect(saveCallCount).toBe(0);
      } else {
        expect(result.messages.map(message => message.role)).toEqual(['user', 'assistant']);
        expect(result.messages[1].content.parts).toEqual([
          {
            type: 'error',
            error: { name: 'Error', message: 'Immediate interruption' },
            createdAt: expect.any(Number),
          },
        ]);
      }
    });
  });

  if (version === 'v2') {
    describe('error handling consistency', () => {
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
  describe('metadata', () => {
    it('returns configured static metadata', () => {
      const metadata = { type: 'support', tier: 'paid' };
      const agent = new Agent({
        id: 'metadata-agent',
        name: 'metadata-agent',
        instructions: 'You are a helpful assistant.',
        model: 'openai/gpt-5',
        metadata,
      });

      expect(agent.getMetadata()).toEqual(metadata);
    });

    it('resolves dynamic metadata from the request context', async () => {
      const agent = new Agent({
        id: 'dynamic-metadata-agent',
        name: 'dynamic-metadata-agent',
        instructions: 'You are a helpful assistant.',
        model: 'openai/gpt-5',
        metadata: ({ requestContext }) => ({
          type: 'support',
          tenant: requestContext.get('tenant'),
        }),
      });

      const requestContext = new RequestContext();
      requestContext.set('tenant', 'acme');

      const result = await agent.getMetadata({ requestContext });
      expect(result).toEqual({ type: 'support', tenant: 'acme' });
    });
  });

  describe('structuredOutput with a top-level array of primitives (#23980)', () => {
    const responseText = '{"elements":["alpha","beta","gamma"]}';

    function createArrayModel(deltas: string[]) {
      let capturedResponseFormat: any;
      const model = new MockLanguageModelV2({
        doGenerate: async options => {
          capturedResponseFormat = options.responseFormat;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text', text: deltas.join('') }],
            warnings: [],
          };
        },
        doStream: async options => {
          capturedResponseFormat = options.responseFormat;
          return {
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: 'text-1' },
              ...deltas.map(delta => ({ type: 'text-delta' as const, id: 'text-1', delta })),
              { type: 'text-end', id: 'text-1' },
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
      return { model, getResponseFormat: () => capturedResponseFormat };
    }

    it('generate() returns the array of strings and sends the wrapped schema to the model', async () => {
      const { model, getResponseFormat } = createArrayModel([responseText]);
      const agent = new Agent({ id: 'array-agent', name: 'array-agent', instructions: 'list', model });

      const result = await agent.generate('List greek letters', {
        structuredOutput: { schema: z.array(z.string()) },
      });

      expect(result.object).toEqual(['alpha', 'beta', 'gamma']);
      expect(result.text).toBe(responseText);
      expect(getResponseFormat()).toMatchObject({
        type: 'json',
        schema: {
          type: 'object',
          properties: { elements: { type: 'array', items: { type: 'string' } } },
          required: ['elements'],
        },
      });
    });

    it('generate() returns an array of numbers', async () => {
      const { model } = createArrayModel(['{"elements":[1,2,3]}']);
      const agent = new Agent({ id: 'array-agent', name: 'array-agent', instructions: 'list', model });

      const result = await agent.generate('Count', { structuredOutput: { schema: z.array(z.number()) } });

      expect(result.object).toEqual([1, 2, 3]);
    });

    it('stream() resolves object, objectStream and textStream for an array of strings split across deltas', async () => {
      const { model } = createArrayModel(['{"elements":["al', 'pha","be', 'ta",', '"gamma"]}']);
      const agent = new Agent({ id: 'array-agent', name: 'array-agent', instructions: 'list', model });

      const stream = await agent.stream('List greek letters', {
        structuredOutput: { schema: z.array(z.string()) },
      });

      const partials: string[][] = [];
      for await (const partial of stream.objectStream) {
        partials.push(partial as string[]);
      }

      // Partial arrays only ever contain completed elements and grow monotonically
      for (const partial of partials) {
        expect(['alpha', 'beta', 'gamma'].slice(0, partial.length)).toEqual(partial);
      }
      expect(partials.at(-1)).toEqual(['alpha', 'beta', 'gamma']);
      expect(await stream.object).toEqual(['alpha', 'beta', 'gamma']);
      expect(await stream.text).toBe(responseText);
    });

    it('stream() textStream emits the unwrapped JSON array', async () => {
      const { model } = createArrayModel(['{"elements":[1', '23,4', '5]}']);
      const agent = new Agent({ id: 'array-agent', name: 'array-agent', instructions: 'list', model });

      const stream = await agent.stream('Count', { structuredOutput: { schema: z.array(z.number()) } });

      let text = '';
      for await (const chunk of stream.textStream) {
        text += chunk;
      }

      expect(JSON.parse(text)).toEqual([123, 45]);
      expect(await stream.object).toEqual([123, 45]);
    });

    it('rejects elements that fail the item schema', async () => {
      const { model } = createArrayModel(['{"elements":[1,"two"]}']);
      const agent = new Agent({ id: 'array-agent', name: 'array-agent', instructions: 'list', model });

      await expect(agent.generate('Count', { structuredOutput: { schema: z.array(z.number()) } })).rejects.toThrow(
        /Structured output validation failed/,
      );
    });

    it('works with a separate structuring model', async () => {
      const { model: structuringModel } = createArrayModel([responseText]);
      const agent = new Agent({
        id: 'array-agent',
        name: 'array-agent',
        instructions: 'list',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text', text: 'The greek letters are alpha, beta and gamma.' }],
            warnings: [],
          }),
        }),
      });

      const result = await agent.generate('List greek letters', {
        structuredOutput: { schema: z.array(z.string()), model: structuringModel },
      });

      expect(result.object).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  describe('prepareStep', () => {
    it("keeps tools and tool history when prepareStep forces toolChoice 'none' (#25908)", async () => {
      const calls: LanguageModelV2CallOptions[] = [];
      const mockModel = new MockLanguageModelV2({
        doGenerate: async options => {
          calls.push(options);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            warnings: [],
            ...(calls.length === 1
              ? {
                  finishReason: 'tool-calls' as const,
                  content: [
                    {
                      type: 'tool-call' as const,
                      toolCallId: 'call-1',
                      toolName: 'lookup',
                      input: JSON.stringify({ q: 'x' }),
                    },
                  ],
                }
              : { finishReason: 'stop' as const, content: [{ type: 'text' as const, text: 'Done' }] }),
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
          lookup: createTool({
            id: 'lookup',
            description: 'lookup',
            inputSchema: z.object({ q: z.string() }),
            execute: async () => 'looked up',
          }),
        },
      });
      agent.__setLogger(noopLogger);

      await agent.generate('Hello', {
        maxSteps: 3,
        prepareStep: ({ stepNumber }) => (stepNumber >= 1 ? { toolChoice: 'none' } : undefined),
      });

      expect(calls).toHaveLength(2);
      const finalCall = calls[1]!;
      expect(finalCall.toolChoice).toEqual({ type: 'none' });
      expect(finalCall.tools?.map(t => t.name)).toEqual(['lookup']);
      const partTypes = finalCall.prompt.flatMap(m => (Array.isArray(m.content) ? m.content.map(p => p.type) : []));
      expect(partTypes).toContain('tool-call');
      expect(partTypes).toContain('tool-result');
    });

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
                  input: JSON.stringify({ text: 'Hello world' }),
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

describe('sub-agent tool input schema coercion', () => {
  function createSupervisorModel(argsJson: string) {
    let call = 0;
    return new MockLanguageModelV2({
      doStream: async () => {
        call++;
        if (call === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start' as const, warnings: [] },
              { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
              { type: 'tool-call' as const, toolCallId: 'tc-1', toolName: 'agent-child', input: argsJson },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start' as const, id: 't1' },
            { type: 'text-delta' as const, id: 't1', delta: 'done' },
            { type: 'text-end' as const, id: 't1' },
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });
  }

  function createChildModel(invocations: string[]) {
    return new MockLanguageModelV2({
      doStream: async () => {
        invocations.push('child-ran');
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: 'c-0', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start' as const, id: 'c1' },
            { type: 'text-delta' as const, id: 'c1', delta: 'child answer' },
            { type: 'text-end' as const, id: 'c1' },
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });
  }

  async function runDelegation(argsJson: string) {
    const invocations: string[] = [];
    const child = new Agent({
      name: 'child',
      description: 'A child agent',
      instructions: 'You answer questions.',
      model: createChildModel(invocations),
    });
    const supervisor = new Agent({
      name: 'supervisor',
      instructions: 'Delegate to child.',
      model: createSupervisorModel(argsJson),
      agents: { child },
    });

    const stream = await supervisor.stream('delegate please');
    const chunks: any[] = [];
    for await (const c of stream.fullStream) chunks.push(c);

    const toolResults = chunks.filter(c => c.type === 'tool-result');
    return { invocations, toolResults };
  }

  it('coerces maxSteps from string to number (LLMs often emit strings)', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: '10' }));
    expect(r.invocations).toContain('child-ran');
    expect(r.toolResults[0]?.payload?.result?.text).toBe('child answer');
  });

  it('accepts maxSteps as number', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: 10 }));
    expect(r.invocations).toContain('child-ran');
    expect(r.toolResults[0]?.payload?.result?.text).toBe('child answer');
  });

  it('allows null maxSteps', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: null }));
    expect(r.invocations).toContain('child-ran');
  });

  it('allows omitted maxSteps', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello' }));
    expect(r.invocations).toContain('child-ran');
  });

  it('rejects non-integer maxSteps', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: 5.5 }));
    expect(r.invocations).not.toContain('child-ran');
    expect(r.toolResults[0]?.payload?.result?.error).toBe(true);
  });

  it('rejects non-integer maxSteps sent as a string', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: '5.5' }));
    expect(r.invocations).not.toContain('child-ran');
    expect(r.toolResults[0]?.payload?.result?.error).toBe(true);
  });

  it('rejects maxSteps below minimum of 3', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: 1 }));
    expect(r.invocations).not.toContain('child-ran');
    expect(r.toolResults[0]?.payload?.result?.error).toBe(true);
  });

  it('rejects maxSteps below minimum of 3 sent as a string', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: '1' }));
    expect(r.invocations).not.toContain('child-ran');
    expect(r.toolResults[0]?.payload?.result?.error).toBe(true);
  });

  it('rejects non-numeric string maxSteps', async () => {
    const r = await runDelegation(JSON.stringify({ prompt: 'hello', maxSteps: 'ten' }));
    expect(r.invocations).not.toContain('child-ran');
    expect(r.toolResults[0]?.payload?.result?.error).toBe(true);
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
