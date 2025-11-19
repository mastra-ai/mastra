import { fail } from 'assert';
import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils-v5/test';
import type { LanguageModelV2CallWarning, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { jsonSchema, NoObjectGeneratedError, pipeTextStreamToResponse } from 'ai-v5';
import type { FinishReason, LanguageModelResponseMetadata, LanguageModelUsage } from 'ai-v5';
import { MockLanguageModelV2 } from 'ai-v5/test';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import type { loop } from '../loop';
import { createMockServerResponse } from './mock-server-response';
import { createMessageListWithUserMessage, mockDate, testUsage } from './utils';

function createTestModels({
  warnings = [],
  stream = convertArrayToReadableStream([
    {
      type: 'stream-start',
      warnings,
    },
    {
      type: 'response-metadata',
      id: 'id-0',
      modelId: 'mock-model-id',
      timestamp: new Date(0),
    },
    { type: 'text-start', id: '1' },
    { type: 'text-delta', id: '1', delta: '{ ' },
    { type: 'text-delta', id: '1', delta: '"content": ' },
    { type: 'text-delta', id: '1', delta: `"Hello, ` },
    { type: 'text-delta', id: '1', delta: `world` },
    { type: 'text-delta', id: '1', delta: `!"` },
    { type: 'text-delta', id: '1', delta: ' }' },
    { type: 'text-end', id: '1' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: testUsage,
      providerMetadata: {
        testProvider: {
          testKey: 'testValue',
        },
      },
    },
  ]),
  request = undefined,
  response = undefined,
}: {
  stream?: ReadableStream<LanguageModelV2StreamPart>;
  request?: { body: string };
  response?: { headers: Record<string, string> };
  warnings?: LanguageModelV2CallWarning[];
} = {}) {
  return [
    {
      maxRetries: 0,
      id: 'test-model',
      model: new MockLanguageModelV2({
        doStream: async () => ({ stream, request, response, warnings }),
      }),
    },
  ];
}

export function verifyNoObjectGeneratedError(
  error: unknown,
  expected: {
    message: string;
    response: LanguageModelResponseMetadata & {
      body?: string;
    };
    usage: LanguageModelUsage;
    finishReason: FinishReason;
  },
) {
  expect(NoObjectGeneratedError.isInstance(error)).toBeTruthy();
  const noObjectGeneratedError = error as NoObjectGeneratedError;
  expect(noObjectGeneratedError.message).toEqual(expected.message);
  expect(noObjectGeneratedError.response).toEqual(expected.response);
  expect(noObjectGeneratedError.usage).toEqual(expected.usage);
  expect(noObjectGeneratedError.finishReason).toEqual(expected.finishReason);
}

export function streamObjectTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('loopFn', () => {
    describe('result.object auto consume promise', () => {
      it('should resolve object promise without manual stream consumption', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: createTestModels(),
          structuredOutput: { schema: z.object({ content: z.string() }) },
          messageList: createMessageListWithUserMessage(),
        });

        // Test that we can await result.object directly without consuming any stream
        // This would hang forever without auto-consume
        const obj = await result.object;

        expect(obj).toStrictEqual({
          content: 'Hello, world!',
        });
      });

      it('should work with array schemas too', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: createTestModels({
            stream: convertArrayToReadableStream([
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: '{"elements":[{"content":"Hello, world!"}]}' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: testUsage,
              },
            ]),
          }),
          structuredOutput: { schema: z.array(z.object({ content: z.string() })) },
          messageList: createMessageListWithUserMessage(),
        });

        // Test that auto-consume works for arrays too
        const obj = await result.object;

        expect(obj).toStrictEqual([{ content: 'Hello, world!' }]);
      });

      it('should still work when stream is manually consumed first', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: createTestModels(),
          structuredOutput: { schema: z.object({ content: z.string() }) },
          messageList: createMessageListWithUserMessage(),
        });

        // Manually consume stream first (existing pattern)
        void convertAsyncIterableToArray(result.objectStream);

        // Then await object - should still work
        const obj = await result.object;

        expect(obj).toStrictEqual({
          content: 'Hello, world!',
        });
      });
    });

    describe('output = "object"', () => {
      describe('result.objectStream', () => {
        it('should send object deltas', async () => {
          const mockModel = createTestModels();
          const messageList = createMessageListWithUserMessage();
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: mockModel,
            messageList,
            structuredOutput: { schema: z.object({ content: z.string() }) },
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(`
            [
              {},
              {
                "content": "Hello, ",
              },
              {
                "content": "Hello, world",
              },
              {
                "content": "Hello, world!",
              },
            ]
          `);

          expect(mockModel[0]?.model?.doStreamCalls?.[0]?.responseFormat).toMatchInlineSnapshot(`
            {
              "schema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "additionalProperties": false,
                "properties": {
                  "content": {
                    "type": "string",
                  },
                },
                "required": [
                  "content",
                ],
                "type": "object",
              },
              "type": "json",
            }
          `);
        });

        it('should use name and description', async () => {
          const models = createTestModels();
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models,
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(`
          [
            {},
            {
              "content": "Hello, ",
            },
            {
              "content": "Hello, world",
            },
            {
              "content": "Hello, world!",
            },
          ]
        `);
          expect(models[0]?.model?.doStreamCalls?.[0]?.prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "test-input",
                    "type": "text",
                  },
                ],
                "role": "user",
              },
            ]
          `);

          expect(models[0]?.model?.doStreamCalls?.[0]?.responseFormat).toMatchInlineSnapshot(`
            {
              "schema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "additionalProperties": false,
                "properties": {
                  "content": {
                    "type": "string",
                  },
                },
                "required": [
                  "content",
                ],
                "type": "object",
              },
              "type": "json",
            }
          `);
        });

        it('should suppress error in partialObjectStream', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            runId,
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => {
                    throw new Error('test error');
                  },
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
            options: {
              onError: () => {},
            },
            modelSettings: {
              maxRetries: 0,
            },
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([]);
        });

        it('should invoke onError callback with Error', async () => {
          const errors: Array<{ error: unknown }> = [];

          const output = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => {
                    throw new Error('test error');
                  },
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
            options: {
              onError(event) {
                errors.push(event);
              },
            },
            modelSettings: {
              maxRetries: 0,
            },
          });

          // consume stream
          await output.consumeStream();

          expect(errors).toStrictEqual([{ error: new Error('test error') }]);
        });
      });

      describe('result.fullStream', () => {
        it.todo('should send full stream data', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels(),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          const data = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

          expect(data).toMatchInlineSnapshot(`[
  {
    "object": {},
    "type": "object",
  },
  {
    "textDelta": "{ ",
    "type": "text-delta",
  },
  {
    "object": {
      "content": "Hello, ",
    },
    "type": "object",
  },
  {
    "textDelta": ""content": "Hello, ",
    "type": "text-delta",
  },
  {
    "object": {
      "content": "Hello, world",
    },
    "type": "object",
  },
  {
    "textDelta": "world",
    "type": "text-delta",
  },
  {
    "object": {
      "content": "Hello, world!",
    },
    "type": "object",
  },
  {
    "textDelta": "!"",
    "type": "text-delta",
  },
  {
    "textDelta": " }",
    "type": "text-delta",
  },
  {
    "finishReason": "stop",
    "logprobs": [
      {
        "logprob": 1,
        "token": "-",
        "topLogprobs": [],
      },
    ],
    "response": {
      "id": "id-0",
      "modelId": "mock-model-id",
      "modelProvider": "mock-provider",
      "modelVersion": "v2",
      "timestamp": 1970-01-01T00:00:00.000Z,
    },
    "type": "finish",
    "usage": {
      "completionTokens": 10,
      "promptTokens": 2,
      "totalTokens": 12,
    },
  },
]`);
        });
      });

      describe('result.textStream', () => {
        it('should send text stream', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels(),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // aisdk
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.aisdk.v5.textStream), [
            '{ ',
            '"content": ',
            '"Hello, ',
            'world',
            '!"',
            ' }',
          ]);
          // mastra
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.textStream), [
            '{ ',
            '"content": ',
            '"Hello, ',
            'world',
            '!"',
            ' }',
          ]);
        });
      });

      describe('result.toTextStreamResponse', () => {
        it('should create a Response with a text stream', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels(),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          const response = result.aisdk.v5.toTextStreamResponse();

          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');

          assert.deepStrictEqual(
            await convertReadableStreamToArray(response.body!.pipeThrough(new TextDecoderStream())),
            ['{ ', '"content": ', '"Hello, ', 'world', '!"', ' }'],
          );
          // for some reason the original test expected '"content": "Hello, ', to be in one chunk
          // assert.deepStrictEqual(
          //   await convertReadableStreamToArray(response.body!.pipeThrough(new TextDecoderStream())),
          //   ['{ ', '"content": "Hello, ', 'world', '!"', ' }'],
          // );
        });
      });

      describe('result.pipeTextStreamToResponse', async () => {
        it('should write text deltas to a Node.js response-like object', async () => {
          vi.useRealTimers();
          const mockResponse = createMockServerResponse();

          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: createTestModels(),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          pipeTextStreamToResponse({
            response: mockResponse,
            // @ts-ignore
            textStream: result.textStream,
          });

          await mockResponse.waitForEnd();

          expect(mockResponse.statusCode).toBe(200);
          expect(mockResponse.headers).toMatchInlineSnapshot(`
          {
            "content-type": "text/plain; charset=utf-8",
          }
        `);
          expect(mockResponse.getDecodedChunks()).toMatchInlineSnapshot(`
            [
              "{ ",
              ""content": ",
              ""Hello, ",
              "world",
              "!"",
              " }",
            ]
          `);
          vi.useFakeTimers();
          vi.setSystemTime(mockDate);
        });
      });

      describe('result.usage', () => {
        it('should resolve with token usage', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
                { type: 'finish', finishReason: 'stop', usage: testUsage },
              ]),
            }),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // consume stream (runs in parallel)
          // void convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          // expect(await result.usage).toMatchInlineSnapshot(expectedOutput);
          await convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          expect(await result.usage).toMatchInlineSnapshot(`
            {
              "inputTokens": 3,
              "outputTokens": 10,
              "totalTokens": 13,
            }
          `);
        });
      });

      describe('result.providerMetadata', () => {
        it('should resolve with provider metadata', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: '1' },
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
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // consume stream (runs in parallel)
          // void convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          // expect(await result.providerMetadata).toStrictEqual({
          //   testProvider: { testKey: 'testValue' },
          // });
          await convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          expect(await result.providerMetadata).toStrictEqual({
            testProvider: { testKey: 'testValue' },
          });
        });
      });

      describe('result.response', () => {
        it('should resolve with response information', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{"content": "Hello, world!"}',
                },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
              response: { headers: { call: '2' } },
            }),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // consume stream (runs in parallel)
          // void convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          // expect(await result.response).toStrictEqual({
          //   id: 'id-0',
          //   modelId: 'mock-model-id',
          //   timestamp: new Date(0),
          //   headers: { call: '2' },
          // });

          const expectedResponse = {
            id: 'id-0',
            modelId: 'mock-model-id',
            modelMetadata: {
              modelId: 'mock-model-id',
              modelProvider: 'mock-provider',
              modelVersion: 'v2',
            },
            timestamp: new Date(0),
            headers: { call: '2' },
            messages: [
              {
                content: [
                  {
                    text: '{"content": "Hello, world!"}',
                    type: 'text',
                  },
                ],
                role: 'assistant',
              },
            ],
            uiMessages: [
              {
                id: expect.any(String),
                metadata: {
                  structuredOutput: {
                    content: 'Hello, world!',
                  },
                  createdAt: expect.any(Date),
                },
                parts: [
                  {
                    text: '{"content": "Hello, world!"}',
                    type: 'text',
                  },
                ],
                role: 'assistant',
              },
            ],
          };

          await convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          expect(await result.aisdk.v5.response).toStrictEqual(expectedResponse);

          await convertAsyncIterableToArray(result.objectStream);
          expect(await result.response).toStrictEqual(expectedResponse);
        });
      });

      describe('result.request', () => {
        it('should contain request information', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      { type: 'text-start', id: '1' },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta: '{"content": "Hello, world!"}',
                      },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                    request: { body: 'test body' },
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          expect(await result.request).toStrictEqual({
            body: 'test body',
          });
        });
      });

      describe('result.object', () => {
        it('should resolve with typed object', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: '{ ' },
                      { type: 'text-delta', id: '1', delta: '"content": ' },
                      { type: 'text-delta', id: '1', delta: `"Hello, ` },
                      { type: 'text-delta', id: '1', delta: `world` },
                      { type: 'text-delta', id: '1', delta: `!"` },
                      { type: 'text-delta', id: '1', delta: ' }' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // consume stream (runs in parallel)
          void convertAsyncIterableToArray(result.objectStream);

          assert.deepStrictEqual(await result.object, {
            content: 'Hello, world!',
          });
        });

        it('should reject object promise when the streamed object does not match the schema', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: '{ ' },
                      { type: 'text-delta', id: '1', delta: '"invalid": ' },
                      { type: 'text-delta', id: '1', delta: `"Hello, ` },
                      { type: 'text-delta', id: '1', delta: `world` },
                      { type: 'text-delta', id: '1', delta: `!"` },
                      { type: 'text-delta', id: '1', delta: ' }' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // consume stream (runs in parallel)
          void convertAsyncIterableToArray(result.objectStream);
          // Expect the promise to be rejected with a validation error
          await expect(result.object).rejects.toThrow('Structured output validation failed');
        });

        it('should not lead to unhandled promise rejections when the streamed object does not match the schema', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: '{ ' },
                      { type: 'text-delta', id: '1', delta: '"invalid": ' },
                      { type: 'text-delta', id: '1', delta: `"Hello, ` },
                      { type: 'text-delta', id: '1', delta: `world` },
                      { type: 'text-delta', id: '1', delta: `!"` },
                      { type: 'text-delta', id: '1', delta: ' }' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // consume stream (runs in parallel)
          void convertAsyncIterableToArray(result.objectStream);

          // unhandled promise rejection should not be thrown (Vitest does this automatically)
        });
      });

      describe('result.finishReason', () => {
        it('should resolve with finish reason', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: '{ ' },
                      { type: 'text-delta', id: '1', delta: '"content": ' },
                      { type: 'text-delta', id: '1', delta: `"Hello, ` },
                      { type: 'text-delta', id: '1', delta: `world` },
                      { type: 'text-delta', id: '1', delta: `!"` },
                      { type: 'text-delta', id: '1', delta: ' }' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // Now finishReason is a delayed promise that auto-consumes
          expect(await result.finishReason).toStrictEqual('stop');
        });
      });

      describe('options.onFinish', () => {
        it('should be called when a valid object is generated', async () => {
          let result: any;
          const { objectStream } = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      { type: 'text-start', id: '1' },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta: '{ "content": "Hello, world!" }',
                      },
                      { type: 'text-end', id: '1' },
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
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            options: {
              onFinish: async event => {
                result = event;
              },
            },
            _internal: { generateId: () => '1234', currentDate: () => new Date(0), now: () => 0 },
            messageList: createMessageListWithUserMessage(),
          });
          // consume stream
          await convertAsyncIterableToArray(objectStream);
          expect(result!).toMatchInlineSnapshot(`
            {
              "content": [
                {
                  "text": "{ "content": "Hello, world!" }",
                  "type": "text",
                },
              ],
              "dynamicToolCalls": [],
              "dynamicToolResults": [],
              "error": undefined,
              "files": [],
              "finishReason": "stop",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
                "version": "v2",
              },
              "object": {
                "content": "Hello, world!",
              },
              "providerMetadata": {
                "testProvider": {
                  "testKey": "testValue",
                },
              },
              "reasoning": [],
              "reasoningText": undefined,
              "request": {},
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "text": "{ "content": "Hello, world!" }",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "modelMetadata": {
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
                },
                "timestamp": 1970-01-01T00:00:00.000Z,
                "uiMessages": [
                  {
                    "id": "1234",
                    "metadata": {
                      "createdAt": 2024-01-01T00:00:00.001Z,
                      "structuredOutput": {
                        "content": "Hello, world!",
                      },
                    },
                    "parts": [
                      {
                        "text": "{ "content": "Hello, world!" }",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
              },
              "sources": [],
              "staticToolCalls": [],
              "staticToolResults": [],
              "steps": [
                {
                  "content": [
                    {
                      "text": "{ "content": "Hello, world!" }",
                      "type": "text",
                    },
                  ],
                  "dynamicToolCalls": [],
                  "dynamicToolResults": [],
                  "files": [],
                  "finishReason": "stop",
                  "providerMetadata": {
                    "testProvider": {
                      "testKey": "testValue",
                    },
                  },
                  "reasoning": [],
                  "reasoningText": "",
                  "request": {},
                  "response": {
                    "headers": undefined,
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "text": "{ "content": "Hello, world!" }",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "modelMetadata": {
                      "modelId": "mock-model-id",
                      "modelProvider": "mock-provider",
                      "modelVersion": "v2",
                    },
                    "timestamp": 1970-01-01T00:00:00.000Z,
                    "uiMessages": [
                      {
                        "id": "1234",
                        "metadata": {
                          "createdAt": 2024-01-01T00:00:00.001Z,
                          "structuredOutput": {
                            "content": "Hello, world!",
                          },
                        },
                        "parts": [
                          {
                            "text": "{ "content": "Hello, world!" }",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                  },
                  "sources": [],
                  "staticToolCalls": [],
                  "staticToolResults": [],
                  "stepType": "initial",
                  "text": "{ "content": "Hello, world!" }",
                  "toolCalls": [],
                  "toolResults": [],
                  "usage": {
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
              "text": "{ "content": "Hello, world!" }",
              "toolCalls": [],
              "toolResults": [],
              "totalUsage": {
                "cachedInputTokens": undefined,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": undefined,
                "totalTokens": 13,
              },
              "usage": {
                "inputTokens": 3,
                "outputTokens": 10,
                "totalTokens": 13,
              },
              "warnings": [],
            }
          `);
        });

        it("should be called when object doesn't match the schema without destructuring", async () => {
          let result: any;
          const output = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: '{ ' },
                      { type: 'text-delta', id: '1', delta: '"invalid": ' },
                      { type: 'text-delta', id: '1', delta: `"Hello, ` },
                      { type: 'text-delta', id: '1', delta: `world` },
                      { type: 'text-delta', id: '1', delta: `!"` },
                      { type: 'text-delta', id: '1', delta: ' }' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            options: {
              onFinish: async event => {
                result = event;
              },
            },
            _internal: { generateId: () => '1234', currentDate: () => new Date(0), now: () => 0 },
            messageList: createMessageListWithUserMessage(),
          });

          await output.consumeStream();
          await convertAsyncIterableToArray(output.objectStream);

          // consume expected error rejection
          await output.object.catch(err => {
            expect(err).toMatchInlineSnapshot(`[Error: Structured output validation failed
✖ Required
  → at content
]`);
          });

          expect(result!).toMatchInlineSnapshot(`
            {
              "content": [
                {
                  "text": "{ "invalid": "Hello, world!" }",
                  "type": "text",
                },
              ],
              "dynamicToolCalls": [],
              "dynamicToolResults": [],
              "error": [Error: Structured output validation failed
            ✖ Required
              → at content
            ],
              "files": [],
              "finishReason": "error",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
                "version": "v2",
              },
              "object": undefined,
              "providerMetadata": undefined,
              "reasoning": [],
              "reasoningText": undefined,
              "request": {},
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "text": "{ "invalid": "Hello, world!" }",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "modelMetadata": {
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
                },
                "timestamp": 1970-01-01T00:00:00.000Z,
                "uiMessages": [
                  {
                    "id": "1234",
                    "metadata": {
                      "createdAt": 2024-01-01T00:00:00.001Z,
                    },
                    "parts": [
                      {
                        "text": "{ "invalid": "Hello, world!" }",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
              },
              "sources": [],
              "staticToolCalls": [],
              "staticToolResults": [],
              "steps": [
                {
                  "content": [
                    {
                      "text": "{ "invalid": "Hello, world!" }",
                      "type": "text",
                    },
                  ],
                  "dynamicToolCalls": [],
                  "dynamicToolResults": [],
                  "files": [],
                  "finishReason": "error",
                  "providerMetadata": undefined,
                  "reasoning": [],
                  "reasoningText": "",
                  "request": {},
                  "response": {
                    "headers": undefined,
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "text": "{ "invalid": "Hello, world!" }",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "modelMetadata": {
                      "modelId": "mock-model-id",
                      "modelProvider": "mock-provider",
                      "modelVersion": "v2",
                    },
                    "timestamp": 1970-01-01T00:00:00.000Z,
                    "uiMessages": [
                      {
                        "id": "1234",
                        "metadata": {
                          "createdAt": 2024-01-01T00:00:00.001Z,
                        },
                        "parts": [
                          {
                            "text": "{ "invalid": "Hello, world!" }",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                  },
                  "sources": [],
                  "staticToolCalls": [],
                  "staticToolResults": [],
                  "stepType": "initial",
                  "text": "{ "invalid": "Hello, world!" }",
                  "toolCalls": [],
                  "toolResults": [],
                  "usage": {
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
              "text": "{ "invalid": "Hello, world!" }",
              "toolCalls": [],
              "toolResults": [],
              "totalUsage": {
                "cachedInputTokens": undefined,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": undefined,
                "totalTokens": 13,
              },
              "usage": {
                "inputTokens": 3,
                "outputTokens": 10,
                "totalTokens": 13,
              },
              "warnings": [],
            }
          `);
        });

        it("should be called when object doesn't match the schema with destructuring", async () => {
          let result: any;
          const { consumeStream, objectStream, object } = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: 'id-0',
                        modelId: 'mock-model-id',
                        timestamp: new Date(0),
                      },
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: '{ ' },
                      { type: 'text-delta', id: '1', delta: '"invalid": ' },
                      { type: 'text-delta', id: '1', delta: `"Hello, ` },
                      { type: 'text-delta', id: '1', delta: `world` },
                      { type: 'text-delta', id: '1', delta: `!"` },
                      { type: 'text-delta', id: '1', delta: ' }' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            options: {
              onFinish: async event => {
                result = event;
              },
            },
            _internal: { generateId: () => '1234', currentDate: () => new Date(0), now: () => 0 },
            messageList: createMessageListWithUserMessage(),
          });

          await consumeStream();
          await convertAsyncIterableToArray(objectStream);

          // consume expected error rejection
          await object.catch(err => {
            expect(err).toMatchInlineSnapshot(`[Error: Structured output validation failed
✖ Required
  → at content
]`);
          });

          expect(result!).toMatchInlineSnapshot(`
            {
              "content": [
                {
                  "text": "{ "invalid": "Hello, world!" }",
                  "type": "text",
                },
              ],
              "dynamicToolCalls": [],
              "dynamicToolResults": [],
              "error": [Error: Structured output validation failed
            ✖ Required
              → at content
            ],
              "files": [],
              "finishReason": "error",
              "model": {
                "modelId": "mock-model-id",
                "provider": "mock-provider",
                "version": "v2",
              },
              "object": undefined,
              "providerMetadata": undefined,
              "reasoning": [],
              "reasoningText": undefined,
              "request": {},
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "text": "{ "invalid": "Hello, world!" }",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "modelMetadata": {
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
                },
                "timestamp": 1970-01-01T00:00:00.000Z,
                "uiMessages": [
                  {
                    "id": "1234",
                    "metadata": {
                      "createdAt": 2024-01-01T00:00:00.001Z,
                    },
                    "parts": [
                      {
                        "text": "{ "invalid": "Hello, world!" }",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
              },
              "sources": [],
              "staticToolCalls": [],
              "staticToolResults": [],
              "steps": [
                {
                  "content": [
                    {
                      "text": "{ "invalid": "Hello, world!" }",
                      "type": "text",
                    },
                  ],
                  "dynamicToolCalls": [],
                  "dynamicToolResults": [],
                  "files": [],
                  "finishReason": "error",
                  "providerMetadata": undefined,
                  "reasoning": [],
                  "reasoningText": "",
                  "request": {},
                  "response": {
                    "headers": undefined,
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "text": "{ "invalid": "Hello, world!" }",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "modelMetadata": {
                      "modelId": "mock-model-id",
                      "modelProvider": "mock-provider",
                      "modelVersion": "v2",
                    },
                    "timestamp": 1970-01-01T00:00:00.000Z,
                    "uiMessages": [
                      {
                        "id": "1234",
                        "metadata": {
                          "createdAt": 2024-01-01T00:00:00.001Z,
                        },
                        "parts": [
                          {
                            "text": "{ "invalid": "Hello, world!" }",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                  },
                  "sources": [],
                  "staticToolCalls": [],
                  "staticToolResults": [],
                  "stepType": "initial",
                  "text": "{ "invalid": "Hello, world!" }",
                  "toolCalls": [],
                  "toolResults": [],
                  "usage": {
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
              "text": "{ "invalid": "Hello, world!" }",
              "toolCalls": [],
              "toolResults": [],
              "totalUsage": {
                "cachedInputTokens": undefined,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": undefined,
                "totalTokens": 13,
              },
              "usage": {
                "inputTokens": 3,
                "outputTokens": 10,
                "totalTokens": 13,
              },
              "warnings": [],
            }
          `);
        });
      });

      describe('options.headers', () => {
        it('should pass headers to model', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async ({ headers }) => {
                    expect(headers).toStrictEqual({
                      'custom-request-header': 'request-header-value',
                    });

                    return {
                      stream: convertArrayToReadableStream([
                        { type: 'text-start', id: '1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "headers test" }`,
                        },
                        { type: 'text-end', id: '1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: testUsage,
                        },
                      ]),
                    };
                  },
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
            modelSettings: { headers: { 'custom-request-header': 'request-header-value' } },
            headers: { 'custom-request-header': 'request-header-value' },
          });

          // mastra
          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([{ content: 'headers test' }]);

          // aisdk
          expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toStrictEqual([
            { content: 'headers test' },
          ]);
        });
      });

      describe('options.providerOptions', () => {
        it('should pass provider options to model', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async ({ providerOptions }) => {
                    expect(providerOptions).toStrictEqual({
                      aProvider: { someKey: 'someValue' },
                    });

                    return {
                      stream: convertArrayToReadableStream([
                        { type: 'text-start', id: '1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "provider metadata test" }`,
                        },
                        { type: 'text-end', id: '1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: testUsage,
                        },
                      ]),
                    };
                  },
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
            providerOptions: {
              aProvider: { someKey: 'someValue' },
            },
          });

          // mastra
          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([
            { content: 'provider metadata test' },
          ]);
          // aisdk
          expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toStrictEqual([
            { content: 'provider metadata test' },
          ]);
        });
      });

      describe('custom schema', () => {
        it('should send object deltas', async () => {
          const models = createTestModels();

          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            runId,
            models,
            structuredOutput: {
              schema: jsonSchema({
                type: 'object',
                properties: { content: { type: 'string' } },
                required: ['content'],
                additionalProperties: false,
              }),
            },
            messageList: createMessageListWithUserMessage(),
          });
          const expectedOutput = `
          [
            {},
            {
              "content": "Hello, ",
            },
            {
              "content": "Hello, world",
            },
            {
              "content": "Hello, world!",
            },
          ]
        `;
          expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toMatchInlineSnapshot(expectedOutput);
          expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(expectedOutput);

          expect(models?.[0]?.model?.doStreamCalls?.[0]?.responseFormat).toMatchInlineSnapshot(`
            {
              "schema": {
                "additionalProperties": false,
                "properties": {
                  "content": {
                    "type": "string",
                  },
                },
                "required": [
                  "content",
                ],
                "type": "object",
              },
              "type": "json",
            }
          `);
        });
      });

      describe('error handling', () => {
        it('should throw zod validation error when zod schema validation fails', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                model: new MockLanguageModelV2({
                  doStream: async () => ({
                    stream: convertArrayToReadableStream([
                      { type: 'text-start', id: '1' },
                      { type: 'text-delta', id: '1', delta: '{ "content": 123 }' },
                      { type: 'text-end', id: '1' },
                      {
                        type: 'response-metadata',
                        id: 'id-1',
                        timestamp: new Date(123),
                        modelId: 'model-1',
                      },
                      {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: testUsage,
                      },
                    ]),
                  }),
                }),
              },
            ],
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });
          const expectedErrorMessage = `Structured output validation failed
✖ Expected string, received number
  → at content
`;
          await expect(result.object).rejects.toThrow(expectedErrorMessage);

          try {
            await result.object;
          } catch (error) {
            expect((error as Error).cause).toBeInstanceOf(Error);
            expect(error).toMatchInlineSnapshot(`[Error: ${expectedErrorMessage}]`);
            expect((error as Error)?.cause).toBeInstanceOf(z.ZodError);
            expect(((error as Error)?.cause as z.ZodError)?.issues).toHaveLength(1);
            expect(((error as Error)?.cause as z.ZodError)?.issues[0]?.message).toContain(
              'Expected string, received number',
            );
            expect(((error as Error)?.cause as z.ZodError)?.issues[0]?.path).toEqual(['content']);
          }
        });
      });
    });

    describe('JSON code block handling', () => {
      describe('object format with complete code blocks', () => {
        it('should handle complete ```json...``` code blocks', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '```json\n' },
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"content": ' },
                { type: 'text-delta', id: '1', delta: '"Hello, world!"' },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-delta', id: '1', delta: '\n```' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(`
            [
              {},
              {
                "content": "Hello, world!",
              },
            ]
          `);

          expect(await result.object).toStrictEqual({
            content: 'Hello, world!',
          });
        });

        it('should handle ```json code blocks without newlines', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '```json{"content": "Hello, world!"}```' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          expect(await result.object).toStrictEqual({
            content: 'Hello, world!',
          });
        });
      });

      describe('object format with partial streaming', () => {
        it('should handle ```json prefix during streaming', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '```json\n' },
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"content": ' },
                { type: 'text-delta', id: '1', delta: '"Hello, ' },
                { type: 'text-delta', id: '1', delta: 'world' },
                { type: 'text-delta', id: '1', delta: '!"' },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          const streamResults = await convertAsyncIterableToArray(result.objectStream);

          // Should have streaming chunks without ```json prefix
          expect(streamResults).toEqual([
            {},
            { content: 'Hello, ' },
            { content: 'Hello, world' },
            { content: 'Hello, world!' },
          ]);

          expect(await result.object).toStrictEqual({
            content: 'Hello, world!',
          });
        });
      });

      describe('array format with JSON code blocks', () => {
        it('should handle array wrapped in ```json...``` blocks', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '```json\n' },
                { type: 'text-delta', id: '1', delta: '{"elements":[' },
                { type: 'text-delta', id: '1', delta: '{"content":"element 1"},' },
                { type: 'text-delta', id: '1', delta: '{"content":"element 2"}' },
                { type: 'text-delta', id: '1', delta: ']}' },
                { type: 'text-delta', id: '1', delta: '\n```' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.array(z.object({ content: z.string() })) },
            messageList: createMessageListWithUserMessage(),
          });

          expect(await result.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        it('should handle partial array streaming with ```json prefix', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '```json\n' },
                { type: 'text-delta', id: '1', delta: '{"elements":[' },
                { type: 'text-delta', id: '1', delta: '{"content":"element 1"},' },
                { type: 'text-delta', id: '1', delta: '{"content":"element 2"}' },
                { type: 'text-delta', id: '1', delta: ']}' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.array(z.object({ content: z.string() })) },
            messageList: createMessageListWithUserMessage(),
          });

          const streamResults = await convertAsyncIterableToArray(result.objectStream);

          // Should progressively stream array elements without ```json prefix
          expect(streamResults).toEqual([
            [],
            [{ content: 'element 1' }],
            [{ content: 'element 1' }, { content: 'element 2' }],
          ]);
        });
      });

      describe('enum format with JSON code blocks', () => {
        it('should handle enum wrapped in ```json...``` blocks', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '```json\n' },
                { type: 'text-delta', id: '1', delta: '{ "result": "sunny" }' },
                { type: 'text-delta', id: '1', delta: '\n```' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.enum(['sunny', 'rainy', 'snowy']) },
            messageList: createMessageListWithUserMessage(),
          });

          expect(await result.object).toStrictEqual('sunny');
        });

        it('should handle partial enum streaming with ```json prefix', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '```json\n' },
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"result": ' },
                { type: 'text-delta', id: '1', delta: '"su' },
                { type: 'text-delta', id: '1', delta: 'nny' },
                { type: 'text-delta', id: '1', delta: '"' },
                { type: 'text-delta', id: '1', delta: ' }' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.enum(['sunny', 'rainy', 'snowy']) },
            messageList: createMessageListWithUserMessage(),
          });

          const streamResults = await convertAsyncIterableToArray(result.objectStream);

          // Should progressively stream enum values without ```json prefix
          expect(streamResults).toEqual(['sunny']);
        });
      });
    });

    describe('output = "array"', () => {
      describe('array with 3 elements', () => {
        let result: any;
        let onFinishResult: any;

        beforeEach(async () => {
          result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{"elements":[' },
                // first element:
                { type: 'text-delta', id: '1', delta: '{' },
                { type: 'text-delta', id: '1', delta: '"content":' },
                { type: 'text-delta', id: '1', delta: `"element 1"` },
                { type: 'text-delta', id: '1', delta: '},' },
                // second element:
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"content": ' },
                { type: 'text-delta', id: '1', delta: `"element 2"` },
                { type: 'text-delta', id: '1', delta: '},' },
                // third element:
                { type: 'text-delta', id: '1', delta: '{' },
                { type: 'text-delta', id: '1', delta: '"content":' },
                { type: 'text-delta', id: '1', delta: `"element 3"` },
                { type: 'text-delta', id: '1', delta: '}' },
                // end of array
                { type: 'text-delta', id: '1', delta: ']' },
                { type: 'text-delta', id: '1', delta: '}' },
                { type: 'text-end', id: '1' },
                // finish
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.array(z.object({ content: z.string() })) },
            options: {
              onFinish: async event => {
                onFinishResult = event as unknown as typeof onFinishResult;
              },
            },
            messageList: createMessageListWithUserMessage(),
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.aisdk.v5.objectStream), [
            [],
            [{ content: 'element 1' }],
            [{ content: 'element 1' }, { content: 'element 2' }],
            [{ content: 'element 1' }, { content: 'element 2' }, { content: 'element 3' }],
          ]);
        });

        it('should stream only complete objects in textStream', async () => {
          const data = await convertAsyncIterableToArray(result.aisdk.v5.textStream);

          assert.deepStrictEqual(data, [
            '[',
            '{"content":"element 1"}',
            ',{"content":"element 2"}',
            ',{"content":"element 3"}',
            ']',
          ]);
        });

        it('should have the correct object result', async () => {
          // consume stream
          await result.consumeStream();

          expect(await result.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);

          expect(await result.aisdk.v5.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });

        it('should call onFinish callback with full array', async () => {
          await result.consumeStream();

          expect(onFinishResult?.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });

        it('should stream elements individually in elementStream', async () => {
          const arr = await convertAsyncIterableToArray(result.aisdk.v5.elementStream);
          assert.deepStrictEqual(arr, [{ content: 'element 1' }, { content: 'element 2' }, { content: 'element 3' }]);
        });
      });

      describe('array with 2 elements streamed in 1 chunk', () => {
        let result: any;
        let onFinishResult: any;

        beforeEach(async () => {
          result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                {
                  type: 'text-start',
                  id: '1',
                },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{"elements":[{"content":"element 1"},{"content":"element 2"}]}',
                },
                {
                  type: 'text-end',
                  id: '1',
                },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.array(z.object({ content: z.string() })) },
            options: {
              onFinish: async event => {
                onFinishResult = event as unknown as typeof onFinishResult;
              },
            },
            messageList: createMessageListWithUserMessage(),
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.aisdk.v5.objectStream), [
            [{ content: 'element 1' }, { content: 'element 2' }],
          ]);
        });

        it('should stream only complete objects in textStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.textStream), [
            '[{"content":"element 1"},{"content":"element 2"}]',
          ]);
        });

        it('should have the correct object result', async () => {
          // consume stream
          await convertAsyncIterableToArray(result.aisdk.v5.objectStream);

          expect(await result.aisdk.v5.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        it('should call onFinish callback with full array', async () => {
          await result.consumeStream();
          expect(onFinishResult.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        it('should stream elements individually in elementStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.elementStream), [
            { content: 'element 1' },
            { content: 'element 2' },
          ]);
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.aisdk.v5.elementStream), [
            { content: 'element 1' },
            { content: 'element 2' },
          ]);
        });
      });

      describe('error handling', () => {
        it('should reject object promise when the streamed object does not match the schema', async () => {
          const result = loopFn({
            methodType: 'stream',
            runId,
            agentId: 'agent-id',
            models: createTestModels({
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: '{"elements":[' },
                // first element:
                { type: 'text-delta', id: '1', delta: '{' },
                { type: 'text-delta', id: '1', delta: '"invalid":' },
                { type: 'text-delta', id: '1', delta: `"element 1"` },
                { type: 'text-delta', id: '1', delta: '},' },
                // second element:
                { type: 'text-delta', id: '1', delta: '{ ' },
                { type: 'text-delta', id: '1', delta: '"invalid": ' },
                { type: 'text-delta', id: '1', delta: `"element 2"` },
                { type: 'text-delta', id: '1', delta: '},' },
                // third element:
                { type: 'text-delta', id: '1', delta: '{' },
                { type: 'text-delta', id: '1', delta: '"invalid":' },
                { type: 'text-delta', id: '1', delta: `"element 3"` },
                { type: 'text-delta', id: '1', delta: '}' },
                // end of array
                { type: 'text-delta', id: '1', delta: ']' },
                { type: 'text-delta', id: '1', delta: '}' },
                { type: 'text-end', id: '1' },
                // finish
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: testUsage,
                },
              ]),
            }),
            structuredOutput: { schema: z.array(z.object({ content: z.string() })) },
            messageList: createMessageListWithUserMessage(),
          });
          await result.consumeStream();
          const expectedErrorMessage = `Structured output validation failed
✖ Required
  → at [0].content
✖ Required
  → at [1].content
✖ Required
  → at [2].content`;
          await expect(result.object).rejects.toThrow(expectedErrorMessage);
          await expect(result.aisdk.v5.object).rejects.toThrow(expectedErrorMessage);
        });
      });
    });

    describe('output = "enum"', () => {
      it('should stream an enum value', async () => {
        const mockModels = createTestModels({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"su` },
            { type: 'text-delta', id: '1', delta: `nny` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage },
          ]),
        });

        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: mockModels,
          structuredOutput: { schema: z.enum(['sunny', 'rainy', 'snowy']) },
          messageList: createMessageListWithUserMessage(),
        });

        expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toMatchInlineSnapshot(`
          [
            "sunny",
          ]
        `);

        // TODO: responseFormat disabled in favor of json schema in system prompt
        // expect(mockModels?.[0]?.model?.doStreamCalls?.[0]?.responseFormat).toMatchInlineSnapshot(`
        //   {
        //     "schema": {
        //       "$schema": "http://json-schema.org/draft-07/schema#",
        //       "additionalProperties": false,
        //       "properties": {
        //         "result": {
        //           "enum": [
        //             "sunny",
        //             "rainy",
        //             "snowy",
        //           ],
        //           "type": "string",
        //         },
        //       },
        //       "required": [
        //         "result",
        //       ],
        //       "type": "object",
        //     },
        //     "type": "json",
        //   }
        // `);
      });

      it('should not stream incorrect values', async () => {
        const mockModels = [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockLanguageModelV2({
              doStream: {
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: '{ ' },
                  { type: 'text-delta', id: '1', delta: '"result": ' },
                  { type: 'text-delta', id: '1', delta: `"foo` },
                  { type: 'text-delta', id: '1', delta: `bar` },
                  { type: 'text-delta', id: '1', delta: `"` },
                  { type: 'text-delta', id: '1', delta: ' }' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: testUsage,
                  },
                ]),
              },
            }),
          },
        ];

        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: mockModels,
          structuredOutput: { schema: z.enum(['sunny', 'rainy', 'snowy']) },
          messageList: createMessageListWithUserMessage(),
        });

        expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toMatchInlineSnapshot(`[]`);
      });

      it('should handle ambiguous values', async () => {
        const mockModels = createTestModels({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"foo` },
            { type: 'text-delta', id: '1', delta: `bar` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        });

        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: mockModels,
          structuredOutput: { schema: z.enum(['foobar', 'foobar2']) },
          messageList: createMessageListWithUserMessage(),
        });

        expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toMatchInlineSnapshot(`
        [
          "foo",
          "foobar",
        ]
      `);
      });

      it('should handle non-ambiguous values', async () => {
        const mockModels = createTestModels({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '{ ' },
            { type: 'text-delta', id: '1', delta: '"result": ' },
            { type: 'text-delta', id: '1', delta: `"foo` },
            { type: 'text-delta', id: '1', delta: `bar` },
            { type: 'text-delta', id: '1', delta: `"` },
            { type: 'text-delta', id: '1', delta: ' }' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        });

        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: mockModels,
          structuredOutput: { schema: z.enum(['foobar', 'barfoo']) },
          messageList: createMessageListWithUserMessage(),
        });

        expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toMatchInlineSnapshot(`
        [
          "foobar",
        ]
      `);
      });
    });

    describe.todo('options.experimental_repairText', () => {
      it('should be able to repair a JSONParseError', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: '1' },
                    {
                      type: 'text-delta',
                      id: '1',
                      delta: '{ "content": "provider metadata test" ',
                    },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ]),
                }),
              }),
            },
          ],
          structuredOutput: { schema: z.object({ content: z.string() }) },
          // TODO
          // options: {
          //   experimental_repairText: async ({ text, error }) => {
          //     expect(error).toBeInstanceOf(JSONParseError);
          //     expect(text).toStrictEqual('{ "content": "provider metadata test" ');
          //     return text + '}';
          //   },
          // },
          messageList: createMessageListWithUserMessage(),
        });

        // consume stream
        void convertAsyncIterableToArray(result.aisdk.v5.objectStream);

        expect(await result.object).toStrictEqual({
          content: 'provider metadata test',
        });
      });

      it('should be able to repair a TypeValidationError', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: '1' },
                    {
                      type: 'text-delta',
                      id: '1',
                      delta: '{ "content-a": "provider metadata test" }',
                    },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ]),
                }),
              }),
            },
          ],
          structuredOutput: { schema: z.object({ content: z.string() }) },
          // TODO
          // options: {
          //   experimental_repairText: async ({ text, error }) => {
          //     expect(error).toBeInstanceOf(TypeValidationError);
          //     expect(text).toStrictEqual('{ "content-a": "provider metadata test" }');
          //     return `{ "content": "provider metadata test" }`;
          //   },
          // },
          messageList: createMessageListWithUserMessage(),
        });

        // consume stream
        await convertAsyncIterableToArray(result.aisdk.v5.objectStream);

        expect(await result.aisdk.v5.object).toStrictEqual({
          content: 'provider metadata test',
        });
      });

      it('should be able to handle repair that returns null', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: '1' },
                    {
                      type: 'text-delta',
                      id: '1',
                      delta: '{ "content-a": "provider metadata test" }',
                    },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ]),
                }),
              }),
            },
          ],

          structuredOutput: { schema: z.object({ content: z.string() }) },

          // TODO: experimental_repairText?
          // options: {
          //   experimental_repairText: async ({ text, error }) => {
          //     expect(error).toBeInstanceOf(TypeValidationError);
          //     expect(text).toStrictEqual('{ "content-a": "provider metadata test" }');
          //     return null;
          //   },
          // },
          messageList: createMessageListWithUserMessage(),
        });

        // consume stream
        void convertAsyncIterableToArray(result.aisdk.v5.objectStream);

        await expect(await result.aisdk.v5.object).rejects.toThrow(
          'No object generated: response did not match schema.',
        );
      });

      it('should be able to repair JSON wrapped with markdown code blocks', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: '1' },
                    {
                      type: 'text-delta',
                      id: '1',
                      delta: '```json\n{ "content": "test message" }\n```',
                    },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ]),
                }),
              }),
            },
          ],
          structuredOutput: { schema: z.object({ content: z.string() }) },
          // TODO
          // options: {
          //   experimental_repairText: async ({ text, error }) => {
          //     expect(error).toBeInstanceOf(JSONParseError);
          //     expect(text).toStrictEqual('```json\n{ "content": "test message" }\n```');

          //     // Remove markdown code block wrapper
          //     const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          //     return cleaned;
          //   },
          // },
          messageList: createMessageListWithUserMessage(),
        });

        // consume stream
        await convertAsyncIterableToArray(result.aisdk.v5.objectStream);

        expect(await result.aisdk.v5.object).toStrictEqual({
          content: 'test message',
        });
      });

      it('should throw NoObjectGeneratedError when parsing fails with repairText', async () => {
        const result = loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: '{ broken json' },
                    { type: 'text-end', id: '1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ]),
                }),
              }),
            },
          ],
          structuredOutput: { schema: z.object({ content: z.string() }) },
          // TODO
          // options: {
          //   experimental_repairText: async ({ text }) => text + '{',
          // },
          messageList: createMessageListWithUserMessage(),
        });

        try {
          await convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          await result.aisdk.v5.object;
          fail('must throw error');
        } catch (error) {
          verifyNoObjectGeneratedError(error, {
            message: 'No object generated: could not parse the response.',
            response: {
              id: 'id-0',
              timestamp: new Date(0),
              modelId: 'mock-model-id',
            },
            usage: testUsage,
            finishReason: 'stop',
          });
        }
      });
    });
  });
}
