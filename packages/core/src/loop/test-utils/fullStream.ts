import { delay } from '@ai-sdk/provider-utils-v5';
import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { tool } from '@internal/ai-sdk-v5';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV2,
  mockValues,
  mockId,
} from '@internal/ai-sdk-v5/test';
import { convertArrayToReadableStream as convertArrayToReadableStreamV3 } from '@internal/ai-v6/test';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import type { loop } from '../loop';
import { createMessageListWithUserMessage, defaultSettings, mockDate, testUsage, testUsage2 } from './utils';
import { testUsageV3, testUsageV3_2 } from './utils-v3';
import { MastraLanguageModelV2Mock } from './MastraLanguageModelV2Mock';
import { MastraLanguageModelV3Mock } from './MastraLanguageModelV3Mock';

export function fullStreamTests({
  loopFn,
  runId,
  modelVersion = 'v2',
}: {
  loopFn: typeof loop;
  runId: string;
  modelVersion?: 'v2' | 'v3';
}) {
  const MockModel = modelVersion === 'v2' ? MastraLanguageModelV2Mock : MastraLanguageModelV3Mock;
  const convertArrayToReadableStream =
    modelVersion === 'v2' ? convertArrayToReadableStreamV2 : convertArrayToReadableStreamV3;
  const testUsageForVersion = modelVersion === 'v2' ? testUsage : testUsageV3;
  const testUsageForVersion2 = modelVersion === 'v2' ? testUsage2 : testUsageV3_2;
  // Expected normalized usage for testUsageForVersion2 (includes cached/reasoning tokens)
  const expectedNormalizedUsage2 =
    modelVersion === 'v2'
      ? {
          cachedInputTokens: 3,
          inputTokens: 3,
          outputTokens: 10,
          reasoningTokens: 10,
          totalTokens: 23,
        }
      : {
          cachedInputTokens: 3,
          inputTokens: 3,
          outputTokens: 10,
          reasoningTokens: 10,
          totalTokens: 13, // V3 normalizes totalTokens as inputTokens.total + outputTokens.total
        };

  describe('result.fullStream', () => {
    it('should maintain conversation history in the llm input', async () => {
      const messageList = new MessageList();
      messageList.add(
        [
          {
            role: 'user',
            content: [{ type: 'text', text: 'test-input' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'test-input' }],
          },
        ],
        'memory',
      );
      messageList.add(
        [
          {
            role: 'user',
            content: [{ type: 'text', text: 'test-input' }],
          },
        ],
        'input',
      );
      const result = loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockModel({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                  {
                    role: 'assistant',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'response-id',
                      modelId: 'response-model-id',
                      timestamp: new Date(5000),
                    },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                    { type: 'text-delta', id: 'text-1', delta: ', ' },
                    { type: 'text-delta', id: 'text-1', delta: `world!` },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsageForVersion,
                    },
                  ] as any),
                };
              },
            } as any),
          },
        ],
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const data = await convertAsyncIterableToArray(result.fullStream);
      expect(data).toMatchSnapshot();
    });

    it('should send text deltas', async () => {
      const messageList = createMessageListWithUserMessage();
      const result = loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockModel({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                    // providerOptions: undefined,
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'response-id',
                      modelId: 'response-model-id',
                      timestamp: new Date(5000),
                    },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                    { type: 'text-delta', id: 'text-1', delta: ', ' },
                    { type: 'text-delta', id: 'text-1', delta: `world!` },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsageForVersion,
                    },
                  ] as any),
                };
              },
            } as any),
          },
        ],
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const data = await convertAsyncIterableToArray(result.fullStream);
      expect(data).toMatchSnapshot();
    });

    it('should send reasoning deltas', async () => {
      const messageList = createMessageListWithUserMessage();
      const modelWithReasoningLocal = new MockModel({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'reasoning-start', id: '1' },
            { type: 'reasoning-delta', id: '1', delta: 'I will open the conversation' },
            { type: 'reasoning-delta', id: '1', delta: ' with witty banter.' },
            {
              type: 'reasoning-delta',
              id: '1',
              delta: '',
              providerMetadata: { testProvider: { signature: '1234567890' } },
            },
            { type: 'reasoning-end', id: '1' },
            {
              type: 'reasoning-start',
              id: '2',
              providerMetadata: { testProvider: { redactedData: 'redacted-reasoning-data' } },
            },
            { type: 'reasoning-end', id: '2' },
            { type: 'reasoning-start', id: '3' },
            { type: 'reasoning-delta', id: '3', delta: ' Once the user has relaxed,' },
            { type: 'reasoning-delta', id: '3', delta: ' I will pry for valuable information.' },
            {
              type: 'reasoning-end',
              id: '3',
              providerMetadata: { testProvider: { signature: '1234567890' } },
            },
            {
              type: 'reasoning-start',
              id: '4',
              providerMetadata: { testProvider: { signature: '1234567890' } },
            },
            { type: 'reasoning-delta', id: '4', delta: ' I need to think about' },
            { type: 'reasoning-delta', id: '4', delta: ' this problem carefully.' },
            {
              type: 'reasoning-end',
              id: '4',
              providerMetadata: { testProvider: { signature: '0987654321' } },
            },
            {
              type: 'reasoning-start',
              id: '5',
              providerMetadata: { testProvider: { signature: '1234567890' } },
            },
            { type: 'reasoning-delta', id: '5', delta: ' The best solution' },
            { type: 'reasoning-delta', id: '5', delta: ' requires careful' },
            { type: 'reasoning-delta', id: '5', delta: ' consideration of all factors.' },
            {
              type: 'reasoning-end',
              id: '5',
              providerMetadata: { testProvider: { signature: '0987654321' } },
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hi' },
            { type: 'text-delta', id: 'text-1', delta: ' there!' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageForVersion },
          ] as any),
        }),
      } as any);

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoningLocal }],
        messageList,
        ...defaultSettings(),
      });

      expect(await convertAsyncIterableToArray(result.fullStream)).toMatchSnapshot();
    });

    // https://github.com/mastra-ai/mastra/issues/9005
    it('should store empty reasoning with providerMetadata for OpenAI item_reference', async () => {
      const messageList = createMessageListWithUserMessage();
      const modelWithEmptyReasoning = new MockModel({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'reasoning-start',
              id: 'rs_test123',
              providerMetadata: { openai: { itemId: 'rs_test123' } },
            },
            // No reasoning-delta - empty reasoning
            {
              type: 'reasoning-end',
              id: 'rs_test123',
              providerMetadata: { openai: { itemId: 'rs_test123' } },
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageForVersion },
          ] as any),
        }),
      } as any);

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithEmptyReasoning }],
        messageList,
        ...defaultSettings(),
      });

      await convertAsyncIterableToArray(result.fullStream);

      // Check that reasoning was stored in messageList even though deltas were empty
      const responseMessages = messageList.get.response.db();
      const reasoningMessage = responseMessages.find(msg => msg.content.parts?.some(p => p.type === 'reasoning'));

      expect(reasoningMessage).toBeDefined();
      const reasoningPart = reasoningMessage?.content.parts?.find(p => p.type === 'reasoning');
      expect(reasoningPart?.providerMetadata).toEqual({ openai: { itemId: 'rs_test123' } });
    });

    it('should send sources', async () => {
      const messageList = createMessageListWithUserMessage();
      const modelWithSourcesLocal = new MockModel({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'source',
              sourceType: 'url',
              id: '123',
              url: 'https://example.com',
              title: 'Example',
              providerMetadata: { provider: { custom: 'value' } },
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'source',
              sourceType: 'url',
              id: '456',
              url: 'https://example.com/2',
              title: 'Example 2',
              providerMetadata: { provider: { custom: 'value2' } },
            },
            { type: 'finish', finishReason: 'stop', usage: testUsageForVersion },
          ] as any),
        }),
      } as any);

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithSourcesLocal }],
        messageList,
        ...defaultSettings(),
      });

      expect(await convertAsyncIterableToArray(result.fullStream)).toMatchSnapshot();
    });

    it('should send files', async () => {
      const messageList = createMessageListWithUserMessage();
      const modelWithFilesLocal = new MockModel({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'file', data: 'Hello World', mediaType: 'text/plain' },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
            { type: 'text-end', id: 'text-1' },
            { type: 'file', data: 'QkFVRw==', mediaType: 'image/jpeg' },
            { type: 'finish', finishReason: 'stop', usage: testUsageForVersion },
          ] as any),
        }),
      } as any);

      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithFilesLocal }],
        ...defaultSettings(),
      });

      const converted = await convertAsyncIterableToArray(result.fullStream);

      expect(converted).toMatchSnapshot();
    });

    it('should use fallback response metadata when response metadata is not provided', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        messageList,
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockModel({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                    // providerOptions: undefined,
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                    { type: 'text-delta', id: 'text-1', delta: ', ' },
                    { type: 'text-delta', id: 'text-1', delta: `world!` },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsageForVersion,
                    },
                  ] as any),
                };
              },
            } as any),
          },
        ],
        _internal: {
          currentDate: mockValues(new Date(2000)),
          generateId: mockValues('id-2000'),
        },
      });

      expect(await convertAsyncIterableToArray(result.fullStream)).toMatchSnapshot();
    });

    it('should send tool calls', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        messageList,
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockModel({
              doStream: async ({
                prompt,
                tools,
                toolChoice,
              }: {
                prompt: unknown;
                tools: unknown;
                toolChoice: unknown;
              }) => {
                expect(tools).toStrictEqual([
                  {
                    type: 'function',
                    name: 'tool1',
                    description: undefined,
                    inputSchema: {
                      $schema: 'http://json-schema.org/draft-07/schema#',
                      additionalProperties: false,
                      properties: { value: { type: 'string' } },
                      required: ['value'],
                      type: 'object',
                    },
                    providerOptions: undefined,
                  },
                ]);

                expect(toolChoice).toStrictEqual({ type: 'required' });

                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                    // providerOptions: undefined,
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value" }`,
                      providerMetadata: {
                        testProvider: {
                          signature: 'sig',
                        },
                      },
                    },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsageForVersion,
                    },
                  ] as any),
                };
              },
            } as any),
          },
        ],
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        toolChoice: 'required',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      expect(await convertAsyncIterableToArray(result.fullStream)).toMatchSnapshot();
    });

    it('should send tool call deltas', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockModel({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-input-start',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    toolName: 'test-tool',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    delta: '{"',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    delta: 'value',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    delta: '":"',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    delta: 'Spark',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    delta: 'le',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    delta: ' Day',
                  },
                  {
                    type: 'tool-input-delta',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    delta: '"}',
                  },
                  {
                    type: 'tool-input-end',
                    id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
                    toolName: 'test-tool',
                    input: '{"value":"Sparkle Day"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: testUsageForVersion2,
                  },
                ] as any),
              }),
            } as any),
          },
        ],
        tools: {
          'test-tool': tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        toolChoice: 'required',
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.fullStream);

      expect(fullStream).toMatchSnapshot();
    });

    it('should send tool results', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockModel({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "value" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: testUsageForVersion,
                  },
                ] as any),
              }),
            } as any),
          },
        ],
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async (inputData, options) => {
              // console.info('TOOL 1', inputData, options);

              expect(inputData).toStrictEqual({ value: 'value' });
              expect(options.messages).toStrictEqual([
                { role: 'user', content: [{ type: 'text', text: 'test-input' }] },
              ]);
              return `${inputData.value}-result`;
            },
          }),
        },
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.fullStream);

      expect(fullStream).toMatchSnapshot();
    });

    it('should send delayed asynchronous tool results', async () => {
      vi.useRealTimers();
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockModel({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'tool1',
                    input: `{ "value": "value" }`,
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: testUsageForVersion,
                  },
                ] as any),
              }),
            } as any),
          },
        ],
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }: { value: string }) => {
              await delay(50); // delay to show bug where step finish is sent before tool result
              return `${value}-result`;
            },
          },
        },
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.fullStream);

      expect(fullStream).toMatchSnapshot();
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    it('should filter out empty text deltas', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockModel({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: '' },
                  { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                  { type: 'text-delta', id: 'text-1', delta: '' },
                  { type: 'text-delta', id: 'text-1', delta: ', ' },
                  { type: 'text-delta', id: 'text-1', delta: '' },
                  { type: 'text-delta', id: 'text-1', delta: 'world!' },
                  { type: 'text-delta', id: 'text-1', delta: '' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: testUsageForVersion,
                  },
                ] as any),
              }),
            } as any),
          },
        ],
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.fullStream);

      expect(fullStream).toMatchSnapshot();
    });
  });
}
