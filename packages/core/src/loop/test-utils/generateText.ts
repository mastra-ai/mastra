import type { LanguageModelV2StreamPart, SharedV2ProviderMetadata } from '@ai-sdk/provider-v5';
import type { generateText as generateText5, ToolSet } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, mockId } from '@internal/ai-sdk-v5/test';
import { assertType, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { loop } from '../loop';
import type { LoopOptions } from '../types';
import {
  createMessageListWithUserMessage,
  createTestModels,
  expectPromptWithoutMastraCreatedAt,
  modelWithFiles,
  modelWithReasoning,
  modelWithSources,
  stripMastraCreatedAt,
  testUsage,
} from './utils';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';

export function generateTextTestsV5({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  const generateText = async (args: Omit<LoopOptions, 'runId' | 'methodType'>): ReturnType<typeof generateText5> => {
    const output = await loopFn({
      runId,
      methodType: 'generate',
      ...args,
    });
    // @ts-expect-error -- missing `experimental_output` in v5 getFullOutput
    return output.getFullOutput();
  };

  const dummyResponseValues = {
    finishReason: 'stop' as const,
    usage: {
      inputTokens: 3,
      outputTokens: 10,
      totalTokens: 13,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
    },
    warnings: [],
  };

  describe('generateText', () => {
    describe('result.content', () => {
      // TODO: content is not in the correct shape. missing `source` chunks if tool calls are included in stream
      it.todo('should generate content', async () => {
        const messageList = createMessageListWithUserMessage();

        const result = await generateText({
          agentId: 'agent-id',
          models: createTestModels({
            stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Hello, world!' },
              { type: 'text-end', id: 'text-1' },
              {
                id: '123',
                providerMetadata: {
                  provider: {
                    custom: 'value',
                  },
                },
                sourceType: 'url',
                title: 'Example',
                type: 'source',
                url: 'https://example.com',
              },
              { type: 'file', data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' },
              { type: 'reasoning-start', id: '1' },
              { type: 'reasoning-delta', id: '1', delta: 'I will open the conversation with witty banter.' },
              { type: 'reasoning-end', id: '1' },
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'tool1', input: `{ "value": "value" }` },
              { type: 'text-start', id: 'text-2' },
              { type: 'text-delta', id: 'text-2', delta: 'More text' },
              { type: 'text-end', id: 'text-2' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: testUsage,
                providerMetadata: {
                  testProvider: { testKey: 'testValue' },
                },
              },
            ]),
          }),
          messageList,
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async args => {
                expect(args).toStrictEqual({ value: 'value' });
                return 'result1';
              },
            },
          },
        });

        expect(result.content).toMatchInlineSnapshot(`
            [
              {
                "text": "Hello, world!",
                "type": "text",
              },
              {
                "id": "123",
                "providerMetadata": {
                  "provider": {
                    "custom": "value",
                  },
                },
                "sourceType": "url",
                "title": "Example",
                "type": "source",
                "url": "https://example.com",
              },
              {
                "file": DefaultGeneratedFileWithType {
                  "type":"file",
                  "base64Data": "AQID",
                  "mediaType": "image/png",
                  "uint8ArrayData": Uint8Array [
                    1,
                    2,
                    3,
                  ],
                },
                "type": "file",
              },
              {
                "text": "I will open the conversation with witty banter.",
                "type": "reasoning",
                "providerOptions": undefined,
              },
              {
                "text": "More text",
                "type": "text",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-call",
              },
              {
                "dynamic": false,
                "input": {
                  "value": "value",
                },
                "output": "result1",
                "toolCallId": "call-1",
                "toolName": "tool1",
                "type": "tool-result",
              },
            ]
          `);
      });
    });

    describe('result.text', () => {
      it('should generate text', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: createTestModels(),
          messageList: createMessageListWithUserMessage(),
        });

        expect(stripMastraCreatedAt(modelWithSources.doGenerateCalls)).toMatchSnapshot();
        expect(await result.text).toStrictEqual('Hello, world!');
      });
    });

    describe('result.reasoningText', () => {
      it('should contain reasoning string from model response', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoning }],
          messageList: createMessageListWithUserMessage(),
        });

        expect(result.reasoningText).toStrictEqual(
          'I will open the conversation with witty banter. Once the user has relaxed, I will pry for valuable information. I need to think about this problem carefully. The best solution requires careful consideration of all factors.',
        );
      });
    });

    describe('result.sources', () => {
      it('should contain sources', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithSources }],
          messageList: createMessageListWithUserMessage(),
        });

        expect(stripMastraCreatedAt(await result.sources)).toMatchSnapshot();
      });
    });

    describe('result.files', () => {
      it('should contain files', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithFiles }],
          messageList: createMessageListWithUserMessage(),
        });

        expect(stripMastraCreatedAt(await result.files)).toMatchSnapshot();
      });
    });

    describe('result.steps', () => {
      const modelWithReasoning = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'reasoning-start', id: '1' },
            {
              type: 'reasoning-delta',
              id: '1',
              delta: 'I will open the conversation',
            },
            {
              type: 'reasoning-delta',
              id: '1',
              delta: ' with witty banter.',
            },
            {
              type: 'reasoning-delta',
              id: '1',
              delta: '',
              providerMetadata: {
                testProvider: { signature: '1234567890' },
              } as SharedV2ProviderMetadata,
            },
            { type: 'reasoning-end', id: '1' },
            {
              type: 'reasoning-start',
              id: '2',
              providerMetadata: {
                testProvider: { redactedData: 'redacted-reasoning-data' },
              },
            },
            { type: 'reasoning-end', id: '2' },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello,' },
            { type: 'text-delta', id: 'text-1', delta: ' world!' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
      });

      const modelWithSources = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello, world!' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'source',
              sourceType: 'url',
              id: '123',
              url: 'https://example.com',
              title: 'Example',
              providerMetadata: { provider: { custom: 'value' } },
            },
            {
              type: 'source',
              sourceType: 'url',
              id: '456',
              url: 'https://example.com/2',
              title: 'Example 2',
              providerMetadata: { provider: { custom: 'value2' } },
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
      });

      it.todo('should add the reasoning from the model response to the step result', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoning }],
          messageList: createMessageListWithUserMessage(),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            currentDate: () => new Date(0),
          },
        });

        expect(stripMastraCreatedAt(await result.steps)).toMatchSnapshot();
      });

      it.todo('should contain sources', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithSources }],
          messageList: createMessageListWithUserMessage(),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            currentDate: () => new Date(0),
          },
        });
        expect(stripMastraCreatedAt(await result.steps)).toMatchSnapshot();
      });

      // TODO: include `files` in step result
      // generateText uses a defaurt StepResult class than streaming does
      // https://github.com/vercel/ai/blob/53569b8e0e5c958db0186009b83ce941a5bc91c1/packages/ai/src/generate-text/generate-text.ts#L540
      it.todo('should contain files', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithFiles }],
          messageList: createMessageListWithUserMessage(),
          _internal: {
            generateId: mockId({ prefix: 'id' }),
            currentDate: () => new Date(0),
          },
        });

        expect(stripMastraCreatedAt(await result.steps)).toMatchSnapshot();
      });
    });

    describe.todo('result.toolCalls', () => {
      it('should contain tool calls', async () => {
        const messageList = createMessageListWithUserMessage();
        const result = await generateText({
          agentId: 'agent-id',
          models: [
            {
              maxRetries: 0,
              id: 'test-model',
              model: new MockLanguageModelV2({
                doGenerate: async ({ prompt, tools, toolChoice }) => {
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
                    {
                      type: 'function',
                      name: 'tool2',
                      description: undefined,
                      inputSchema: {
                        $schema: 'http://json-schema.org/draft-07/schema#',
                        additionalProperties: false,
                        properties: { somethingElse: { type: 'string' } },
                        required: ['somethingElse'],
                        type: 'object',
                      },
                      providerOptions: undefined,
                    },
                  ]);

                  expect(toolChoice).toStrictEqual({ type: 'required' });

                  expectPromptWithoutMastraCreatedAt(prompt, [
                    {
                      role: 'user',
                      content: [{ type: 'text', text: 'test-input' }],
                      providerOptions: undefined,
                    },
                  ]);

                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                    ],
                  };
                },
              }),
            },
          ],
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
            },
            // 2nd tool to show typing:
            tool2: {
              inputSchema: z.object({ somethingElse: z.string() }),
            },
          },
          toolChoice: 'required',
          messageList,
        });

        // test type inference
        if (result.toolCalls?.[0]?.toolName === 'tool1' && !result.toolCalls?.[0]?.dynamic) {
          assertType<string>(result.toolCalls[0].input.value);
        }

        expect(await result.toolCalls).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
        ]
      `);
      });
    });

    describe.todo('result.toolResults', () => {
      it('should contain tool results', async () => {
        const messageList = createMessageListWithUserMessage();
        const result = await generateText({
          agentId: 'agent-id',
          models: [
            {
              maxRetries: 0,
              id: 'test-model',
              model: new MockLanguageModelV2({
                doGenerate: async ({ prompt, tools, toolChoice }) => {
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

                  expect(toolChoice).toStrictEqual({ type: 'auto' });

                  expectPromptWithoutMastraCreatedAt(prompt, [
                    {
                      role: 'user',
                      content: [{ type: 'text', text: 'test-input' }],
                      providerOptions: undefined,
                    },
                  ]);

                  return {
                    ...dummyResponseValues,
                    content: [
                      {
                        type: 'tool-call',
                        toolCallType: 'function',
                        toolCallId: 'call-1',
                        toolName: 'tool1',
                        input: `{ "value": "value" }`,
                      },
                    ],
                  };
                },
              }),
            },
          ],
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async args => {
                expect(args).toStrictEqual({ value: 'value' });
                return 'result1';
              },
            },
          },
          messageList,
        });

        // test type inference
        if (result.toolResults?.[0]?.toolName === 'tool1' && !result.toolResults?.[0]?.dynamic) {
          assertType<string>(result.toolResults[0].output);
        }

        expect(await result.toolResults).toMatchInlineSnapshot(`
        [
          {
            "dynamic": false,
            "input": {
              "value": "value",
            },
            "output": "result1",
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-result",
          },
        ]
      `);
      });
    });

    describe.todo('result.providerMetadata', () => {
      it('should contain provider metadata', async () => {
        const messageList = createMessageListWithUserMessage();
        const result = await generateText({
          agentId: 'agent-id',
          models: [
            {
              maxRetries: 0,
              id: 'test-model',
              model: new MockLanguageModelV2({
                doGenerate: async () => ({
                  ...dummyResponseValues,
                  content: [],
                  providerMetadata: {
                    exampleProvider: {
                      a: 10,
                      b: 20,
                    },
                  },
                }),
              }),
            },
          ],
          messageList,
        });

        expect(await result.providerMetadata).toStrictEqual({
          exampleProvider: {
            a: 10,
            b: 20,
          },
        });
      });
    });

    describe.todo('result.response.messages', () => {
      it('should contain assistant response message when there are no tool calls', async () => {
        const messageList = createMessageListWithUserMessage();

        const result = await generateText({
          agentId: 'agent-id',
          models: [
            {
              maxRetries: 0,
              id: 'test-model',
              model: new MockLanguageModelV2({
                doStream: async ({}) => ({
                  ...dummyResponseValues,
                  stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello, world!' },
                    { type: 'text-end', id: 'text-1' },
                    { type: 'finish', finishReason: 'stop', usage: testUsage },
                  ]),
                }),
              }),
            },
          ],
          messageList,
        });

        expect(stripMastraCreatedAt(result.response.messages)).toMatchSnapshot();
      });

      it('should contain assistant response message and tool message when there are tool calls with results', async () => {
        const messageList = createMessageListWithUserMessage();
        const result = await generateText({
          agentId: 'agent-id',
          models: [
            {
              maxRetries: 0,
              id: 'test-model',
              model: new MockLanguageModelV2({
                doGenerate: async () => ({
                  ...dummyResponseValues,
                  content: [
                    { type: 'text', text: 'Hello, world!' },
                    {
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value" }`,
                    },
                  ],
                }),
              }),
            },
          ],
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async (args, options) => {
                expect(args).toStrictEqual({ value: 'value' });
                expectPromptWithoutMastraCreatedAt(options.messages, [{ role: 'user', content: 'test-input' }]);
                return 'result1';
              },
            },
          },
          messageList,
        });

        expect(stripMastraCreatedAt(result.response.messages)).toMatchSnapshot();
      });

      it('should contain reasoning', async () => {
        const messageList = createMessageListWithUserMessage();
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoning }],
          messageList,
        });

        expect(stripMastraCreatedAt(result.response.messages)).toMatchSnapshot();
      });
    });

    describe('result.request', () => {
      it('should contain request body', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [
            {
              maxRetries: 0,
              id: 'test-model',
              model: new MockLanguageModelV2({
                doGenerate: async () => ({
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Hello, world!' }],
                  request: {
                    body: 'test body',
                  },
                }),
                doStream: async ({}) => ({
                  ...dummyResponseValues,
                  stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello, world!' },
                    { type: 'text-end', id: 'text-1' },
                    { type: 'finish', finishReason: 'stop', usage: testUsage },
                  ]),
                  request: {
                    body: 'test body',
                  },
                }),
              }),
            },
          ],
          messageList: createMessageListWithUserMessage(),
        });

        expect(result.request).toStrictEqual({
          body: 'test body',
        });
      });
    });

    describe('result.response', () => {
      it('should contain response body and headers', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [
            {
              maxRetries: 0,
              id: 'test-model',
              model: new MockLanguageModelV2({
                doGenerate: async () => ({
                  ...dummyResponseValues,
                  content: [{ type: 'text', text: 'Hello, world!' }],
                  response: {
                    id: 'test-id-from-model',
                    timestamp: new Date(10000),
                    modelId: 'test-response-model-id',
                    modelProvider: 'mock-provider',
                    modelVersion: 'v2',
                    headers: {
                      'custom-response-header': 'response-header-value',
                    },
                    body: 'test body',
                  },
                }),
                doStream: async ({}) => ({
                  ...dummyResponseValues,
                  stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello, world!' },
                    { type: 'text-end', id: 'text-1' },
                    { type: 'finish', finishReason: 'stop', usage: testUsage },
                  ]),
                  response: {
                    id: 'test-id-from-model',
                    timestamp: new Date(10000),
                    modelId: 'test-response-model-id',
                    modelProvider: 'mock-provider',
                    modelVersion: 'v2',
                    headers: {
                      'custom-response-header': 'response-header-value',
                    },
                    body: 'test body',
                  },
                }),
              }),
            },
          ],
          _internal: { generateId: () => '1234', currentDate: () => new Date(0), now: () => 0 },
          messageList: createMessageListWithUserMessage(),
        });

        expect(stripMastraCreatedAt(result.steps?.[0]?.response)).toMatchObject({
          body: 'test body',
          headers: {
            'custom-response-header': 'response-header-value',
          },
          id: 'test-id-from-model',
          modelId: 'test-response-model-id',
          modelProvider: 'mock-provider',
          modelVersion: 'v2',
          // With direct execution (default), timestamps remain as Date objects.
          // With evented execution they would be serialized to ISO strings via JSON.stringify.
          timestamp: new Date(10000),
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Hello, world!',
                },
              ],
            },
          ],
        });

        expect(stripMastraCreatedAt(await result.response)).toMatchObject({
          body: 'test body',
          headers: {
            'custom-response-header': 'response-header-value',
          },
          id: 'test-id-from-model',
          modelId: 'test-response-model-id',
          modelProvider: 'mock-provider',
          modelVersion: 'v2',
          // With direct execution (default), timestamps remain as Date objects.
          timestamp: new Date(10000),
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Hello, world!',
                },
              ],
            },
          ],
        });
      });
    });
  });
}
