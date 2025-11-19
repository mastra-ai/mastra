import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import type {
  LanguageModelV2CallOptions,
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
} from '@ai-sdk/provider-v5';
import { stepCountIs, tool } from 'ai-v5';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
  mockId,
  MockLanguageModelV2,
  mockValues,
} from 'ai-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import type { loop } from '../loop';
import type { ChunkType } from '../../stream/types';
import {
  createTestModels,
  testUsage,
  defaultSettings,
  modelWithSources,
  modelWithFiles,
  testUsage2,
  createMessageListWithUserMessage,
} from './utils';

export function optionsTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('options.abortSignal', () => {
    it('should forward abort signal to tool execution during streaming', async () => {
      const messageList = createMessageListWithUserMessage();

      const abortController = new AbortController();
      const toolExecuteMock = vi.fn().mockResolvedValue('tool result');

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: toolExecuteMock,
          },
        },
        messageList,
        options: {
          abortSignal: abortController.signal,
        },
        agentId: 'agent-id',
      });

      await convertAsyncIterableToArray(result.aisdk.v5.fullStream as any);

      abortController.abort();

      expect(toolExecuteMock).toHaveBeenCalledWith(
        { value: 'value' },
        {
          abortSignal: abortController.signal,
          toolCallId: 'call-1',
          messages: expect.any(Array),
          writableStream: expect.any(Object),
          resumeData: undefined,
          suspend: expect.any(Function),
        },
      );
    });
  });

  describe('options.onError', () => {
    it('should invoke onError', async () => {
      const messageList = createMessageListWithUserMessage();

      const result: Array<{ error: unknown }> = [];

      const resultObject = await loopFn({
        methodType: 'stream',
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
        modelSettings: {
          maxRetries: 0,
        },
        messageList,
        options: {
          onError(event) {
            result.push(event);
          },
        },
        agentId: 'agent-id',
      });

      await resultObject.aisdk.v5.consumeStream();

      expect(result).toStrictEqual([{ error: new Error('test error') }]);
    });
  });

  describe('options.providerMetadata', () => {
    it('should pass provider metadata to model', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
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
                      delta: 'provider metadata test',
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
        messageList,
        providerOptions: {
          aProvider: { someKey: 'someValue' },
        },
        agentId: 'agent-id',
      });

      expect(await convertAsyncIterableToArray(result.textStream as any)).toEqual(['provider metadata test']);
    });
  });

  describe('options.activeTools', () => {
    it('should filter available tools to only the ones in activeTools', async () => {
      const messageList = createMessageListWithUserMessage();

      let tools: (LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool)[] | undefined;

      const result = await loopFn({
        methodType: 'stream',
        runId,
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockLanguageModelV2({
              doStream: async ({ tools: toolsArg }) => {
                tools = toolsArg;

                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-start', id: '1' },
                    { type: 'text-delta', id: '1', delta: 'Hello' },
                    { type: 'text-delta', id: '1', delta: ', ' },
                    { type: 'text-delta', id: '1', delta: `world!` },
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
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result1',
          },
          tool2: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => 'result2',
          },
        },
        messageList,
        options: {
          activeTools: ['tool1'],
        },
        agentId: 'agent-id',
      });

      await result.aisdk.v5.consumeStream();

      expect(tools).toMatchInlineSnapshot(`
            [
              {
                "description": undefined,
                "inputSchema": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "additionalProperties": false,
                  "properties": {
                    "value": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "value",
                  ],
                  "type": "object",
                },
                "name": "tool1",
                "providerOptions": undefined,
                "type": "function",
              },
            ]
          `);
    });
  });

  describe('options.stopWhen', () => {
    let result: any;
    let onFinishResult: any;
    let onStepFinishResults: any[];
    let tracer: any;
    let stepInputs: Array<any>;

    beforeEach(() => {
      stepInputs = [];
    });

    describe('2 steps: initial, tool-result', () => {
      beforeEach(async () => {
        const messageList = createMessageListWithUserMessage();

        result = undefined as any;
        onFinishResult = undefined as any;
        onStepFinishResults = [];

        let responseCount = 0;
        result = await loopFn({
          methodType: 'stream',
          runId,
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async ({ prompt, tools, toolChoice }) => {
                  stepInputs.push({ prompt, tools, toolChoice });

                  switch (responseCount++) {
                    case 0: {
                      return {
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-0',
                            modelId: 'mock-model-id',
                            timestamp: new Date(0),
                          },
                          { type: 'reasoning-start', id: '0' },
                          { type: 'reasoning-delta', id: '0', delta: 'thinking' },
                          { type: 'reasoning-end', id: '0' },
                          {
                            type: 'tool-call',
                            id: 'call-1',
                            toolCallId: 'call-1',
                            toolName: 'tool1',
                            input: `{ "value": "value" }`,
                          },
                          {
                            type: 'finish',
                            finishReason: 'tool-calls',
                            usage: testUsage,
                          },
                        ]),
                        response: { headers: { call: '1' } },
                      };
                    }
                    case 1: {
                      return {
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-1',
                            modelId: 'mock-model-id',
                            timestamp: new Date(1000),
                          },
                          { type: 'text-start', id: '1' },
                          { type: 'text-delta', id: '1', delta: 'Hello, ' },
                          { type: 'text-delta', id: '1', delta: `world!` },
                          { type: 'text-end', id: '1' },
                          {
                            type: 'finish',
                            finishReason: 'stop',
                            usage: testUsage2,
                          },
                        ]),
                        response: { headers: { call: '2' } },
                      };
                    }
                    default:
                      throw new Error(`Unexpected response count: ${responseCount}`);
                  }
                },
              }),
            },
          ],
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          messageList,
          options: {
            onFinish: async event => {
              expect(onFinishResult).to.be.undefined;
              onFinishResult = event as unknown as typeof onFinishResult;
            },
            onStepFinish: async event => {
              onStepFinishResults.push(event);
            },
          },
          stopWhen: stepCountIs(3),
          _internal: {
            now: mockValues(0, 100, 500, 600, 1000),
            generateId: mockId({ prefix: 'id' }),
          },
          agentId: 'agent-id',
        });
      });

      it('should contain correct step inputs', async () => {
        await result.aisdk.v5.consumeStream();

        expect(stepInputs).toMatchInlineSnapshot(`
          [
            {
              "prompt": [
                {
                  "content": [
                    {
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolChoice": {
                "type": "auto",
              },
              "tools": [
                {
                  "description": undefined,
                  "inputSchema": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "additionalProperties": false,
                    "properties": {
                      "value": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "value",
                    ],
                    "type": "object",
                  },
                  "name": "tool1",
                  "providerOptions": undefined,
                  "type": "function",
                },
              ],
            },
            {
              "prompt": [
                {
                  "content": [
                    {
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "providerOptions": undefined,
                      "text": "thinking",
                      "type": "reasoning",
                    },
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "toolChoice": {
                "type": "auto",
              },
              "tools": [
                {
                  "description": undefined,
                  "inputSchema": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "additionalProperties": false,
                    "properties": {
                      "value": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "value",
                    ],
                    "type": "object",
                  },
                  "name": "tool1",
                  "providerOptions": undefined,
                  "type": "function",
                },
              ],
            },
          ]
        `);
      });

      it('should contain assistant response message and tool message from all steps', async () => {
        expect(await convertAsyncIterableToArray(result.aisdk.v5.fullStream)).toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "request": {},
              "type": "start-step",
              "warnings": [],
            },
            {
              "id": "0",
              "providerMetadata": undefined,
              "type": "reasoning-start",
            },
            {
              "id": "0",
              "providerMetadata": undefined,
              "text": "thinking",
              "type": "reasoning-delta",
            },
            {
              "id": "0",
              "providerMetadata": undefined,
              "type": "reasoning-end",
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
              "input": {
                "value": "value",
              },
              "output": "result1",
              "providerExecuted": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
            {
              "finishReason": "tool-calls",
              "providerMetadata": undefined,
              "response": {
                "headers": {
                  "call": "1",
                },
                "id": "id-0",
                "modelId": "mock-model-id",
                "modelMetadata": {
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
                },
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
              "usage": {
                "inputTokens": 3,
                "outputTokens": 10,
                "totalTokens": 13,
              },
            },
            {
              "request": {},
              "type": "start-step",
              "warnings": [],
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello, ",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "world!",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "type": "text-end",
            },
            {
              "finishReason": "stop",
              "providerMetadata": undefined,
              "response": {
                "headers": {
                  "call": "2",
                },
                "id": "id-1",
                "modelId": "mock-model-id",
                "modelMetadata": {
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
                },
                "timestamp": 1970-01-01T00:00:01.000Z,
              },
              "type": "finish-step",
              "usage": {
                "cachedInputTokens": 3,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": 10,
                "totalTokens": 23,
              },
            },
            {
              "finishReason": "stop",
              "totalUsage": {
                "cachedInputTokens": 3,
                "inputTokens": 6,
                "outputTokens": 20,
                "reasoningTokens": 10,
                "totalTokens": 36,
              },
              "type": "finish",
            },
          ]
        `);
      });

      describe('callbacks', () => {
        beforeEach(async () => {
          await result.aisdk.v5.consumeStream();
        });

        it.skip('onFinish should send correct information', async () => {
          expect(onFinishResult).toMatchInlineSnapshot(`
            {
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
              ],
              "dynamicToolCalls": [],
              "dynamicToolResults": [],
              "files": [],
              "finishReason": "stop",
              "providerMetadata": undefined,
              "reasoning": [],
              "reasoningText": undefined,
              "request": {},
              "response": {
                "headers": {
                  "call": "2",
                },
                "id": "id-1",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "thinking",
                        "type": "reasoning",
                      },
                      {
                        "input": {
                          "value": "value",
                        },
                        "providerExecuted": undefined,
                        "providerOptions": undefined,
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "text",
                          "value": "result1",
                        },
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Hello, world!",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:01.000Z,
              },
              "sources": [],
              "staticToolCalls": [],
              "staticToolResults": [],
              "steps": [
                DefaultStepResult {
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "thinking",
                      "type": "reasoning",
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
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "usage": {
                    "cachedInputTokens": undefined,
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "reasoningTokens": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
                DefaultStepResult {
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "Hello, world!",
                      "type": "text",
                    },
                  ],
                  "finishReason": "stop",
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "id-1",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "Hello, world!",
                            "type": "text",
                          },
                        ],
                        "role": "assistant",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "usage": {
                    "cachedInputTokens": 3,
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "reasoningTokens": 10,
                    "totalTokens": 23,
                  },
                  "warnings": [],
                },
              ],
              "text": "Hello, world!",
              "toolCalls": [],
              "toolResults": [],
              "totalUsage": {
                "cachedInputTokens": 3,
                "inputTokens": 6,
                "outputTokens": 20,
                "reasoningTokens": 10,
                "totalTokens": 36,
              },
              "usage": {
                "cachedInputTokens": 3,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": 10,
                "totalTokens": 23,
              },
              "warnings": [],
            }
          `);
        });

        it.skip('onStepFinish should send correct information', async () => {
          expect(onStepFinishResults).toMatchInlineSnapshot(`
            [
              DefaultStepResult {
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "thinking",
                    "type": "reasoning",
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
                    "input": {
                      "value": "value",
                    },
                    "output": "result1",
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "finishReason": "tool-calls",
                "providerMetadata": undefined,
                "request": {},
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "result1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "usage": {
                  "cachedInputTokens": undefined,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
              DefaultStepResult {
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "providerMetadata": undefined,
                "request": {},
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "result1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "usage": {
                  "cachedInputTokens": 3,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": 10,
                  "totalTokens": 23,
                },
                "warnings": [],
              },
            ]
          `);
        });
      });

      describe('value promises', () => {
        beforeEach(async () => {
          await result.aisdk.v5.consumeStream();
        });

        it('result.totalUsage should contain total token usage', async () => {
          expect(await result.totalUsage).toMatchInlineSnapshot(`
            {
              "cachedInputTokens": 3,
              "inputTokens": 6,
              "outputTokens": 20,
              "reasoningTokens": 10,
              "totalTokens": 36,
            }
          `);
        });

        it('result.usage should contain token usage from final step', async () => {
          expect(await result.totalUsage).toMatchInlineSnapshot(`
          {
            "cachedInputTokens": 3,
            "inputTokens": 6,
            "outputTokens": 20,
            "reasoningTokens": 10,
            "totalTokens": 36,
          }
        `);
        });

        it('result.finishReason should contain finish reason from final step', async () => {
          expect(await result.finishReason).toBe('stop');
        });

        it('result.text should contain text from final step', async () => {
          expect(await result.text).toBe('Hello, world!');
        });

        it.skip('result.steps should contain all steps', async () => {
          expect(await result.steps).toMatchInlineSnapshot(`
            [
              DefaultStepResult {
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "thinking",
                    "type": "reasoning",
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
                    "input": {
                      "value": "value",
                    },
                    "output": "result1",
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "finishReason": "tool-calls",
                "providerMetadata": undefined,
                "request": {},
                "response": {
                  "headers": {
                    "call": "1",
                  },
                  "id": "id-0",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "result1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "usage": {
                  "cachedInputTokens": undefined,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": undefined,
                  "totalTokens": 13,
                },
                "warnings": [],
              },
              DefaultStepResult {
                "content": [
                  {
                    "providerMetadata": undefined,
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "finishReason": "stop",
                "providerMetadata": undefined,
                "request": {},
                "response": {
                  "headers": {
                    "call": "2",
                  },
                  "id": "id-1",
                  "messages": [
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "thinking",
                          "type": "reasoning",
                        },
                        {
                          "input": {
                            "value": "value",
                          },
                          "providerExecuted": undefined,
                          "providerOptions": undefined,
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-call",
                        },
                      ],
                      "role": "assistant",
                    },
                    {
                      "content": [
                        {
                          "output": {
                            "type": "text",
                            "value": "result1",
                          },
                          "toolCallId": "call-1",
                          "toolName": "tool1",
                          "type": "tool-result",
                        },
                      ],
                      "role": "tool",
                    },
                    {
                      "content": [
                        {
                          "providerOptions": undefined,
                          "text": "Hello, world!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:01.000Z,
                },
                "usage": {
                  "cachedInputTokens": 3,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": 10,
                  "totalTokens": 23,
                },
                "warnings": [],
              },
            ]
          `);
        });

        it('result.response.messages should contain response messages from all steps', async () => {
          expect((await result.response).messages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "providerOptions": undefined,
                    "text": "thinking",
                    "type": "reasoning",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "result1",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
              {
                "content": [
                  {
                    "text": "Hello, world!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
        });
      });

      it('should have correct ui message stream', async () => {
        expect(await convertReadableStreamToArray(result.aisdk.v5.toUIMessageStream())).toMatchInlineSnapshot(`
          [
            {
              "messageId": "id-0",
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "0",
              "type": "reasoning-start",
            },
            {
              "delta": "thinking",
              "id": "0",
              "type": "reasoning-delta",
            },
            {
              "id": "0",
              "type": "reasoning-end",
            },
            {
              "input": {
                "value": "value",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-input-available",
            },
            {
              "output": "result1",
              "toolCallId": "call-1",
              "type": "tool-output-available",
            },
            {
              "type": "finish-step",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello, ",
              "id": "1",
              "type": "text-delta",
            },
            {
              "delta": "world!",
              "id": "1",
              "type": "text-delta",
            },
            {
              "id": "1",
              "type": "text-end",
            },
            {
              "type": "finish-step",
            },
            {
              "type": "finish",
            },
          ]
        `);
      });
    });

    describe('2 steps: initial, tool-result with prepareStep', () => {
      let result: any;
      let doStreamCalls: Array<LanguageModelV2CallOptions>;
      let prepareStepCalls: Array<{
        stepNumber: number;
        steps: Array<any>;
        messages: Array<any>;
      }>;

      beforeEach(async () => {
        const messageList = createMessageListWithUserMessage();

        doStreamCalls = [];
        prepareStepCalls = [];

        result = await loopFn({
          methodType: 'stream',
          runId,
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async options => {
                  doStreamCalls.push(options);
                  switch (doStreamCalls.length) {
                    case 1:
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
                          },
                          {
                            type: 'finish',
                            finishReason: 'tool-calls',
                            usage: testUsage,
                          },
                        ]),
                        response: { headers: { call: '1' } },
                      };
                    case 2:
                      return {
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-1',
                            modelId: 'mock-model-id',
                            timestamp: new Date(1000),
                          },
                          { type: 'text-start', id: '2' },
                          { type: 'text-delta', id: '2', delta: 'Hello, ' },
                          { type: 'text-delta', id: '2', delta: `world!` },
                          { type: 'text-end', id: '2' },
                          {
                            type: 'finish',
                            finishReason: 'stop',
                            usage: testUsage2,
                          },
                        ]),
                        response: { headers: { call: '2' } },
                      };
                    default:
                      throw new Error(`Unexpected response count: ${doStreamCalls.length}`);
                  }
                },
              }),
            },
          ],
          agentId: 'agent-id',
          tools: {
            tool1: tool({
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            }),
          },
          messageList,
          stopWhen: stepCountIs(3),
          options: {
            prepareStep: async ({ stepNumber, steps, messages }) => {
              prepareStepCalls.push({ stepNumber, steps, messages });

              if (stepNumber === 0) {
                return {
                  toolChoice: {
                    type: 'tool',
                    toolName: 'tool1' as const,
                  },
                  system: 'system-message-0',
                  messages: [
                    {
                      role: 'user',
                      content: 'new input from prepareStep',
                    },
                  ],
                };
              }

              if (stepNumber === 1) {
                return {
                  activeTools: [],
                  system: 'system-message-1',
                };
              }
            },
          },
        });
      });

      it.skip('should contain all doStream calls', async () => {
        await result.aisdk.v5.consumeStream();
        expect(doStreamCalls).toMatchInlineSnapshot(`
          [
            {
              "abortSignal": undefined,
              "frequencyPenalty": undefined,
              "headers": undefined,
              "includeRawChunks": false,
              "maxOutputTokens": undefined,
              "presencePenalty": undefined,
              "prompt": [
                {
                  "content": "system-message-0",
                  "role": "system",
                },
                {
                  "content": [
                    {
                      "text": "new input from prepareStep",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
              ],
              "providerOptions": undefined,
              "responseFormat": undefined,
              "seed": undefined,
              "stopSequences": undefined,
              "temperature": undefined,
              "toolChoice": {
                "toolName": "tool1",
                "type": "tool",
              },
              "tools": [
                {
                  "description": undefined,
                  "inputSchema": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "additionalProperties": false,
                    "properties": {
                      "value": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "value",
                    ],
                    "type": "object",
                  },
                  "name": "tool1",
                  "providerOptions": undefined,
                  "type": "function",
                },
              ],
              "topK": undefined,
              "topP": undefined,
            },
            {
              "abortSignal": undefined,
              "frequencyPenalty": undefined,
              "headers": undefined,
              "includeRawChunks": false,
              "maxOutputTokens": undefined,
              "presencePenalty": undefined,
              "prompt": [
                {
                  "content": "system-message-1",
                  "role": "system",
                },
                {
                  "content": [
                    {
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "providerOptions": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "providerOptions": undefined,
                  "role": "tool",
                },
              ],
              "providerOptions": undefined,
              "responseFormat": undefined,
              "seed": undefined,
              "stopSequences": undefined,
              "temperature": undefined,
              "toolChoice": {
                "type": "auto",
              },
              "tools": [],
              "topK": undefined,
              "topP": undefined,
            },
          ]
        `);
      });

      it('should contain all prepareStep calls', async () => {
        await result.consumeStream();
        expect(prepareStepCalls).toMatchInlineSnapshot(`
          [
            {
              "messages": [
                {
                  "content": [
                    {
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "stepNumber": 0,
              "steps": [
                DefaultStepResult {
                  "content": [],
                  "finishReason": undefined,
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "usage": {
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
                DefaultStepResult {
                  "content": [],
                  "finishReason": undefined,
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "id-1",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
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
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "usage": {
                    "cachedInputTokens": 3,
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "reasoningTokens": 10,
                    "totalTokens": 23,
                  },
                  "warnings": [],
                },
              ],
            },
            {
              "messages": [
                {
                  "content": [
                    {
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
                {
                  "content": [
                    {
                      "input": {
                        "value": "value",
                      },
                      "providerExecuted": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-call",
                    },
                  ],
                  "role": "assistant",
                },
                {
                  "content": [
                    {
                      "output": {
                        "type": "text",
                        "value": "result1",
                      },
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "role": "tool",
                },
              ],
              "stepNumber": 1,
              "steps": [
                DefaultStepResult {
                  "content": [],
                  "finishReason": undefined,
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "usage": {
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
                DefaultStepResult {
                  "content": [],
                  "finishReason": undefined,
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "2",
                    },
                    "id": "id-1",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
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
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:01.000Z,
                  },
                  "usage": {
                    "cachedInputTokens": 3,
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "reasoningTokens": 10,
                    "totalTokens": 23,
                  },
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });
    });

    // describe.skip('2 steps: initial, tool-result with transformed tool results', () => {
    //   const upperCaseToolResultTransform = () =>
    //     new TransformStream<TextStreamPart<{ tool1: any }>, TextStreamPart<{ tool1: any }>>({
    //       transform(chunk, controller) {
    //         if (chunk.type === 'tool-result' && !chunk.dynamic) {
    //           chunk.output = chunk.output.toUpperCase();
    //           chunk.input = {
    //             ...chunk.input,
    //             value: chunk.input.value.toUpperCase(),
    //           };
    //         }

    //         controller.enqueue(chunk);
    //       },
    //     });

    //   beforeEach(async () => {
    //     result = undefined as any;
    //     onFinishResult = undefined as any;
    //     onStepFinishResults = [];

    //     let responseCount = 0;
    //     result = await loopFn({
    //   methodType: 'stream',
    //       runId,
    //       model: new MockLanguageModelV2({
    //         doStream: async ({ prompt, tools, toolChoice }) => {
    //           switch (responseCount++) {
    //             case 0: {
    //               return {
    //                 stream: convertArrayToReadableStream([
    //                   {
    //                     type: 'response-metadata',
    //                     id: 'id-0',
    //                     modelId: 'mock-model-id',
    //                     timestamp: new Date(0),
    //                   },
    //                   { type: 'reasoning-start', id: 'id-0' },
    //                   {
    //                     type: 'reasoning-delta',
    //                     id: 'id-0',
    //                     delta: 'thinking',
    //                   },
    //                   { type: 'reasoning-end', id: 'id-0' },
    //                   {
    //                     type: 'tool-call',
    //                     toolCallId: 'call-1',
    //                     toolName: 'tool1',
    //                     input: `{ "value": "value" }`,
    //                   },
    //                   {
    //                     type: 'finish',
    //                     finishReason: 'tool-calls',
    //                     usage: testUsage,
    //                   },
    //                 ]),
    //                 response: { headers: { call: '1' } },
    //               };
    //             }
    //             case 1: {
    //               return {
    //                 stream: convertArrayToReadableStream([
    //                   {
    //                     type: 'response-metadata',
    //                     id: 'id-1',
    //                     modelId: 'mock-model-id',
    //                     timestamp: new Date(1000),
    //                   },
    //                   { type: 'text-start', id: '1' },
    //                   { type: 'text-delta', id: '1', delta: 'Hello, ' },
    //                   { type: 'text-delta', id: '1', delta: `world!` },
    //                   { type: 'text-end', id: '1' },
    //                   {
    //                     type: 'finish',
    //                     finishReason: 'stop',
    //                     usage: testUsage2,
    //                   },
    //                 ]),
    //                 response: { headers: { call: '2' } },
    //               };
    //             }
    //             default:
    //               throw new Error(`Unexpected response count: ${responseCount}`);
    //           }
    //         },
    //       }),
    //       tools: {
    //         tool1: {
    //           inputSchema: z.object({ value: z.string() }),
    //           execute: async () => 'result1',
    //         },
    //       },
    //       experimental_transform: upperCaseToolResultTransform,
    //       prompt: 'test-input',
    //       onFinish: async event => {
    //         expect(onFinishResult).to.be.undefined;
    //         onFinishResult = event as unknown as typeof onFinishResult;
    //       },
    //       onStepFinish: async event => {
    //         onStepFinishResults.push(event);
    //       },
    //       stopWhen: stepCountIs(3),
    //       _internal: {
    //         now: mockValues(0, 100, 500, 600, 1000),
    //         generateId: mockId({ prefix: 'id' }),
    //       },
    //     });
    //   });

    //   it('should contain assistant response message and tool message from all steps', async () => {
    //     expect(await convertAsyncIterableToArray(result.fullStream)).toMatchInlineSnapshot(`
    //         [
    //           {
    //             "type": "start",
    //           },
    //           {
    //             "request": {},
    //             "type": "start-step",
    //             "warnings": [],
    //           },
    //           {
    //             "id": "id-0",
    //             "type": "reasoning-start",
    //           },
    //           {
    //             "id": "id-0",
    //             "providerMetadata": undefined,
    //             "text": "thinking",
    //             "type": "reasoning-delta",
    //           },
    //           {
    //             "id": "id-0",
    //             "type": "reasoning-end",
    //           },
    //           {
    //             "input": {
    //               "value": "value",
    //             },
    //             "providerExecuted": undefined,
    //             "providerMetadata": undefined,
    //             "toolCallId": "call-1",
    //             "toolName": "tool1",
    //             "type": "tool-call",
    //           },
    //           {
    //             "input": {
    //               "value": "VALUE",
    //             },
    //             "output": "RESULT1",
    //             "providerExecuted": undefined,
    //             "providerMetadata": undefined,
    //             "toolCallId": "call-1",
    //             "toolName": "tool1",
    //             "type": "tool-result",
    //           },
    //           {
    //             "finishReason": "tool-calls",
    //             "providerMetadata": undefined,
    //             "response": {
    //               "headers": {
    //                 "call": "1",
    //               },
    //               "id": "id-0",
    //               "modelId": "mock-model-id",
    //               "timestamp": 1970-01-01T00:00:00.000Z,
    //             },
    //             "type": "finish-step",
    //             "usage": {
    //               "cachedInputTokens": undefined,
    //               "inputTokens": 3,
    //               "outputTokens": 10,
    //               "reasoningTokens": undefined,
    //               "totalTokens": 13,
    //             },
    //           },
    //           {
    //             "request": {},
    //             "type": "start-step",
    //             "warnings": [],
    //           },
    //           {
    //             "id": "1",
    //             "type": "text-start",
    //           },
    //           {
    //             "id": "1",
    //             "providerMetadata": undefined,
    //             "text": "Hello, ",
    //             "type": "text-delta",
    //           },
    //           {
    //             "id": "1",
    //             "providerMetadata": undefined,
    //             "text": "world!",
    //             "type": "text-delta",
    //           },
    //           {
    //             "id": "1",
    //             "type": "text-end",
    //           },
    //           {
    //             "finishReason": "stop",
    //             "providerMetadata": undefined,
    //             "response": {
    //               "headers": {
    //                 "call": "2",
    //               },
    //               "id": "id-1",
    //               "modelId": "mock-model-id",
    //               "timestamp": 1970-01-01T00:00:01.000Z,
    //             },
    //             "type": "finish-step",
    //             "usage": {
    //               "cachedInputTokens": 3,
    //               "inputTokens": 3,
    //               "outputTokens": 10,
    //               "reasoningTokens": 10,
    //               "totalTokens": 23,
    //             },
    //           },
    //           {
    //             "finishReason": "stop",
    //             "totalUsage": {
    //               "cachedInputTokens": 3,
    //               "inputTokens": 6,
    //               "outputTokens": 20,
    //               "reasoningTokens": 10,
    //               "totalTokens": 36,
    //             },
    //             "type": "finish",
    //           },
    //         ]
    //       `);
    //   });

    //   describe('callbacks', () => {
    //     beforeEach(async () => {
    //       await result.consumeStream();
    //     });

    //     it('onFinish should send correct information', async () => {
    //       expect(onFinishResult).toMatchInlineSnapshot(`
    //         {
    //           "content": [
    //             {
    //               "providerMetadata": undefined,
    //               "text": "Hello, world!",
    //               "type": "text",
    //             },
    //           ],
    //           "dynamicToolCalls": [],
    //           "dynamicToolResults": [],
    //           "files": [],
    //           "finishReason": "stop",
    //           "providerMetadata": undefined,
    //           "reasoning": [],
    //           "reasoningText": undefined,
    //           "request": {},
    //           "response": {
    //             "headers": {
    //               "call": "2",
    //             },
    //             "id": "id-1",
    //             "messages": [
    //               {
    //                 "content": [
    //                   {
    //                     "providerOptions": undefined,
    //                     "text": "thinking",
    //                     "type": "reasoning",
    //                   },
    //                   {
    //                     "input": {
    //                       "value": "value",
    //                     },
    //                     "providerExecuted": undefined,
    //                     "providerOptions": undefined,
    //                     "toolCallId": "call-1",
    //                     "toolName": "tool1",
    //                     "type": "tool-call",
    //                   },
    //                 ],
    //                 "role": "assistant",
    //               },
    //               {
    //                 "content": [
    //                   {
    //                     "output": {
    //                       "type": "text",
    //                       "value": "RESULT1",
    //                     },
    //                     "toolCallId": "call-1",
    //                     "toolName": "tool1",
    //                     "type": "tool-result",
    //                   },
    //                 ],
    //                 "role": "tool",
    //               },
    //               {
    //                 "content": [
    //                   {
    //                     "providerOptions": undefined,
    //                     "text": "Hello, world!",
    //                     "type": "text",
    //                   },
    //                 ],
    //                 "role": "assistant",
    //               },
    //             ],
    //             "modelId": "mock-model-id",
    //             "timestamp": 1970-01-01T00:00:01.000Z,
    //           },
    //           "sources": [],
    //           "staticToolCalls": [],
    //           "staticToolResults": [],
    //           "steps": [
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "providerMetadata": undefined,
    //                   "text": "thinking",
    //                   "type": "reasoning",
    //                 },
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
    //                   "input": {
    //                     "value": "VALUE",
    //                   },
    //                   "output": "RESULT1",
    //                   "providerExecuted": undefined,
    //                   "providerMetadata": undefined,
    //                   "toolCallId": "call-1",
    //                   "toolName": "tool1",
    //                   "type": "tool-result",
    //                 },
    //               ],
    //               "finishReason": "tool-calls",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "headers": {
    //                   "call": "1",
    //                 },
    //                 "id": "id-0",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "providerOptions": undefined,
    //                         "text": "thinking",
    //                         "type": "reasoning",
    //                       },
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
    //                           "value": "RESULT1",
    //                         },
    //                         "toolCallId": "call-1",
    //                         "toolName": "tool1",
    //                         "type": "tool-result",
    //                       },
    //                     ],
    //                     "role": "tool",
    //                   },
    //                 ],
    //                 "modelId": "mock-model-id",
    //                 "timestamp": 1970-01-01T00:00:00.000Z,
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
    //             DefaultStepResult {
    //               "content": [
    //                 {
    //                   "providerMetadata": undefined,
    //                   "text": "Hello, world!",
    //                   "type": "text",
    //                 },
    //               ],
    //               "finishReason": "stop",
    //               "providerMetadata": undefined,
    //               "request": {},
    //               "response": {
    //                 "headers": {
    //                   "call": "2",
    //                 },
    //                 "id": "id-1",
    //                 "messages": [
    //                   {
    //                     "content": [
    //                       {
    //                         "providerOptions": undefined,
    //                         "text": "thinking",
    //                         "type": "reasoning",
    //                       },
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
    //                           "value": "RESULT1",
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
    //                 "modelId": "mock-model-id",
    //                 "timestamp": 1970-01-01T00:00:01.000Z,
    //               },
    //               "usage": {
    //                 "cachedInputTokens": 3,
    //                 "inputTokens": 3,
    //                 "outputTokens": 10,
    //                 "reasoningTokens": 10,
    //                 "totalTokens": 23,
    //               },
    //               "warnings": [],
    //             },
    //           ],
    //           "text": "Hello, world!",
    //           "toolCalls": [],
    //           "toolResults": [],
    //           "totalUsage": {
    //             "cachedInputTokens": 3,
    //             "inputTokens": 6,
    //             "outputTokens": 20,
    //             "reasoningTokens": 10,
    //             "totalTokens": 36,
    //           },
    //           "usage": {
    //             "cachedInputTokens": 3,
    //             "inputTokens": 3,
    //             "outputTokens": 10,
    //             "reasoningTokens": 10,
    //             "totalTokens": 23,
    //           },
    //           "warnings": [],
    //         }
    //       `);
    //     });

    //     it('onStepFinish should send correct information', async () => {
    //       expect(onStepFinishResults).toMatchInlineSnapshot(`
    //         [
    //           DefaultStepResult {
    //             "content": [
    //               {
    //                 "providerMetadata": undefined,
    //                 "text": "thinking",
    //                 "type": "reasoning",
    //               },
    //               {
    //                 "input": {
    //                   "value": "value",
    //                 },
    //                 "providerExecuted": undefined,
    //                 "providerMetadata": undefined,
    //                 "toolCallId": "call-1",
    //                 "toolName": "tool1",
    //                 "type": "tool-call",
    //               },
    //               {
    //                 "input": {
    //                   "value": "VALUE",
    //                 },
    //                 "output": "RESULT1",
    //                 "providerExecuted": undefined,
    //                 "providerMetadata": undefined,
    //                 "toolCallId": "call-1",
    //                 "toolName": "tool1",
    //                 "type": "tool-result",
    //               },
    //             ],
    //             "finishReason": "tool-calls",
    //             "providerMetadata": undefined,
    //             "request": {},
    //             "response": {
    //               "headers": {
    //                 "call": "1",
    //               },
    //               "id": "id-0",
    //               "messages": [
    //                 {
    //                   "content": [
    //                     {
    //                       "providerOptions": undefined,
    //                       "text": "thinking",
    //                       "type": "reasoning",
    //                     },
    //                     {
    //                       "input": {
    //                         "value": "value",
    //                       },
    //                       "providerExecuted": undefined,
    //                       "providerOptions": undefined,
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-call",
    //                     },
    //                   ],
    //                   "role": "assistant",
    //                 },
    //                 {
    //                   "content": [
    //                     {
    //                       "output": {
    //                         "type": "text",
    //                         "value": "RESULT1",
    //                       },
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-result",
    //                     },
    //                   ],
    //                   "role": "tool",
    //                 },
    //               ],
    //               "modelId": "mock-model-id",
    //               "timestamp": 1970-01-01T00:00:00.000Z,
    //             },
    //             "usage": {
    //               "cachedInputTokens": undefined,
    //               "inputTokens": 3,
    //               "outputTokens": 10,
    //               "reasoningTokens": undefined,
    //               "totalTokens": 13,
    //             },
    //             "warnings": [],
    //           },
    //           DefaultStepResult {
    //             "content": [
    //               {
    //                 "providerMetadata": undefined,
    //                 "text": "Hello, world!",
    //                 "type": "text",
    //               },
    //             ],
    //             "finishReason": "stop",
    //             "providerMetadata": undefined,
    //             "request": {},
    //             "response": {
    //               "headers": {
    //                 "call": "2",
    //               },
    //               "id": "id-1",
    //               "messages": [
    //                 {
    //                   "content": [
    //                     {
    //                       "providerOptions": undefined,
    //                       "text": "thinking",
    //                       "type": "reasoning",
    //                     },
    //                     {
    //                       "input": {
    //                         "value": "value",
    //                       },
    //                       "providerExecuted": undefined,
    //                       "providerOptions": undefined,
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-call",
    //                     },
    //                   ],
    //                   "role": "assistant",
    //                 },
    //                 {
    //                   "content": [
    //                     {
    //                       "output": {
    //                         "type": "text",
    //                         "value": "RESULT1",
    //                       },
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-result",
    //                     },
    //                   ],
    //                   "role": "tool",
    //                 },
    //                 {
    //                   "content": [
    //                     {
    //                       "providerOptions": undefined,
    //                       "text": "Hello, world!",
    //                       "type": "text",
    //                     },
    //                   ],
    //                   "role": "assistant",
    //                 },
    //               ],
    //               "modelId": "mock-model-id",
    //               "timestamp": 1970-01-01T00:00:01.000Z,
    //             },
    //             "usage": {
    //               "cachedInputTokens": 3,
    //               "inputTokens": 3,
    //               "outputTokens": 10,
    //               "reasoningTokens": 10,
    //               "totalTokens": 23,
    //             },
    //             "warnings": [],
    //           },
    //         ]
    //       `);
    //     });
    //   });

    //   describe('value promises', () => {
    //     beforeEach(async () => {
    //       await result.consumeStream();
    //     });

    //     it('result.totalUsage should contain total token usage', async () => {
    //       expect(await result.totalUsage).toMatchInlineSnapshot(`
    //         {
    //           "cachedInputTokens": 3,
    //           "inputTokens": 6,
    //           "outputTokens": 20,
    //           "reasoningTokens": 10,
    //           "totalTokens": 36,
    //         }
    //       `);
    //     });

    //     it('result.usage should contain token usage from final step', async () => {
    //       expect(await result.totalUsage).toMatchInlineSnapshot(`
    //       {
    //         "cachedInputTokens": 3,
    //         "inputTokens": 6,
    //         "outputTokens": 20,
    //         "reasoningTokens": 10,
    //         "totalTokens": 36,
    //       }
    //     `);
    //     });

    //     it('result.finishReason should contain finish reason from final step', async () => {
    //       assert.strictEqual(await result.finishReason, 'stop');
    //     });

    //     it('result.text should contain text from final step', async () => {
    //       assert.strictEqual(await result.text, 'Hello, world!');
    //     });

    //     it('result.steps should contain all steps', async () => {
    //       expect(await result.steps).toMatchInlineSnapshot(`
    //         [
    //           DefaultStepResult {
    //             "content": [
    //               {
    //                 "providerMetadata": undefined,
    //                 "text": "thinking",
    //                 "type": "reasoning",
    //               },
    //               {
    //                 "input": {
    //                   "value": "value",
    //                 },
    //                 "providerExecuted": undefined,
    //                 "providerMetadata": undefined,
    //                 "toolCallId": "call-1",
    //                 "toolName": "tool1",
    //                 "type": "tool-call",
    //               },
    //               {
    //                 "input": {
    //                   "value": "VALUE",
    //                 },
    //                 "output": "RESULT1",
    //                 "providerExecuted": undefined,
    //                 "providerMetadata": undefined,
    //                 "toolCallId": "call-1",
    //                 "toolName": "tool1",
    //                 "type": "tool-result",
    //               },
    //             ],
    //             "finishReason": "tool-calls",
    //             "providerMetadata": undefined,
    //             "request": {},
    //             "response": {
    //               "headers": {
    //                 "call": "1",
    //               },
    //               "id": "id-0",
    //               "messages": [
    //                 {
    //                   "content": [
    //                     {
    //                       "providerOptions": undefined,
    //                       "text": "thinking",
    //                       "type": "reasoning",
    //                     },
    //                     {
    //                       "input": {
    //                         "value": "value",
    //                       },
    //                       "providerExecuted": undefined,
    //                       "providerOptions": undefined,
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-call",
    //                     },
    //                   ],
    //                   "role": "assistant",
    //                 },
    //                 {
    //                   "content": [
    //                     {
    //                       "output": {
    //                         "type": "text",
    //                         "value": "RESULT1",
    //                       },
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-result",
    //                     },
    //                   ],
    //                   "role": "tool",
    //                 },
    //               ],
    //               "modelId": "mock-model-id",
    //               "timestamp": 1970-01-01T00:00:00.000Z,
    //             },
    //             "usage": {
    //               "cachedInputTokens": undefined,
    //               "inputTokens": 3,
    //               "outputTokens": 10,
    //               "reasoningTokens": undefined,
    //               "totalTokens": 13,
    //             },
    //             "warnings": [],
    //           },
    //           DefaultStepResult {
    //             "content": [
    //               {
    //                 "providerMetadata": undefined,
    //                 "text": "Hello, world!",
    //                 "type": "text",
    //               },
    //             ],
    //             "finishReason": "stop",
    //             "providerMetadata": undefined,
    //             "request": {},
    //             "response": {
    //               "headers": {
    //                 "call": "2",
    //               },
    //               "id": "id-1",
    //               "messages": [
    //                 {
    //                   "content": [
    //                     {
    //                       "providerOptions": undefined,
    //                       "text": "thinking",
    //                       "type": "reasoning",
    //                     },
    //                     {
    //                       "input": {
    //                         "value": "value",
    //                       },
    //                       "providerExecuted": undefined,
    //                       "providerOptions": undefined,
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-call",
    //                     },
    //                   ],
    //                   "role": "assistant",
    //                 },
    //                 {
    //                   "content": [
    //                     {
    //                       "output": {
    //                         "type": "text",
    //                         "value": "RESULT1",
    //                       },
    //                       "toolCallId": "call-1",
    //                       "toolName": "tool1",
    //                       "type": "tool-result",
    //                     },
    //                   ],
    //                   "role": "tool",
    //                 },
    //                 {
    //                   "content": [
    //                     {
    //                       "providerOptions": undefined,
    //                       "text": "Hello, world!",
    //                       "type": "text",
    //                     },
    //                   ],
    //                   "role": "assistant",
    //                 },
    //               ],
    //               "modelId": "mock-model-id",
    //               "timestamp": 1970-01-01T00:00:01.000Z,
    //             },
    //             "usage": {
    //               "cachedInputTokens": 3,
    //               "inputTokens": 3,
    //               "outputTokens": 10,
    //               "reasoningTokens": 10,
    //               "totalTokens": 23,
    //             },
    //             "warnings": [],
    //           },
    //         ]
    //       `);
    //     });

    //     it('result.response.messages should contain response messages from all steps', async () => {
    //       expect((await result.response).messages).toMatchInlineSnapshot(`
    //         [
    //           {
    //             "content": [
    //               {
    //                 "providerOptions": undefined,
    //                 "text": "thinking",
    //                 "type": "reasoning",
    //               },
    //               {
    //                 "input": {
    //                   "value": "value",
    //                 },
    //                 "providerExecuted": undefined,
    //                 "providerOptions": undefined,
    //                 "toolCallId": "call-1",
    //                 "toolName": "tool1",
    //                 "type": "tool-call",
    //               },
    //             ],
    //             "role": "assistant",
    //           },
    //           {
    //             "content": [
    //               {
    //                 "output": {
    //                   "type": "text",
    //                   "value": "RESULT1",
    //                 },
    //                 "toolCallId": "call-1",
    //                 "toolName": "tool1",
    //                 "type": "tool-result",
    //               },
    //             ],
    //             "role": "tool",
    //           },
    //           {
    //             "content": [
    //               {
    //                 "providerOptions": undefined,
    //                 "text": "Hello, world!",
    //                 "type": "text",
    //               },
    //             ],
    //             "role": "assistant",
    //           },
    //         ]
    //       `);
    //     });
    //   });

    //   it('should have correct ui message stream', async () => {
    //     expect(await convertReadableStreamToArray(result.toUIMessageStream())).toMatchInlineSnapshot(`
    //         [
    //           {
    //             "type": "start",
    //           },
    //           {
    //             "type": "start-step",
    //           },
    //           {
    //             "id": "id-0",
    //             "type": "reasoning-start",
    //           },
    //           {
    //             "delta": "thinking",
    //             "id": "id-0",
    //             "type": "reasoning-delta",
    //           },
    //           {
    //             "id": "id-0",
    //             "type": "reasoning-end",
    //           },
    //           {
    //             "input": {
    //               "value": "value",
    //             },
    //             "toolCallId": "call-1",
    //             "toolName": "tool1",
    //             "type": "tool-input-available",
    //           },
    //           {
    //             "output": "RESULT1",
    //             "toolCallId": "call-1",
    //             "type": "tool-output-available",
    //           },
    //           {
    //             "type": "finish-step",
    //           },
    //           {
    //             "type": "start-step",
    //           },
    //           {
    //             "id": "1",
    //             "type": "text-start",
    //           },
    //           {
    //             "delta": "Hello, ",
    //             "id": "1",
    //             "type": "text-delta",
    //           },
    //           {
    //             "delta": "world!",
    //             "id": "1",
    //             "type": "text-delta",
    //           },
    //           {
    //             "id": "1",
    //             "type": "text-end",
    //           },
    //           {
    //             "type": "finish-step",
    //           },
    //           {
    //             "type": "finish",
    //           },
    //         ]
    //       `);
    //   });
    // });

    describe('2 stop conditions', () => {
      let stopConditionCalls: Array<{
        number: number;
        steps: any[];
      }>;

      beforeEach(async () => {
        const messageList = createMessageListWithUserMessage();

        stopConditionCalls = [];

        let responseCount = 0;
        result = await loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => {
                  switch (responseCount++) {
                    case 0: {
                      return {
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-0',
                            modelId: 'mock-model-id',
                            timestamp: new Date(0),
                          },
                          {
                            type: 'reasoning-start',
                            id: 'id-0',
                          },
                          {
                            type: 'reasoning-delta',
                            id: 'id-0',
                            delta: 'thinking',
                          },
                          {
                            type: 'reasoning-end',
                            id: 'id-0',
                          },
                          {
                            type: 'tool-call',
                            id: 'call-1',
                            toolCallId: 'call-1',
                            toolName: 'tool1',
                            input: `{ "value": "value" }`,
                          },
                          {
                            type: 'finish',
                            finishReason: 'tool-calls',
                            usage: testUsage,
                          },
                        ]),
                        response: { headers: { call: '1' } },
                      };
                    }
                    default:
                      throw new Error(`Unexpected response count: ${responseCount}`);
                  }
                },
              }),
            },
          ],
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          messageList,
          stopWhen: [
            ({ steps }) => {
              stopConditionCalls.push({ number: 0, steps });
              return false;
            },
            ({ steps }) => {
              stopConditionCalls.push({ number: 1, steps });
              return true;
            },
          ],
          _internal: {
            now: mockValues(0, 100, 500, 600, 1000),
          },
        });
      });

      it('result.steps should contain a single step', async () => {
        await result.aisdk.v5.consumeStream();
        expect((await result.steps).length).toStrictEqual(1);
      });

      it.skip('stopConditionCalls should be called for each stop condition', async () => {
        await result.aisdk.v5.consumeStream();
        expect(stopConditionCalls).toMatchInlineSnapshot(`
          [
            {
              "number": 0,
              "steps": [
                DefaultStepResult {
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "thinking",
                      "type": "reasoning",
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
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "usage": {
                    "cachedInputTokens": undefined,
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "reasoningTokens": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
            },
            {
              "number": 1,
              "steps": [
                DefaultStepResult {
                  "content": [
                    {
                      "providerMetadata": undefined,
                      "text": "thinking",
                      "type": "reasoning",
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
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": {
                      "call": "1",
                    },
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "providerOptions": undefined,
                            "text": "thinking",
                            "type": "reasoning",
                          },
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "usage": {
                    "cachedInputTokens": undefined,
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "reasoningTokens": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });
    });
  });

  describe('options.onFinish', () => {
    it.todo('should send correct information', async () => {
      const messageList = createMessageListWithUserMessage();

      let result!: any;

      const resultObject = await loopFn({
        methodType: 'stream',
        runId,
        messageList,
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: ', ' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            { type: 'text-delta', id: '1', delta: `world!` },
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
          response: { headers: { call: '2' } },
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        options: {
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
        },
        ...defaultSettings(),
      });

      await resultObject.aisdk.v5.consumeStream();

      console.log('test_result', JSON.stringify(result, null, 2));

      expect(result).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "Hello, world!",
              "type": "text",
            },
            {
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-call",
              "input": {
                "value": "value",
              },
            },
            {
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
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
          "reasoningText": undefined,
          "request": {},
          "response": {
            "headers": {
              "call": "2",
            },
            "id": "id-0",
            "messages": [
              {
                "content": [
                  {
                    "text": "Hello, world!",
                    "type": "text",
                  },
                  {
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-call",
                  },
                ],
                "role": "assistant",
              },
              {
                "content": [
                  {
                    "output": {
                      "type": "text",
                      "value": "value-result",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ],
            "modelId": "mock-model-id",
            "timestamp": 1970-01-01T00:00:00.000Z,
          },
          "sources": [],
          "staticToolCalls": [],
          "staticToolResults": [],
          "steps": [
            DefaultStepResult {
              "content": [
                {
                  "text": "Hello, world!",
                  "type": "text",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "providerExecuted": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-call",
                },
                {
                  "input": {
                    "value": "value",
                  },
                  "output": "value-result",
                  "providerExecuted": undefined,
                  "toolCallId": "call-1",
                  "toolName": "tool1",
                  "type": "tool-result",
                },
              ],
              "finishReason": "stop",
              "providerMetadata": {
                "testProvider": {
                  "testKey": "testValue",
                },
              },
              "request": {},
              "response": {
                "headers": {
                  "call": "2",
                },
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "text": "Hello, world!",
                        "type": "text",
                      },
                      {
                        "input": {
                          "value": "value",
                        },
                        "providerExecuted": undefined,
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-call",
                      },
                    ],
                    "role": "assistant",
                  },
                  {
                    "content": [
                      {
                        "output": {
                          "type": "text",
                          "value": "value-result",
                        },
                        "toolCallId": "call-1",
                        "toolName": "tool1",
                        "type": "tool-result",
                      },
                    ],
                    "role": "tool",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "usage": {
                "cachedInputTokens": undefined,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": undefined,
                "totalTokens": 13,
              },
              "warnings": [],
            },
          ],
          "text": "Hello, world!",
          "toolCalls": [
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
          ],
          "toolResults": [
            {
              "input": {
                "value": "value",
              },
              "output": "value-result",
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
          ],
          "totalUsage": {
            "cachedInputTokens": undefined,
            "inputTokens": 3,
            "outputTokens": 10,
            "reasoningTokens": undefined,
            "totalTokens": 13,
          },
          "usage": {
            "cachedInputTokens": undefined,
            "inputTokens": 3,
            "outputTokens": 10,
            "reasoningTokens": undefined,
            "totalTokens": 13,
          },
          "warnings": [],
        }
      `);
    });

    it.todo('should send sources', async () => {
      const messageList = createMessageListWithUserMessage();
      let result!: any;

      const resultObject = await loopFn({
        methodType: 'stream',
        runId,
        messageList,
        models: [{ id: 'test-model', maxRetries: 0, model: modelWithSources }],
        options: {
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
        },
        ...defaultSettings(),
      });

      await resultObject.aisdk.v5.consumeStream();

      expect(result).toMatchInlineSnapshot(`
        {
          "content": [
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
              "text": "Hello!",
              "type": "text",
            },
            {
              "id": "456",
              "providerMetadata": {
                "provider": {
                  "custom": "value2",
                },
              },
              "sourceType": "url",
              "title": "Example 2",
              "type": "source",
              "url": "https://example.com/2",
            },
          ],
          "dynamicToolCalls": [],
          "dynamicToolResults": [],
          "files": [],
          "finishReason": "stop",
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
                    "text": "Hello!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ],
            "modelId": "mock-model-id",
            "timestamp": 1970-01-01T00:00:00.000Z,
          },
          "sources": [
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
              "id": "456",
              "providerMetadata": {
                "provider": {
                  "custom": "value2",
                },
              },
              "sourceType": "url",
              "title": "Example 2",
              "type": "source",
              "url": "https://example.com/2",
            },
          ],
          "staticToolCalls": [],
          "staticToolResults": [],
          "steps": [
            DefaultStepResult {
              "content": [
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
                  "text": "Hello!",
                  "type": "text",
                },
                {
                  "id": "456",
                  "providerMetadata": {
                    "provider": {
                      "custom": "value2",
                    },
                  },
                  "sourceType": "url",
                  "title": "Example 2",
                  "type": "source",
                  "url": "https://example.com/2",
                },
              ],
              "finishReason": "stop",
              "providerMetadata": undefined,
              "request": {},
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "text": "Hello!",
                        "type": "text",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "usage": {
                "cachedInputTokens": undefined,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": undefined,
                "totalTokens": 13,
              },
              "warnings": [],
            },
          ],
          "text": "Hello!",
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
            "cachedInputTokens": undefined,
            "inputTokens": 3,
            "outputTokens": 10,
            "reasoningTokens": undefined,
            "totalTokens": 13,
          },
          "warnings": [],
        }
      `);
    });

    it.todo('should send files', async () => {
      let result!: any;

      const resultObject = await loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [{ id: 'test-model', maxRetries: 0, model: modelWithFiles }],
        options: {
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
        },
        ...defaultSettings(),
      });

      await resultObject.aisdk.v5.consumeStream();

      expect(result).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "file": DefaultGeneratedFileWithType {
                "base64Data": "Hello World",
                "mediaType": "text/plain",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "type": "file",
            },
            {
              "text": "Hello!",
              "type": "text",
            },
            {
              "file": DefaultGeneratedFileWithType {
                "base64Data": "QkFVRw==",
                "mediaType": "image/jpeg",
                "type": "file",
                "uint8ArrayData": undefined,
              },
              "type": "file",
            },
          ],
          "dynamicToolCalls": [],
          "dynamicToolResults": [],
          "files": [
            DefaultGeneratedFileWithType {
              "base64Data": "Hello World",
              "mediaType": "text/plain",
              "type": "file",
              "uint8ArrayData": undefined,
            },
            DefaultGeneratedFileWithType {
              "base64Data": "QkFVRw==",
              "mediaType": "image/jpeg",
              "type": "file",
              "uint8ArrayData": undefined,
            },
          ],
          "finishReason": "stop",
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
                    "data": "Hello World",
                    "mediaType": "text/plain",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                  {
                    "text": "Hello!",
                    "type": "text",
                  },
                  {
                    "data": "QkFVRw==",
                    "mediaType": "image/jpeg",
                    "providerOptions": undefined,
                    "type": "file",
                  },
                ],
                "role": "assistant",
              },
            ],
            "modelId": "mock-model-id",
            "timestamp": 1970-01-01T00:00:00.000Z,
          },
          "sources": [],
          "staticToolCalls": [],
          "staticToolResults": [],
          "steps": [
            DefaultStepResult {
              "content": [
                {
                  "file": DefaultGeneratedFileWithType {
                    "base64Data": "Hello World",
                    "mediaType": "text/plain",
                    "type": "file",
                    "uint8ArrayData": undefined,
                  },
                  "type": "file",
                },
                {
                  "text": "Hello!",
                  "type": "text",
                },
                {
                  "file": DefaultGeneratedFileWithType {
                    "base64Data": "QkFVRw==",
                    "mediaType": "image/jpeg",
                    "type": "file",
                    "uint8ArrayData": undefined,
                  },
                  "type": "file",
                },
              ],
              "finishReason": "stop",
              "providerMetadata": undefined,
              "request": {},
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "data": "Hello World",
                        "mediaType": "text/plain",
                        "providerOptions": undefined,
                        "type": "file",
                      },
                      {
                        "text": "Hello!",
                        "type": "text",
                      },
                      {
                        "data": "QkFVRw==",
                        "mediaType": "image/jpeg",
                        "providerOptions": undefined,
                        "type": "file",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "usage": {
                "cachedInputTokens": undefined,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": undefined,
                "totalTokens": 13,
              },
              "warnings": [],
            },
          ],
          "text": "Hello!",
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
            "cachedInputTokens": undefined,
            "inputTokens": 3,
            "outputTokens": 10,
            "reasoningTokens": undefined,
            "totalTokens": 13,
          },
          "warnings": [],
        }
      `);
    });

    it('should not prevent error from being forwarded', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = await loopFn({
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
        modelSettings: {
          maxRetries: 0,
        },
        messageList,
        options: {
          onFinish() {}, // just defined; do nothing
          onError: () => {},
        },
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      expect((await convertAsyncIterableToArray(result.aisdk.v5.fullStream as any)).slice(0, 3)).toStrictEqual([
        {
          type: 'start',
        },
        {
          type: 'start-step',
          request: {},
          warnings: [],
        },
        {
          type: 'error',
          error: new Error('test error'),
        },
      ]);
    });
  });

  describe('options.onChunk', () => {
    let result: Array<ChunkType>;

    beforeEach(async () => {
      const messageList = createMessageListWithUserMessage();

      result = [];

      const resultObject = await loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: createTestModels({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            { type: 'tool-input-start', id: '2', toolName: 'tool1' },
            { type: 'tool-input-delta', id: '2', delta: '{"value": "' },
            { type: 'reasoning-start', id: '3' },
            { type: 'reasoning-delta', id: '3', delta: 'Feeling clever' },
            { type: 'reasoning-end', id: '3' },
            { type: 'tool-input-delta', id: '2', delta: 'test' },
            { type: 'tool-input-delta', id: '2', delta: '"}' },
            {
              type: 'source',
              sourceType: 'url',
              id: '123',
              url: 'https://example.com',
              title: 'Example',
              providerMetadata: { provider: { custom: 'value' } },
            },
            { type: 'tool-input-end', id: '2' },
            {
              type: 'tool-call',
              toolCallId: '2',
              toolName: 'tool1',
              input: `{ "value": "test" }`,
              providerMetadata: { provider: { custom: 'value' } },
            },
            { type: 'text-start', id: '4' },
            { type: 'text-delta', id: '4', delta: ' World' },
            { type: 'text-end', id: '4' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage2,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        messageList,
        options: {
          onChunk(chunk) {
            result.push(chunk);
          },
        },
      });

      await resultObject.aisdk.v5.consumeStream();
    });

    it('should return events in order', async () => {
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "from": "AGENT",
            "payload": {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
            },
            "runId": "test-run-id",
            "type": "text-delta",
          },
          {
            "from": "AGENT",
            "payload": {
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "toolCallId": "2",
              "toolName": "tool1",
            },
            "runId": "test-run-id",
            "type": "tool-call-input-streaming-start",
          },
          {
            "from": "AGENT",
            "payload": {
              "argsTextDelta": "{"value": "",
              "providerMetadata": undefined,
              "toolCallId": "2",
              "toolName": "tool1",
            },
            "runId": "test-run-id",
            "type": "tool-call-delta",
          },
          {
            "from": "AGENT",
            "payload": {
              "id": "3",
              "providerMetadata": undefined,
              "text": "Feeling clever",
            },
            "runId": "test-run-id",
            "type": "reasoning-delta",
          },
          {
            "from": "AGENT",
            "payload": {
              "argsTextDelta": "test",
              "providerMetadata": undefined,
              "toolCallId": "2",
              "toolName": "tool1",
            },
            "runId": "test-run-id",
            "type": "tool-call-delta",
          },
          {
            "from": "AGENT",
            "payload": {
              "argsTextDelta": ""}",
              "providerMetadata": undefined,
              "toolCallId": "2",
              "toolName": "tool1",
            },
            "runId": "test-run-id",
            "type": "tool-call-delta",
          },
          {
            "from": "AGENT",
            "payload": {
              "filename": undefined,
              "id": "123",
              "mimeType": undefined,
              "providerMetadata": {
                "provider": {
                  "custom": "value",
                },
              },
              "sourceType": "url",
              "title": "Example",
              "url": "https://example.com",
            },
            "runId": "test-run-id",
            "type": "source",
          },
          {
            "from": "AGENT",
            "payload": {
              "args": {
                "value": "test",
              },
              "providerExecuted": undefined,
              "providerMetadata": {
                "provider": {
                  "custom": "value",
                },
              },
              "toolCallId": "2",
              "toolName": "tool1",
            },
            "runId": "test-run-id",
            "type": "tool-call",
          },
          {
            "from": "AGENT",
            "payload": {
              "id": "4",
              "providerMetadata": undefined,
              "text": " World",
            },
            "runId": "test-run-id",
            "type": "text-delta",
          },
          {
            "chunk": {
              "input": {
                "value": "test",
              },
              "output": "test-result",
              "providerExecuted": undefined,
              "toolCallId": "2",
              "toolName": "tool1",
              "type": "tool-result",
            },
          },
        ]
      `);
    });
  });

  //   describe.skip('options.transform', () => {
  //     describe('with base transformation', () => {
  //       const upperCaseTransform = () =>
  //         new TransformStream<
  //           TextStreamPart<{ tool1: Tool<{ value: string }> }>,
  //           TextStreamPart<{ tool1: Tool<{ value: string }> }>
  //         >({
  //           transform(chunk, controller) {
  //             if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
  //               chunk.text = chunk.text.toUpperCase();
  //             }

  //             if (chunk.type === 'tool-input-delta') {
  //               chunk.delta = chunk.delta.toUpperCase();
  //             }

  //             // assuming test arg structure:
  //             if (chunk.type === 'tool-call' && !chunk.dynamic) {
  //               chunk.input = {
  //                 ...chunk.input,
  //                 value: chunk.input.value.toUpperCase(),
  //               };
  //             }

  //             if (chunk.type === 'tool-result' && !chunk.dynamic) {
  //               chunk.output = chunk.output.toUpperCase();
  //               chunk.input = {
  //                 ...chunk.input,
  //                 value: chunk.input.value.toUpperCase(),
  //               };
  //             }

  //             if (chunk.type === 'start-step') {
  //               if (chunk.request.body != null) {
  //                 chunk.request.body = (chunk.request.body as string).toUpperCase();
  //               }
  //             }

  //             if (chunk.type === 'finish-step') {
  //               if (chunk.providerMetadata?.testProvider != null) {
  //                 chunk.providerMetadata.testProvider = {
  //                   testKey: 'TEST VALUE',
  //                 };
  //               }
  //             }

  //             controller.enqueue(chunk);
  //           },
  //         });

  //       it('should transform the stream', async () => {
  //         const result = streamText({
  //           models: createTestModels(),
  //           experimental_transform: upperCaseTransform,
  //           prompt: 'test-input',
  //         });

  //         expect(await convertAsyncIterableToArray(result.textStream)).toStrictEqual(['HELLO', ', ', 'WORLD!']);
  //       });

  //       it('result.text should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels(),
  //           experimental_transform: upperCaseTransform,
  //           prompt: 'test-input',
  //         });

  //         await result.consumeStream();

  //         expect(await result.text).toStrictEqual('HELLO, WORLD!');
  //       });

  //       it('result.response.messages should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels(),
  //           experimental_transform: upperCaseTransform,
  //           prompt: 'test-input',
  //         });

  //         await result.consumeStream();

  //         expect(await result.response).toStrictEqual({
  //           id: expect.any(String),
  //           timestamp: expect.any(Date),
  //           modelId: expect.any(String),
  //           headers: undefined,
  //           messages: [
  //             {
  //               role: 'assistant',
  //               content: [
  //                 {
  //                   providerOptions: undefined,
  //                   text: 'HELLO, WORLD!',
  //                   type: 'text',
  //                 },
  //               ],
  //             },
  //           ],
  //         });
  //       });

  //       it('result.totalUsage should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_transform: () =>
  //             new TransformStream<TextStreamPart<any>, TextStreamPart<any>>({
  //               transform(chunk, controller) {
  //                 if (chunk.type === 'finish') {
  //                   chunk.totalUsage = {
  //                     inputTokens: 200,
  //                     outputTokens: 300,
  //                     totalTokens: undefined,
  //                     reasoningTokens: undefined,
  //                     cachedInputTokens: undefined,
  //                   };
  //                 }
  //                 controller.enqueue(chunk);
  //               },
  //             }),
  //           prompt: 'test-input',
  //         });

  //         await result.consumeStream();

  //         expect(await result.totalUsage).toStrictEqual({
  //           inputTokens: 200,
  //           outputTokens: 300,
  //           totalTokens: undefined,
  //           reasoningTokens: undefined,
  //           cachedInputTokens: undefined,
  //         });
  //       });

  //       it('result.finishReason should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'length',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_transform: () =>
  //             new TransformStream<TextStreamPart<any>, TextStreamPart<any>>({
  //               transform(chunk, controller) {
  //                 if (chunk.type === 'finish') {
  //                   chunk.finishReason = 'stop';
  //                 }
  //                 controller.enqueue(chunk);
  //               },
  //             }),
  //           prompt: 'test-input',
  //         });

  //         await result.consumeStream();

  //         expect(await result.finishReason).toStrictEqual('stop');
  //       });

  //       it('result.toolCalls should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello, ' },
  //               { type: 'text-delta', id: '1', delta: 'world!' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'tool-call',
  //                 toolCallId: 'call-1',
  //                 toolName: 'tool1',
  //                 input: `{ "value": "value" }`,
  //               },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           tools: {
  //             tool1: {
  //               inputSchema: z.object({ value: z.string() }),
  //               execute: async () => 'result1',
  //             },
  //           },
  //           experimental_transform: upperCaseTransform,
  //           prompt: 'test-input',
  //         });

  //         await result.consumeStream();

  //         expect(await result.toolCalls).toMatchInlineSnapshot(`
  //           [
  //             {
  //               "input": {
  //                 "value": "VALUE",
  //               },
  //               "providerExecuted": undefined,
  //               "providerMetadata": undefined,
  //               "toolCallId": "call-1",
  //               "toolName": "tool1",
  //               "type": "tool-call",
  //             },
  //           ]
  //         `);
  //       });

  //       it('result.toolResults should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello, ' },
  //               { type: 'text-delta', id: '1', delta: 'world!' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'tool-call',
  //                 toolCallId: 'call-1',
  //                 toolName: 'tool1',
  //                 input: `{ "value": "value" }`,
  //               },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           tools: {
  //             tool1: {
  //               inputSchema: z.object({ value: z.string() }),
  //               execute: async () => 'result1',
  //             },
  //           },
  //           experimental_transform: upperCaseTransform,
  //           prompt: 'test-input',
  //         });

  //         await result.consumeStream();

  //         expect(await result.toolResults).toMatchInlineSnapshot(`
  //           [
  //             {
  //               "input": {
  //                 "value": "VALUE",
  //               },
  //               "output": "RESULT1",
  //               "providerExecuted": undefined,
  //               "providerMetadata": undefined,
  //               "toolCallId": "call-1",
  //               "toolName": "tool1",
  //               "type": "tool-result",
  //             },
  //           ]
  //         `);
  //       });

  //       it('result.steps should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               {
  //                 type: 'response-metadata',
  //                 id: 'id-0',
  //                 modelId: 'mock-model-id',
  //                 timestamp: new Date(0),
  //               },
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello, ' },
  //               { type: 'text-delta', id: '1', delta: 'world!' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'tool-call',
  //                 toolCallId: 'call-1',
  //                 toolName: 'tool1',
  //                 input: `{ "value": "value" }`,
  //               },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           tools: {
  //             tool1: {
  //               inputSchema: z.object({ value: z.string() }),
  //               execute: async () => 'result1',
  //             },
  //           },
  //           experimental_transform: upperCaseTransform,
  //           prompt: 'test-input',
  //         });

  //         result.consumeStream();

  //         expect(await result.steps).toMatchInlineSnapshot(`
  //           [
  //             DefaultStepResult {
  //               "content": [
  //                 {
  //                   "providerMetadata": undefined,
  //                   "text": "HELLO, WORLD!",
  //                   "type": "text",
  //                 },
  //                 {
  //                   "input": {
  //                     "value": "VALUE",
  //                   },
  //                   "providerExecuted": undefined,
  //                   "providerMetadata": undefined,
  //                   "toolCallId": "call-1",
  //                   "toolName": "tool1",
  //                   "type": "tool-call",
  //                 },
  //                 {
  //                   "input": {
  //                     "value": "VALUE",
  //                   },
  //                   "output": "RESULT1",
  //                   "providerExecuted": undefined,
  //                   "providerMetadata": undefined,
  //                   "toolCallId": "call-1",
  //                   "toolName": "tool1",
  //                   "type": "tool-result",
  //                 },
  //               ],
  //               "finishReason": "stop",
  //               "providerMetadata": undefined,
  //               "request": {},
  //               "response": {
  //                 "headers": undefined,
  //                 "id": "id-0",
  //                 "messages": [
  //                   {
  //                     "content": [
  //                       {
  //                         "providerOptions": undefined,
  //                         "text": "HELLO, WORLD!",
  //                         "type": "text",
  //                       },
  //                       {
  //                         "input": {
  //                           "value": "VALUE",
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
  //                           "value": "RESULT1",
  //                         },
  //                         "toolCallId": "call-1",
  //                         "toolName": "tool1",
  //                         "type": "tool-result",
  //                       },
  //                     ],
  //                     "role": "tool",
  //                   },
  //                 ],
  //                 "modelId": "mock-model-id",
  //                 "timestamp": 1970-01-01T00:00:00.000Z,
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
  //           ]
  //         `);
  //       });

  //       it('result.request should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               {
  //                 type: 'response-metadata',
  //                 id: 'id-0',
  //                 modelId: 'mock-model-id',
  //                 timestamp: new Date(0),
  //               },
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //             request: { body: 'test body' },
  //           }),
  //           prompt: 'test-input',
  //           experimental_transform: upperCaseTransform,
  //         });

  //         result.consumeStream();

  //         expect(await result.request).toStrictEqual({
  //           body: 'TEST BODY',
  //         });
  //       });

  //       it('result.providerMetadata should be transformed', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               {
  //                 type: 'response-metadata',
  //                 id: 'id-0',
  //                 modelId: 'mock-model-id',
  //                 timestamp: new Date(0),
  //               },
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //                 providerMetadata: {
  //                   testProvider: {
  //                     testKey: 'testValue',
  //                   },
  //                 },
  //               },
  //             ]),
  //             request: { body: 'test body' },
  //           }),
  //           prompt: 'test-input',
  //           experimental_transform: upperCaseTransform,
  //         });

  //         result.consumeStream();

  //         expect(JSON.stringify(await result.providerMetadata)).toStrictEqual(
  //           JSON.stringify({
  //             testProvider: {
  //               testKey: 'TEST VALUE',
  //             },
  //           }),
  //         );
  //       });

  //       it('options.onFinish should receive transformed data', async () => {
  //         let result!: Parameters<Required<Parameters<typeof streamText>[0]>['onFinish']>[0];

  //         const resultObject = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               {
  //                 type: 'response-metadata',
  //                 id: 'id-0',
  //                 modelId: 'mock-model-id',
  //                 timestamp: new Date(0),
  //               },
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello' },
  //               { type: 'text-delta', id: '1', delta: ', ' },
  //               {
  //                 type: 'tool-call',
  //                 toolCallId: 'call-1',
  //                 toolName: 'tool1',
  //                 input: `{ "value": "value" }`,
  //               },
  //               { type: 'text-delta', id: '1', delta: 'world!' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //                 providerMetadata: {
  //                   testProvider: { testKey: 'testValue' },
  //                 },
  //               },
  //             ]),
  //             response: { headers: { call: '2' } },
  //           }),
  //           tools: {
  //             tool1: {
  //               inputSchema: z.object({ value: z.string() }),
  //               execute: async ({ value }) => `${value}-result`,
  //             },
  //           },
  //           prompt: 'test-input',
  //           onFinish: async event => {
  //             result = event as unknown as typeof result;
  //           },
  //           experimental_transform: upperCaseTransform,
  //         });

  //         await resultObject.consumeStream();

  //         expect(result).toMatchInlineSnapshot(`
  //           {
  //             "content": [
  //               {
  //                 "providerMetadata": undefined,
  //                 "text": "HELLO, WORLD!",
  //                 "type": "text",
  //               },
  //               {
  //                 "input": {
  //                   "value": "VALUE",
  //                 },
  //                 "providerExecuted": undefined,
  //                 "providerMetadata": undefined,
  //                 "toolCallId": "call-1",
  //                 "toolName": "tool1",
  //                 "type": "tool-call",
  //               },
  //               {
  //                 "input": {
  //                   "value": "VALUE",
  //                 },
  //                 "output": "VALUE-RESULT",
  //                 "providerExecuted": undefined,
  //                 "providerMetadata": undefined,
  //                 "toolCallId": "call-1",
  //                 "toolName": "tool1",
  //                 "type": "tool-result",
  //               },
  //             ],
  //             "dynamicToolCalls": [],
  //             "dynamicToolResults": [],
  //             "files": [],
  //             "finishReason": "stop",
  //             "providerMetadata": {
  //               "testProvider": {
  //                 "testKey": "TEST VALUE",
  //               },
  //             },
  //             "reasoning": [],
  //             "reasoningText": undefined,
  //             "request": {},
  //             "response": {
  //               "headers": {
  //                 "call": "2",
  //               },
  //               "id": "id-0",
  //               "messages": [
  //                 {
  //                   "content": [
  //                     {
  //                       "providerOptions": undefined,
  //                       "text": "HELLO, WORLD!",
  //                       "type": "text",
  //                     },
  //                     {
  //                       "input": {
  //                         "value": "VALUE",
  //                       },
  //                       "providerExecuted": undefined,
  //                       "providerOptions": undefined,
  //                       "toolCallId": "call-1",
  //                       "toolName": "tool1",
  //                       "type": "tool-call",
  //                     },
  //                   ],
  //                   "role": "assistant",
  //                 },
  //                 {
  //                   "content": [
  //                     {
  //                       "output": {
  //                         "type": "text",
  //                         "value": "VALUE-RESULT",
  //                       },
  //                       "toolCallId": "call-1",
  //                       "toolName": "tool1",
  //                       "type": "tool-result",
  //                     },
  //                   ],
  //                   "role": "tool",
  //                 },
  //               ],
  //               "modelId": "mock-model-id",
  //               "timestamp": 1970-01-01T00:00:00.000Z,
  //             },
  //             "sources": [],
  //             "staticToolCalls": [],
  //             "staticToolResults": [],
  //             "steps": [
  //               DefaultStepResult {
  //                 "content": [
  //                   {
  //                     "providerMetadata": undefined,
  //                     "text": "HELLO, WORLD!",
  //                     "type": "text",
  //                   },
  //                   {
  //                     "input": {
  //                       "value": "VALUE",
  //                     },
  //                     "providerExecuted": undefined,
  //                     "providerMetadata": undefined,
  //                     "toolCallId": "call-1",
  //                     "toolName": "tool1",
  //                     "type": "tool-call",
  //                   },
  //                   {
  //                     "input": {
  //                       "value": "VALUE",
  //                     },
  //                     "output": "VALUE-RESULT",
  //                     "providerExecuted": undefined,
  //                     "providerMetadata": undefined,
  //                     "toolCallId": "call-1",
  //                     "toolName": "tool1",
  //                     "type": "tool-result",
  //                   },
  //                 ],
  //                 "finishReason": "stop",
  //                 "providerMetadata": {
  //                   "testProvider": {
  //                     "testKey": "TEST VALUE",
  //                   },
  //                 },
  //                 "request": {},
  //                 "response": {
  //                   "headers": {
  //                     "call": "2",
  //                   },
  //                   "id": "id-0",
  //                   "messages": [
  //                     {
  //                       "content": [
  //                         {
  //                           "providerOptions": undefined,
  //                           "text": "HELLO, WORLD!",
  //                           "type": "text",
  //                         },
  //                         {
  //                           "input": {
  //                             "value": "VALUE",
  //                           },
  //                           "providerExecuted": undefined,
  //                           "providerOptions": undefined,
  //                           "toolCallId": "call-1",
  //                           "toolName": "tool1",
  //                           "type": "tool-call",
  //                         },
  //                       ],
  //                       "role": "assistant",
  //                     },
  //                     {
  //                       "content": [
  //                         {
  //                           "output": {
  //                             "type": "text",
  //                             "value": "VALUE-RESULT",
  //                           },
  //                           "toolCallId": "call-1",
  //                           "toolName": "tool1",
  //                           "type": "tool-result",
  //                         },
  //                       ],
  //                       "role": "tool",
  //                     },
  //                   ],
  //                   "modelId": "mock-model-id",
  //                   "timestamp": 1970-01-01T00:00:00.000Z,
  //                 },
  //                 "usage": {
  //                   "cachedInputTokens": undefined,
  //                   "inputTokens": 3,
  //                   "outputTokens": 10,
  //                   "reasoningTokens": undefined,
  //                   "totalTokens": 13,
  //                 },
  //                 "warnings": [],
  //               },
  //             ],
  //             "text": "HELLO, WORLD!",
  //             "toolCalls": [
  //               {
  //                 "input": {
  //                   "value": "VALUE",
  //                 },
  //                 "providerExecuted": undefined,
  //                 "providerMetadata": undefined,
  //                 "toolCallId": "call-1",
  //                 "toolName": "tool1",
  //                 "type": "tool-call",
  //               },
  //             ],
  //             "toolResults": [
  //               {
  //                 "input": {
  //                   "value": "VALUE",
  //                 },
  //                 "output": "VALUE-RESULT",
  //                 "providerExecuted": undefined,
  //                 "providerMetadata": undefined,
  //                 "toolCallId": "call-1",
  //                 "toolName": "tool1",
  //                 "type": "tool-result",
  //               },
  //             ],
  //             "totalUsage": {
  //               "cachedInputTokens": undefined,
  //               "inputTokens": 3,
  //               "outputTokens": 10,
  //               "reasoningTokens": undefined,
  //               "totalTokens": 13,
  //             },
  //             "usage": {
  //               "cachedInputTokens": undefined,
  //               "inputTokens": 3,
  //               "outputTokens": 10,
  //               "reasoningTokens": undefined,
  //               "totalTokens": 13,
  //             },
  //             "warnings": [],
  //           }
  //         `);
  //       });

  //       it('options.onStepFinish should receive transformed data', async () => {
  //         let result!: Parameters<Required<Parameters<typeof streamText>[0]>['onStepFinish']>[0];

  //         const resultObject = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               {
  //                 type: 'response-metadata',
  //                 id: 'id-0',
  //                 modelId: 'mock-model-id',
  //                 timestamp: new Date(0),
  //               },
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello' },
  //               { type: 'text-delta', id: '1', delta: ', ' },
  //               {
  //                 type: 'tool-call',
  //                 toolCallId: 'call-1',
  //                 toolName: 'tool1',
  //                 input: `{ "value": "value" }`,
  //               },
  //               { type: 'text-delta', id: '1', delta: 'world!' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //                 providerMetadata: {
  //                   testProvider: { testKey: 'testValue' },
  //                 },
  //               },
  //             ]),
  //             response: { headers: { call: '2' } },
  //           }),
  //           tools: {
  //             tool1: tool({
  //               inputSchema: z.object({ value: z.string() }),
  //               execute: async ({ value }) => `${value}-result`,
  //             }),
  //           },
  //           prompt: 'test-input',
  //           onStepFinish: async event => {
  //             result = event as unknown as typeof result;
  //           },
  //           experimental_transform: upperCaseTransform,
  //         });

  //         await resultObject.consumeStream();

  //         expect(result).toMatchInlineSnapshot(`
  //           DefaultStepResult {
  //             "content": [
  //               {
  //                 "providerMetadata": undefined,
  //                 "text": "HELLO, WORLD!",
  //                 "type": "text",
  //               },
  //               {
  //                 "input": {
  //                   "value": "VALUE",
  //                 },
  //                 "providerExecuted": undefined,
  //                 "providerMetadata": undefined,
  //                 "toolCallId": "call-1",
  //                 "toolName": "tool1",
  //                 "type": "tool-call",
  //               },
  //               {
  //                 "input": {
  //                   "value": "VALUE",
  //                 },
  //                 "output": "VALUE-RESULT",
  //                 "providerExecuted": undefined,
  //                 "providerMetadata": undefined,
  //                 "toolCallId": "call-1",
  //                 "toolName": "tool1",
  //                 "type": "tool-result",
  //               },
  //             ],
  //             "finishReason": "stop",
  //             "providerMetadata": {
  //               "testProvider": {
  //                 "testKey": "TEST VALUE",
  //               },
  //             },
  //             "request": {},
  //             "response": {
  //               "headers": {
  //                 "call": "2",
  //               },
  //               "id": "id-0",
  //               "messages": [
  //                 {
  //                   "content": [
  //                     {
  //                       "providerOptions": undefined,
  //                       "text": "HELLO, WORLD!",
  //                       "type": "text",
  //                     },
  //                     {
  //                       "input": {
  //                         "value": "VALUE",
  //                       },
  //                       "providerExecuted": undefined,
  //                       "providerOptions": undefined,
  //                       "toolCallId": "call-1",
  //                       "toolName": "tool1",
  //                       "type": "tool-call",
  //                     },
  //                   ],
  //                   "role": "assistant",
  //                 },
  //                 {
  //                   "content": [
  //                     {
  //                       "output": {
  //                         "type": "text",
  //                         "value": "VALUE-RESULT",
  //                       },
  //                       "toolCallId": "call-1",
  //                       "toolName": "tool1",
  //                       "type": "tool-result",
  //                     },
  //                   ],
  //                   "role": "tool",
  //                 },
  //               ],
  //               "modelId": "mock-model-id",
  //               "timestamp": 1970-01-01T00:00:00.000Z,
  //             },
  //             "usage": {
  //               "cachedInputTokens": undefined,
  //               "inputTokens": 3,
  //               "outputTokens": 10,
  //               "reasoningTokens": undefined,
  //               "totalTokens": 13,
  //             },
  //             "warnings": [],
  //           }
  //         `);
  //       });

  //       it('it should send transformed chunks to onChunk', async () => {
  //         const result: Array<
  //           Extract<
  //             TextStreamPart<any>,
  //             {
  //               type:
  //                 | 'text-delta'
  //                 | 'reasoning-delta'
  //                 | 'source'
  //                 | 'tool-call'
  //                 | 'tool-input-start'
  //                 | 'tool-input-delta'
  //                 | 'tool-result'
  //                 | 'raw';
  //             }
  //           >
  //         > = [];

  //         const resultObject = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello' },
  //               { type: 'reasoning-start', id: '2' },
  //               { type: 'reasoning-delta', id: '2', delta: 'Feeling clever' },
  //               { type: 'reasoning-end', id: '2' },
  //               { type: 'tool-input-start', id: 'call-1', toolName: 'tool1' },
  //               { type: 'tool-input-delta', id: 'call-1', delta: '{"value": "' },
  //               { type: 'tool-input-delta', id: 'call-1', delta: 'test' },
  //               { type: 'tool-input-delta', id: 'call-1', delta: '"}' },
  //               { type: 'tool-input-end', id: 'call-1' },
  //               {
  //                 type: 'tool-call',
  //                 toolCallId: 'call-1',
  //                 toolName: 'tool1',
  //                 input: `{ "value": "test" }`,
  //               },
  //               { type: 'text-delta', id: '1', delta: ' World' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           tools: {
  //             tool1: {
  //               inputSchema: z.object({ value: z.string() }),
  //               execute: async ({ value }) => `${value}-result`,
  //             },
  //           },
  //           prompt: 'test-input',
  //           onChunk(event) {
  //             result.push(event.chunk);
  //           },
  //           experimental_transform: upperCaseTransform,
  //         });

  //         await resultObject.consumeStream();

  //         expect(result).toMatchInlineSnapshot(`
  //           [
  //             {
  //               "id": "1",
  //               "providerMetadata": undefined,
  //               "text": "HELLO",
  //               "type": "text-delta",
  //             },
  //             {
  //               "id": "2",
  //               "providerMetadata": undefined,
  //               "text": "FEELING CLEVER",
  //               "type": "reasoning-delta",
  //             },
  //             {
  //               "dynamic": false,
  //               "id": "call-1",
  //               "toolName": "tool1",
  //               "type": "tool-input-start",
  //             },
  //             {
  //               "delta": "{"VALUE": "",
  //               "id": "call-1",
  //               "type": "tool-input-delta",
  //             },
  //             {
  //               "delta": "TEST",
  //               "id": "call-1",
  //               "type": "tool-input-delta",
  //             },
  //             {
  //               "delta": ""}",
  //               "id": "call-1",
  //               "type": "tool-input-delta",
  //             },
  //             {
  //               "input": {
  //                 "value": "TEST",
  //               },
  //               "providerExecuted": undefined,
  //               "providerMetadata": undefined,
  //               "toolCallId": "call-1",
  //               "toolName": "tool1",
  //               "type": "tool-call",
  //             },
  //             {
  //               "input": {
  //                 "value": "TEST",
  //               },
  //               "output": "TEST-RESULT",
  //               "providerExecuted": undefined,
  //               "providerMetadata": undefined,
  //               "toolCallId": "call-1",
  //               "toolName": "tool1",
  //               "type": "tool-result",
  //             },
  //             {
  //               "id": "1",
  //               "providerMetadata": undefined,
  //               "text": " WORLD",
  //               "type": "text-delta",
  //             },
  //           ]
  //         `);
  //       });
  //     });

  //     describe('with multiple transformations', () => {
  //       const toUppercaseAndAddCommaTransform =
  //         <TOOLS extends ToolSet>() =>
  //         (options: { tools: TOOLS }) =>
  //           new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
  //             transform(chunk, controller) {
  //               if (chunk.type !== 'text-delta') {
  //                 controller.enqueue(chunk);
  //                 return;
  //               }

  //               controller.enqueue({
  //                 ...chunk,
  //                 text: `${chunk.text.toUpperCase()},`,
  //               });
  //             },
  //           });

  //       const omitCommaTransform =
  //         <TOOLS extends ToolSet>() =>
  //         (options: { tools: TOOLS }) =>
  //           new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
  //             transform(chunk, controller) {
  //               if (chunk.type !== 'text-delta') {
  //                 controller.enqueue(chunk);
  //                 return;
  //               }

  //               controller.enqueue({
  //                 ...chunk,
  //                 text: chunk.text.replaceAll(',', ''),
  //               });
  //             },
  //           });

  //       it('should transform the stream', async () => {
  //         const result = streamText({
  //           models: createTestModels(),
  //           experimental_transform: [toUppercaseAndAddCommaTransform(), omitCommaTransform()],
  //           prompt: 'test-input',
  //         });

  //         expect(await convertAsyncIterableToArray(result.textStream)).toStrictEqual(['HELLO', ' ', 'WORLD!']);
  //       });
  //     });

  //     describe('with transformation that aborts stream', () => {
  //       const stopWordTransform =
  //         <TOOLS extends ToolSet>() =>
  //         ({ stopStream }: { stopStream: () => void }) =>
  //           new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
  //             // note: this is a simplified transformation for testing;
  //             // in a real-world version more there would need to be
  //             // stream buffering and scanning to correctly emit prior text
  //             // and to detect all STOP occurrences.
  //             transform(chunk, controller) {
  //               if (chunk.type !== 'text-delta') {
  //                 controller.enqueue(chunk);
  //                 return;
  //               }

  //               if (chunk.text.includes('STOP')) {
  //                 stopStream();

  //                 controller.enqueue({
  //                   type: 'finish-step',
  //                   finishReason: 'stop',
  //                   providerMetadata: undefined,
  //                   usage: {
  //                     inputTokens: undefined,
  //                     outputTokens: undefined,
  //                     totalTokens: undefined,
  //                     reasoningTokens: undefined,
  //                     cachedInputTokens: undefined,
  //                   },
  //                   response: {
  //                     id: 'response-id',
  //                     modelId: 'mock-model-id',
  //                     timestamp: new Date(0),
  //                   },
  //                 });

  //                 controller.enqueue({
  //                   type: 'finish',
  //                   finishReason: 'stop',
  //                   totalUsage: {
  //                     inputTokens: undefined,
  //                     outputTokens: undefined,
  //                     totalTokens: undefined,
  //                     reasoningTokens: undefined,
  //                     cachedInputTokens: undefined,
  //                   },
  //                 });

  //                 return;
  //               }

  //               controller.enqueue(chunk);
  //             },
  //           });

  //       it('stream should stop when STOP token is encountered', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello, ' },
  //               { type: 'text-delta', id: '1', delta: 'STOP' },
  //               { type: 'text-delta', id: '1', delta: ' World' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: {
  //                   inputTokens: undefined,
  //                   outputTokens: undefined,
  //                   totalTokens: undefined,
  //                   reasoningTokens: undefined,
  //                   cachedInputTokens: undefined,
  //                 },
  //               },
  //             ]),
  //           }),
  //           prompt: 'test-input',
  //           experimental_transform: stopWordTransform(),
  //         });

  //         expect(await convertAsyncIterableToArray(result.fullStream)).toMatchInlineSnapshot(`
  //             [
  //               {
  //                 "type": "start",
  //               },
  //               {
  //                 "request": {},
  //                 "type": "start-step",
  //                 "warnings": [],
  //               },
  //               {
  //                 "id": "1",
  //                 "type": "text-start",
  //               },
  //               {
  //                 "id": "1",
  //                 "providerMetadata": undefined,
  //                 "text": "Hello, ",
  //                 "type": "text-delta",
  //               },
  //               {
  //                 "finishReason": "stop",
  //                 "providerMetadata": undefined,
  //                 "response": {
  //                   "id": "response-id",
  //                   "modelId": "mock-model-id",
  //                   "timestamp": 1970-01-01T00:00:00.000Z,
  //                 },
  //                 "type": "finish-step",
  //                 "usage": {
  //                   "cachedInputTokens": undefined,
  //                   "inputTokens": undefined,
  //                   "outputTokens": undefined,
  //                   "reasoningTokens": undefined,
  //                   "totalTokens": undefined,
  //                 },
  //               },
  //               {
  //                 "finishReason": "stop",
  //                 "totalUsage": {
  //                   "cachedInputTokens": undefined,
  //                   "inputTokens": undefined,
  //                   "outputTokens": undefined,
  //                   "reasoningTokens": undefined,
  //                   "totalTokens": undefined,
  //                 },
  //                 "type": "finish",
  //               },
  //             ]
  //           `);
  //       });

  //       it('options.onStepFinish should be called', async () => {
  //         let result!: Parameters<Required<Parameters<typeof streamText>[0]>['onStepFinish']>[0];

  //         const resultObject = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello, ' },
  //               { type: 'text-delta', id: '1', delta: 'STOP' },
  //               { type: 'text-delta', id: '1', delta: ' World' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           prompt: 'test-input',
  //           onStepFinish: async event => {
  //             result = event as unknown as typeof result;
  //           },
  //           experimental_transform: stopWordTransform(),
  //         });

  //         await resultObject.consumeStream();

  //         expect(result).toMatchInlineSnapshot(`
  //           DefaultStepResult {
  //             "content": [
  //               {
  //                 "providerMetadata": undefined,
  //                 "text": "Hello, ",
  //                 "type": "text",
  //               },
  //             ],
  //             "finishReason": "stop",
  //             "providerMetadata": undefined,
  //             "request": {},
  //             "response": {
  //               "id": "response-id",
  //               "messages": [
  //                 {
  //                   "content": [
  //                     {
  //                       "providerOptions": undefined,
  //                       "text": "Hello, ",
  //                       "type": "text",
  //                     },
  //                   ],
  //                   "role": "assistant",
  //                 },
  //               ],
  //               "modelId": "mock-model-id",
  //               "timestamp": 1970-01-01T00:00:00.000Z,
  //             },
  //             "usage": {
  //               "cachedInputTokens": undefined,
  //               "inputTokens": undefined,
  //               "outputTokens": undefined,
  //               "reasoningTokens": undefined,
  //               "totalTokens": undefined,
  //             },
  //             "warnings": [],
  //           }
  //         `);
  //       });
  //     });
  //   });

  //   describe.skip('options.output', () => {
  //     describe('no output', () => {
  //       it('should throw error when accessing partial output stream', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: '{ ' },
  //               { type: 'text-delta', id: '1', delta: '"value": ' },
  //               { type: 'text-delta', id: '1', delta: `"Hello, ` },
  //               { type: 'text-delta', id: '1', delta: `world` },
  //               { type: 'text-delta', id: '1', delta: `!"` },
  //               { type: 'text-delta', id: '1', delta: ' }' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           prompt: 'prompt',
  //         });

  //         await expect(async () => {
  //           await convertAsyncIterableToArray(result.experimental_partialOutputStream);
  //         }).rejects.toThrow('No output specified');
  //       });
  //     });

  //     describe('text output', () => {
  //       it('should send partial output stream', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: 'Hello, ' },
  //               { type: 'text-delta', id: '1', delta: ',' },
  //               { type: 'text-delta', id: '1', delta: ' world!' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_output: text(),
  //           prompt: 'prompt',
  //         });

  //         expect(await convertAsyncIterableToArray(result.experimental_partialOutputStream)).toStrictEqual([
  //           'Hello, ',
  //           'Hello, ,',
  //           'Hello, , world!',
  //         ]);
  //       });
  //     });

  //     describe('object output', () => {
  //       it('should set responseFormat to json and send schema as part of the responseFormat', async () => {
  //         let callOptions!: LanguageModelV2CallOptions;

  //         const result = streamText({
  //           model: new MockLanguageModelV2({
  //             doStream: async args => {
  //               callOptions = args;
  //               return {
  //                 stream: convertArrayToReadableStream([
  //                   { type: 'text-start', id: '1' },
  //                   { type: 'text-delta', id: '1', delta: '{ ' },
  //                   { type: 'text-delta', id: '1', delta: '"value": ' },
  //                   { type: 'text-delta', id: '1', delta: `"Hello, ` },
  //                   { type: 'text-delta', id: '1', delta: `world` },
  //                   { type: 'text-delta', id: '1', delta: `!"` },
  //                   { type: 'text-delta', id: '1', delta: ' }' },
  //                   { type: 'text-end', id: '1' },
  //                   {
  //                     type: 'finish',
  //                     finishReason: 'stop',
  //                     usage: testUsage,
  //                   },
  //                 ]),
  //               };
  //             },
  //           }),
  //           experimental_output: object({
  //             schema: z.object({ value: z.string() }),
  //           }),
  //           prompt: 'prompt',
  //         });

  //         await result.consumeStream();

  //         expect(callOptions).toMatchInlineSnapshot(`
  //           {
  //             "abortSignal": undefined,
  //             "frequencyPenalty": undefined,
  //             "headers": undefined,
  //             "includeRawChunks": false,
  //             "maxOutputTokens": undefined,
  //             "presencePenalty": undefined,
  //             "prompt": [
  //               {
  //                 "content": [
  //                   {
  //                     "text": "prompt",
  //                     "type": "text",
  //                   },
  //                 ],
  //                 "providerOptions": undefined,
  //                 "role": "user",
  //               },
  //             ],
  //             "providerOptions": undefined,
  //             "responseFormat": {
  //               "schema": {
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
  //               "type": "json",
  //             },
  //             "seed": undefined,
  //             "stopSequences": undefined,
  //             "temperature": undefined,
  //             "toolChoice": undefined,
  //             "tools": undefined,
  //             "topK": undefined,
  //             "topP": undefined,
  //           }
  //         `);
  //       });

  //       it('should send valid partial text fragments', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: '{ ' },
  //               { type: 'text-delta', id: '1', delta: '"value": ' },
  //               { type: 'text-delta', id: '1', delta: `"Hello, ` },
  //               { type: 'text-delta', id: '1', delta: `world` },
  //               { type: 'text-delta', id: '1', delta: `!"` },
  //               { type: 'text-delta', id: '1', delta: ' }' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_output: object({
  //             schema: z.object({ value: z.string() }),
  //           }),
  //           prompt: 'prompt',
  //         });

  //         expect(await convertAsyncIterableToArray(result.textStream)).toStrictEqual([
  //           `{ `,
  //           // key difference: need to combine after `:`
  //           `"value": "Hello, `,
  //           `world`,
  //           `!"`,
  //           ` }`,
  //         ]);
  //       });

  //       it('should send partial output stream', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: '{ ' },
  //               { type: 'text-delta', id: '1', delta: '"value": ' },
  //               { type: 'text-delta', id: '1', delta: `"Hello, ` },
  //               { type: 'text-delta', id: '1', delta: `world` },
  //               { type: 'text-delta', id: '1', delta: `!"` },
  //               { type: 'text-delta', id: '1', delta: ' }' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_output: object({
  //             schema: z.object({ value: z.string() }),
  //           }),
  //           prompt: 'prompt',
  //         });

  //         expect(await convertAsyncIterableToArray(result.experimental_partialOutputStream)).toStrictEqual([
  //           {},
  //           { value: 'Hello, ' },
  //           { value: 'Hello, world' },
  //           { value: 'Hello, world!' },
  //         ]);
  //       });

  //       it('should send partial output stream when last chunk contains content', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: '{ ' },
  //               { type: 'text-delta', id: '1', delta: '"value": ' },
  //               { type: 'text-delta', id: '1', delta: `"Hello, ` },
  //               { type: 'text-delta', id: '1', delta: `world!" }` },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_output: object({
  //             schema: z.object({ value: z.string() }),
  //           }),
  //           prompt: 'prompt',
  //         });

  //         expect(await convertAsyncIterableToArray(result.experimental_partialOutputStream)).toStrictEqual([
  //           {},
  //           { value: 'Hello, ' },
  //           { value: 'Hello, world!' },
  //         ]);
  //       });

  //       it('should resolve text promise with the correct content', async () => {
  //         const result = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: '{ ' },
  //               { type: 'text-delta', id: '1', delta: '"value": ' },
  //               { type: 'text-delta', id: '1', delta: `"Hello, ` },
  //               { type: 'text-delta', id: '1', delta: `world!" ` },
  //               { type: 'text-delta', id: '1', delta: '}' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_output: object({
  //             schema: z.object({ value: z.string() }),
  //           }),
  //           prompt: 'prompt',
  //         });

  //         result.consumeStream();

  //         expect(await result.text).toStrictEqual('{ "value": "Hello, world!" }');
  //       });

  //       it('should call onFinish with the correct content', async () => {
  //         let result!: Parameters<Required<Parameters<typeof streamText>[0]>['onFinish']>[0];

  //         const resultObject = streamText({
  //           models: createTestModels({
  //             stream: convertArrayToReadableStream([
  //               { type: 'text-start', id: '1' },
  //               { type: 'text-delta', id: '1', delta: '{ ' },
  //               { type: 'text-delta', id: '1', delta: '"value": ' },
  //               { type: 'text-delta', id: '1', delta: `"Hello, ` },
  //               { type: 'text-delta', id: '1', delta: `world!" ` },
  //               { type: 'text-delta', id: '1', delta: '}' },
  //               { type: 'text-end', id: '1' },
  //               {
  //                 type: 'finish',
  //                 finishReason: 'stop',
  //                 usage: testUsage,
  //               },
  //             ]),
  //           }),
  //           experimental_output: object({
  //             schema: z.object({ value: z.string() }),
  //           }),
  //           prompt: 'prompt',
  //           onFinish: async event => {
  //             result = event as unknown as typeof result;
  //           },
  //           _internal: {
  //             generateId: mockId({ prefix: 'id' }),
  //             currentDate: () => new Date(0),
  //           },
  //         });

  //         resultObject.consumeStream();

  //         await resultObject.consumeStream();

  //         expect(result).toMatchInlineSnapshot(`
  //           {
  //             "content": [
  //               {
  //                 "providerMetadata": undefined,
  //                 "text": "{ "value": "Hello, world!" }",
  //                 "type": "text",
  //               },
  //             ],
  //             "dynamicToolCalls": [],
  //             "dynamicToolResults": [],
  //             "files": [],
  //             "finishReason": "stop",
  //             "providerMetadata": undefined,
  //             "reasoning": [],
  //             "reasoningText": undefined,
  //             "request": {},
  //             "response": {
  //               "headers": undefined,
  //               "id": "id-0",
  //               "messages": [
  //                 {
  //                   "content": [
  //                     {
  //                       "providerOptions": undefined,
  //                       "text": "{ "value": "Hello, world!" }",
  //                       "type": "text",
  //                     },
  //                   ],
  //                   "role": "assistant",
  //                 },
  //               ],
  //               "modelId": "mock-model-id",
  //               "timestamp": 1970-01-01T00:00:00.000Z,
  //             },
  //             "sources": [],
  //             "staticToolCalls": [],
  //             "staticToolResults": [],
  //             "steps": [
  //               DefaultStepResult {
  //                 "content": [
  //                   {
  //                     "providerMetadata": undefined,
  //                     "text": "{ "value": "Hello, world!" }",
  //                     "type": "text",
  //                   },
  //                 ],
  //                 "finishReason": "stop",
  //                 "providerMetadata": undefined,
  //                 "request": {},
  //                 "response": {
  //                   "headers": undefined,
  //                   "id": "id-0",
  //                   "messages": [
  //                     {
  //                       "content": [
  //                         {
  //                           "providerOptions": undefined,
  //                           "text": "{ "value": "Hello, world!" }",
  //                           "type": "text",
  //                         },
  //                       ],
  //                       "role": "assistant",
  //                     },
  //                   ],
  //                   "modelId": "mock-model-id",
  //                   "timestamp": 1970-01-01T00:00:00.000Z,
  //                 },
  //                 "usage": {
  //                   "cachedInputTokens": undefined,
  //                   "inputTokens": 3,
  //                   "outputTokens": 10,
  //                   "reasoningTokens": undefined,
  //                   "totalTokens": 13,
  //                 },
  //                 "warnings": [],
  //               },
  //             ],
  //             "text": "{ "value": "Hello, world!" }",
  //             "toolCalls": [],
  //             "toolResults": [],
  //             "totalUsage": {
  //               "cachedInputTokens": undefined,
  //               "inputTokens": 3,
  //               "outputTokens": 10,
  //               "reasoningTokens": undefined,
  //               "totalTokens": 13,
  //             },
  //             "usage": {
  //               "cachedInputTokens": undefined,
  //               "inputTokens": 3,
  //               "outputTokens": 10,
  //               "reasoningTokens": undefined,
  //               "totalTokens": 13,
  //             },
  //             "warnings": [],
  //           }
  //         `);
  //       });
  //     });
  //   });

  //   describe.skip('options.messages', () => {
  //     it('should support models that use "this" context in supportedUrls', async () => {
  //       let supportedUrlsCalled = false;
  //       class MockLanguageModelWithImageSupport extends MockLanguageModelV2 {
  //         constructor() {
  //           super({
  //             supportedUrls() {
  //               supportedUrlsCalled = true;
  //               // Reference 'this' to verify context
  //               return this.modelId === 'mock-model-id'
  //                 ? ({ 'image/*': [/^https:\/\/.*$/] } as Record<string, RegExp[]>)
  //                 : {};
  //             },
  //             doStream: async () => ({
  //               stream: convertArrayToReadableStream([
  //                 { type: 'text-start', id: '1' },
  //                 { type: 'text-delta', id: '1', delta: 'Hello' },
  //                 { type: 'text-delta', id: '1', delta: ', ' },
  //                 { type: 'text-delta', id: '1', delta: 'world!' },
  //                 { type: 'text-end', id: '1' },
  //               ]),
  //             }),
  //           });
  //         }
  //       }

  //       const model = new MockLanguageModelWithImageSupport();
  //       const result = await loopFn({
  //         methodType: 'stream',
  //         runId,
  //         model,
  //         messages: [
  //           {
  //             role: 'user',
  //             content: [{ type: 'image', image: 'https://example.com/test.jpg' }],
  //           },
  //         ],
  //       });

  //       await result.aisdk.v5.consumeStream();

  //       expect(supportedUrlsCalled).toBe(true);
  //       expect(result.text).toBe('Hello, world!');
  //     });
  //   });

  describe('raw chunks forwarding', () => {
    it('should forward raw chunks when includeRawChunks is enabled', async () => {
      const messageList = createMessageListWithUserMessage();

      const modelWithRawChunks = createTestModels({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'raw',
            rawValue: {
              type: 'raw-data',
              content: 'should appear',
            },
          },
          {
            type: 'response-metadata',
            id: 'test-id',
            modelId: 'test-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello, world!' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: testUsage,
          },
        ]),
      });

      const result = await loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models: modelWithRawChunks,
        messageList,
        includeRawChunks: true,
      });

      const chunks = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toMatchInlineSnapshot(`
          [
            {
              "rawValue": {
                "content": "should appear",
                "type": "raw-data",
              },
              "type": "raw",
            },
          ]
        `);
    });

    it('should not forward raw chunks when includeRawChunks is disabled', async () => {
      const messageList = createMessageListWithUserMessage();

      const modelWithRawChunks = createTestModels({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'raw',
            rawValue: {
              type: 'raw-data',
              content: 'should not appear',
            },
          },
          {
            type: 'response-metadata',
            id: 'test-id',
            modelId: 'test-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello, world!' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: testUsage,
          },
        ]),
      });

      const result = await loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models: modelWithRawChunks,
        messageList,
        includeRawChunks: false,
      });

      const chunks = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

      expect(chunks.filter(chunk => chunk.type === 'raw')).toHaveLength(0);
    });

    it('should pass through the includeRawChunks flag correctly to the model', async () => {
      const messageList = createMessageListWithUserMessage();
      let capturedOptions: any;

      const models = [
        {
          id: 'test-model',
          maxRetries: 0,
          model: new MockLanguageModelV2({
            doStream: async options => {
              capturedOptions = options;

              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'finish', finishReason: 'stop', usage: testUsage },
                ]),
              };
            },
          }),
        },
      ];

      const result = await loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models,
        messageList,
        includeRawChunks: true,
      });

      await result.aisdk.v5.consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(true);
    });

    it('should call onChunk with raw chunks when includeRawChunks is enabled', async () => {
      const messageList = createMessageListWithUserMessage();
      const onChunkCalls: Array<any> = [];

      const modelWithRawChunks = createTestModels({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'raw',
            rawValue: { type: 'stream-start', data: 'start' },
          },
          {
            type: 'raw',
            rawValue: {
              type: 'response-metadata',
              id: 'test-id',
              modelId: 'test-model',
            },
          },
          {
            type: 'raw',
            rawValue: { type: 'text-delta', content: 'Hello' },
          },
          {
            type: 'raw',
            rawValue: { type: 'text-delta', content: ', world!' },
          },
          {
            type: 'raw',
            rawValue: { type: 'finish', reason: 'stop' },
          },
          {
            type: 'response-metadata',
            id: 'test-id',
            modelId: 'test-model',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Hello, world!' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: testUsage,
          },
        ]),
      });

      const result = await loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: modelWithRawChunks,
        messageList,
        includeRawChunks: true,
        options: {
          onChunk(chunk) {
            onChunkCalls.push(chunk);
          },
        },
      });

      await result.aisdk.v5.consumeStream();

      expect(onChunkCalls).toMatchInlineSnapshot(`
        [
          {
            "from": "AGENT",
            "payload": {
              "data": "start",
              "type": "stream-start",
            },
            "runId": "test-run-id",
            "type": "raw",
          },
          {
            "from": "AGENT",
            "payload": {
              "id": "test-id",
              "modelId": "test-model",
              "type": "response-metadata",
            },
            "runId": "test-run-id",
            "type": "raw",
          },
          {
            "from": "AGENT",
            "payload": {
              "content": "Hello",
              "type": "text-delta",
            },
            "runId": "test-run-id",
            "type": "raw",
          },
          {
            "from": "AGENT",
            "payload": {
              "content": ", world!",
              "type": "text-delta",
            },
            "runId": "test-run-id",
            "type": "raw",
          },
          {
            "from": "AGENT",
            "payload": {
              "reason": "stop",
              "type": "finish",
            },
            "runId": "test-run-id",
            "type": "raw",
          },
          {
            "from": "AGENT",
            "payload": {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello, world!",
            },
            "runId": "test-run-id",
            "type": "text-delta",
          },
        ]
      `);
    });

    it('should pass includeRawChunks flag correctly to the model', async () => {
      const messageList = createMessageListWithUserMessage();
      let capturedOptions: any;

      const models = [
        {
          id: 'test-model',
          maxRetries: 0,
          model: new MockLanguageModelV2({
            doStream: async options => {
              capturedOptions = options;
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'response-metadata',
                    id: 'test-id',
                    modelId: 'test-model',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'Hello' },
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
      ];

      const result = await loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models,
        messageList,
        includeRawChunks: true,
      });
      await result.aisdk.v5.consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(true);

      const result2 = await loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models,
        messageList,
        includeRawChunks: false,
      });
      await result2.aisdk.v5.consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(false);

      const result3 = await loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models,
        messageList,
      });
      await result3.aisdk.v5.consumeStream();

      expect(capturedOptions.includeRawChunks).toBe(false);
    });
  });

  describe('mixed multi content streaming with interleaving parts', () => {
    describe('mixed text and reasoning blocks', () => {
      const messageList = createMessageListWithUserMessage();
      let result: any;

      beforeEach(async () => {
        result = await loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          models: createTestModels({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'reasoning-start', id: '0' },
              { type: 'text-start', id: '1' },
              { type: 'reasoning-delta', id: '0', delta: 'Thinking...' },
              { type: 'text-delta', id: '1', delta: 'Hello' },
              { type: 'text-delta', id: '1', delta: ', ' },
              { type: 'text-start', id: '2' },
              { type: 'text-delta', id: '2', delta: `This ` },
              { type: 'text-delta', id: '2', delta: `is ` },
              { type: 'reasoning-start', id: '3' },
              { type: 'reasoning-delta', id: '0', delta: `I'm thinking...` },
              { type: 'reasoning-delta', id: '3', delta: `Separate thoughts` },
              { type: 'text-delta', id: '2', delta: `a` },
              { type: 'text-delta', id: '1', delta: `world!` },
              { type: 'reasoning-end', id: '0' },
              { type: 'text-delta', id: '2', delta: ` test.` },
              { type: 'text-end', id: '2' },
              { type: 'reasoning-end', id: '3' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: testUsage,
              },
            ]),
          }),
          messageList,
          _internal: {
            currentDate: mockValues(new Date(2000)),
            generateId: mockId(),
          },
        });
      });

      it('should return the full stream with the correct parts', async () => {
        expect(await convertAsyncIterableToArray(result.aisdk.v5.fullStream)).toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "request": {},
              "type": "start-step",
              "warnings": [],
            },
            {
              "id": "0",
              "providerMetadata": undefined,
              "type": "reasoning-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "type": "text-start",
            },
            {
              "id": "0",
              "providerMetadata": undefined,
              "text": "Thinking...",
              "type": "reasoning-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": ", ",
              "type": "text-delta",
            },
            {
              "id": "2",
              "providerMetadata": undefined,
              "type": "text-start",
            },
            {
              "id": "2",
              "providerMetadata": undefined,
              "text": "This ",
              "type": "text-delta",
            },
            {
              "id": "2",
              "providerMetadata": undefined,
              "text": "is ",
              "type": "text-delta",
            },
            {
              "id": "3",
              "providerMetadata": undefined,
              "type": "reasoning-start",
            },
            {
              "id": "0",
              "providerMetadata": undefined,
              "text": "I'm thinking...",
              "type": "reasoning-delta",
            },
            {
              "id": "3",
              "providerMetadata": undefined,
              "text": "Separate thoughts",
              "type": "reasoning-delta",
            },
            {
              "id": "2",
              "providerMetadata": undefined,
              "text": "a",
              "type": "text-delta",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "world!",
              "type": "text-delta",
            },
            {
              "id": "0",
              "providerMetadata": undefined,
              "type": "reasoning-end",
            },
            {
              "id": "2",
              "providerMetadata": undefined,
              "text": " test.",
              "type": "text-delta",
            },
            {
              "id": "2",
              "providerMetadata": undefined,
              "type": "text-end",
            },
            {
              "id": "3",
              "providerMetadata": undefined,
              "type": "reasoning-end",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "type": "text-end",
            },
            {
              "finishReason": "stop",
              "providerMetadata": undefined,
              "response": {
                "headers": undefined,
                "id": "id-1",
                "modelId": "mock-model-id",
                "modelMetadata": {
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
                },
                "modelProvider": "mock-provider",
                "modelVersion": "v2",
                "timestamp": 1970-01-01T00:00:02.000Z,
              },
              "type": "finish-step",
              "usage": {
                "inputTokens": 3,
                "outputTokens": 10,
                "totalTokens": 13,
              },
            },
            {
              "finishReason": "stop",
              "totalUsage": {
                "inputTokens": 3,
                "outputTokens": 10,
                "totalTokens": 13,
              },
              "type": "finish",
            },
          ]
        `);
      });

      it.skip('should return the content parts in the correct order', async () => {
        await result.aisdk.v5.consumeStream();

        expect(await result.aisdk.v5.content).toMatchInlineSnapshot(`
          [
            {
              "providerMetadata": undefined,
              "text": "Thinking...I'm thinking...",
              "type": "reasoning",
            },
            {
              "providerMetadata": undefined,
              "text": "Hello, world!",
              "type": "text",
            },
            {
              "providerMetadata": undefined,
              "text": "This is a test.",
              "type": "text",
            },
            {
              "providerMetadata": undefined,
              "text": "Separate thoughts",
              "type": "reasoning",
            },
          ]
        `);
      });

      it.skip('should return the step content parts in the correct order', async () => {
        await result.aisdk.v5.consumeStream();

        expect(await result.aisdk.v5.steps).toMatchInlineSnapshot(`
          [
            DefaultStepResult {
              "content": [
                {
                  "providerMetadata": undefined,
                  "text": "Thinking...I'm thinking...",
                  "type": "reasoning",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Hello, world!",
                  "type": "text",
                },
                {
                  "providerMetadata": undefined,
                  "text": "This is a test.",
                  "type": "text",
                },
                {
                  "providerMetadata": undefined,
                  "text": "Separate thoughts",
                  "type": "reasoning",
                },
              ],
              "finishReason": "stop",
              "providerMetadata": undefined,
              "request": {},
              "response": {
                "headers": undefined,
                "id": "id-0",
                "messages": [
                  {
                    "content": [
                      {
                        "providerOptions": undefined,
                        "text": "Thinking...I'm thinking...",
                        "type": "reasoning",
                      },
                      {
                        "providerOptions": undefined,
                        "text": "Hello, world!",
                        "type": "text",
                      },
                      {
                        "providerOptions": undefined,
                        "text": "This is a test.",
                        "type": "text",
                      },
                      {
                        "providerOptions": undefined,
                        "text": "Separate thoughts",
                        "type": "reasoning",
                      },
                    ],
                    "role": "assistant",
                  },
                ],
                "modelId": "mock-model-id",
                "timestamp": 1970-01-01T00:00:02.000Z,
              },
              "usage": {
                "cachedInputTokens": undefined,
                "inputTokens": 3,
                "outputTokens": 10,
                "reasoningTokens": undefined,
                "totalTokens": 13,
              },
              "warnings": [],
            },
          ]
        `);
      });
    });
  });

  describe('abort signal', () => {
    describe('basic abort', () => {
      let result: any;
      let onErrorCalls: Array<{ error: unknown }> = [];
      let onAbortCalls: Array<{ steps: any[] }> = [];

      beforeEach(async () => {
        const messageList = createMessageListWithUserMessage();
        onErrorCalls = [];
        onAbortCalls = [];

        const abortController = new AbortController();
        let pullCalls = 0;

        result = await loopFn({
          methodType: 'stream',
          runId,
          agentId: 'agent-id',
          options: {
            abortSignal: abortController.signal,
            onError: error => {
              onErrorCalls.push({ error });
            },
            onAbort: event => {
              onAbortCalls.push(event);
            },
          },
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
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
                          controller.enqueue({
                            type: 'text-delta',
                            id: '1',
                            delta: 'Hello',
                          });
                          break;
                        case 3:
                          abortController.abort();
                          controller.error(new DOMException('The user aborted a request.', 'AbortError'));
                          break;
                      }
                    },
                  }),
                }),
              }),
            },
          ],
          messageList,
          _internal: {
            generateId: mockId({ prefix: 'id' }),
          },
        });
      });

      it('should not call onError for abort errors', async () => {
        await result.aisdk.v5.consumeStream();
        expect(onErrorCalls).toMatchInlineSnapshot(`[]`);
      });

      it('should call onAbort when the abort signal is triggered', async () => {
        await result.aisdk.v5.consumeStream();
        expect(onAbortCalls).toMatchInlineSnapshot(`
          [
            {
              "steps": [],
            },
          ]
        `);
      });

      it('should only stream initial chunks in full stream', async () => {
        expect(await convertAsyncIterableToArray(result.aisdk.v5.fullStream)).toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "request": {},
              "type": "start-step",
              "warnings": [],
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
              "type": "text-delta",
            },
            {
              "type": "abort",
            },
          ]
        `);
      });

      it('should sent an abort chunk in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.aisdk.v5.toUIMessageStream())).toMatchInlineSnapshot(`
          [
            {
              "messageId": "id-0",
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello",
              "id": "1",
              "type": "text-delta",
            },
            {
              "type": "abort",
            },
          ]
        `);
      });
    });

    describe('abort in 2nd step', () => {
      let result: any;
      let onErrorCalls: Array<{ error: unknown }> = [];
      let onAbortCalls: Array<{ steps: any[] }> = [];

      beforeEach(async () => {
        onErrorCalls = [];
        onAbortCalls = [];

        const abortController = new AbortController();
        let pullCalls = 0;
        let streamCalls = 0;

        result = loopFn({
          methodType: 'stream',
          runId,
          messageList: createMessageListWithUserMessage(),
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
                  stream: new ReadableStream({
                    start() {
                      streamCalls++;
                      pullCalls = 0;
                    },
                    pull(controller) {
                      if (streamCalls === 1) {
                        switch (pullCalls++) {
                          case 0:
                            controller.enqueue({
                              type: 'stream-start',
                              warnings: [],
                            });
                            break;
                          case 1:
                            controller.enqueue({
                              type: 'tool-call',
                              toolCallId: 'call-1',
                              toolName: 'tool1',
                              input: `{ "value": "value" }`,
                            });
                            break;
                          case 2:
                            controller.enqueue({
                              type: 'finish',
                              finishReason: 'tool-calls',
                              usage: testUsage,
                            });
                            controller.close();
                            break;
                        }
                      } else
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
                            controller.enqueue({
                              type: 'text-delta',
                              id: '1',
                              delta: 'Hello',
                            });
                            break;
                          case 3:
                            abortController.abort();
                            controller.error(new DOMException('The user aborted a request.', 'AbortError'));
                            break;
                        }
                    },
                  }),
                }),
              }),
            },
          ],
          tools: {
            tool1: {
              inputSchema: z.object({ value: z.string() }),
              execute: async () => 'result1',
            },
          },
          stopWhen: stepCountIs(3),
          ...defaultSettings(),
          options: {
            abortSignal: abortController.signal,
            onAbort: event => {
              onAbortCalls.push(event);
            },
            onError: error => {
              onErrorCalls.push({ error });
            },
          },
        });
      });

      it('should not call onError for abort errors', async () => {
        await result.aisdk.v5.consumeStream();
        expect(onErrorCalls).toMatchInlineSnapshot(`[]`);
      });

      it.skip('should call onAbort when the abort signal is triggered', async () => {
        await result.aisdk.v5.consumeStream();
        console.log('onAbortCalls', JSON.stringify(onAbortCalls, null, 2));
        expect(onAbortCalls).toMatchInlineSnapshot(`
          [
            {
              "steps": [
                DefaultStepResult {
                  "content": [
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
                      "input": {
                        "value": "value",
                      },
                      "output": "result1",
                      "providerExecuted": undefined,
                      "providerMetadata": undefined,
                      "toolCallId": "call-1",
                      "toolName": "tool1",
                      "type": "tool-result",
                    },
                  ],
                  "finishReason": "tool-calls",
                  "providerMetadata": undefined,
                  "request": {},
                  "response": {
                    "headers": undefined,
                    "id": "id-0",
                    "messages": [
                      {
                        "content": [
                          {
                            "input": {
                              "value": "value",
                            },
                            "providerExecuted": undefined,
                            "providerOptions": undefined,
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-call",
                          },
                        ],
                        "role": "assistant",
                      },
                      {
                        "content": [
                          {
                            "output": {
                              "type": "text",
                              "value": "result1",
                            },
                            "toolCallId": "call-1",
                            "toolName": "tool1",
                            "type": "tool-result",
                          },
                        ],
                        "role": "tool",
                      },
                    ],
                    "modelId": "mock-model-id",
                    "timestamp": 1970-01-01T00:00:00.000Z,
                  },
                  "usage": {
                    "cachedInputTokens": undefined,
                    "inputTokens": 3,
                    "outputTokens": 10,
                    "reasoningTokens": undefined,
                    "totalTokens": 13,
                  },
                  "warnings": [],
                },
              ],
            },
          ]
        `);
      });

      it('should only stream initial chunks in full stream', async () => {
        expect(await convertAsyncIterableToArray(result.aisdk.v5.fullStream)).toMatchInlineSnapshot(`
          [
            {
              "type": "start",
            },
            {
              "request": {},
              "type": "start-step",
              "warnings": [],
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
              "input": {
                "value": "value",
              },
              "output": "result1",
              "providerExecuted": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-result",
            },
            {
              "finishReason": "tool-calls",
              "providerMetadata": undefined,
              "response": {
                "headers": undefined,
                "id": "id-0",
                "modelId": "mock-model-id",
                "modelMetadata": {
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
                },
                "modelProvider": "mock-provider",
                "modelVersion": "v2",
                "timestamp": 1970-01-01T00:00:00.000Z,
              },
              "type": "finish-step",
              "usage": {
                "inputTokens": 3,
                "outputTokens": 10,
                "totalTokens": 13,
              },
            },
            {
              "request": {},
              "type": "start-step",
              "warnings": [],
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "type": "text-start",
            },
            {
              "id": "1",
              "providerMetadata": undefined,
              "text": "Hello",
              "type": "text-delta",
            },
            {
              "type": "abort",
            },
          ]
        `);
      });

      it('should sent an abort chunk in the ui message stream', async () => {
        expect(await convertAsyncIterableToArray(result.aisdk.v5.toUIMessageStream())).toMatchInlineSnapshot(`
          [
            {
              "messageId": "msg-0",
              "type": "start",
            },
            {
              "type": "start-step",
            },
            {
              "input": {
                "value": "value",
              },
              "toolCallId": "call-1",
              "toolName": "tool1",
              "type": "tool-input-available",
            },
            {
              "output": "result1",
              "toolCallId": "call-1",
              "type": "tool-output-available",
            },
            {
              "type": "finish-step",
            },
            {
              "type": "start-step",
            },
            {
              "id": "1",
              "type": "text-start",
            },
            {
              "delta": "Hello",
              "id": "1",
              "type": "text-delta",
            },
            {
              "type": "abort",
            },
          ]
        `);
      });
    });
  });
}
