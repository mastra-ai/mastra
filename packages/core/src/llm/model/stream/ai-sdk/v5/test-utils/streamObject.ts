import assert, { fail } from 'node:assert';
import { JSONParseError, TypeValidationError } from '@ai-sdk/provider';
import { jsonSchema } from '@ai-sdk/provider-utils';
import { convertAsyncIterableToArray, convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { streamObject as streamObjectv5 } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2, mockValues } from 'ai-v5/test';
import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod/v4';

import type { execute } from '../../../execute';
// import { NoObjectGeneratedError, verifyNoObjectGeneratedError } from '../error/no-object-generated-error';

import {
  createTestModel,
  defaultSettings,
  modelWithFiles,
  modelWithReasoning,
  modelWithSources,
  testUsage,
  testUsage2,
} from './test-utils';

export function streamObjectTestsV5({ executeFn, runId }: { executeFn: typeof execute; runId: string }) {
  const streamObject = streamObjectv5;
  // const streamObject = async (args: Omit<ExecuteParams, 'runId'>): Promise<StreamObjectResult> => {
  //   const output = await executeFn({
  //     runId,
  //     ...args,
  //   });
  //   return output.aisdk.v5.getFullOutput();
  // };

  describe.skip('streamObject', () => {
    describe('output = "object"', () => {
      describe('result.objectStream', () => {
        it('should send object deltas', async () => {
          const mockModel = createTestModel();

          const result = streamObject({
            model: mockModel,
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });
          console.log(result);

          console.log(
            'RESULT222',
            JSON.stringify(await convertAsyncIterableToArray(result.partialObjectStream), null, 2),
          );

          expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`
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

          expect(mockModel.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
          {
            "description": undefined,
            "name": undefined,
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
          const model = createTestModel();

          const result = streamObject({
            model,
            schema: z.object({ content: z.string() }),
            schemaName: 'test-name',
            schemaDescription: 'test description',
            prompt: 'prompt',
          });

          expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`
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
          expect(model.doStreamCalls[0].prompt).toMatchInlineSnapshot(`
          [
            {
              "content": [
                {
                  "text": "prompt",
                  "type": "text",
                },
              ],
              "providerOptions": undefined,
              "role": "user",
            },
          ]
        `);
          expect(model.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
          {
            "description": "test description",
            "name": "test-name",
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
          const result = streamObject({
            model: new MockLanguageModelV2({
              doStream: async () => {
                throw new Error('test error');
              },
            }),
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
            onError: () => {},
          });

          expect(await convertAsyncIterableToArray(result.partialObjectStream)).toStrictEqual([]);
        });

        it('should invoke onError callback with Error', async () => {
          const result: Array<{ error: unknown }> = [];

          const resultObject = streamObject({
            model: new MockLanguageModelV2({
              doStream: async () => {
                throw new Error('test error');
              },
            }),
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
            onError(event) {
              result.push(event);
            },
          });

          // consume stream
          await convertAsyncIterableToArray(resultObject.partialObjectStream);

          expect(result).toStrictEqual([{ error: new Error('test error') }]);
        });
      });

      describe('result.fullStream', () => {
        it('should send full stream data', async () => {
          const result = streamObject({
            model: createTestModel(),
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          expect(await convertAsyncIterableToArray(result.fullStream)).toMatchSnapshot();
        });
      });

      describe('result.textStream', () => {
        it('should send text stream', async () => {
          const result = streamObject({
            model: createTestModel(),
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertAsyncIterableToArray(result.textStream), [
            '{ ',
            '"content": "Hello, ',
            'world',
            '!"',
            ' }',
          ]);
        });
      });

      describe('result.toTextStreamResponse', () => {
        it('should create a Response with a text stream', async () => {
          const result = streamObject({
            model: createTestModel(),
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          const response = result.toTextStreamResponse();

          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');

          assert.deepStrictEqual(
            await convertReadableStreamToArray(response.body!.pipeThrough(new TextDecoderStream())),
            ['{ ', '"content": "Hello, ', 'world', '!"', ' }'],
          );
        });
      });

      describe('result.pipeTextStreamToResponse', async () => {
        it('should write text deltas to a Node.js response-like object', async () => {
          const mockResponse = createMockServerResponse();

          const result = streamObject({
            model: createTestModel(),
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          result.pipeTextStreamToResponse(mockResponse);

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
            ""content": "Hello, ",
            "world",
            "!"",
            " }",
          ]
        `);
        });
      });

      describe('result.usage', () => {
        it('should resolve with token usage', async () => {
          const result = streamObject({
            model: createTestModel({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          convertAsyncIterableToArray(result.partialObjectStream);

          expect(await result.usage).toMatchInlineSnapshot(`
          {
            "cachedInputTokens": undefined,
            "inputTokens": 3,
            "outputTokens": 10,
            "reasoningTokens": undefined,
            "totalTokens": 13,
          }
        `);
        });
      });

      describe('result.providerMetadata', () => {
        it('should resolve with provider metadata', async () => {
          const result = streamObject({
            model: createTestModel({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          convertAsyncIterableToArray(result.partialObjectStream);

          expect(await result.providerMetadata).toStrictEqual({
            testProvider: { testKey: 'testValue' },
          });
        });
      });

      describe('result.response', () => {
        it('should resolve with response information', async () => {
          const result = streamObject({
            model: createTestModel({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          convertAsyncIterableToArray(result.partialObjectStream);

          expect(await result.response).toStrictEqual({
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
            headers: { call: '2' },
          });
        });
      });

      describe('result.request', () => {
        it('should contain request information', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          await convertAsyncIterableToArray(result.partialObjectStream);

          expect(await result.request).toStrictEqual({
            body: 'test body',
          });
        });
      });

      describe('result.object', () => {
        it('should resolve with typed object', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          convertAsyncIterableToArray(result.partialObjectStream);

          assert.deepStrictEqual(await result.object, {
            content: 'Hello, world!',
          });
        });

        it('should reject object promise when the streamed object does not match the schema', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          convertAsyncIterableToArray(result.partialObjectStream);

          expect(result.object).rejects.toThrow(NoObjectGeneratedError);
        });

        it('should not lead to unhandled promise rejections when the streamed object does not match the schema', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          convertAsyncIterableToArray(result.partialObjectStream);

          // unhandled promise rejection should not be thrown (Vitest does this automatically)
        });
      });

      describe('result.finishReason', () => {
        it('should resolve with finish reason', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          convertAsyncIterableToArray(result.partialObjectStream);

          expect(await result.finishReason).toStrictEqual('stop');
        });
      });

      describe('options.onFinish', () => {
        it('should be called when a valid object is generated', async () => {
          let result: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

          const { partialObjectStream } = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
            onFinish: async event => {
              result = event as unknown as typeof result;
            },
          });

          // consume stream
          await convertAsyncIterableToArray(partialObjectStream);

          expect(result!).toMatchSnapshot();
        });

        it("should be called when object doesn't match the schema", async () => {
          let result: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

          const { partialObjectStream, object } = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
            onFinish: async event => {
              result = event as unknown as typeof result;
            },
          });

          // consume stream
          await convertAsyncIterableToArray(partialObjectStream);

          // consume expected error rejection
          await object.catch(() => {});

          expect(result!).toMatchSnapshot();
        });
      });

      describe('options.headers', () => {
        it('should pass headers to model', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
            headers: { 'custom-request-header': 'request-header-value' },
          });

          expect(await convertAsyncIterableToArray(result.partialObjectStream)).toStrictEqual([
            { content: 'headers test' },
          ]);
        });
      });

      describe('options.providerOptions', () => {
        it('should pass provider options to model', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
            providerOptions: {
              aProvider: { someKey: 'someValue' },
            },
          });

          expect(await convertAsyncIterableToArray(result.partialObjectStream)).toStrictEqual([
            { content: 'provider metadata test' },
          ]);
        });
      });

      describe('custom schema', () => {
        it('should send object deltas', async () => {
          const mockModel = createTestModel();

          const result = streamObject({
            model: mockModel,
            schema: jsonSchema({
              type: 'object',
              properties: { content: { type: 'string' } },
              required: ['content'],
              additionalProperties: false,
            }),
            prompt: 'prompt',
          });

          expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`
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

          expect(mockModel.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
          {
            "description": undefined,
            "name": undefined,
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
        it('should throw NoObjectGeneratedError when schema validation fails', async () => {
          const result = streamObject({
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          try {
            await convertAsyncIterableToArray(result.partialObjectStream);
            await result.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: response did not match schema.',
              response: {
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
              },
              usage: testUsage,
              finishReason: 'stop',
            });
          }
        });

        it('should throw NoObjectGeneratedError when parsing fails', async () => {
          const result = streamObject({
            model: new MockLanguageModelV2({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: '{ broken json' },
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          try {
            await convertAsyncIterableToArray(result.partialObjectStream);
            await result.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: could not parse the response.',
              response: {
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
              },
              usage: testUsage,
              finishReason: 'stop',
            });
          }
        });

        it('should throw NoObjectGeneratedError when no text is generated', async () => {
          const result = streamObject({
            model: new MockLanguageModelV2({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
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
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          try {
            await convertAsyncIterableToArray(result.partialObjectStream);
            await result.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: could not parse the response.',
              response: {
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
              },
              usage: testUsage,
              finishReason: 'stop',
            });
          }
        });
      });
    });

    describe('output = "array"', () => {
      describe('array with 3 elements', () => {
        let result: StreamObjectResult<
          { content: string }[],
          { content: string }[],
          AsyncIterableStream<{ content: string }>
        >;

        let onFinishResult: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

        beforeEach(async () => {
          result = streamObject({
            model: createTestModel({
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
            schema: z.object({ content: z.string() }),
            output: 'array',
            prompt: 'prompt',
            onFinish: async event => {
              onFinishResult = event as unknown as typeof onFinishResult;
            },
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.partialObjectStream), [
            [],
            [{ content: 'element 1' }],
            [{ content: 'element 1' }, { content: 'element 2' }],
            [{ content: 'element 1' }, { content: 'element 2' }, { content: 'element 3' }],
          ]);
        });

        it('should stream only complete objects in textStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.textStream), [
            '[',
            '{"content":"element 1"}',
            ',{"content":"element 2"}',
            ',{"content":"element 3"}]',
          ]);
        });

        it('should have the correct object result', async () => {
          // consume stream
          await convertAsyncIterableToArray(result.partialObjectStream);

          expect(await result.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });

        it('should call onFinish callback with full array', async () => {
          expect(onFinishResult.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });

        it('should stream elements individually in elementStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.elementStream), [
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });
      });

      describe('array with 2 elements streamed in 1 chunk', () => {
        let result: StreamObjectResult<
          { content: string }[],
          { content: string }[],
          AsyncIterableStream<{ content: string }>
        >;

        let onFinishResult: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

        beforeEach(async () => {
          result = streamObject({
            model: createTestModel({
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
            schema: z.object({ content: z.string() }),
            output: 'array',
            prompt: 'prompt',
            onFinish: async event => {
              onFinishResult = event as unknown as typeof onFinishResult;
            },
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.partialObjectStream), [
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
          await convertAsyncIterableToArray(result.partialObjectStream);

          expect(await result.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        it('should call onFinish callback with full array', async () => {
          expect(onFinishResult.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        it('should stream elements individually in elementStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.elementStream), [
            { content: 'element 1' },
            { content: 'element 2' },
          ]);
        });
      });
    });

    describe('output = "enum"', () => {
      it('should stream an enum value', async () => {
        const mockModel = createTestModel({
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

        const result = streamObject({
          model: mockModel,
          output: 'enum',
          enum: ['sunny', 'rainy', 'snowy'],
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`
          [
            "sunny",
          ]
        `);

        expect(mockModel.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
        {
          "description": undefined,
          "name": undefined,
          "schema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "additionalProperties": false,
            "properties": {
              "result": {
                "enum": [
                  "sunny",
                  "rainy",
                  "snowy",
                ],
                "type": "string",
              },
            },
            "required": [
              "result",
            ],
            "type": "object",
          },
          "type": "json",
        }
      `);
      });

      it('should not stream incorrect values', async () => {
        const mockModel = new MockLanguageModelV2({
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
        });

        const result = streamObject({
          model: mockModel,
          output: 'enum',
          enum: ['sunny', 'rainy', 'snowy'],
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`[]`);
      });

      it('should handle ambiguous values', async () => {
        const mockModel = createTestModel({
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

        const result = streamObject({
          model: mockModel,
          output: 'enum',
          enum: ['foobar', 'foobar2'],
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`
        [
          "foo",
          "foobar",
        ]
      `);
      });

      it('should handle non-ambiguous values', async () => {
        const mockModel = createTestModel({
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

        const result = streamObject({
          model: mockModel,
          output: 'enum',
          enum: ['foobar', 'barfoo'],
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`
        [
          "foobar",
        ]
      `);
      });
    });

    describe('output = "no-schema"', () => {
      it('should send object deltas', async () => {
        const mockModel = createTestModel({
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
        });

        const result = streamObject({
          model: mockModel,
          output: 'no-schema',
          prompt: 'prompt',
        });

        expect(await convertAsyncIterableToArray(result.partialObjectStream)).toMatchInlineSnapshot(`
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

        expect(mockModel.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
        {
          "description": undefined,
          "name": undefined,
          "schema": undefined,
          "type": "json",
        }
      `);
      });
    });

    describe('telemetry', () => {
      let tracer: MockTracer;

      beforeEach(() => {
        tracer = new MockTracer();
      });

      it('should not record any telemetry data when not explicitly enabled', async () => {
        const result = streamObject({
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
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          _internal: { now: () => 0 },
        });

        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(tracer.jsonSpans).toMatchSnapshot();
      });

      it('should record telemetry data when enabled', async () => {
        const result = streamObject({
          model: createTestModel({
            stream: convertArrayToReadableStream([
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
          }),
          schema: z.object({ content: z.string() }),
          schemaName: 'test-name',
          schemaDescription: 'test description',
          prompt: 'prompt',
          topK: 0.1,
          topP: 0.2,
          frequencyPenalty: 0.3,
          presencePenalty: 0.4,
          temperature: 0.5,
          headers: {
            header1: 'value1',
            header2: 'value2',
          },
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'test-function-id',
            metadata: {
              test1: 'value1',
              test2: false,
            },
            tracer,
          },
          _internal: { now: () => 0 },
        });

        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(tracer.jsonSpans).toMatchSnapshot();
      });

      it('should not record telemetry inputs / outputs when disabled', async () => {
        const result = streamObject({
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
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          experimental_telemetry: {
            isEnabled: true,
            recordInputs: false,
            recordOutputs: false,
            tracer,
          },
          _internal: { now: () => 0 },
        });

        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(tracer.jsonSpans).toMatchSnapshot();
      });
    });

    describe('options.messages', () => {
      it('should support models that use "this" context in supportedUrls', async () => {
        let supportedUrlsCalled = false;
        class MockLanguageModelWithImageSupport extends MockLanguageModelV2 {
          constructor() {
            super({
              supportedUrls: () => {
                supportedUrlsCalled = true;
                // Reference 'this' to verify context
                return this.modelId === 'mock-model-id'
                  ? ({ 'image/*': [/^https:\/\/.*$/] } as Record<string, RegExp[]>)
                  : {};
              },
              doStream: async () => ({
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
            });
          }
        }

        const model = new MockLanguageModelWithImageSupport();

        const result = streamObject({
          model,
          schema: z.object({ content: z.string() }),
          messages: [
            {
              role: 'user',
              content: [{ type: 'image', image: 'https://example.com/test.jpg' }],
            },
          ],
        });

        const chunks = await convertAsyncIterableToArray(result.textStream);
        expect(chunks.join('')).toBe('{ "content": "Hello, world!" }');
        expect(supportedUrlsCalled).toBe(true);
      });
    });

    describe('options.experimental_repairText', () => {
      it('should be able to repair a JSONParseError', async () => {
        const result = streamObject({
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
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          experimental_repairText: async ({ text, error }) => {
            expect(error).toBeInstanceOf(JSONParseError);
            expect(text).toStrictEqual('{ "content": "provider metadata test" ');
            return text + '}';
          },
        });

        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.object).toStrictEqual({
          content: 'provider metadata test',
        });
      });

      it('should be able to repair a TypeValidationError', async () => {
        const result = streamObject({
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
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          experimental_repairText: async ({ text, error }) => {
            expect(error).toBeInstanceOf(TypeValidationError);
            expect(text).toStrictEqual('{ "content-a": "provider metadata test" }');
            return `{ "content": "provider metadata test" }`;
          },
        });

        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.object).toStrictEqual({
          content: 'provider metadata test',
        });
      });

      it('should be able to handle repair that returns null', async () => {
        const result = streamObject({
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
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          experimental_repairText: async ({ text, error }) => {
            expect(error).toBeInstanceOf(TypeValidationError);
            expect(text).toStrictEqual('{ "content-a": "provider metadata test" }');
            return null;
          },
        });

        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(result.object).rejects.toThrow('No object generated: response did not match schema.');
      });

      it('should be able to repair JSON wrapped with markdown code blocks', async () => {
        const result = streamObject({
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
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          experimental_repairText: async ({ text, error }) => {
            expect(error).toBeInstanceOf(JSONParseError);
            expect(text).toStrictEqual('```json\n{ "content": "test message" }\n```');

            // Remove markdown code block wrapper
            const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            return cleaned;
          },
        });

        // consume stream
        await convertAsyncIterableToArray(result.partialObjectStream);

        expect(await result.object).toStrictEqual({
          content: 'test message',
        });
      });

      it('should throw NoObjectGeneratedError when parsing fails with repairText', async () => {
        const result = streamObject({
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
          schema: z.object({ content: z.string() }),
          prompt: 'prompt',
          experimental_repairText: async ({ text }) => text + '{',
        });

        try {
          await convertAsyncIterableToArray(result.partialObjectStream);
          await result.object;
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
