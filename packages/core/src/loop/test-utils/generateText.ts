import type { LanguageModelV2StreamPart, SharedV2ProviderMetadata } from '@ai-sdk/provider-v5';
import type { generateText as generateText5 } from 'ai-v5';
import { convertArrayToReadableStream, mockId, MockLanguageModelV2 } from 'ai-v5/test';
import { assertType, describe, expect, it } from 'vitest';
import z from 'zod';
import type { loop } from '../loop';
import type { LoopOptions } from '../types';
import {
  createMessageListWithUserMessage,
  createTestModels,
  modelWithFiles,
  modelWithReasoning,
  modelWithSources,
  testUsage,
} from './utils';

export function generateTextTestsV5({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  const generateText = async (args: Omit<LoopOptions, 'runId' | 'methodType'>): ReturnType<typeof generateText5> => {
    const output = await loopFn({
      runId,
      methodType: 'generate',
      ...args,
    });
    // @ts-expect-error -- missing `experimental_output` in v5 getFullOutput
    return output.aisdk.v5.getFullOutput();
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
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Hello, world!' },
              { type: 'text-end', id: '1' },
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
              { type: 'text-start', id: '2' },
              { type: 'text-delta', id: '2', delta: 'More text' },
              { type: 'text-end', id: '2' },
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

        console.dir({ resultContent: result.content }, { depth: null });

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

        expect(modelWithSources.doGenerateCalls).toMatchSnapshot();
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

        expect(await result.sources).toMatchSnapshot();
      });
    });

    describe('result.files', () => {
      it.todo('should contain files', async () => {
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithFiles }],
          messageList: createMessageListWithUserMessage(),
        });

        expect(await result.files).toMatchSnapshot();
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
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello,' },
            { type: 'text-delta', id: '1', delta: ' world!' },
            { type: 'text-end', id: '1' },
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
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello, world!' },
            { type: 'text-end', id: '1' },
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

        expect(await result.steps).toMatchSnapshot();
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
        expect(await result.steps).toMatchSnapshot();
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

        expect(await result.steps).toMatchSnapshot();
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

                  expect(prompt).toStrictEqual([
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

                  expect(prompt).toStrictEqual([
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
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Hello, world!' },
                    { type: 'text-end', id: '1' },
                    { type: 'finish', finishReason: 'stop', usage: testUsage },
                  ]),
                }),
              }),
            },
          ],
          messageList,
        });

        expect(result.response.messages).toMatchSnapshot();
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
                expect(options.messages).toStrictEqual([{ role: 'user', content: 'test-input' }]);
                return 'result1';
              },
            },
          },
          messageList,
        });

        expect(result.response.messages).toMatchSnapshot();
      });

      it('should contain reasoning', async () => {
        const messageList = createMessageListWithUserMessage();
        const result = await generateText({
          agentId: 'agent-id',
          models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoning }],
          messageList,
        });

        expect(result.response.messages).toMatchSnapshot();
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
                doStream: async ({}) => ({
                  ...dummyResponseValues,
                  stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Hello, world!' },
                    { type: 'text-end', id: '1' },
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

        expect(await result.request).toStrictEqual({
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
                doStream: async ({}) => ({
                  ...dummyResponseValues,
                  stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Hello, world!' },
                    { type: 'text-end', id: '1' },
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

        expect(result.steps?.[0]?.response).toMatchInlineSnapshot(`
          {
            "body": "test body",
            "headers": {
              "custom-response-header": "response-header-value",
            },
            "id": "test-id-from-model",
            "messages": [
              {
                "content": [
                  {
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
            "modelId": "test-response-model-id",
            "modelMetadata": {
              "modelId": "mock-model-id",
              "modelProvider": "mock-provider",
              "modelVersion": "v2",
            },
            "modelProvider": "mock-provider",
            "modelVersion": "v2",
            "timestamp": 1970-01-01T00:00:10.000Z,
            "uiMessages": [
              {
                "id": "1234",
                "metadata": {
                  "createdAt": 2024-01-01T00:00:00.001Z,
                },
                "parts": [
                  {
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
          }
        `);
        expect(await result.response).toMatchInlineSnapshot(`
          {
            "body": "test body",
            "headers": {
              "custom-response-header": "response-header-value",
            },
            "id": "test-id-from-model",
            "messages": [
              {
                "content": [
                  {
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
            "modelId": "test-response-model-id",
            "modelMetadata": {
              "modelId": "mock-model-id",
              "modelProvider": "mock-provider",
              "modelVersion": "v2",
            },
            "modelProvider": "mock-provider",
            "modelVersion": "v2",
            "timestamp": 1970-01-01T00:00:10.000Z,
            "uiMessages": [
              {
                "id": "1234",
                "metadata": {
                  "createdAt": 2024-01-01T00:00:00.001Z,
                },
                "parts": [
                  {
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
          }
        `);
      });
    });

    // describe.todo('options.stopWhen', () => {
    //   describe.todo('2 steps: initial, tool-result', () => {
    //     let result: GenerateTextResult<any, any>;
    //     let onStepFinishResults: StepResult<any>[];

    //     beforeEach(async () => {
    //       onStepFinishResults = [];

    //       let responseCount = 0;
    //       result = await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async ({ prompt, tools, toolChoice }) => {
    //             switch (responseCount++) {
    //               case 0:
    //                 expect(tools).toStrictEqual([
    //                   {
    //                     type: 'function',
    //                     name: 'tool1',
    //                     description: undefined,
    //                     inputSchema: {
    //                       $schema: 'http://json-schema.org/draft-07/schema#',
    //                       additionalProperties: false,
    //                       properties: { value: { type: 'string' } },
    //                       required: ['value'],
    //                       type: 'object',
    //                     },
    //                     providerOptions: undefined,
    //                   },
    //                 ]);

    //                 expect(toolChoice).toStrictEqual({ type: 'auto' });

    //                 expect(prompt).toStrictEqual([
    //                   {
    //                     role: 'user',
    //                     content: [{ type: 'text', text: 'test-input' }],
    //                     providerOptions: undefined,
    //                   },
    //                 ]);

    //                 return {
    //                   ...dummyResponseValues,
    //                   content: [
    //                     {
    //                       type: 'tool-call',
    //                       toolCallType: 'function',
    //                       toolCallId: 'call-1',
    //                       toolName: 'tool1',
    //                       input: `{ "value": "value" }`,
    //                     },
    //                   ],
    //                   finishReason: 'tool-calls',
    //                   usage: {
    //                     inputTokens: 10,
    //                     outputTokens: 5,
    //                     totalTokens: 15,
    //                     reasoningTokens: undefined,
    //                     cachedInputTokens: undefined,
    //                   },
    //                   response: {
    //                     id: 'test-id-1-from-model',
    //                     timestamp: new Date(0),
    //                     modelId: 'test-response-model-id',
    //                   },
    //                 };
    //               case 1:
    //                 return {
    //                   ...dummyResponseValues,
    //                   content: [{ type: 'text', text: 'Hello, world!' }],
    //                   response: {
    //                     id: 'test-id-2-from-model',
    //                     timestamp: new Date(10000),
    //                     modelId: 'test-response-model-id',
    //                     headers: {
    //                       'custom-response-header': 'response-header-value',
    //                     },
    //                   },
    //                 };
    //               default:
    //                 throw new Error(`Unexpected response count: ${responseCount}`);
    //             }
    //           },
    //         }),
    //         tools: {
    //           tool1: tool({
    //             inputSchema: z.object({ value: z.string() }),
    //             execute: async (args, options) => {
    //               expect(args).toStrictEqual({ value: 'value' });
    //               expect(options.messages).toStrictEqual([{ role: 'user', content: 'test-input' }]);
    //               return 'result1';
    //             },
    //           }),
    //         },
    //         prompt: 'test-input',
    //         stopWhen: stepCountIs(3),
    //         onStepFinish: async event => {
    //           onStepFinishResults.push(event);
    //         },
    //       });
    //     });

    //     it('result.text should return text from last step', async () => {
    //       assert.deepStrictEqual(result.text, 'Hello, world!');
    //     });

    //     it('result.toolCalls should return empty tool calls from last step', async () => {
    //       assert.deepStrictEqual(result.toolCalls, []);
    //     });

    //     it('result.toolResults should return empty tool results from last step', async () => {
    //       assert.deepStrictEqual(result.toolResults, []);
    //     });

    //     it('result.response.messages should contain response messages from all steps', () => {
    //       expect(result.response.messages).toMatchSnapshot();
    //     });

    //     it('result.totalUsage should sum token usage', () => {
    //       expect(result.totalUsage).toMatchInlineSnapshot(`
    //     {
    //       "cachedInputTokens": undefined,
    //       "inputTokens": 13,
    //       "outputTokens": 15,
    //       "reasoningTokens": undefined,
    //       "totalTokens": 28,
    //     }
    //   `);
    //     });

    //     it('result.usage should contain token usage from final step', async () => {
    //       expect(result.usage).toMatchInlineSnapshot(`
    //     {
    //       "cachedInputTokens": undefined,
    //       "inputTokens": 3,
    //       "outputTokens": 10,
    //       "reasoningTokens": undefined,
    //       "totalTokens": 13,
    //     }
    //   `);
    //     });

    //     it('result.steps should contain all steps', () => {
    //       expect(result.steps).toMatchSnapshot();
    //     });

    //     it('onStepFinish should be called for each step', () => {
    //       expect(onStepFinishResults).toMatchSnapshot();
    //     });
    //   });

    //   describe.todo('2 steps: initial, tool-result with prepareStep', () => {
    //     let result: GenerateTextResult<any, any>;
    //     let onStepFinishResults: StepResult<any>[];
    //     let doGenerateCalls: Array<LanguageModelV2CallOptions>;
    //     let prepareStepCalls: Array<{
    //       stepNumber: number;
    //       steps: Array<StepResult<any>>;
    //       messages: Array<ModelMessage>;
    //     }>;

    //     beforeEach(async () => {
    //       onStepFinishResults = [];
    //       doGenerateCalls = [];
    //       prepareStepCalls = [];

    //       let responseCount = 0;

    //       const trueModel = new MockLanguageModelV2({
    //         doGenerate: async ({ prompt, tools, toolChoice }) => {
    //           doGenerateCalls.push({ prompt, tools, toolChoice });

    //           switch (responseCount++) {
    //             case 0:
    //               return {
    //                 ...dummyResponseValues,
    //                 content: [
    //                   {
    //                     type: 'tool-call',
    //                     toolCallType: 'function',
    //                     toolCallId: 'call-1',
    //                     toolName: 'tool1',
    //                     input: `{ "value": "value" }`,
    //                   },
    //                 ],
    //                 toolResults: [
    //                   {
    //                     toolCallId: 'call-1',
    //                     toolName: 'tool1',
    //                     input: { value: 'value' },
    //                     output: 'result1',
    //                   },
    //                 ],
    //                 finishReason: 'tool-calls',
    //                 usage: {
    //                   inputTokens: 10,
    //                   outputTokens: 5,
    //                   totalTokens: 15,
    //                   reasoningTokens: undefined,
    //                   cachedInputTokens: undefined,
    //                 },
    //                 response: {
    //                   id: 'test-id-1-from-model',
    //                   timestamp: new Date(0),
    //                   modelId: 'test-response-model-id',
    //                 },
    //               };
    //             case 1:
    //               return {
    //                 ...dummyResponseValues,
    //                 content: [{ type: 'text', text: 'Hello, world!' }],
    //                 response: {
    //                   id: 'test-id-2-from-model',
    //                   timestamp: new Date(10000),
    //                   modelId: 'test-response-model-id',
    //                   headers: {
    //                     'custom-response-header': 'response-header-value',
    //                   },
    //                 },
    //               };
    //             default:
    //               throw new Error(`Unexpected response count: ${responseCount}`);
    //           }
    //         },
    //       });

    //       result = await generateText({
    //         model: modelWithFiles,
    //         tools: {
    //           tool1: tool({
    //             inputSchema: z.object({ value: z.string() }),
    //             execute: async (args, options) => {
    //               expect(args).toStrictEqual({ value: 'value' });
    //               expect(options.messages).toStrictEqual([{ role: 'user', content: 'test-input' }]);
    //               return 'result1';
    //             },
    //           }),
    //         },
    //         prompt: 'test-input',
    //         stopWhen: stepCountIs(3),
    //         onStepFinish: async event => {
    //           onStepFinishResults.push(event);
    //         },
    //         prepareStep: async ({ model, stepNumber, steps, messages }) => {
    //           prepareStepCalls.push({ stepNumber, steps, messages });

    //           if (stepNumber === 0) {
    //             expect(steps).toStrictEqual([]);
    //             return {
    //               model: trueModel,
    //               toolChoice: {
    //                 type: 'tool',
    //                 toolName: 'tool1' as const,
    //               },
    //               system: 'system-message-0',
    //               messages: [
    //                 {
    //                   role: 'user',
    //                   content: 'new input from prepareStep',
    //                 },
    //               ],
    //             };
    //           }

    //           if (stepNumber === 1) {
    //             expect(steps.length).toStrictEqual(1);
    //             return {
    //               model: trueModel,
    //               activeTools: [],
    //               system: 'system-message-1',
    //             };
    //           }
    //         },
    //       });
    //     });

    //     it('should contain all prepareStep calls', async () => {
    //       expect(prepareStepCalls).toMatchInlineSnapshot(`
    //       [
    //         {
    //           "messages": [
    //             {
    //               "content": "test-input",
    //               "role": "user",
    //             },
    //           ],
    //           "stepNumber": 0,
    //           "steps": [
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "providerExecuted": undefined,
    //                   "providerMetadata": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-call",
    //                 },
    //                 {
    //                   "dynamic": false,
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "output": "result1",
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-result",
    //                 },
    //               ],
    //               "finishReason": "tool-calls",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "body": undefined,
    //                 "headers": undefined,
    //                 "id": "test-id-1-from-model",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "input": {
    //                           "value": "value",
    //                         },
    //                         "providerExecuted": undefined,
    //                         "providerOptions": undefined,
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-call",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "output": {
    //                           "type": "text",
    //                           "value": "result1",
    //                         },
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-result",
    //                       },
    //                     ],
    //                     "role": "tool",
    //                   },
    //                 ],
    //                 "modelId": "test-response-model-id",
    //                 "timestamp": 1970-01-01T00:00:00.000Z,
    //               },
    //               "usage": {
    //                 "cachedInputTokens": undefined,
    //                 "inputTokens": 10,
    //                 "outputTokens": 5,
    //                 "reasoningTokens": undefined,
    //                 "totalTokens": 15,
    //               },
    //               "warnings": [],
    //             },
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "text": "Hello, world!",
    //                   "type": "text",
    //                 },
    //               ],
    //               "finishReason": "stop",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "body": undefined,
    //                 "headers": {
    //                   "custom-response-header": "response-header-value",
    //                 },
    //                 "id": "test-id-2-from-model",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "input": {
    //                           "value": "value",
    //                         },
    //                         "providerExecuted": undefined,
    //                         "providerOptions": undefined,
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-call",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "output": {
    //                           "type": "text",
    //                           "value": "result1",
    //                         },
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-result",
    //                       },
    //                     ],
    //                     "role": "tool",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "providerOptions": undefined,
    //                         "text": "Hello, world!",
    //                         "type": "text",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                 ],
    //                 "modelId": "test-response-model-id",
    //                 "modelProvider": "mock-provider",
    //                 "modelVersion": "v2",
    //                 "timestamp": 1970-01-01T00:00:10.000Z,
    //               },
    //               "usage": {
    //                 "cachedInputTokens": undefined,
    //                 "inputTokens": 3,
    //                 "outputTokens": 10,
    //                 "reasoningTokens": undefined,
    //                 "totalTokens": 13,
    //               },
    //               "warnings": [],
    //             },
    //           ],
    //         },
    //         {
    //           "messages": [
    //             {
    //               "content": "test-input",
    //               "role": "user",
    //             },
    //             {
    //               "content": [
    //                 {
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "providerExecuted": undefined,
    //                   "providerOptions": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-call",
    //                 },
    //               ],
    //               "role": "assistant",
    //             },
    //             {
    //               "content": [
    //                 {
    //                   "output": {
    //                     "type": "text",
    //                     "value": "result1",
    //                   },
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-result",
    //                 },
    //               ],
    //               "role": "tool",
    //             },
    //           ],
    //           "stepNumber": 1,
    //           "steps": [
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "providerExecuted": undefined,
    //                   "providerMetadata": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-call",
    //                 },
    //                 {
    //                   "dynamic": false,
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "output": "result1",
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-result",
    //                 },
    //               ],
    //               "finishReason": "tool-calls",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "body": undefined,
    //                 "headers": undefined,
    //                 "id": "test-id-1-from-model",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "input": {
    //                           "value": "value",
    //                         },
    //                         "providerExecuted": undefined,
    //                         "providerOptions": undefined,
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-call",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "output": {
    //                           "type": "text",
    //                           "value": "result1",
    //                         },
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-result",
    //                       },
    //                     ],
    //                     "role": "tool",
    //                   },
    //                 ],
    //                 "modelId": "test-response-model-id",
    //                 "timestamp": 1970-01-01T00:00:00.000Z,
    //               },
    //               "usage": {
    //                 "cachedInputTokens": undefined,
    //                 "inputTokens": 10,
    //                 "outputTokens": 5,
    //                 "reasoningTokens": undefined,
    //                 "totalTokens": 15,
    //               },
    //               "warnings": [],
    //             },
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "text": "Hello, world!",
    //                   "type": "text",
    //                 },
    //               ],
    //               "finishReason": "stop",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "body": undefined,
    //                 "headers": {
    //                   "custom-response-header": "response-header-value",
    //                 },
    //                 "id": "test-id-2-from-model",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "input": {
    //                           "value": "value",
    //                         },
    //                         "providerExecuted": undefined,
    //                         "providerOptions": undefined,
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-call",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "output": {
    //                           "type": "text",
    //                           "value": "result1",
    //                         },
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-result",
    //                       },
    //                     ],
    //                     "role": "tool",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "providerOptions": undefined,
    //                         "text": "Hello, world!",
    //                         "type": "text",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                 ],
    //                 "modelId": "test-response-model-id",
    //                 "modelProvider": "mock-provider",
    //                 "modelVersion": "v2",
    //                 "timestamp": 1970-01-01T00:00:10.000Z,
    //               },
    //               "usage": {
    //                 "cachedInputTokens": undefined,
    //                 "inputTokens": 3,
    //                 "outputTokens": 10,
    //                 "reasoningTokens": undefined,
    //                 "totalTokens": 13,
    //               },
    //               "warnings": [],
    //             },
    //           ],
    //         },
    //       ]
    //     `);
    //     });

    //     it('doGenerate should be called with the correct arguments', () => {
    //       expect(doGenerateCalls).toMatchInlineSnapshot(`
    //       [
    //         {
    //           "prompt": [
    //             {
    //               "content": "system-message-0",
    //               "role": "system",
    //             },
    //             {
    //               "content": [
    //                 {
    //                   "text": "new input from prepareStep",
    //                   "type": "text",
    //                 },
    //               ],
    //               "providerOptions": undefined,
    //               "role": "user",
    //             },
    //           ],
    //           "toolChoice": {
    //             "toolName": "tool1",
    //             "type": "tool",
    //           },
    //           "tools": [
    //             {
    //               "description": undefined,
    //               "inputSchema": {
    //                 "$schema": "http://json-schema.org/draft-07/schema#",
    //                 "additionalProperties": false,
    //                 "properties": {
    //                   "value": {
    //                     "type": "string",
    //                   },
    //                 },
    //                 "required": [
    //                   "value",
    //                 ],
    //                 "type": "object",
    //               },
    //               "name": "tool1",
    //               "providerOptions": undefined,
    //               "type": "function",
    //             },
    //           ],
    //         },
    //         {
    //           "prompt": [
    //             {
    //               "content": "system-message-1",
    //               "role": "system",
    //             },
    //             {
    //               "content": [
    //                 {
    //                   "text": "test-input",
    //                   "type": "text",
    //                 },
    //               ],
    //               "providerOptions": undefined,
    //               "role": "user",
    //             },
    //             {
    //               "content": [
    //                 {
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "providerExecuted": undefined,
    //                   "providerOptions": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-call",
    //                 },
    //               ],
    //               "providerOptions": undefined,
    //               "role": "assistant",
    //             },
    //             {
    //               "content": [
    //                 {
    //                   "output": {
    //                     "type": "text",
    //                     "value": "result1",
    //                   },
    //                   "providerOptions": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-result",
    //                 },
    //               ],
    //               "providerOptions": undefined,
    //               "role": "tool",
    //             },
    //           ],
    //           "toolChoice": {
    //             "type": "auto",
    //           },
    //           "tools": [],
    //         },
    //       ]
    //     `);
    //     });

    //     it('result.text should return text from last step', async () => {
    //       expect(result.text).toStrictEqual('Hello, world!');
    //     });

    //     it('result.toolCalls should return empty tool calls from last step', async () => {
    //       expect(result.toolCalls).toStrictEqual([]);
    //     });

    //     it('result.toolResults should return empty tool results from last step', async () => {
    //       expect(result.toolResults).toStrictEqual([]);
    //     });

    //     it('result.response.messages should contain response messages from all steps', () => {
    //       expect(result.response.messages).toMatchSnapshot();
    //     });

    //     it('result.totalUsage should sum token usage', () => {
    //       expect(result.totalUsage).toMatchInlineSnapshot(`
    //     {
    //       "cachedInputTokens": undefined,
    //       "inputTokens": 13,
    //       "outputTokens": 15,
    //       "reasoningTokens": undefined,
    //       "totalTokens": 28,
    //     }
    //   `);
    //     });

    //     it('result.usage should contain token usage from final step', async () => {
    //       expect(result.usage).toMatchInlineSnapshot(`
    //     {
    //       "cachedInputTokens": undefined,
    //       "inputTokens": 3,
    //       "outputTokens": 10,
    //       "reasoningTokens": undefined,
    //       "totalTokens": 13,
    //     }
    //   `);
    //     });

    //     it('result.steps should contain all steps', () => {
    //       expect(result.steps).toMatchSnapshot();
    //     });

    //     it('onStepFinish should be called for each step', () => {
    //       expect(onStepFinishResults).toMatchSnapshot();
    //     });

    //     it('content should contain content from the last step', () => {
    //       expect(result.content).toMatchInlineSnapshot(`
    //     [
    //       {
    //         "text": "Hello, world!",
    //         "type": "text",
    //       },
    //     ]
    //   `);
    //     });
    //   });

    //   describe.todo('2 stop conditions', () => {
    //     let result: GenerateTextResult<any, any>;
    //     let stopConditionCalls: Array<{
    //       number: number;
    //       steps: StepResult<any>[];
    //     }>;

    //     beforeEach(async () => {
    //       stopConditionCalls = [];

    //       let responseCount = 0;
    //       result = await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async () => {
    //             switch (responseCount++) {
    //               case 0:
    //                 return {
    //                   ...dummyResponseValues,
    //                   content: [
    //                     {
    //                       type: 'tool-call',
    //                       toolCallType: 'function',
    //                       toolCallId: 'call-1',
    //                       toolName: 'tool1',
    //                       input: `{ "value": "value" }`,
    //                     },
    //                   ],
    //                   finishReason: 'tool-calls',
    //                   usage: {
    //                     inputTokens: 10,
    //                     outputTokens: 5,
    //                     totalTokens: 15,
    //                     reasoningTokens: undefined,
    //                     cachedInputTokens: undefined,
    //                   },
    //                   response: {
    //                     id: 'test-id-1-from-model',
    //                     timestamp: new Date(0),
    //                     modelId: 'test-response-model-id',
    //                   },
    //                 };
    //               default:
    //                 throw new Error(`Unexpected response count: ${responseCount}`);
    //             }
    //           },
    //         }),
    //         tools: {
    //           tool1: tool({
    //             inputSchema: z.object({ value: z.string() }),
    //             execute: async (input, options) => {
    //               expect(input).toStrictEqual({ value: 'value' });
    //               expect(options.messages).toStrictEqual([{ role: 'user', content: 'test-input' }]);
    //               return 'result1';
    //             },
    //           }),
    //         },
    //         prompt: 'test-input',
    //         stopWhen: [
    //           ({ steps }) => {
    //             stopConditionCalls.push({ number: 0, steps });
    //             return false;
    //           },
    //           ({ steps }) => {
    //             stopConditionCalls.push({ number: 1, steps });
    //             return true;
    //           },
    //         ],
    //       });
    //     });

    //     it('result.steps should contain a single step', () => {
    //       expect(result.steps.length).toStrictEqual(1);
    //     });

    //     it('stopConditionCalls should be called for each stop condition', () => {
    //       expect(stopConditionCalls).toMatchInlineSnapshot(`
    //       [
    //         {
    //           "number": 0,
    //           "steps": [
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "providerExecuted": undefined,
    //                   "providerMetadata": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-call",
    //                 },
    //                 {
    //                   "dynamic": false,
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "output": "result1",
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-result",
    //                 },
    //               ],
    //               "finishReason": "tool-calls",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "body": undefined,
    //                 "headers": undefined,
    //                 "id": "test-id-1-from-model",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "input": {
    //                           "value": "value",
    //                         },
    //                         "providerExecuted": undefined,
    //                         "providerOptions": undefined,
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-call",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "output": {
    //                           "type": "text",
    //                           "value": "result1",
    //                         },
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-result",
    //                       },
    //                     ],
    //                     "role": "tool",
    //                   },
    //                 ],
    //                 "modelId": "test-response-model-id",
    //                 "timestamp": 1970-01-01T00:00:00.000Z,
    //               },
    //               "usage": {
    //                 "cachedInputTokens": undefined,
    //                 "inputTokens": 10,
    //                 "outputTokens": 5,
    //                 "reasoningTokens": undefined,
    //                 "totalTokens": 15,
    //               },
    //               "warnings": [],
    //             },
    //           ],
    //         },
    //         {
    //           "number": 1,
    //           "steps": [
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "providerExecuted": undefined,
    //                   "providerMetadata": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-call",
    //                 },
    //                 {
    //                   "dynamic": false,
    //                   "input": {
    //                     "value": "value",
    //                   },
    //                   "output": "result1",
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-result",
    //                 },
    //               ],
    //               "finishReason": "tool-calls",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "body": undefined,
    //                 "headers": undefined,
    //                 "id": "test-id-1-from-model",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "input": {
    //                           "value": "value",
    //                         },
    //                         "providerExecuted": undefined,
    //                         "providerOptions": undefined,
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-call",
    //                       },
    //                     ],
    //                     "role": "assistant",
    //                   },
    //                   {
    //                     "content": [
    //                       {
    //                         "output": {
    //                           "type": "text",
    //                           "value": "result1",
    //                         },
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-result",
    //                       },
    //                     ],
    //                     "role": "tool",
    //                   },
    //                 ],
    //                 "modelId": "test-response-model-id",
    //                 "timestamp": 1970-01-01T00:00:00.000Z,
    //               },
    //               "usage": {
    //                 "cachedInputTokens": undefined,
    //                 "inputTokens": 10,
    //                 "outputTokens": 5,
    //                 "reasoningTokens": undefined,
    //                 "totalTokens": 15,
    //               },
    //               "warnings": [],
    //             },
    //           ],
    //         },
    //       ]
    //     `);
    //     });
    //   });
    // });

    // describe.todo('options.headers', () => {
    //   it('should pass headers to model', async () => {
    //     const result = await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async ({ headers }) => {
    //           assert.deepStrictEqual(headers, {
    //             'custom-request-header': 'request-header-value',
    //           });

    //           return {
    //             ...dummyResponseValues,
    //             content: [{ type: 'text', text: 'Hello, world!' }],
    //           };
    //         },
    //       }),
    //       prompt: 'test-input',
    //       headers: { 'custom-request-header': 'request-header-value' },
    //     });

    //     assert.deepStrictEqual(result.text, 'Hello, world!');
    //   });
    // });

    // describe.todo('options.providerOptions', () => {
    //   it('should pass provider options to model', async () => {
    //     const result = await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async ({ providerOptions }) => {
    //           expect(providerOptions).toStrictEqual({
    //             aProvider: { someKey: 'someValue' },
    //           });

    //           return {
    //             ...dummyResponseValues,
    //             content: [{ type: 'text', text: 'provider metadata test' }],
    //           };
    //         },
    //       }),
    //       prompt: 'test-input',
    //       providerOptions: {
    //         aProvider: { someKey: 'someValue' },
    //       },
    //     });

    //     expect(result.text).toStrictEqual('provider metadata test');
    //   });
    // });

    // describe.todo('options.abortSignal', () => {
    //   it('should forward abort signal to tool execution', async () => {
    //     const abortController = new AbortController();
    //     const toolExecuteMock = vi.fn().mockResolvedValue('tool result');

    //     const generateTextPromise = generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async () => ({
    //           ...dummyResponseValues,
    //           content: [
    //             {
    //               type: 'tool-call',
    //               toolCallType: 'function',
    //               toolCallId: 'call-1',
    //               toolName: 'tool1',
    //               input: `{ "value": "value" }`,
    //             },
    //           ],
    //         }),
    //       }),
    //       tools: {
    //         tool1: {
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: toolExecuteMock,
    //         },
    //       },
    //       prompt: 'test-input',
    //       abortSignal: abortController.signal,
    //     });

    //     // Abort the operation
    //     abortController.abort();

    //     await generateTextPromise;

    //     expect(toolExecuteMock).toHaveBeenCalledWith(
    //       { value: 'value' },
    //       {
    //         abortSignal: abortController.signal,
    //         toolCallId: 'call-1',
    //         messages: expect.any(Array),
    //       },
    //     );
    //   });
    // });

    // describe.todo('options.activeTools', () => {
    //   it('should filter available tools to only the ones in activeTools', async () => {
    //     let tools: (LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool)[] | undefined;

    //     await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async ({ tools: toolsArg }) => {
    //           tools = toolsArg;

    //           return {
    //             ...dummyResponseValues,
    //             content: [{ type: 'text', text: 'Hello, world!' }],
    //           };
    //         },
    //       }),

    //       tools: {
    //         tool1: {
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: async () => 'result1',
    //         },
    //         tool2: {
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: async () => 'result2',
    //         },
    //       },
    //       prompt: 'test-input',
    //       activeTools: ['tool1'],
    //     });

    //     expect(tools).toMatchInlineSnapshot(`
    //   [
    //     {
    //       "description": undefined,
    //       "inputSchema": {
    //         "$schema": "http://json-schema.org/draft-07/schema#",
    //         "additionalProperties": false,
    //         "properties": {
    //           "value": {
    //             "type": "string",
    //           },
    //         },
    //         "required": [
    //           "value",
    //         ],
    //         "type": "object",
    //       },
    //       "name": "tool1",
    //       "providerOptions": undefined,
    //       "type": "function",
    //     },
    //   ]
    // `);
    //   });
    // });

    //   it('should record error on tool call', async () => {
    //     await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async ({}) => ({
    //           ...dummyResponseValues,
    //           content: [
    //             {
    //               type: 'tool-call',
    //               toolCallType: 'function',
    //               toolCallId: 'call-1',
    //               toolName: 'tool1',
    //               input: `{ "value": "value" }`,
    //             },
    //           ],
    //         }),
    //       }),
    //       tools: {
    //         tool1: {
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: async () => {
    //             throw new Error('Tool execution failed');
    //           },
    //         },
    //       },
    //       prompt: 'test-input',
    //       _internal: {
    //         generateId: () => 'test-id',
    //         currentDate: () => new Date(0),
    //       },
    //     });

    //     expect(tracer.jsonSpans).toHaveLength(3);

    //     // Check that we have the expected spans
    //     expect(tracer.jsonSpans[0].name).toBe('ai.generateText');
    //     expect(tracer.jsonSpans[1].name).toBe('ai.generateText.doGenerate');
    //     expect(tracer.jsonSpans[2].name).toBe('ai.toolCall');

    //     // Check that the tool call span has error status
    //     const toolCallSpan = tracer.jsonSpans[2];
    //     expect(toolCallSpan.status).toEqual({
    //       code: 2,
    //       message: 'Tool execution failed',
    //     });

    //     expect(toolCallSpan.events).toHaveLength(1);
    //     const exceptionEvent = toolCallSpan.events[0];
    //     expect(exceptionEvent.name).toBe('exception');
    //     expect(exceptionEvent.attributes).toMatchObject({
    //       'exception.message': 'Tool execution failed',
    //       'exception.name': 'Error',
    //     });
    //     expect(exceptionEvent.attributes?.['exception.stack']).toContain('Tool execution failed');
    //     expect(exceptionEvent.time).toEqual([0, 0]);
    //   });

    // describe.todo('tool callbacks', () => {
    //   it('should invoke callbacks in the correct order', async () => {
    //     const recordedCalls: unknown[] = [];

    //     await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async () => {
    //           return {
    //             ...dummyResponseValues,
    //             content: [
    //               {
    //                 type: 'tool-call',
    //                 toolCallType: 'function',
    //                 toolCallId: 'call-1',
    //                 toolName: 'test-tool',
    //                 input: `{ "value": "value" }`,
    //               },
    //             ],
    //           };
    //         },
    //       }),
    //       tools: {
    //         'test-tool': tool({
    //           inputSchema: jsonSchema<{ value: string }>({
    //             type: 'object',
    //             properties: { value: { type: 'string' } },
    //             required: ['value'],
    //             additionalProperties: false,
    //           }),
    //           onInputAvailable: options => {
    //             recordedCalls.push({ type: 'onInputAvailable', options });
    //           },
    //           onInputStart: options => {
    //             recordedCalls.push({ type: 'onInputStart', options });
    //           },
    //           onInputDelta: options => {
    //             recordedCalls.push({ type: 'onInputDelta', options });
    //           },
    //         }),
    //       },
    //       toolChoice: 'required',
    //       prompt: 'test-input',
    //     });

    //     expect(recordedCalls).toMatchInlineSnapshot(`
    //   [
    //     {
    //       "options": {
    //         "abortSignal": undefined,
    //         "input": {
    //           "value": "value",
    //         },
    //         "messages": [
    //           {
    //             "content": "test-input",
    //             "role": "user",
    //           },
    //         ],
    //         "toolCallId": "call-1",
    //       },
    //       "type": "onInputAvailable",
    //     },
    //   ]
    // `);
    //   });
    // });

    // describe.todo('tools with custom schema', () => {
    //   it('should contain tool calls', async () => {
    //     const result = await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async ({ prompt, tools, toolChoice }) => {
    //           expect(tools).toStrictEqual([
    //             {
    //               type: 'function',
    //               name: 'tool1',
    //               description: undefined,
    //               inputSchema: {
    //                 additionalProperties: false,
    //                 properties: { value: { type: 'string' } },
    //                 required: ['value'],
    //                 type: 'object',
    //               },
    //               providerOptions: undefined,
    //             },
    //             {
    //               type: 'function',
    //               name: 'tool2',
    //               description: undefined,
    //               inputSchema: {
    //                 additionalProperties: false,
    //                 properties: { somethingElse: { type: 'string' } },
    //                 required: ['somethingElse'],
    //                 type: 'object',
    //               },
    //               providerOptions: undefined,
    //             },
    //           ]);

    //           expect(toolChoice).toStrictEqual({ type: 'required' });

    //           expect(prompt).toStrictEqual([
    //             {
    //               role: 'user',
    //               content: [{ type: 'text', text: 'test-input' }],
    //               providerOptions: undefined,
    //             },
    //           ]);

    //           return {
    //             ...dummyResponseValues,
    //             content: [
    //               {
    //                 type: 'tool-call',
    //                 toolCallType: 'function',
    //                 toolCallId: 'call-1',
    //                 toolName: 'tool1',
    //                 input: `{ "value": "value" }`,
    //               },
    //             ],
    //           };
    //         },
    //       }),
    //       tools: {
    //         tool1: {
    //           inputSchema: jsonSchema<{ value: string }>({
    //             type: 'object',
    //             properties: { value: { type: 'string' } },
    //             required: ['value'],
    //             additionalProperties: false,
    //           }),
    //         },
    //         // 2nd tool to show typing:
    //         tool2: {
    //           inputSchema: jsonSchema<{ somethingElse: string }>({
    //             type: 'object',
    //             properties: { somethingElse: { type: 'string' } },
    //             required: ['somethingElse'],
    //             additionalProperties: false,
    //           }),
    //         },
    //       },
    //       toolChoice: 'required',
    //       prompt: 'test-input',
    //       _internal: {
    //         generateId: () => 'test-id',
    //         currentDate: () => new Date(0),
    //       },
    //     });

    //     // test type inference
    //     if (result.toolCalls[0].toolName === 'tool1' && !result.toolCalls[0].dynamic) {
    //       assertType<string>(result.toolCalls[0].input.value);
    //     }

    //     expect(result.toolCalls).toMatchInlineSnapshot(`
    //     [
    //       {
    //         "input": {
    //           "value": "value",
    //         },
    //         "providerExecuted": undefined,
    //         "providerMetadata": undefined,
    //         "toolCallId": "call-1",
    //         "toolName": "tool1",
    //         "type": "tool-call",
    //       },
    //     ]
    //   `);
    //   });
    // });

    // describe.todo('provider-executed tools', () => {
    //   describe.todo('single provider-executed tool call and result', () => {
    //     let result: GenerateTextResult<any, any>;

    //     beforeEach(async () => {
    //       result = await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async () => ({
    //             ...dummyResponseValues,
    //             content: [
    //               {
    //                 type: 'tool-call',
    //                 toolCallId: 'call-1',
    //                 toolName: 'web_search',
    //                 input: `{ "value": "value" }`,
    //                 providerExecuted: true,
    //               },
    //               {
    //                 type: 'tool-result',
    //                 toolCallId: 'call-1',
    //                 toolName: 'web_search',
    //                 result: `{ "value": "result1" }`,
    //               },
    //               {
    //                 type: 'tool-call',
    //                 toolCallId: 'call-2',
    //                 toolName: 'web_search',
    //                 input: `{ "value": "value" }`,
    //                 providerExecuted: true,
    //               },
    //               {
    //                 type: 'tool-result',
    //                 toolCallId: 'call-2',
    //                 toolName: 'web_search',
    //                 result: 'ERROR',
    //                 isError: true,
    //                 providerExecuted: true,
    //               },
    //             ],
    //           }),
    //         }),
    //         tools: {
    //           web_search: {
    //             type: 'provider-defined',
    //             id: 'test.web_search',
    //             name: 'web_search',
    //             inputSchema: z.object({ value: z.string() }),
    //             outputSchema: z.object({ value: z.string() }),
    //             args: {},
    //           },
    //         },
    //         prompt: 'test-input',
    //         stopWhen: stepCountIs(4),
    //       });
    //     });

    //     it('should include provider-executed tool calls and results in the content', async () => {
    //       expect(result.content).toMatchInlineSnapshot(`
    //       [
    //         {
    //           "input": {
    //             "value": "value",
    //           },
    //           "providerExecuted": true,
    //           "providerMetadata": undefined,
    //           "toolCallId": "call-1",
    //           "toolName": "web_search",
    //           "type": "tool-call",
    //         },
    //         {
    //           "dynamic": undefined,
    //           "input": {
    //             "value": "value",
    //           },
    //           "output": "{ "value": "result1" }",
    //           "providerExecuted": true,
    //           "toolCallId": "call-1",
    //           "toolName": "web_search",
    //           "type": "tool-result",
    //         },
    //         {
    //           "input": {
    //             "value": "value",
    //           },
    //           "providerExecuted": true,
    //           "providerMetadata": undefined,
    //           "toolCallId": "call-2",
    //           "toolName": "web_search",
    //           "type": "tool-call",
    //         },
    //         {
    //           "dynamic": undefined,
    //           "error": "ERROR",
    //           "input": {
    //             "value": "value",
    //           },
    //           "providerExecuted": true,
    //           "toolCallId": "call-2",
    //           "toolName": "web_search",
    //           "type": "tool-error",
    //         },
    //       ]
    //     `);
    //     });

    //     it('should only execute a single step', async () => {
    //       expect(result.steps.length).toBe(1);
    //     });
    //   });
    // });

    // describe.todo('options.messages', () => {
    //   it('should support models that use "this" context in supportedUrls', async () => {
    //     let supportedUrlsCalled = false;
    //     class MockLanguageModelWithImageSupport extends MockLanguageModelV2 {
    //       constructor() {
    //         super({
    //           supportedUrls() {
    //             supportedUrlsCalled = true;
    //             // Reference 'this' to verify context
    //             return this.modelId === 'mock-model-id'
    //               ? ({ 'image/*': [/^https:\/\/.*$/] } as Record<string, RegExp[]>)
    //               : {};
    //           },
    //           doGenerate: async () => ({
    //             ...dummyResponseValues,
    //             content: [{ type: 'text', text: 'Hello, world!' }],
    //           }),
    //         });
    //       }
    //     }

    //     const model = new MockLanguageModelWithImageSupport();

    //     const result = await generateText({
    //       model,
    //       messages: [
    //         {
    //           role: 'user',
    //           content: [{ type: 'image', image: 'https://example.com/test.jpg' }],
    //         },
    //       ],
    //     });

    //     expect(result.text).toStrictEqual('Hello, world!');
    //     expect(supportedUrlsCalled).toBe(true);
    //   });
    // });

    // describe.todo('options.output', () => {
    //   describe.todo('no output', () => {
    //     it('should throw error when accessing output', async () => {
    //       const result = await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async () => ({
    //             ...dummyResponseValues,
    //             content: [{ type: 'text', text: `Hello, world!` }],
    //           }),
    //         }),
    //         prompt: 'prompt',
    //       });

    //       expect(() => {
    //         result.experimental_output;
    //       }).toThrow('No output specified');
    //     });
    //   });

    //   describe.todo('text output', () => {
    //     it('should forward text as output', async () => {
    //       const result = await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async () => ({
    //             ...dummyResponseValues,
    //             content: [{ type: 'text', text: `Hello, world!` }],
    //           }),
    //         }),
    //         prompt: 'prompt',
    //         experimental_output: Output.text(),
    //       });

    //       expect(result.experimental_output).toStrictEqual('Hello, world!');
    //     });

    //     it('should set responseFormat to text and not change the prompt', async () => {
    //       let callOptions: LanguageModelV2CallOptions;

    //       await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async args => {
    //             callOptions = args;
    //             return {
    //               ...dummyResponseValues,
    //               content: [{ type: 'text', text: `Hello, world!` }],
    //             };
    //           },
    //         }),
    //         prompt: 'prompt',
    //         experimental_output: Output.text(),
    //       });

    //       expect(callOptions!).toMatchInlineSnapshot(`
    //     {
    //       "abortSignal": undefined,
    //       "frequencyPenalty": undefined,
    //       "headers": undefined,
    //       "maxOutputTokens": undefined,
    //       "presencePenalty": undefined,
    //       "prompt": [
    //         {
    //           "content": [
    //             {
    //               "text": "prompt",
    //               "type": "text",
    //             },
    //           ],
    //           "providerOptions": undefined,
    //           "role": "user",
    //         },
    //       ],
    //       "providerOptions": undefined,
    //       "responseFormat": {
    //         "type": "text",
    //       },
    //       "seed": undefined,
    //       "stopSequences": undefined,
    //       "temperature": undefined,
    //       "toolChoice": undefined,
    //       "tools": undefined,
    //       "topK": undefined,
    //       "topP": undefined,
    //     }
    //   `);
    //     });
    //   });

    //   describe.todo('object output', () => {
    //     it('should parse the output', async () => {
    //       const result = await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async () => ({
    //             ...dummyResponseValues,
    //             content: [{ type: 'text', text: `{ "value": "test-value" }` }],
    //           }),
    //         }),
    //         prompt: 'prompt',
    //         experimental_output: Output.object({
    //           schema: z.object({ value: z.string() }),
    //         }),
    //       });

    //       expect(result.experimental_output).toEqual({ value: 'test-value' });
    //     });

    //     it('should set responseFormat to json and send schema as part of the responseFormat', async () => {
    //       let callOptions: LanguageModelV2CallOptions;

    //       await generateText({
    //         model: new MockLanguageModelV2({
    //           doGenerate: async args => {
    //             callOptions = args;
    //             return {
    //               ...dummyResponseValues,
    //               content: [{ type: 'text', text: `{ "value": "test-value" }` }],
    //             };
    //           },
    //         }),
    //         prompt: 'prompt',
    //         experimental_output: Output.object({
    //           schema: z.object({ value: z.string() }),
    //         }),
    //       });

    //       expect(callOptions!).toMatchInlineSnapshot(`
    //     {
    //       "abortSignal": undefined,
    //       "frequencyPenalty": undefined,
    //       "headers": undefined,
    //       "maxOutputTokens": undefined,
    //       "presencePenalty": undefined,
    //       "prompt": [
    //         {
    //           "content": [
    //             {
    //               "text": "prompt",
    //               "type": "text",
    //             },
    //           ],
    //           "providerOptions": undefined,
    //           "role": "user",
    //         },
    //       ],
    //       "providerOptions": undefined,
    //       "responseFormat": {
    //         "schema": {
    //           "$schema": "http://json-schema.org/draft-07/schema#",
    //           "additionalProperties": false,
    //           "properties": {
    //             "value": {
    //               "type": "string",
    //             },
    //           },
    //           "required": [
    //             "value",
    //           ],
    //           "type": "object",
    //         },
    //         "type": "json",
    //       },
    //       "seed": undefined,
    //       "stopSequences": undefined,
    //       "temperature": undefined,
    //       "toolChoice": undefined,
    //       "tools": undefined,
    //       "topK": undefined,
    //       "topP": undefined,
    //     }
    //   `);
    //     });
    //   });
    // });

    // describe.todo('tool execution errors', () => {
    //   let result: GenerateTextResult<any, any>;

    //   beforeEach(async () => {
    //     result = await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async () => ({
    //           ...dummyResponseValues,
    //           content: [
    //             {
    //               type: 'tool-call',
    //               toolCallType: 'function',
    //               toolCallId: 'call-1',
    //               toolName: 'tool1',
    //               input: `{ "value": "value" }`,
    //             },
    //           ],
    //         }),
    //       }),
    //       tools: {
    //         tool1: {
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: async () => {
    //             throw new Error('test error');
    //           },
    //         },
    //       },
    //       prompt: 'test-input',
    //     });
    //   });

    //   it('should add tool error part to the content', async () => {
    //     expect(result.content).toMatchInlineSnapshot(`
    //     [
    //       {
    //         "input": {
    //           "value": "value",
    //         },
    //         "providerExecuted": undefined,
    //         "providerMetadata": undefined,
    //         "toolCallId": "call-1",
    //         "toolName": "tool1",
    //         "type": "tool-call",
    //       },
    //       {
    //         "dynamic": false,
    //         "error": [Error: test error],
    //         "input": {
    //           "value": "value",
    //         },
    //         "toolCallId": "call-1",
    //         "toolName": "tool1",
    //         "type": "tool-error",
    //       },
    //     ]
    //   `);
    //   });

    //   it('should include error result in response messages', async () => {
    //     expect(result.response.messages).toMatchInlineSnapshot(`
    //     [
    //       {
    //         "content": [
    //           {
    //             "input": {
    //               "value": "value",
    //             },
    //             "providerExecuted": undefined,
    //             "providerOptions": undefined,
    //             "toolCallId": "call-1",
    //             "toolName": "tool1",
    //             "type": "tool-call",
    //           },
    //         ],
    //         "role": "assistant",
    //       },
    //       {
    //         "content": [
    //           {
    //             "output": {
    //               "type": "error-text",
    //               "value": "test error",
    //             },
    //             "toolCallId": "call-1",
    //             "toolName": "tool1",
    //             "type": "tool-result",
    //           },
    //         ],
    //         "role": "tool",
    //       },
    //     ]
    //   `);
    //   });
    // });

    // describe.todo('provider-executed tools', () => {
    //   it('should not call execute for provider-executed tool calls', async () => {
    //     let toolExecuted = false;

    //     const result = await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async () => ({
    //           ...dummyResponseValues,
    //           content: [
    //             {
    //               type: 'tool-call',
    //               toolCallType: 'function',
    //               toolCallId: 'call-1',
    //               toolName: 'providerTool',
    //               input: `{ "value": "test" }`,
    //               providerExecuted: true,
    //             },
    //             {
    //               type: 'tool-result',
    //               toolCallId: 'call-1',
    //               toolName: 'providerTool',
    //               providerExecuted: true,
    //               result: { example: 'example' },
    //             },
    //           ],
    //           finishReason: 'stop',
    //         }),
    //       }),
    //       tools: {
    //         providerTool: {
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: async ({ value }) => {
    //             toolExecuted = true;
    //             return `${value}-should-not-execute`;
    //           },
    //         },
    //       },
    //       prompt: 'test-input',
    //     });

    //     // tool should not be executed by client
    //     expect(toolExecuted).toBe(false);

    //     // tool call should still be included in content
    //     expect(result.content).toMatchInlineSnapshot(`
    //     [
    //       {
    //         "input": {
    //           "value": "test",
    //         },
    //         "providerExecuted": true,
    //         "providerMetadata": undefined,
    //         "toolCallId": "call-1",
    //         "toolName": "providerTool",
    //         "type": "tool-call",
    //       },
    //       {
    //         "dynamic": undefined,
    //         "input": {
    //           "value": "test",
    //         },
    //         "output": {
    //           "example": "example",
    //         },
    //         "providerExecuted": true,
    //         "toolCallId": "call-1",
    //         "toolName": "providerTool",
    //         "type": "tool-result",
    //       },
    //     ]
    //   `);

    //     // tool results should include the result from the provider
    //     expect(result.toolResults).toMatchInlineSnapshot(`
    //     [
    //       {
    //         "dynamic": undefined,
    //         "input": {
    //           "value": "test",
    //         },
    //         "output": {
    //           "example": "example",
    //         },
    //         "providerExecuted": true,
    //         "toolCallId": "call-1",
    //         "toolName": "providerTool",
    //         "type": "tool-result",
    //       },
    //     ]
    //   `);
    //   });
    // });

    // describe.todo('dynamic tools', () => {
    //   it('should execute dynamic tools', async () => {
    //     let toolExecuted = false;

    //     const result = await generateText({
    //       model: new MockLanguageModelV2({
    //         doGenerate: async () => ({
    //           ...dummyResponseValues,
    //           content: [
    //             {
    //               type: 'tool-call',
    //               toolCallType: 'function',
    //               toolCallId: 'call-1',
    //               toolName: 'dynamicTool',
    //               input: `{ "value": "test" }`,
    //             },
    //           ],
    //           finishReason: 'tool-calls',
    //         }),
    //       }),
    //       tools: {
    //         dynamicTool: dynamicTool({
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: async () => {
    //             toolExecuted = true;
    //             return { value: 'test-result' };
    //           },
    //         }),
    //       },
    //       prompt: 'test-input',
    //     });

    //     // tool should be executed by client
    //     expect(toolExecuted).toBe(true);

    //     // tool call should be included in content
    //     expect(result.content).toMatchInlineSnapshot(`
    //     [
    //       {
    //         "dynamic": true,
    //         "input": {
    //           "value": "test",
    //         },
    //         "providerExecuted": undefined,
    //         "providerMetadata": undefined,
    //         "toolCallId": "call-1",
    //         "toolName": "dynamicTool",
    //         "type": "tool-call",
    //       },
    //       {
    //         "dynamic": true,
    //         "input": {
    //           "value": "test",
    //         },
    //         "output": {
    //           "value": "test-result",
    //         },
    //         "toolCallId": "call-1",
    //         "toolName": "dynamicTool",
    //         "type": "tool-result",
    //       },
    //     ]
    //   `);
    //   });
    // });
  });
}
