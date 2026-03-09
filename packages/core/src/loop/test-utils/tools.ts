import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { dynamicTool, jsonSchema, stepCountIs } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, mockValues, mockId } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import z from 'zod/v4';
import type { MastraModelOutput } from '../../stream/base/output';
import type { loop } from '../loop';
import { createMessageListWithUserMessage, createTestModels, defaultSettings, testUsage } from './utils';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';

export function toolsTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe.skip('provider-executed tools', () => {
    describe('single provider-executed tool call and result', () => {
      let result: MastraModelOutput<unknown>;

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
        await result.consumeStream();
        expect((await result.steps).length).toBe(1);
      });

      it('should include provider-executed tool call and result content', async () => {
        await result.consumeStream();
        expect(result.content).toMatchInlineSnapshot(`
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
        expect(await convertAsyncIterableToArray(result.fullStream as any)).toMatchInlineSnapshot(`
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
    });
  });

  describe.skip('dynamic tools', () => {
    describe('single dynamic tool call and result', () => {
      let result: MastraModelOutput<unknown>;

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
        await result.consumeStream();

        console.log(JSON.stringify(result.content, null, 2));

        expect(result.content).toMatchInlineSnapshot(`
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
        const fullStream = await convertAsyncIterableToArray(result.fullStream as any);

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

      await result.consumeStream();

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

      expect(await convertAsyncIterableToArray(result.fullStream as any)).toMatchSnapshot();
    });
  });

  describe('tool execution errors', () => {
    let result: MastraModelOutput<unknown>;

    beforeEach(async () => {
      let responseCount = 0;
      result = await loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockLanguageModelV2({
              doStream: async () => {
                switch (responseCount++) {
                  case 0:
                    return {
                      warnings: [],
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
                    };
                  case 1:
                    return {
                      warnings: [],
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'id-1',
                          modelId: 'mock-model-id',
                          timestamp: new Date(0),
                        },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'I see the tool failed, let me help.' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: testUsage,
                        },
                      ]),
                    };
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
            execute: async (): Promise<string> => {
              throw new Error('test error');
            },
          },
        },
        stopWhen: stepCountIs(3),
        ...defaultSettings(),
      });
    });

    it('should include tool error part in the full stream', async () => {
      const fullStream = await convertAsyncIterableToArray(result.fullStream as any);

      expect(fullStream).toMatchSnapshot();
    });

    it.skip('should include the error part in the step stream', async () => {
      await result.consumeStream();

      expect(result.steps).toMatchSnapshot();
    });

    it.skip('should include error result in response messages', async () => {
      await result.consumeStream();

      expect((await result.response).messages).toMatchSnapshot();
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
      const stream = result.fullStream;
      const chunks = await convertAsyncIterableToArray(stream);

      // Verify tool-result chunk exists with provider output
      const toolResultChunk = chunks.find((c: any) => c.type === 'tool-result');
      expect(toolResultChunk).toBeDefined();
      // as any because we're testing a case where there's a provider defined tool that's not added to tools: {} in agent definition, so there's no output type
      expect((toolResultChunk as any)?.payload?.result).toEqual({
        content: '// app.ts file content\nexport function main() {\n  console.log("Hello");\n}',
        line_count: 4,
      });
      expect((toolResultChunk as any)?.payload?.providerExecuted).toBe(true);

      // Verify we also get the text response
      const textChunks = chunks.filter((c: any) => c.type === 'text-delta');
      expect(textChunks.length).toBeGreaterThan(0);
    });
  });

  describe('toModelOutput', () => {
    it('should call toModelOutput and use transformed output in subsequent model prompt', async () => {
      const messageList = createMessageListWithUserMessage();
      const toModelOutputCalls: unknown[] = [];
      const stepInputs: any[] = [];

      let responseCount = 0;
      const result = await loopFn({
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
                        {
                          type: 'tool-call',
                          id: 'call-1',
                          toolCallId: 'call-1',
                          toolName: 'weather',
                          input: `{ "city": "Seattle" }`,
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: testUsage,
                        },
                      ]),
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
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'The weather is nice.' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: testUsage,
                        },
                      ]),
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
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => ({
              city,
              temperature: 72,
              conditions: 'sunny',
              humidity: 45,
              wind_speed: 12,
              raw_sensor_data: { sensor_id: 'wx-001', readings: [71.8, 72.1, 72.0] },
            }),
            toModelOutput: (output: unknown) => {
              toModelOutputCalls.push(output);
              const data = output as any;
              return {
                type: 'text' as const,
                value: `Weather in ${data.city}: ${data.temperature}F, ${data.conditions}`,
              };
            },
          },
        },
        messageList,
        stopWhen: stepCountIs(3),
        ...defaultSettings(),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000),
          generateId: mockId({ prefix: 'id' }),
        },
      });

      await result.consumeStream();

      // toModelOutput should have been called with the raw tool result
      expect(toModelOutputCalls).toHaveLength(1);
      expect(toModelOutputCalls[0]).toEqual({
        city: 'Seattle',
        temperature: 72,
        conditions: 'sunny',
        humidity: 45,
        wind_speed: 12,
        raw_sensor_data: { sensor_id: 'wx-001', readings: [71.8, 72.1, 72.0] },
      });

      // The second model call's prompt should contain the transformed output
      expect(stepInputs).toHaveLength(2);
      const secondPrompt = stepInputs[1].prompt;
      const toolMessage = secondPrompt.find((m: any) => m.role === 'tool');
      expect(toolMessage).toBeDefined();

      const toolResult = toolMessage.content.find((p: any) => p.type === 'tool-result');
      expect(toolResult).toBeDefined();
      expect(toolResult.output).toEqual({
        type: 'text',
        value: `Weather in Seattle: 72F, sunny`,
      });
    });
  });

  describe('stopWhen receives toolResults', () => {
    it('should populate toolResults on steps passed to stopWhen', async () => {
      const messageList = createMessageListWithUserMessage();
      const stopWhenSteps: any[][] = [];

      let responseCount = 0;
      const result = await loopFn({
        methodType: 'stream',
        runId,
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockLanguageModelV2({
              doStream: async () => {
                switch (responseCount++) {
                  case 0:
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
                          toolName: 'test-tool',
                          input: '{"value":"hello"}',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: testUsage,
                        },
                      ]),
                    };
                  case 1:
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'id-1',
                          modelId: 'mock-model-id',
                          timestamp: new Date(0),
                        },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'Done.' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: testUsage,
                        },
                      ]),
                    };
                  default:
                    throw new Error(`Unexpected response count: ${responseCount}`);
                }
              },
            }),
          },
        ],
        tools: {
          'test-tool': {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }: { value: string }) => ({ echoed: value }),
          },
        },
        messageList,
        stopWhen: ({ steps }: { steps: any[] }) => {
          stopWhenSteps.push([...steps]);
          return false;
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      // stopWhen should have been called (once per continued step)
      expect(stopWhenSteps.length).toBeGreaterThanOrEqual(1);

      // First call: step has tool-call + tool-result content, toolResults should be populated
      const firstCallStep = stopWhenSteps[0]![0]!;
      const contentToolResults = firstCallStep.content.filter((p: any) => p.type === 'tool-result');
      expect(contentToolResults.length).toBe(1);
      expect(firstCallStep.toolResults.length).toBe(contentToolResults.length);
      expect(firstCallStep.toolResults[0].toolName).toBe('test-tool');
    });
  });
}
