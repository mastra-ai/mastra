import { fail } from 'node:assert';
import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils-v5/test';
import type { LanguageModelV2CallWarning, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { jsonSchema, NoObjectGeneratedError, pipeTextStreamToResponse } from '@internal/ai-sdk-v5';
import type { FinishReason, LanguageModelResponseMetadata, LanguageModelUsage } from '@internal/ai-sdk-v5';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import z from 'zod/v4';
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
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: '{ ' },
    { type: 'text-delta', id: 'text-1', delta: '"content": ' },
    { type: 'text-delta', id: 'text-1', delta: `"Hello, ` },
    { type: 'text-delta', id: 'text-1', delta: `world` },
    { type: 'text-delta', id: 'text-1', delta: `!"` },
    { type: 'text-delta', id: 'text-1', delta: ' }' },
    { type: 'text-end', id: 'text-1' },
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
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: '{"elements":[{"content":"Hello, world!"}]}' },
              { type: 'text-end', id: 'text-1' },
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

          // mastra
          expect(await convertAsyncIterableToArray(result.textStream)).toStrictEqual([
            '{ ',
            '"content": ',
            '"Hello, ',
            'world',
            '!"',
            ' }',
          ]);
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
            // @ts-expect-error
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
                { type: 'text-start', id: 'text-1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: testUsage },
              ]),
            }),
            structuredOutput: { schema: z.object({ content: z.string() }) },
            messageList: createMessageListWithUserMessage(),
          });

          // consume stream (runs in parallel)
          // void convertAsyncIterableToArray(result.objectStream);
          // expect(await result.usage).toMatchInlineSnapshot(expectedOutput);
          await convertAsyncIterableToArray(result.objectStream);
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
                { type: 'text-start', id: 'text-1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{ "content": "Hello, world!" }',
                },
                { type: 'text-end', id: 'text-1' },
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

          await convertAsyncIterableToArray(result.objectStream);
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
                { type: 'text-start', id: 'text-1' },
                {
                  type: 'text-delta',
                  id: '1',
                  delta: '{"content": "Hello, world!"}',
                },
                { type: 'text-end', id: 'text-1' },
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
            dbMessages: [
              {
                id: expect.any(String),
                createdAt: expect.any(Date),
                content: {
                  content: '{"content": "Hello, world!"}',
                  format: 2,
                  metadata: {
                    structuredOutput: {
                      content: 'Hello, world!',
                    },
                  },
                  parts: [
                    {
                      text: '{"content": "Hello, world!"}',
                      type: 'text',
                    },
                  ],
                },
                role: 'assistant',
              },
            ],
          };

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
                      { type: 'text-start', id: 'text-1' },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta: '{"content": "Hello, world!"}',
                      },
                      { type: 'text-end', id: 'text-1' },
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
                      { type: 'text-start', id: 'text-1' },
                      { type: 'text-delta', id: 'text-1', delta: '{ ' },
                      { type: 'text-delta', id: 'text-1', delta: '"content": ' },
                      { type: 'text-delta', id: 'text-1', delta: `"Hello, ` },
                      { type: 'text-delta', id: 'text-1', delta: `world` },
                      { type: 'text-delta', id: 'text-1', delta: `!"` },
                      { type: 'text-delta', id: 'text-1', delta: ' }' },
                      { type: 'text-end', id: 'text-1' },
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

          expect(await result.object).toStrictEqual({
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
                      { type: 'text-start', id: 'text-1' },
                      { type: 'text-delta', id: 'text-1', delta: '{ ' },
                      { type: 'text-delta', id: 'text-1', delta: '"invalid": ' },
                      { type: 'text-delta', id: 'text-1', delta: `"Hello, ` },
                      { type: 'text-delta', id: 'text-1', delta: `world` },
                      { type: 'text-delta', id: 'text-1', delta: `!"` },
                      { type: 'text-delta', id: 'text-1', delta: ' }' },
                      { type: 'text-end', id: 'text-1' },
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
                      { type: 'text-start', id: 'text-1' },
                      { type: 'text-delta', id: 'text-1', delta: '{ ' },
                      { type: 'text-delta', id: 'text-1', delta: '"invalid": ' },
                      { type: 'text-delta', id: 'text-1', delta: `"Hello, ` },
                      { type: 'text-delta', id: 'text-1', delta: `world` },
                      { type: 'text-delta', id: 'text-1', delta: `!"` },
                      { type: 'text-delta', id: 'text-1', delta: ' }' },
                      { type: 'text-end', id: 'text-1' },
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
                      { type: 'text-start', id: 'text-1' },
                      { type: 'text-delta', id: 'text-1', delta: '{ ' },
                      { type: 'text-delta', id: 'text-1', delta: '"content": ' },
                      { type: 'text-delta', id: 'text-1', delta: `"Hello, ` },
                      { type: 'text-delta', id: 'text-1', delta: `world` },
                      { type: 'text-delta', id: 'text-1', delta: `!"` },
                      { type: 'text-delta', id: 'text-1', delta: ' }' },
                      { type: 'text-end', id: 'text-1' },
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
                      { type: 'text-start', id: 'text-1' },
                      {
                        type: 'text-delta',
                        id: '1',
                        delta: '{ "content": "Hello, world!" }',
                      },
                      { type: 'text-end', id: 'text-1' },
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
                "dbMessages": [
                  {
                    "content": {
                      "content": "{ "content": "Hello, world!" }",
                      "format": 2,
                      "metadata": {
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
                    },
                    "createdAt": 2024-01-01T00:00:00.001Z,
                    "id": "1234",
                    "role": "assistant",
                  },
                ],
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
                  "tripwire": undefined,
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
                      { type: 'text-start', id: 'text-1' },
                      { type: 'text-delta', id: 'text-1', delta: '{ ' },
                      { type: 'text-delta', id: 'text-1', delta: '"invalid": ' },
                      { type: 'text-delta', id: 'text-1', delta: `"Hello, ` },
                      { type: 'text-delta', id: 'text-1', delta: `world` },
                      { type: 'text-delta', id: 'text-1', delta: `!"` },
                      { type: 'text-delta', id: 'text-1', delta: ' }' },
                      { type: 'text-end', id: 'text-1' },
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
            expect(err).toMatchInlineSnapshot(
              `[Error: Structured output validation failed: - content: Invalid input: expected string, received undefined]`,
            );
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
              "error": [Error: Structured output validation failed: - content: Invalid input: expected string, received undefined],
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
                "dbMessages": [
                  {
                    "content": {
                      "content": "{ "invalid": "Hello, world!" }",
                      "format": 2,
                      "parts": [
                        {
                          "text": "{ "invalid": "Hello, world!" }",
                          "type": "text",
                        },
                      ],
                    },
                    "createdAt": 2024-01-01T00:00:00.001Z,
                    "id": "1234",
                    "role": "assistant",
                  },
                ],
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
                  "tripwire": undefined,
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
                      { type: 'text-start', id: 'text-1' },
                      { type: 'text-delta', id: 'text-1', delta: '{ ' },
                      { type: 'text-delta', id: 'text-1', delta: '"invalid": ' },
                      { type: 'text-delta', id: 'text-1', delta: `"Hello, ` },
                      { type: 'text-delta', id: 'text-1', delta: `world` },
                      { type: 'text-delta', id: 'text-1', delta: `!"` },
                      { type: 'text-delta', id: 'text-1', delta: ' }' },
                      { type: 'text-end', id: 'text-1' },
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
            expect(err).toMatchInlineSnapshot(
              `[Error: Structured output validation failed: - content: Invalid input: expected string, received undefined]`,
            );
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
              "error": [Error: Structured output validation failed: - content: Invalid input: expected string, received undefined],
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
                "dbMessages": [
                  {
                    "content": {
                      "content": "{ "invalid": "Hello, world!" }",
                      "format": 2,
                      "parts": [
                        {
                          "text": "{ "invalid": "Hello, world!" }",
                          "type": "text",
                        },
                      ],
                    },
                    "createdAt": 2024-01-01T00:00:00.001Z,
                    "id": "1234",
                    "role": "assistant",
                  },
                ],
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
                  "tripwire": undefined,
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
        it('should pass headers from modelSettings to model', async () => {
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
                        { type: 'text-start', id: 'text-1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "headers test" }`,
                        },
                        { type: 'text-end', id: 'text-1' },
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
          });

          // mastra
          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([{ content: 'headers test' }]);
        });

        it('should pass headers from model config to model', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                headers: { 'x-model-header': 'from-config' },
                model: new MockLanguageModelV2({
                  doStream: async ({ headers }) => {
                    expect(headers).toStrictEqual({
                      'x-model-header': 'from-config',
                    });

                    return {
                      stream: convertArrayToReadableStream([
                        { type: 'text-start', id: 'text-1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "config headers test" }`,
                        },
                        { type: 'text-end', id: 'text-1' },
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
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([
            { content: 'config headers test' },
          ]);
        });

        it('should merge headers with modelSettings overriding model config', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                headers: {
                  'x-model-header': 'from-config',
                  'x-shared-header': 'from-config',
                },
                model: new MockLanguageModelV2({
                  doStream: async ({ headers }) => {
                    expect(headers).toStrictEqual({
                      'x-model-header': 'from-config',
                      'x-shared-header': 'from-runtime', // modelSettings overrides config
                      'x-runtime-header': 'from-runtime',
                    });

                    return {
                      stream: convertArrayToReadableStream([
                        { type: 'text-start', id: 'text-1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "merged headers test" }`,
                        },
                        { type: 'text-end', id: 'text-1' },
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
            modelSettings: {
              headers: {
                'x-shared-header': 'from-runtime',
                'x-runtime-header': 'from-runtime',
              },
            },
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([
            { content: 'merged headers test' },
          ]);
        });

        it('should use correct headers for each fallback model', async () => {
          let attemptCount = 0;

          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'model-1',
                maxRetries: 0,
                headers: { 'x-model': 'model-1', 'x-provider': 'provider-a' },
                model: new MockLanguageModelV2({
                  doStream: async ({ headers }) => {
                    attemptCount++;
                    expect(headers).toStrictEqual({
                      'x-model': 'model-1',
                      'x-provider': 'provider-a',
                    });

                    // First model fails
                    throw new Error('Model 1 failed');
                  },
                }),
              },
              {
                id: 'model-2',
                maxRetries: 0,
                headers: { 'x-model': 'model-2', 'x-provider': 'provider-b' },
                model: new MockLanguageModelV2({
                  doStream: async ({ headers }) => {
                    attemptCount++;
                    expect(headers).toStrictEqual({
                      'x-model': 'model-2',
                      'x-provider': 'provider-b',
                    });

                    return {
                      stream: convertArrayToReadableStream([
                        { type: 'text-start', id: 'text-1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "fallback success" }`,
                        },
                        { type: 'text-end', id: 'text-1' },
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
            modelSettings: { maxRetries: 0 }, // Disable retries at the loop level
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([
            { content: 'fallback success' },
          ]);
          expect(attemptCount).toBe(2); // Both models should have been tried
        });

        it('should handle undefined headers gracefully', async () => {
          const result = loopFn({
            methodType: 'stream',
            agentId: 'agent-id',
            models: [
              {
                id: 'test-model',
                maxRetries: 0,
                // No headers field
                model: new MockLanguageModelV2({
                  doStream: async ({ headers }) => {
                    expect(headers).toBeUndefined();

                    return {
                      stream: convertArrayToReadableStream([
                        { type: 'text-start', id: 'text-1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "no headers test" }`,
                        },
                        { type: 'text-end', id: 'text-1' },
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
            // No modelSettings.headers
          });

          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([
            { content: 'no headers test' },
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
                        { type: 'text-start', id: 'text-1' },
                        {
                          type: 'text-delta',
                          id: '1',
                          delta: `{ "content": "provider metadata test" }`,
                        },
                        { type: 'text-end', id: 'text-1' },
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
              schema: z.object({ content: z.string() }),
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
          expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(expectedOutput);

          expect(models?.[0]?.model?.doStreamCalls?.[0]?.responseFormat).toMatchInlineSnapshot(`
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
                      { type: 'text-start', id: 'text-1' },
                      { type: 'text-delta', id: 'text-1', delta: '{ "content": 123 }' },
                      { type: 'text-end', id: 'text-1' },
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
          // Zod v4 has a different error message format
          const expectedErrorMessage = `Structured output validation failed: - content: Invalid input: expected string, received number`;
          await expect(result.object).rejects.toThrow(expectedErrorMessage);

          try {
            await result.object;
          } catch (error) {
            expect((error as Error).cause).toBeInstanceOf(Error);
            expect(error).toMatchInlineSnapshot(`[Error: ${expectedErrorMessage}]`);
            expect((error as Error)?.cause).toBeInstanceOf(z.ZodError);
            expect(((error as Error)?.cause as z.ZodError)?.issues).toHaveLength(1);
            expect(((error as Error)?.cause as z.ZodError)?.issues[0]?.message).toContain(
              'expected string, received number',
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '```json\n' },
                { type: 'text-delta', id: 'text-1', delta: '{ ' },
                { type: 'text-delta', id: 'text-1', delta: '"content": ' },
                { type: 'text-delta', id: 'text-1', delta: '"Hello, world!"' },
                { type: 'text-delta', id: 'text-1', delta: ' }' },
                { type: 'text-delta', id: 'text-1', delta: '\n```' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '```json{"content": "Hello, world!"}```' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '```json\n' },
                { type: 'text-delta', id: 'text-1', delta: '{ ' },
                { type: 'text-delta', id: 'text-1', delta: '"content": ' },
                { type: 'text-delta', id: 'text-1', delta: '"Hello, ' },
                { type: 'text-delta', id: 'text-1', delta: 'world' },
                { type: 'text-delta', id: 'text-1', delta: '!"' },
                { type: 'text-delta', id: 'text-1', delta: ' }' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '```json\n' },
                { type: 'text-delta', id: 'text-1', delta: '{"elements":[' },
                { type: 'text-delta', id: 'text-1', delta: '{"content":"element 1"},' },
                { type: 'text-delta', id: 'text-1', delta: '{"content":"element 2"}' },
                { type: 'text-delta', id: 'text-1', delta: ']}' },
                { type: 'text-delta', id: 'text-1', delta: '\n```' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '```json\n' },
                { type: 'text-delta', id: 'text-1', delta: '{"elements":[' },
                { type: 'text-delta', id: 'text-1', delta: '{"content":"element 1"},' },
                { type: 'text-delta', id: 'text-1', delta: '{"content":"element 2"}' },
                { type: 'text-delta', id: 'text-1', delta: ']}' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '```json\n' },
                { type: 'text-delta', id: 'text-1', delta: '{ "result": "sunny" }' },
                { type: 'text-delta', id: 'text-1', delta: '\n```' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '```json\n' },
                { type: 'text-delta', id: 'text-1', delta: '{ ' },
                { type: 'text-delta', id: 'text-1', delta: '"result": ' },
                { type: 'text-delta', id: 'text-1', delta: '"su' },
                { type: 'text-delta', id: 'text-1', delta: 'nny' },
                { type: 'text-delta', id: 'text-1', delta: '"' },
                { type: 'text-delta', id: 'text-1', delta: ' }' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '{"elements":[' },
                // first element:
                { type: 'text-delta', id: 'text-1', delta: '{' },
                { type: 'text-delta', id: 'text-1', delta: '"content":' },
                { type: 'text-delta', id: 'text-1', delta: `"element 1"` },
                { type: 'text-delta', id: 'text-1', delta: '},' },
                // second element:
                { type: 'text-delta', id: 'text-1', delta: '{ ' },
                { type: 'text-delta', id: 'text-1', delta: '"content": ' },
                { type: 'text-delta', id: 'text-1', delta: `"element 2"` },
                { type: 'text-delta', id: 'text-1', delta: '},' },
                // third element:
                { type: 'text-delta', id: 'text-1', delta: '{' },
                { type: 'text-delta', id: 'text-1', delta: '"content":' },
                { type: 'text-delta', id: 'text-1', delta: `"element 3"` },
                { type: 'text-delta', id: 'text-1', delta: '}' },
                // end of array
                { type: 'text-delta', id: 'text-1', delta: ']' },
                { type: 'text-delta', id: 'text-1', delta: '}' },
                { type: 'text-end', id: 'text-1' },
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
          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([
            [],
            [{ content: 'element 1' }],
            [{ content: 'element 1' }, { content: 'element 2' }],
            [{ content: 'element 1' }, { content: 'element 2' }, { content: 'element 3' }],
          ]);
        });

        it('should stream only complete objects in textStream', async () => {
          const data = await convertAsyncIterableToArray(result.textStream);

          expect(data).toStrictEqual([
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
        });

        it('should call onFinish callback with full array', async () => {
          await result.consumeStream();

          expect(onFinishResult?.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
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
          expect(await convertAsyncIterableToArray(result.objectStream)).toStrictEqual([
            [{ content: 'element 1' }, { content: 'element 2' }],
          ]);
        });

        it('should stream only complete objects in textStream', async () => {
          expect(await convertAsyncIterableToArray(result.textStream)).toStrictEqual([
            '[{"content":"element 1"},{"content":"element 2"}]',
          ]);
        });

        it('should have the correct object result', async () => {
          // consume stream
          await convertAsyncIterableToArray(result.objectStream);

          expect(await result.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        it('should call onFinish callback with full array', async () => {
          await result.consumeStream();
          expect(onFinishResult.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        it('should stream elements individually in elementStream', async () => {
          expect(await convertAsyncIterableToArray(result.elementStream)).toStrictEqual([
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: '{"elements":[' },
                // first element:
                { type: 'text-delta', id: 'text-1', delta: '{' },
                { type: 'text-delta', id: 'text-1', delta: '"invalid":' },
                { type: 'text-delta', id: 'text-1', delta: `"element 1"` },
                { type: 'text-delta', id: 'text-1', delta: '},' },
                // second element:
                { type: 'text-delta', id: 'text-1', delta: '{ ' },
                { type: 'text-delta', id: 'text-1', delta: '"invalid": ' },
                { type: 'text-delta', id: 'text-1', delta: `"element 2"` },
                { type: 'text-delta', id: 'text-1', delta: '},' },
                // third element:
                { type: 'text-delta', id: 'text-1', delta: '{' },
                { type: 'text-delta', id: 'text-1', delta: '"invalid":' },
                { type: 'text-delta', id: 'text-1', delta: `"element 3"` },
                { type: 'text-delta', id: 'text-1', delta: '}' },
                // end of array
                { type: 'text-delta', id: 'text-1', delta: ']' },
                { type: 'text-delta', id: 'text-1', delta: '}' },
                { type: 'text-end', id: 'text-1' },
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
          const expectedErrorMessage = `Structured output validation failed: - 0.content: Invalid input: expected string, received undefined
- 1.content: Invalid input: expected string, received undefined
- 2.content: Invalid input: expected string, received undefined`;
          await expect(result.object).rejects.toThrow(expectedErrorMessage);
        });
      });
    });

    describe('output = "enum"', () => {
      it('should stream an enum value', async () => {
        const mockModels = createTestModels({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{ ' },
            { type: 'text-delta', id: 'text-1', delta: '"result": ' },
            { type: 'text-delta', id: 'text-1', delta: `"su` },
            { type: 'text-delta', id: 'text-1', delta: `nny` },
            { type: 'text-delta', id: 'text-1', delta: `"` },
            { type: 'text-delta', id: 'text-1', delta: ' }' },
            { type: 'text-end', id: 'text-1' },
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

        expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(`
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
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: '{ ' },
                  { type: 'text-delta', id: 'text-1', delta: '"result": ' },
                  { type: 'text-delta', id: 'text-1', delta: `"foo` },
                  { type: 'text-delta', id: 'text-1', delta: `bar` },
                  { type: 'text-delta', id: 'text-1', delta: `"` },
                  { type: 'text-delta', id: 'text-1', delta: ' }' },
                  { type: 'text-end', id: 'text-1' },
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

        expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(`[]`);
      });

      it('should handle ambiguous values', async () => {
        const mockModels = createTestModels({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{ ' },
            { type: 'text-delta', id: 'text-1', delta: '"result": ' },
            { type: 'text-delta', id: 'text-1', delta: `"foo` },
            { type: 'text-delta', id: 'text-1', delta: `bar` },
            { type: 'text-delta', id: 'text-1', delta: `"` },
            { type: 'text-delta', id: 'text-1', delta: ' }' },
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

        expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(`
        [
          "foo",
          "foobar",
        ]
      `);
      });

      it('should handle non-ambiguous values', async () => {
        const mockModels = createTestModels({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{ ' },
            { type: 'text-delta', id: 'text-1', delta: '"result": ' },
            { type: 'text-delta', id: 'text-1', delta: `"foo` },
            { type: 'text-delta', id: 'text-1', delta: `bar` },
            { type: 'text-delta', id: 'text-1', delta: `"` },
            { type: 'text-delta', id: 'text-1', delta: ' }' },
            { type: 'text-end', id: 'text-1' },
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

        expect(await convertAsyncIterableToArray(result.objectStream)).toMatchInlineSnapshot(`
        [
          "foobar",
        ]
      `);
      });
    });
  });
}
