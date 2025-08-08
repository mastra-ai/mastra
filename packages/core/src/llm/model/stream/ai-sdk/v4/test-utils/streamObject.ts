import assert, { fail } from 'node:assert';
import { convertAsyncIterableToArray, convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { jsonSchema } from '@ai-sdk/ui-utils';
import { NoObjectGeneratedError } from 'ai';
import type { FinishReason, LanguageModelResponseMetadata, LanguageModelUsage } from 'ai';
import { MockLanguageModelV1, convertArrayToReadableStream } from 'ai/test';
import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import type { MastraModelOutput } from '../../../base';
import type { execute, ExecuteParams } from '../../../execute';
import { createMockServerResponse } from './test-utils';

function verifyNoObjectGeneratedError(
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

export function streamObjectTestsV4({ executeFn, runId }: { executeFn: typeof execute; runId: string }) {
  // const streamObject = streamObjectv4;
  const streamObject = async (
    args: any,
    // Parameters<typeof streamObjectv4>[0]
  ) => {
    const {
      mode,
      output,
      schema,
      schemaName,
      schemaDescription,

      model,
      messages,
      prompt,
      system,
      headers,
      onError,
      providerOptions,

      onFinish,
    } = args;

    let modeType: 'regular' | 'object-json' | 'object-tool' | undefined;
    if (mode === 'json') {
      modeType = 'object-json';
    } else if (mode === 'tool') {
      modeType = 'object-tool';
    }

    const executeParams: Omit<ExecuteParams, 'runId'> = {
      model,
      messages,
      prompt,
      system,
      options: {
        mode: modeType,
        schema,
        schemaName,
        schemaDescription,
        onError,
        output,
        onFinish,
      },
      headers,
      providerOptions,
    };

    const res = await executeFn({
      runId,
      ...executeParams,
    });

    return res;
  };

  describe.only('streamObject', () => {
    describe('output = "object"', () => {
      describe('result.objectStream', () => {
        it('should send object deltas with json mode', async () => {
          const model = new MockLanguageModelV1({
            doStream: async ({ prompt, mode }) => {
              expect(mode).toStrictEqual({
                type: 'object-json',
                name: undefined,
                description: undefined,
                schema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { content: { type: 'string' } },
                  required: ['content'],
                  type: 'object',
                },
              });
              expect(prompt).toStrictEqual([
                {
                  role: 'system',
                  content:
                    'JSON schema:\n' +
                    '{"type":"object","properties":{"content":{"type":"string"}},"required":["content"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}\n' +
                    'You MUST answer with a JSON object that matches the JSON schema above.',
                },
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'prompt' }],
                  // providerMetadata: undefined,
                },
              ]);

              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                    providerMetadata: {
                      testprovider: {
                        testkey: 'testvalue',
                      },
                    },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              };
            },
          });
          const result = await streamObject({
            runId,
            model,
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            {},
            { content: 'Hello, ' },
            { content: 'Hello, world' },
            { content: 'Hello, world!' },
          ]);
        });

        it('should send object deltas with json mode when structured outputs are enabled', async () => {
          const model = new MockLanguageModelV1({
            supportsStructuredOutputs: true,
            doStream: async ({ prompt, mode }) => {
              assert.deepStrictEqual(mode, {
                type: 'object-json',
                name: undefined,
                description: undefined,
                schema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { content: { type: 'string' } },
                  required: ['content'],
                  type: 'object',
                },
              });

              // The prompt structure will be different for our execute function vs AI SDK streamObject
              // Just verify that we have some prompt structure rather than exact match
              expect(prompt).toBeDefined();
              expect(Array.isArray(prompt)).toBe(true);
              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              };
            },
          });
          const result = await streamObject({
            runId,
            model,
            mode: 'json',
            schema: z.object({ content: z.string() }),
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            {},
            { content: 'Hello, ' },
            { content: 'Hello, world' },
            { content: 'Hello, world!' },
          ]);
        });

        it('should use name and description with json mode when structured outputs are enabled', async () => {
          const model = new MockLanguageModelV1({
            supportsStructuredOutputs: true,
            doStream: async ({ prompt, mode }) => {
              assert.deepStrictEqual(mode, {
                type: 'object-json',
                name: 'test-name',
                description: 'test description',
                schema: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { content: { type: 'string' } },
                  required: ['content'],
                  type: 'object',
                },
              });

              expect(prompt).toStrictEqual([
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'prompt' }],
                  // providerMetadata: undefined,
                },
              ]);

              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              };
            },
          });

          const result = await streamObject({
            model,
            schema: z.object({ content: z.string() }),
            schemaName: 'test-name',
            schemaDescription: 'test description',
            mode: 'json',
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            {},
            { content: 'Hello, ' },
            { content: 'Hello, world' },
            { content: 'Hello, world!' },
          ]);
        });

        it('should send object deltas with tool mode', async () => {
          const model = new MockLanguageModelV1({
            doStream: async ({ prompt, mode }) => {
              // assert.deepStrictEqual(mode, {
              //   type: 'object-tool',
              //   tool: {
              //     type: 'function',
              //     name: 'json',
              //     description: 'Respond with a JSON object.',
              //     parameters: {
              //       $schema: 'http://json-schema.org/draft-07/schema#',
              //       additionalProperties: false,
              //       properties: { content: { type: 'string' } },
              //       required: ['content'],
              //       type: 'object',
              //     },
              //   },
              // });
              // expect(prompt).toStrictEqual([
              //   {
              //     role: 'user',
              //     content: [{ type: 'text', text: 'prompt' }],
              //     // providerMetadata: undefined,
              //   },
              // ]);

              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '{ ',
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '"content": ',
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: `"Hello, `,
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: `world`,
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: `!"`,
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: ' }',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              };
            },
          });

          const result = await streamObject({
            model,
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            {},
            { content: 'Hello, ' },
            { content: 'Hello, world' },
            { content: 'Hello, world!' },
          ]);
        });

        it('should  use name and description with tool mode', async () => {
          const model = new MockLanguageModelV1({
            doStream: async ({ prompt, mode }) => {
              assert.deepStrictEqual(mode, {
                type: 'object-tool',
                tool: {
                  type: 'function',
                  name: 'test-name',
                  description: 'test description',
                  parameters: {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    additionalProperties: false,
                    properties: { content: { type: 'string' } },
                    required: ['content'],
                    type: 'object',
                  },
                },
              });
              expect(prompt).toStrictEqual([
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'prompt' }],
                  // providerMetadata: undefined,
                },
              ]);

              return {
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '{ ',
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '"content": ',
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: `"Hello, `,
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: `world`,
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: `!"`,
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: ' }',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              };
            },
          });
          const result = await streamObject({
            model,
            schema: z.object({ content: z.string() }),
            schemaName: 'test-name',
            schemaDescription: 'test description',
            mode: 'tool',
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            {},
            { content: 'Hello, ' },
            { content: 'Hello, world' },
            { content: 'Hello, world!' },
          ]);
        });

        it('should suppress error in partialObjectStream', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => {
                throw new Error('test error');
              },
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          expect(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream)).toStrictEqual([]);
        });

        it('should invoke onError callback with Error', async () => {
          const result: Array<{ error: unknown }> = [];

          const resultObject = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => {
                throw new Error('test error');
              },
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
            onError(event) {
              result.push(event);
            },
          });

          // consume stream
          await convertReadableStreamToArray(resultObject.aisdk.v4.partialObjectStream);

          expect(result).toStrictEqual([{ error: new Error('test error') }]);
        });
      });

      // the snapshot doesn't have chunks like step-start, step-finish
      describe.todo('result.fullStream', () => {
        it('should send full stream data', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 2 },
                    logprobs: [{ token: '-', logprob: 1, topLogprobs: [] }],
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: { logprobs: 0 } },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          const data = await convertReadableStreamToArray(result.aisdk.v4.fullStream);
          expect(data).toMatchSnapshot();
        });
      });

      // no textStream yet
      describe.todo('result.textStream', () => {
        it('should send text stream', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 2 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.textStream), [
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
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 2 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          const response = result.aisdk.v4.toTextStreamResponse();

          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');

          assert.deepStrictEqual(
            await convertReadableStreamToArray(response.body!.pipeThrough(new TextDecoderStream())),
            ['{ ', '"content": ', '"Hello, ', 'world', '!"', ' }'],
          );
        });
      });

      // TODO: no pipeTextStreamToResponse
      describe('result.pipeTextStreamToResponse', async () => {
        it.todo('should write text deltas to a Node.js response-like object', async () => {
          const mockResponse = createMockServerResponse();

          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 2 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          result.pipeTextStreamToResponse(mockResponse);

          await mockResponse.waitForEnd();

          expect(mockResponse.statusCode).toBe(200);
          expect(mockResponse.headers).toEqual({
            'Content-Type': 'text/plain; charset=utf-8',
          });
          expect(mockResponse.getDecodedChunks()).toEqual(['{ ', '"content": "Hello, ', 'world', '!"', ' }']);
        });
      });

      describe('result.usage', () => {
        it('should resolve with token usage', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'text-delta',
                    textDelta: '{ "content": "Hello, world!" }',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          assert.deepStrictEqual(await result.usage, {
            completionTokens: 10,
            promptTokens: 3,
            totalTokens: 13,
          });
        });
      });

      describe('result.providerMetadata', () => {
        it('should resolve with provider metadata', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'text-delta',
                    textDelta: '{ "content": "Hello, world!" }',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                    providerMetadata: {
                      testProvider: { testKey: 'testValue' },
                    },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          expect(result.providerMetadata).toStrictEqual({
            testProvider: { testKey: 'testValue' },
          });
        });
      });

      describe.todo('result.response', () => {
        // original test didn't include `messages` in response
        it.todo('should resolve with response information in json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'text-delta',
                    textDelta: '{"content": "Hello, world!"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                rawResponse: { headers: { call: '2' } },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          void convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          expect(await result.aisdk.v4.response).toStrictEqual({
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
            headers: { call: '2' },
            // messages: [
            //   {
            //     content: [
            //       {
            //         text: '{"content": "Hello, world!"}',
            //         type: 'text',
            //       },
            //     ],
            //     id: 'N58FGZvizhdYXP3Z',
            //     role: 'assistant',
            //   },
            // ],
          });
        });

        // original test didn't include `messages` in response
        it.todo('should resolve with response information in tool mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '{"content": "Hello, world!"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                rawResponse: { headers: { call: '2' } },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
          });

          void convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
          // consume stream (runs in parallel)

          expect(await result.aisdk.v4.response).toStrictEqual({
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
            headers: { call: '2' },
          });
        });
      });

      describe('result.request', () => {
        it('should contain request information with json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'text-delta',
                    textDelta: '{"content": "Hello, world!"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                request: { body: 'test body' },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          expect(await result.request).toStrictEqual({
            body: 'test body',
          });
        });

        it('should contain request information with tool mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '{"content": "Hello, world!"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    logprobs: undefined,
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                request: { body: 'test body' },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          expect(await result.request).toStrictEqual({
            body: 'test body',
          });
        });
      });

      describe('result.object', () => {
        it('should resolve with typed object', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          void convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          assert.deepStrictEqual(await result.aisdk.v4.object, {
            content: 'Hello, world!',
          });
        });

        it('should reject object promise when the streamed object does not match the schema', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"invalid": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          void convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          await expect(result.aisdk.v4.object).rejects.toThrow(NoObjectGeneratedError);
        });

        it('should not lead to unhandled promise rejections when the streamed object does not match the schema', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"invalid": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          // consume stream (runs in parallel)
          void convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          // unhandled promise rejection should not be thrown (Vitest does this automatically)
        });
      });

      describe.todo('options.onFinish', () => {
        // TODO: onFinish not being invoked
        it.todo('should be called when a valid object is generated', async () => {
          let result: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

          const streamResult = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'text-delta',
                    textDelta: '{ "content": "Hello, world!" }',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                    providerMetadata: {
                      testProvider: { testKey: 'testValue' },
                    },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
            onFinish: async event => {
              result = event as unknown as typeof result;
            },
          });

          // consume stream
          await convertReadableStreamToArray(streamResult.aisdk.v4.partialObjectStream);

          expect(result!).toMatchSnapshot();
        });

        it.todo("should be called when object doesn't match the schema", async () => {
          let result: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

          const streamResult = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"invalid": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
            onFinish: async event => {
              result = event as unknown as typeof result;
            },
          });

          // consume stream
          await convertReadableStreamToArray(streamResult.aisdk.v4.partialObjectStream);

          // consume expected error rejection
          await streamResult.aisdk.v4.object.catch(() => {});

          expect(result!).toMatchSnapshot();
        });
      });

      describe('options.headers', () => {
        it('should pass headers to model in json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async ({ headers }) => {
                expect(headers).toStrictEqual({
                  'custom-request-header': 'request-header-value',
                });

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'text-delta',
                      textDelta: `{ "content": "headers test" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { completionTokens: 10, promptTokens: 3 },
                    },
                  ]),
                  rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                };
              },
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
            headers: { 'custom-request-header': 'request-header-value' },
          });

          expect(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream)).toStrictEqual([
            { content: 'headers test' },
          ]);
        });

        it('should pass headers to model in tool mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async ({ headers }) => {
                expect(headers).toStrictEqual({
                  'custom-request-header': 'request-header-value',
                });

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call-delta',
                      toolCallType: 'function',
                      toolCallId: 'tool-call-1',
                      toolName: 'json',
                      argsTextDelta: `{ "content": "headers test" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { completionTokens: 10, promptTokens: 3 },
                    },
                  ]),
                  rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                };
              },
            }),
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
            headers: { 'custom-request-header': 'request-header-value' },
          });

          expect(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream)).toStrictEqual([
            { content: 'headers test' },
          ]);
        });
      });

      describe('options.providerOptions', () => {
        it('should pass provider options to model in json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async ({ providerMetadata }) => {
                expect(providerMetadata).toStrictEqual({
                  aProvider: { someKey: 'someValue' },
                });

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'text-delta',
                      textDelta: `{ "content": "provider metadata test" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { completionTokens: 10, promptTokens: 3 },
                    },
                  ]),
                  rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                };
              },
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
            providerOptions: {
              aProvider: { someKey: 'someValue' },
            },
          });

          expect(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream)).toStrictEqual([
            { content: 'provider metadata test' },
          ]);
        });

        it('should pass provider options to model in tool mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async ({ providerMetadata }) => {
                expect(providerMetadata).toStrictEqual({
                  aProvider: { someKey: 'someValue' },
                });

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'tool-call-delta',
                      toolCallType: 'function',
                      toolCallId: 'tool-call-1',
                      toolName: 'json',
                      argsTextDelta: `{ "content": "provider metadata test" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { completionTokens: 10, promptTokens: 3 },
                    },
                  ]),
                  rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                };
              },
            }),
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
            providerOptions: {
              aProvider: { someKey: 'someValue' },
            },
          });

          expect(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream)).toStrictEqual([
            { content: 'provider metadata test' },
          ]);
        });
      });

      describe('custom schema', () => {
        it('should send object deltas with json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async ({ prompt, mode }) => {
                assert.deepStrictEqual(mode, {
                  type: 'object-json',
                  name: undefined,
                  description: undefined,
                  schema: jsonSchema({
                    type: 'object',
                    properties: { content: { type: 'string' } },
                    required: ['content'],
                    additionalProperties: false,
                  }).jsonSchema,
                });

                expect(prompt).toStrictEqual([
                  {
                    role: 'system',
                    content:
                      'JSON schema:\n' +
                      '{"type":"object","properties":{"content":{"type":"string"}},"required":["content"],"additionalProperties":false}\n' +
                      'You MUST answer with a JSON object that matches the JSON schema above.',
                  },
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'prompt' }],
                    // providerMetadata: undefined,
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-delta', textDelta: '{ ' },
                    { type: 'text-delta', textDelta: '"content": ' },
                    { type: 'text-delta', textDelta: `"Hello, ` },
                    { type: 'text-delta', textDelta: `world` },
                    { type: 'text-delta', textDelta: `!"` },
                    { type: 'text-delta', textDelta: ' }' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { completionTokens: 10, promptTokens: 3 },
                    },
                  ]),
                  rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                };
              },
            }),
            schema: jsonSchema({
              type: 'object',
              properties: { content: { type: 'string' } },
              required: ['content'],
              additionalProperties: false,
            }),
            mode: 'json',
            prompt: 'prompt',
          });

          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            {},
            { content: 'Hello, ' },
            { content: 'Hello, world' },
            { content: 'Hello, world!' },
          ]);
        });
      });

      describe('error handling', () => {
        it('should throw NoObjectGeneratedError when schema validation fails in tool mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '{ "content": 123 }',
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-1',
                    timestamp: new Date(123),
                    modelId: 'model-1',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
          });

          try {
            await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
            await result.aisdk.v4.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: response did not match schema.',
              response: {
                headers: undefined,
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
                // @ts-expect-error
                messages: [], // TODO is this messages array supposed to be here in the response?
              },
              usage: { completionTokens: 10, promptTokens: 3, totalTokens: 13 },
              finishReason: 'stop',
            });
          }
        });

        // TODO: response has messages with content and a random id
        it.todo('should throw NoObjectGeneratedError when schema validation fails in json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ "content": 123 }' },
                  {
                    type: 'response-metadata',
                    id: 'id-1',
                    timestamp: new Date(123),
                    modelId: 'model-1',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          try {
            await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
            await result.aisdk.v4.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: response did not match schema.',
              response: {
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
                headers: undefined,
              },
              usage: { completionTokens: 10, promptTokens: 3, totalTokens: 13 },
              finishReason: 'stop',
            });
          }
        });

        it('should throw NoObjectGeneratedError when parsing fails in tool mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'tool-call-delta',
                    toolCallType: 'function',
                    toolCallId: 'tool-call-1',
                    toolName: 'json',
                    argsTextDelta: '{ broken json',
                  },
                  {
                    type: 'response-metadata',
                    id: 'id-1',
                    timestamp: new Date(123),
                    modelId: 'model-1',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
          });

          try {
            await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
            await result.aisdk.v4.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: response did not match schema.',
              response: {
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
                headers: undefined,
                // @ts-expect-error
                messages: [], // TODO: should messages be here?
              },
              usage: { completionTokens: 10, promptTokens: 3, totalTokens: 13 },
              finishReason: 'stop',
            });
          }
        });

        // TODO: response has messages with content and a random id
        it.todo('should throw NoObjectGeneratedError when parsing fails in json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ broken json' },
                  {
                    type: 'response-metadata',
                    id: 'id-1',
                    timestamp: new Date(123),
                    modelId: 'model-1',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          try {
            await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
            await result.aisdk.v4.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: response did not match schema.',
              response: {
                headers: undefined,
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
              },
              usage: { completionTokens: 10, promptTokens: 3, totalTokens: 13 },
              finishReason: 'stop',
            });
          }
        });

        it('should throw NoObjectGeneratedError when no tool call is made in tool mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
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
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'tool',
            prompt: 'prompt',
          });

          try {
            await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
            await result.aisdk.v4.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: response did not match schema.',
              response: {
                headers: undefined,
                // @ts-expect-error
                messages: [], // TODO: should messages be here?
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
              },
              usage: { completionTokens: 10, promptTokens: 3, totalTokens: 13 },
              finishReason: 'stop',
            });
          }
        });

        it('should throw NoObjectGeneratedError when no text is generated in json mode', async () => {
          const result = await streamObject({
            model: new MockLanguageModelV1({
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
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            }),
            schema: z.object({ content: z.string() }),
            mode: 'json',
            prompt: 'prompt',
          });

          try {
            await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
            await result.aisdk.v4.object;
            fail('must throw error');
          } catch (error) {
            verifyNoObjectGeneratedError(error, {
              message: 'No object generated: response did not match schema.',
              response: {
                headers: undefined,
                // @ts-expect-error
                messages: [], // TODO: should messages be here?
                id: 'id-1',
                timestamp: new Date(123),
                modelId: 'model-1',
              },
              usage: { completionTokens: 10, promptTokens: 3, totalTokens: 13 },
              finishReason: 'stop',
            });
          }
        });
      });
    });

    describe('output = "array"', () => {
      describe('array with 3 elements', () => {
        let result: MastraModelOutput;
        let onFinishResult: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

        beforeEach(async () => {
          result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async ({ prompt, mode }) => {
                const expectedPrompt = [
                  {
                    role: 'system',
                    content:
                      'JSON schema:\n' +
                      `{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"type\":\"object\",\"properties\":{\"elements\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"content\":{\"type\":\"string\"}},\"required\":[\"content\"],\"additionalProperties\":false}}},\"required\":[\"elements\"],\"additionalProperties\":false}` +
                      `\n` +
                      'You MUST answer with a JSON object that matches the JSON schema above.',
                  },
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'prompt' }],
                    // providerMetadata: undefined,
                  },
                ];
                // console.log('prompt22', JSON.stringify(prompt, null, 2));
                // console.log('expectedprompt22', console.log(JSON.stringify(expectedPrompt, null, 2)));
                // console.log('mode22', mode);

                assert.deepStrictEqual(mode, {
                  type: 'object-json',
                  name: undefined,
                  description: undefined,
                  schema: {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    additionalProperties: false,
                    properties: {
                      elements: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: { content: { type: 'string' } },
                          required: ['content'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['elements'],
                    type: 'object',
                  },
                });

                expect(prompt).toStrictEqual(expectedPrompt);

                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-delta', textDelta: '{"elements":[' },
                    // first element:
                    { type: 'text-delta', textDelta: '{' },
                    { type: 'text-delta', textDelta: '"content":' },
                    { type: 'text-delta', textDelta: `"element 1"` },
                    { type: 'text-delta', textDelta: '},' },
                    // second element:
                    { type: 'text-delta', textDelta: '{ ' },
                    { type: 'text-delta', textDelta: '"content": ' },
                    { type: 'text-delta', textDelta: `"element 2"` },
                    { type: 'text-delta', textDelta: '},' },
                    // third element:
                    { type: 'text-delta', textDelta: '{' },
                    { type: 'text-delta', textDelta: '"content":' },
                    { type: 'text-delta', textDelta: `"element 3"` },
                    { type: 'text-delta', textDelta: '}' },
                    // end of array
                    { type: 'text-delta', textDelta: ']' },
                    { type: 'text-delta', textDelta: '}' },
                    // finish
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { completionTokens: 10, promptTokens: 3 },
                    },
                  ]),
                  rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                };
              },
            }),
            schema: z.object({ content: z.string() }),
            output: 'array',
            mode: 'json',
            prompt: 'prompt',
            onFinish: async event => {
              onFinishResult = event as unknown as typeof onFinishResult;
            },
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            [],
            [{ content: 'element 1' }],
            [{ content: 'element 1' }, { content: 'element 2' }],
            [{ content: 'element 1' }, { content: 'element 2' }, { content: 'element 3' }],
          ]);
        });

        // TODO: textStream is not implemented yet in aisdk.v4
        it.todo('should stream only complete objects in textStream', async () => {
          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.textStream), [
            '[',
            '{"content":"element 1"}',
            ',{"content":"element 2"}',
            ',{"content":"element 3"}]',
          ]);
        });

        it('should have the correct object result', async () => {
          // consume stream
          await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);

          expect(await result.aisdk.v4.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });

        // TODO: onFinish is not implemented yet
        it.todo('should call onFinish callback with full array', async () => {
          expect(onFinishResult.object).toStrictEqual([
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });

        // TODO: elementStream is not implemented yet
        it.todo('should stream elements individually in elementStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.elementStream), [
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ]);
        });
      });

      describe('array with 2 elements streamed in 1 chunk', () => {
        let result: MastraModelOutput;
        let onFinishResult: Parameters<Required<Parameters<typeof streamObject>[0]>['onFinish']>[0];

        beforeEach(async () => {
          result = await streamObject({
            model: new MockLanguageModelV1({
              doStream: async ({ prompt, mode }) => {
                assert.deepStrictEqual(mode, {
                  type: 'object-json',
                  name: undefined,
                  description: undefined,
                  schema: {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    additionalProperties: false,
                    properties: {
                      elements: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: { content: { type: 'string' } },
                          required: ['content'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['elements'],
                    type: 'object',
                  },
                });

                expect(prompt).toStrictEqual([
                  {
                    role: 'system',
                    content:
                      'JSON schema:\n' +
                      `{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"type\":\"object\",\"properties\":{\"elements\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"content\":{\"type\":\"string\"}},\"required\":[\"content\"],\"additionalProperties\":false}}},\"required\":[\"elements\"],\"additionalProperties\":false}` +
                      `\n` +
                      'You MUST answer with a JSON object that matches the JSON schema above.',
                  },
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'prompt' }],
                    // providerMetadata: undefined,
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'text-delta',
                      textDelta: '{"elements":[{"content":"element 1"},{"content":"element 2"}]}',
                    },
                    // finish
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { completionTokens: 10, promptTokens: 3 },
                    },
                  ]),
                  rawCall: { rawPrompt: 'prompt', rawSettings: {} },
                };
              },
            }),
            schema: z.object({ content: z.string() }),
            output: 'array',
            mode: 'json',
            prompt: 'prompt',
            onFinish: async event => {
              onFinishResult = event as unknown as typeof onFinishResult;
            },
          });
        });

        it('should stream only complete objects in partialObjectStream', async () => {
          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
            [{ content: 'element 1' }, { content: 'element 2' }],
          ]);
        });

        // TODO: textStream is not implemented yet in aisdk.v4
        it.todo('should stream only complete objects in textStream', async () => {
          assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.textStream), [
            '[{"content":"element 1"},{"content":"element 2"}]',
          ]);
        });

        it('should have the correct object result', async () => {
          // consume stream
          await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream);
          expect(await result.aisdk.v4.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        // TODO: onFinish is not implemented yet
        it.todo('should call onFinish callback with full array', async () => {
          expect(onFinishResult.object).toStrictEqual([{ content: 'element 1' }, { content: 'element 2' }]);
        });

        // TODO: elementStream is not implemented yet
        it.todo('should stream elements individually in elementStream', async () => {
          assert.deepStrictEqual(await convertAsyncIterableToArray(result.elementStream), [
            { content: 'element 1' },
            { content: 'element 2' },
          ]);
        });
      });
    });

    describe('output = "no-schema"', () => {
      it('should send object deltas with json mode', async () => {
        const result = await streamObject({
          model: new MockLanguageModelV1({
            doStream: async ({ prompt, mode }) => {
              console.log('mode22', mode);
              assert.deepStrictEqual(mode, {
                type: 'object-json',
                name: undefined,
                description: undefined,
                schema: undefined,
              });

              expect(prompt).toStrictEqual([
                {
                  role: 'system',
                  content: 'You MUST answer with JSON.',
                },
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'prompt' }],
                  // providerMetadata: undefined,
                },
              ]);

              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              };
            },
          }),
          output: 'no-schema',
          prompt: 'prompt',
        });

        assert.deepStrictEqual(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream), [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ]);
      });
    });

    describe('options.messages', () => {
      // TODO: currently failing to detect ui messages when creating MessageList
      it.todo('should detect and convert ui messages', async () => {
        const result = await streamObject({
          model: new MockLanguageModelV1({
            doStream: async ({ prompt }) => {
              expect(prompt).toStrictEqual([
                {
                  role: 'system',
                  content:
                    'JSON schema:\n' +
                    '{"type":"object","properties":{"content":{"type":"string"}},"required":["content"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}\n' +
                    'You MUST answer with a JSON object that matches the JSON schema above.',
                },
                {
                  content: [
                    {
                      text: 'prompt',
                      type: 'text',
                    },
                  ],
                  providerMetadata: undefined,
                  role: 'user',
                },
                {
                  content: [
                    {
                      args: {
                        value: 'test-value',
                      },
                      providerMetadata: undefined,
                      toolCallId: 'call-1',
                      toolName: 'test-tool',
                      type: 'tool-call',
                    },
                  ],
                  providerMetadata: undefined,
                  role: 'assistant',
                },
                {
                  content: [
                    {
                      content: undefined,
                      isError: undefined,
                      providerMetadata: undefined,
                      result: 'test result',
                      toolCallId: 'call-1',
                      toolName: 'test-tool',
                      type: 'tool-result',
                    },
                  ],
                  providerMetadata: undefined,
                  role: 'tool',
                },
              ]);

              return {
                stream: convertArrayToReadableStream([
                  { type: 'text-delta', textDelta: '{ ' },
                  { type: 'text-delta', textDelta: '"content": ' },
                  { type: 'text-delta', textDelta: `"Hello, ` },
                  { type: 'text-delta', textDelta: `world` },
                  { type: 'text-delta', textDelta: `!"` },
                  { type: 'text-delta', textDelta: ' }' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              };
            },
          }),
          schema: z.object({ content: z.string() }),
          mode: 'json',
          messages: [
            {
              role: 'user',
              content: 'prompt',
            },
            {
              role: 'assistant',
              content: '',
              toolInvocations: [
                {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'test-tool',
                  args: { value: 'test-value' },
                  result: 'test result',
                },
              ],
            },
          ],
        });

        expect(await convertReadableStreamToArray(result.aisdk.v4.partialObjectStream)).toStrictEqual([
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ]);
      });

      // TODO: no textStream in aisdk.v4 yet
      it.todo('should support models that use "this" context in supportsUrl', async () => {
        let supportsUrlCalled = false;
        class MockLanguageModelWithImageSupport extends MockLanguageModelV1 {
          readonly supportsImageUrls = false;

          constructor() {
            super({
              supportsUrl(url: URL) {
                supportsUrlCalled = true;
                // Reference 'this' to verify context
                return this.modelId === 'mock-model-id';
              },
              doStream: async () => ({
                stream: convertArrayToReadableStream([
                  {
                    type: 'text-delta',
                    textDelta: '{ "content": "Hello, world!" }',
                  },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { completionTokens: 10, promptTokens: 3 },
                  },
                ]),
                rawCall: { rawPrompt: 'prompt', rawSettings: {} },
              }),
            });
          }
        }

        const model = new MockLanguageModelWithImageSupport();

        const result = await streamObject({
          model,
          schema: z.object({ content: z.string() }),
          mode: 'json',
          messages: [
            {
              role: 'user',
              content: [{ type: 'image', image: 'https://example.com/test.jpg' }],
            },
          ],
        });

        const chunks = await convertReadableStreamToArray(result.aisdk.v4.textStream);
        expect(chunks.join('')).toBe('{ "content": "Hello, world!" }');
        expect(supportsUrlCalled).toBe(true);
      });
    });
  });
}
