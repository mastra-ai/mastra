import { convertArrayToReadableStream, convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import type { LanguageModelV2CallWarning, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from 'ai-v5/test';
import { assert, describe, expect, it } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import type { loop } from '../loop';
import { testUsage } from './utils';

function createTestModel({
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
  return new MockLanguageModelV2({
    doStream: async () => ({ stream, request, response, warnings }),
  });
}

export function streamObjectTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('streamObject', () => {
    describe('output = "object"', () => {
      describe('result.objectStream', () => {
        it('should send object deltas', async () => {
          const mockModel = createTestModel();

          const messageList = new MessageList();

          const result = loopFn({
            runId,
            model: mockModel,
            messageList,
            objectOptions: {
              schema: z.object({ content: z.string() }),
            },
          });

          expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toMatchInlineSnapshot(`
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

          // TODO: responseFormat is not set in the stream call
          // expect(mockModel?.doStreamCalls?.[0]?.responseFormat).toMatchInlineSnapshot(`
          //   {
          //     "description": undefined,
          //     "name": undefined,
          //     "schema": {
          //       "$schema": "http://json-schema.org/draft-07/schema#",
          //       "additionalProperties": false,xw
          //       "properties": {
          //         "content": {
          //           "type": "string",
          //         },
          //       },
          //       "required": [
          //         "content",
          //       ],
          //       "type": "object",
          //     },
          //     "type": "json",
          //   }
          // `);
        });

        it('should use name and description', async () => {
          const model = createTestModel();

          const result = executeFn({
            runId,
            model,
            options: {
              schema: z.object({ content: z.string() }),
              schemaName: 'test-name',
              schemaDescription: 'test description',
            },
            prompt: 'prompt',
          });

          expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toMatchInlineSnapshot(`
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
          expect(model.doStreamCalls?.[0]?.prompt).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "text": "prompt",
                    "type": "text",
                  },
                ],
                "role": "user",
              },
            ]
          `);
          // TODO: responseFormat is not set in the stream call
          // expect(model.doStreamCalls[0].responseFormat).toMatchInlineSnapshot(`
          //   {
          //     "description": "test description",
          //     "name": "test-name",
          //     "schema": {
          //       "$schema": "http://json-schema.org/draft-07/schema#",
          //       "additionalProperties": false,
          //       "properties": {
          //         "content": {
          //           "type": "string",
          //         },
          //       },
          //       "required": [
          //         "content",
          //       ],
          //       "type": "object",
          //     },
          //     "type": "json",
          //   }
          // `);
        });

        it('should suppress error in partialObjectStream', async () => {
          const result = executeFn({
            runId,
            model: new MockLanguageModelV2({
              doStream: async () => {
                throw new Error('test error');
              },
            }),
            options: {
              schema: z.object({ content: z.string() }),
              onError: () => {},
            },
            prompt: 'prompt',
          });

          expect(await convertAsyncIterableToArray(result.aisdk.v5.objectStream)).toStrictEqual([]);
        });

        it('should invoke onError callback with Error', async () => {
          const result: Array<{ error: unknown }> = [];

          const resultObject = executeFn({
            runId,
            model: new MockLanguageModelV2({
              doStream: async () => {
                throw new Error('test error');
              },
            }),
            prompt: 'prompt',
            options: {
              schema: z.object({ content: z.string() }),
              onError(event) {
                result.push(event);
              },
            },
          });

          // consume stream
          await resultObject.aisdk.v5.consumeStream();
          expect(result).toStrictEqual([{ error: new Error('test error') }]);
        });
      });

      describe('result.object', () => {
        it('should resolve with typed object', async () => {
          const result = loopFn({
            runId,
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
            objectOptions: {
              schema: z.object({ content: z.string() }),
            },
            messageList: new MessageList(),
          });

          // consume stream (runs in parallel)
          await convertAsyncIterableToArray(result.aisdk.v5.objectStream);

          assert.deepStrictEqual(await result.aisdk.v5.object, {
            content: 'Hello, world!',
          });
        });

        it.todo('should reject object promise when the streamed object does not match the schema', async () => {
          const result = executeFn({
            runId,
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
            options: {
              schema: z.object({ content: z.string() }),
            },
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          void convertAsyncIterableToArray(result.aisdk.v5.objectStream);
          const data = await result.aisdk.v5.object;
          console.log('data22', data);

          // expect(result.aisdk.v5.object).rejects.toThrow(NoObjectGeneratedError);
        });

        it('should not lead to unhandled promise rejections when the streamed object does not match the schema', async () => {
          const result = executeFn({
            runId,
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
            options: {
              schema: z.object({ content: z.string() }),
            },
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          void convertAsyncIterableToArray(result.aisdk.v5.objectStream);

          // unhandled promise rejection should not be thrown (Vitest does this automatically)
        });
      });
    });
  });
}
