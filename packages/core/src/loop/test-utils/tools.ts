import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { dynamicTool, jsonSchema, stepCountIs } from 'ai-v5';
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
  MockLanguageModelV2,
  mockValues,
  mockId,
} from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import type { MastraModelOutput } from '../../stream/base/output';
import type { loop } from '../loop';
import { createMessageListWithUserMessage, createTestModels, defaultSettings, testUsage } from './utils';

export function toolsTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe.skip('provider-executed tools', () => {
    describe('single provider-executed tool call and result', () => {
      let result: MastraModelOutput;

      beforeEach(async () => {
        result = await loopFn({
          methodType: 'stream',
          runId,
          messageList: createMessageListWithUserMessage(),
          models: createTestModels({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-input-start',
                id: 'call-1',
                toolName: 'web_search',
                providerExecuted: true,
              },
              {
                type: 'tool-input-delta',
                id: 'call-1',
                delta: '{ "value": "value" }',
              },
              {
                type: 'tool-input-end',
                id: 'call-1',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'web_search',
                input: `{ "value": "value" }`,
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'web_search',
                result: `{ "value": "result1" }`,
                providerExecuted: true,
              },
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'web_search',
                input: `{ "value": "value" }`,
                providerExecuted: true,
              },
              {
                type: 'tool-result',
                toolCallId: 'call-2',
                toolName: 'web_search',
                result: `ERROR`,
                isError: true,
                providerExecuted: true,
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            web_search: {
              type: 'provider-defined',
              id: 'test.web_search',
              name: 'web_search',
              inputSchema: z.object({ value: z.string() }),
              outputSchema: z.object({ value: z.string() }),
              args: {},
            },
          },
          ...defaultSettings(),
          stopWhen: stepCountIs(4),
        });
      });

      it('should only execute a single step', async () => {
        await result.aisdk.v5.consumeStream();
        expect((await result.aisdk.v5.steps).length).toBe(1);
      });

      it('should include provider-executed tool call and result content', async () => {
        await result.aisdk.v5.consumeStream();
        expect(result.aisdk.v5.content).toMatchInlineSnapshot(`
          [
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-call",
            },
            {
              "input": {
                "value": "value",
              },
              "output": "{ "value": "result1" }",
              "providerExecuted": true,
              "toolCallId": "call-1",
              "toolName": "web_search",
              "type": "tool-result",
            },
            {
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "providerMetadata": undefined,
              "toolCallId": "call-2",
              "toolName": "web_search",
              "type": "tool-call",
            },
            {
              "error": "ERROR",
              "input": {
                "value": "value",
              },
              "providerExecuted": true,
              "toolCallId": "call-2",
              "toolName": "web_search",
              "type": "tool-error",
            },
          ]
        `);
      });

      it('should include provider-executed tool call and result in the full stream', async () => {
        expect(await convertAsyncIterableToArray(result.aisdk.v5.fullStream as any)).toMatchInlineSnapshot(`
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
                "dynamic": false,
                "id": "call-1",
                "providerExecuted": true,
                "toolName": "web_search",
                "type": "tool-input-start",
              },
              {
                "delta": "{ "value": "value" }",
                "id": "call-1",
                "type": "tool-input-delta",
              },
              {
                "id": "call-1",
                "type": "tool-input-end",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-call",
              },
              {
                "input": {
                  "value": "value",
                },
                "output": "{ "value": "result1" }",
                "providerExecuted": true,
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-result",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "providerMetadata": undefined,
                "toolCallId": "call-2",
                "toolName": "web_search",
                "type": "tool-call",
              },
              {
                "error": "ERROR",
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "toolCallId": "call-2",
                "toolName": "web_search",
                "type": "tool-error",
              },
              {
                "finishReason": "stop",
                "providerMetadata": undefined,
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
                "usage": {
                  "cachedInputTokens": undefined,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": undefined,
                  "totalTokens": 13,
                },
              },
              {
                "finishReason": "stop",
                "totalUsage": {
                  "cachedInputTokens": undefined,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": undefined,
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include provider-executed tool call and result in the ui message stream', async () => {
        expect(await convertReadableStreamToArray(result.aisdk.v5.toUIMessageStream())).toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "dynamic": false,
                "providerExecuted": true,
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-input-start",
              },
              {
                "inputTextDelta": "{ "value": "value" }",
                "toolCallId": "call-1",
                "type": "tool-input-delta",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "toolCallId": "call-1",
                "toolName": "web_search",
                "type": "tool-input-available",
              },
              {
                "output": "{ "value": "result1" }",
                "providerExecuted": true,
                "toolCallId": "call-1",
                "type": "tool-output-available",
              },
              {
                "input": {
                  "value": "value",
                },
                "providerExecuted": true,
                "toolCallId": "call-2",
                "toolName": "web_search",
                "type": "tool-input-available",
              },
              {
                "errorText": "ERROR",
                "providerExecuted": true,
                "toolCallId": "call-2",
                "type": "tool-output-error",
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
  });

  describe.skip('dynamic tools', () => {
    describe('single dynamic tool call and result', () => {
      let result: MastraModelOutput;

      beforeEach(async () => {
        result = await loopFn({
          methodType: 'stream',
          runId,
          messageList: createMessageListWithUserMessage(),
          models: createTestModels({
            stream: convertArrayToReadableStream([
              {
                type: 'tool-input-start',
                id: 'call-1',
                toolName: 'dynamicTool',
              },
              {
                type: 'tool-input-delta',
                id: 'call-1',
                delta: '{ "value": "value" }',
              },
              {
                type: 'tool-input-end',
                id: 'call-1',
              },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'dynamicTool',
                input: `{ "value": "value" }`,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: testUsage,
              },
            ]),
          }),
          tools: {
            dynamicTool: dynamicTool({
              inputSchema: z.object({ value: z.string() }),
              execute: async () => {
                return { value: 'test-result' };
              },
            }),
          },
          ...defaultSettings(),
        });
      });

      it('should include dynamic tool call and result content', async () => {
        await result.aisdk.v5.consumeStream();

        console.log(JSON.stringify(result.aisdk.v5.content, null, 2));

        expect(result.aisdk.v5.content).toMatchInlineSnapshot(`
          [
            {
              "dynamic": true,
              "input": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "toolCallId": "call-1",
              "toolName": "dynamicTool",
              "type": "tool-call",
            },
            {
              "dynamic": true,
              "input": {
                "value": "value",
              },
              "output": {
                "value": "test-result",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "toolCallId": "call-1",
              "toolName": "dynamicTool",
              "type": "tool-result",
            },
          ]
        `);
      });

      it('should include dynamic tool call and result in the full stream', async () => {
        const fullStream = await convertAsyncIterableToArray(result.aisdk.v5.fullStream as any);

        console.log(JSON.stringify(fullStream, null, 2));

        expect(fullStream).toMatchInlineSnapshot(`
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
                "dynamic": true,
                "id": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-input-start",
              },
              {
                "delta": "{ "value": "value" }",
                "id": "call-1",
                "type": "tool-input-delta",
              },
              {
                "id": "call-1",
                "type": "tool-input-end",
              },
              {
                "dynamic": true,
                "input": {
                  "value": "value",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-call",
              },
              {
                "dynamic": true,
                "input": {
                  "value": "value",
                },
                "output": {
                  "value": "test-result",
                },
                "providerExecuted": undefined,
                "providerMetadata": undefined,
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-result",
              },
              {
                "finishReason": "tool-calls",
                "providerMetadata": undefined,
                "response": {
                  "headers": undefined,
                  "id": "id-0",
                  "modelId": "mock-model-id",
                  "timestamp": 1970-01-01T00:00:00.000Z,
                },
                "type": "finish-step",
                "usage": {
                  "cachedInputTokens": undefined,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": undefined,
                  "totalTokens": 13,
                },
              },
              {
                "finishReason": "tool-calls",
                "totalUsage": {
                  "cachedInputTokens": undefined,
                  "inputTokens": 3,
                  "outputTokens": 10,
                  "reasoningTokens": undefined,
                  "totalTokens": 13,
                },
                "type": "finish",
              },
            ]
          `);
      });

      it('should include dynamic tool call and result in the ui message stream', async () => {
        expect(await convertReadableStreamToArray(result.aisdk.v5.toUIMessageStream())).toMatchInlineSnapshot(`
            [
              {
                "type": "start",
              },
              {
                "type": "start-step",
              },
              {
                "dynamic": true,
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-input-start",
              },
              {
                "inputTextDelta": "{ "value": "value" }",
                "toolCallId": "call-1",
                "type": "tool-input-delta",
              },
              {
                "dynamic": true,
                "input": {
                  "value": "value",
                },
                "toolCallId": "call-1",
                "toolName": "dynamicTool",
                "type": "tool-input-available",
              },
              {
                "dynamic": true,
                "output": {
                  "value": "test-result",
                },
                "toolCallId": "call-1",
                "type": "tool-output-available",
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
  });

  describe('tool callbacks', () => {
    it('should invoke callbacks in the correct order', async () => {
      const messageList = createMessageListWithUserMessage();
      const recordedCalls: unknown[] = [];

      const result = await loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: createTestModels({
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
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          'test-tool': {
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
            onInputAvailable: (options: any) => {
              recordedCalls.push({ type: 'onInputAvailable', options });
            },
            onInputStart: (options: any) => {
              recordedCalls.push({ type: 'onInputStart', options });
            },
            onInputDelta: (options: any) => {
              recordedCalls.push({ type: 'onInputDelta', options });
            },
          },
        },
        toolChoice: 'required',
        messageList,
        _internal: {
          now: mockValues(0, 100, 500),
        },
      });

      await result.aisdk.v5.consumeStream();

      expect(recordedCalls).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "abortSignal": undefined,
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputStart",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "{"",
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "value",
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "":"",
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "Spark",
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "le",
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": " Day",
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": ""}",
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "input": {
                "value": "Sparkle Day",
              },
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
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputAvailable",
          },
        ]
      `);
    });
  });

  describe('tools with custom schema', () => {
    it('should send tool calls', async () => {
      const messageList = createMessageListWithUserMessage();
      const result = await loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockLanguageModelV2({
              doStream: async ({ prompt, tools, toolChoice }) => {
                expect(tools).toStrictEqual([
                  {
                    type: 'function',
                    name: 'tool1',
                    description: undefined,
                    inputSchema: {
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
                    },
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
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
          },
        },
        toolChoice: 'required',
        messageList,
        _internal: {
          now: mockValues(0, 100, 500),
          generateId: mockId({ prefix: 'id' }),
        },
      });

      expect(await convertAsyncIterableToArray(result.aisdk.v5.fullStream as any)).toMatchSnapshot();
    });
  });

  describe('tool execution errors', () => {
    let result: MastraModelOutput;

    beforeEach(async () => {
      result = await loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: createTestModels({
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
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async (): Promise<string> => {
              throw new Error('test error');
            },
          },
        },
        ...defaultSettings(),
      });
    });

    it('should include tool error part in the full stream', async () => {
      const fullStream = await convertAsyncIterableToArray(result.aisdk.v5.fullStream as any);

      console.log(fullStream);

      expect(fullStream).toMatchInlineSnapshot(`
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
            "error": [Error: test error],
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-error",
          },
          {
            "finishReason": "stop",
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

    it.skip('should include the error part in the step stream', async () => {
      await result.aisdk.v5.consumeStream();

      console.log(JSON.stringify(result.aisdk.v5.steps, null, 2));

      expect(result.aisdk.v5.steps).toMatchInlineSnapshot(`
            [
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
                    "error": [Error: test error],
                    "input": {
                      "value": "value",
                    },
                    "providerExecuted": undefined,
                    "providerMetadata": undefined,
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-error",
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
                            "type": "error-text",
                            "value": "test error",
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
            ]
          `);
    });

    it.skip('should include error result in response messages', async () => {
      await result.aisdk.v5.consumeStream();

      expect((await result.aisdk.v5.response).messages).toMatchInlineSnapshot(`
            [
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
                      "type": "error-text",
                      "value": "test error",
                    },
                    "toolCallId": "call-1",
                    "toolName": "tool1",
                    "type": "tool-result",
                  },
                ],
                "role": "tool",
              },
            ]
          `);
    });

    it('should add tool-error parts to ui message stream', async () => {
      const uiMessageStream = await convertReadableStreamToArray(result.aisdk.v5.toUIMessageStream());

      expect(uiMessageStream).toMatchInlineSnapshot(`
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
            "errorText": "test error",
            "toolCallId": "call-1",
            "type": "tool-output-error",
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

  describe('providerExecuted tools should not be re-executed', () => {
    it('should handle Claude Code SDK-style provider-executed tools', async () => {
      // This test simulates the exact scenario from issue #7558
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'claude-code-model',
              timestamp: new Date(0),
            },
            // Simulate Claude Code SDK's file reading tool
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'str_replace_editor',
              input: JSON.stringify({
                command: 'view',
                path: '/src/app.ts',
                view_range: [1, 50],
              }),
              providerExecuted: true,
            },
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'str_replace_editor',
              result: {
                content: '// app.ts file content\nexport function main() {\n  console.log("Hello");\n}',
                line_count: 4,
              },
              providerExecuted: true,
            },
            {
              type: 'text-delta',
              id: 'text-1',
              delta: 'I can see your app.ts file. It contains a main function that logs "Hello".',
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {},
        ...defaultSettings(),
      });

      // Should complete without "tool not found" error
      const stream = result.aisdk.v5.fullStream;
      const chunks = await convertAsyncIterableToArray(stream);

      // Verify tool-result chunk exists with provider output
      const toolResultChunk = chunks.find((c: any) => c.type === 'tool-result');
      expect(toolResultChunk).toBeDefined();
      // as any because we're testing a case where there's a provider defined tool that's not added to tools: {} in agent definition, so there's no output type
      expect((toolResultChunk as any)?.output).toEqual({
        content: '// app.ts file content\nexport function main() {\n  console.log("Hello");\n}',
        line_count: 4,
      });
      expect((toolResultChunk as any)?.providerExecuted).toBe(true);

      // Verify we also get the text response
      const textChunks = chunks.filter((c: any) => c.type === 'text-delta');
      expect(textChunks.length).toBeGreaterThan(0);
    });
  });
}
