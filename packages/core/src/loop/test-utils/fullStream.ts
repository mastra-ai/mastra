import { delay } from '@ai-sdk/provider-utils-v5';
import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { tool } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2, mockValues, mockId } from 'ai-v5/test';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import type { loop } from '../loop';
import {
  createMessageListWithUserMessage,
  createTestModels,
  defaultSettings,
  mockDate,
  modelWithFiles,
  modelWithReasoning,
  modelWithSources,
  testUsage,
  testUsage2,
} from './utils';

export function fullStreamTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('result.fullStream', () => {
    it('should maintain conversation history in the llm input', async () => {
      const messageList = new MessageList();
      messageList.add(
        [
          {
            role: 'user',
            content: [{ type: 'text', text: 'test-input' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'test-input' }],
          },
        ],
        'memory',
      );
      messageList.add(
        [
          {
            role: 'user',
            content: [{ type: 'text', text: 'test-input' }],
          },
        ],
        'input',
      );
      const result = loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockLanguageModelV2({
              doStream: async ({ prompt }) => {
                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                  {
                    role: 'assistant',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'response-id',
                      modelId: 'response-model-id',
                      timestamp: new Date(5000),
                    },
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
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const data = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);
      expect(data).toMatchInlineSnapshot(`
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
            "id": "1",
            "providerMetadata": undefined,
            "text": ", ",
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
              "headers": undefined,
              "id": "response-id",
              "modelId": "response-model-id",
              "modelMetadata": {
                "modelId": "mock-model-id",
                "modelProvider": "mock-provider",
                "modelVersion": "v2",
              },
              "timestamp": 1970-01-01T00:00:05.000Z,
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

    it('should send text deltas', async () => {
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
              doStream: async ({ prompt }) => {
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
                      id: 'response-id',
                      modelId: 'response-model-id',
                      timestamp: new Date(5000),
                    },
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
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const data = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);
      expect(data).toMatchInlineSnapshot(`
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
            "id": "1",
            "providerMetadata": undefined,
            "text": ", ",
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
              "headers": undefined,
              "id": "response-id",
              "modelId": "response-model-id",
              "modelMetadata": {
                "modelId": "mock-model-id",
                "modelProvider": "mock-provider",
                "modelVersion": "v2",
              },
              "timestamp": 1970-01-01T00:00:05.000Z,
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

    it('should send reasoning deltas', async () => {
      const messageList = createMessageListWithUserMessage();
      const result = await loopFn({
        methodType: 'stream',
        runId,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoning }],
        messageList,
        ...defaultSettings(),
      });

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
            "type": "reasoning-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "I will open the conversation",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": " with witty banter.",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "providerMetadata": {
              "testProvider": {
                "signature": "1234567890",
              },
            },
            "text": "",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "type": "reasoning-end",
          },
          {
            "id": "2",
            "providerMetadata": {
              "testProvider": {
                "redactedData": "redacted-reasoning-data",
              },
            },
            "type": "reasoning-start",
          },
          {
            "id": "2",
            "providerMetadata": undefined,
            "type": "reasoning-end",
          },
          {
            "id": "3",
            "providerMetadata": undefined,
            "type": "reasoning-start",
          },
          {
            "id": "3",
            "providerMetadata": undefined,
            "text": " Once the user has relaxed,",
            "type": "reasoning-delta",
          },
          {
            "id": "3",
            "providerMetadata": undefined,
            "text": " I will pry for valuable information.",
            "type": "reasoning-delta",
          },
          {
            "id": "3",
            "providerMetadata": {
              "testProvider": {
                "signature": "1234567890",
              },
            },
            "type": "reasoning-end",
          },
          {
            "id": "4",
            "providerMetadata": {
              "testProvider": {
                "signature": "1234567890",
              },
            },
            "type": "reasoning-start",
          },
          {
            "id": "4",
            "providerMetadata": undefined,
            "text": " I need to think about",
            "type": "reasoning-delta",
          },
          {
            "id": "4",
            "providerMetadata": undefined,
            "text": " this problem carefully.",
            "type": "reasoning-delta",
          },
          {
            "id": "4",
            "providerMetadata": {
              "testProvider": {
                "signature": "0987654321",
              },
            },
            "type": "reasoning-end",
          },
          {
            "id": "5",
            "providerMetadata": {
              "testProvider": {
                "signature": "1234567890",
              },
            },
            "type": "reasoning-start",
          },
          {
            "id": "5",
            "providerMetadata": undefined,
            "text": " The best solution",
            "type": "reasoning-delta",
          },
          {
            "id": "5",
            "providerMetadata": undefined,
            "text": " requires careful",
            "type": "reasoning-delta",
          },
          {
            "id": "5",
            "providerMetadata": undefined,
            "text": " consideration of all factors.",
            "type": "reasoning-delta",
          },
          {
            "id": "5",
            "providerMetadata": {
              "testProvider": {
                "signature": "0987654321",
              },
            },
            "type": "reasoning-end",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "Hi",
            "type": "text-delta",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": " there!",
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

    it('should send sources', async () => {
      const messageList = createMessageListWithUserMessage();
      const result = await loopFn({
        methodType: 'stream',
        runId,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithSources }],
        messageList,
        ...defaultSettings(),
      });

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
            "id": "1",
            "providerMetadata": undefined,
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "Hello!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "type": "text-end",
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

    it('should send files', async () => {
      const messageList = createMessageListWithUserMessage();
      const result = await loopFn({
        methodType: 'stream',
        runId,
        messageList,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithFiles }],
        ...defaultSettings(),
      });

      const converted = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

      expect(converted).toMatchInlineSnapshot(`
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
            "file": DefaultGeneratedFileWithType {
              "base64Data": "Hello World",
              "mediaType": "text/plain",
              "type": "file",
              "uint8ArrayData": undefined,
            },
            "type": "file",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "type": "text-start",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "text": "Hello!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "providerMetadata": undefined,
            "type": "text-end",
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

    it('should use fallback response metadata when response metadata is not provided', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = await loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        messageList,
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockLanguageModelV2({
              doStream: async ({ prompt }) => {
                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                    // providerOptions: undefined,
                  },
                ]);

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
        _internal: {
          currentDate: mockValues(new Date(2000)),
          generateId: mockValues('id-2000'),
        },
      });

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
            "id": "1",
            "providerMetadata": undefined,
            "text": ", ",
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
              "headers": undefined,
              "id": "id-2000",
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

    it('should send tool calls', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = await loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        messageList,
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
                      $schema: 'http://json-schema.org/draft-07/schema#',
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
                      providerMetadata: {
                        testProvider: {
                          signature: 'sig',
                        },
                      },
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
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        toolChoice: 'required',
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      expect(await convertAsyncIterableToArray(result.aisdk.v5.fullStream)).toMatchSnapshot();
    });

    it('should send tool call deltas', async () => {
      const messageList = createMessageListWithUserMessage();

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
              usage: testUsage2,
            },
          ]),
        }),
        tools: {
          'test-tool': tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        toolChoice: 'required',
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

      console.dir({ fullStream }, { depth: null });

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
            "dynamic": false,
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "toolName": "test-tool",
            "type": "tool-input-start",
          },
          {
            "delta": "{"",
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-delta",
          },
          {
            "delta": "value",
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-delta",
          },
          {
            "delta": "":"",
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-delta",
          },
          {
            "delta": "Spark",
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-delta",
          },
          {
            "delta": "le",
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-delta",
          },
          {
            "delta": " Day",
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-delta",
          },
          {
            "delta": ""}",
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-delta",
          },
          {
            "id": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "providerMetadata": undefined,
            "type": "tool-input-end",
          },
          {
            "input": {
              "value": "Sparkle Day",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            "toolName": "test-tool",
            "type": "tool-call",
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
              "timestamp": 1970-01-01T00:00:00.000Z,
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
            "finishReason": "tool-calls",
            "totalUsage": {
              "cachedInputTokens": 3,
              "inputTokens": 3,
              "outputTokens": 10,
              "reasoningTokens": 10,
              "totalTokens": 23,
            },
            "type": "finish",
          },
        ]
      `);
    });

    it('should send tool results', async () => {
      const messageList = createMessageListWithUserMessage();

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
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
            execute: async (inputData, options) => {
              console.info('TOOL 1', inputData, options);

              expect(inputData).toStrictEqual({ value: 'value' });
              expect(options.messages).toStrictEqual([
                { role: 'user', content: [{ type: 'text', text: 'test-input' }] },
              ]);
              return `${inputData.value}-result`;
            },
          }),
        },
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

      console.dir({ fullStream }, { depth: null });

      expect(fullStream).toMatchSnapshot();
    });

    it('should send delayed asynchronous tool results', async () => {
      vi.useRealTimers();
      const messageList = createMessageListWithUserMessage();

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
            execute: async ({ value }: { value: string }) => {
              await delay(50); // delay to show bug where step finish is sent before tool result
              return `${value}-result`;
            },
          },
        },
        messageList,
        _internal: {
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

      expect(fullStream).toMatchSnapshot();
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    it('should filter out empty text deltas', async () => {
      const messageList = createMessageListWithUserMessage();

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
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: ', ' },
            { type: 'text-delta', id: '1', delta: '' },
            { type: 'text-delta', id: '1', delta: 'world!' },
            { type: 'text-delta', id: '1', delta: '' },
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
          generateId: mockId({ prefix: 'id' }),
        },
      });

      const fullStream = await convertAsyncIterableToArray(result.aisdk.v5.fullStream);

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
            "id": "1",
            "providerMetadata": undefined,
            "text": ", ",
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
  });
}
