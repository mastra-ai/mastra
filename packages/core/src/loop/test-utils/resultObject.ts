import { tool } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream as convertArrayToReadableStreamV2 } from '@internal/ai-sdk-v5/test';
import { convertArrayToReadableStream as convertArrayToReadableStreamV3 } from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v3';
import type { loop } from '../loop';
import {
  createTestModels,
  defaultSettings,
  mockDate,
  modelWithFiles,
  modelWithReasoning,
  modelWithSources,
  testUsage,
  createMessageListWithUserMessage,
} from './utils';
import {
  createTestModelsV3,
  testUsageV3,
  modelWithFilesV3,
  modelWithReasoningV3,
  modelWithSourcesV3,
} from './utils-v3';

export function resultObjectTests({
  loopFn,
  runId,
  modelVersion = 'v2',
}: {
  loopFn: typeof loop;
  runId: string;
  modelVersion?: 'v2' | 'v3';
}) {
  // Version-aware utilities
  const convertArrayToReadableStream =
    modelVersion === 'v2' ? convertArrayToReadableStreamV2 : convertArrayToReadableStreamV3;
  const createTestModelsForVersion = modelVersion === 'v2' ? createTestModels : createTestModelsV3;
  const testUsageForVersion = modelVersion === 'v2' ? testUsage : testUsageV3;
  const modelWithFilesForVersion = modelVersion === 'v2' ? modelWithFiles : modelWithFilesV3;
  const modelWithReasoningForVersion = modelVersion === 'v2' ? modelWithReasoning : modelWithReasoningV3;
  const modelWithSourcesForVersion = modelVersion === 'v2' ? modelWithSources : modelWithSourcesV3;
  describe('result.warnings', () => {
    it('should resolve with warnings', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModelsForVersion({
          warnings: [{ type: 'other', message: 'test-warning' }],
        } as any),
        messageList: createMessageListWithUserMessage(),
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.warnings).toStrictEqual([{ type: 'other', message: 'test-warning' }]);
    });
  });

  describe('result.usage', () => {
    it('should resolve with token usage', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModelsForVersion({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageForVersion,
            },
          ] as any) as any,
        }),
        messageList: createMessageListWithUserMessage(),
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.usage).toMatchObject({
        inputTokens: 3,
        outputTokens: 10,
        totalTokens: 13,
      });
    });
  });

  describe('result.finishReason', () => {
    it('should resolve with finish reason', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModelsForVersion({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageForVersion,
            },
          ] as any) as any,
        }),
        messageList,
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.finishReason).toStrictEqual('stop');
    });
  });

  describe('result.providerMetadata', () => {
    it('should resolve with provider metadata', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModelsForVersion({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageForVersion,
              providerMetadata: {
                testProvider: { testKey: 'testValue' },
              },
            },
          ] as any) as any,
        }),
        messageList,
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.providerMetadata).toStrictEqual({
        testProvider: { testKey: 'testValue' },
      });
    });
  });

  describe('result.response.messages', () => {
    it.todo('should contain reasoning', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoningForVersion }],
        messageList,
        ...defaultSettings(),
        agentId: 'agent-id',
      });

      await result.consumeStream();

      const messages = (await result.response).messages;

      expect(messages).toMatchInlineSnapshot(`
            [
              {
                "content": [
                  {
                    "providerOptions": {
                      "testProvider": {
                        "signature": "1234567890",
                      },
                    },
                    "text": "I will open the conversation with witty banter.",
                    "type": "reasoning",
                  },
                  {
                    "providerOptions": {
                      "testProvider": {
                        "redactedData": "redacted-reasoning-data",
                      },
                    },
                    "text": "",
                    "type": "reasoning",
                  },
                  {
                    "providerOptions": {
                      "testProvider": {
                        "signature": "1234567890",
                      },
                    },
                    "text": " Once the user has relaxed, I will pry for valuable information.",
                    "type": "reasoning",
                  },
                  {
                    "providerOptions": {
                      "testProvider": {
                        "signature": "0987654321",
                      },
                    },
                    "text": " I need to think about this problem carefully.",
                    "type": "reasoning",
                  },
                  {
                    "providerOptions": {
                      "testProvider": {
                        "signature": "0987654321",
                      },
                    },
                    "text": " The best solution requires careful consideration of all factors.",
                    "type": "reasoning",
                  },
                  {
                    "text": "Hi there!",
                    "type": "text",
                  },
                ],
                "role": "assistant",
              },
            ]
          `);
    });
  });

  describe('result.request', () => {
    it('should resolve with response information', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModelsForVersion({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageForVersion,
            },
          ] as any) as any,
          request: { body: 'test body' },
        }),
        agentId: 'agent-id',
        messageList,
      });

      await result.consumeStream();

      expect(await result.request).toStrictEqual({
        body: 'test body',
      });
    });
  });

  describe('result.response', () => {
    it('should resolve with response information', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModelsForVersion({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsageForVersion,
            },
          ] as any) as any,
          response: { headers: { call: '2' } },
        }),
        messageList,
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(await result.response).toMatchSnapshot();
    });
  });

  describe('result.text', () => {
    it('should resolve with full text', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        models: createTestModelsForVersion(),
        messageList: createMessageListWithUserMessage(),
        ...defaultSettings(),
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.text).toMatchSnapshot();
    });
  });

  describe('result.reasoningText', () => {
    it('should contain reasoning text from model response', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoningForVersion }],
        ...defaultSettings(),
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.reasoningText).toMatchSnapshot();
    });
  });

  describe('result.reasoning', () => {
    it('should contain reasoning from model response', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoningForVersion }],
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(await result.reasoning).toMatchSnapshot();
    });
  });

  describe('result.sources', () => {
    it('should contain sources', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithSourcesForVersion }],
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(await result.sources).toMatchSnapshot();
    });
  });

  describe('result.files', () => {
    it('should contain files', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithFilesForVersion }],
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(await result.files).toMatchSnapshot();
    });
  });

  describe('result.steps', () => {
    it.todo('should add the reasoning from the model response to the step result', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithReasoningForVersion }],
        messageList: createMessageListWithUserMessage(),
        ...defaultSettings(),
      });

      await result.consumeStream();

      const steps = await result.steps;
      // console.log('test-steps', JSON.stringify(steps, null, 2));

      expect(steps).toMatchInlineSnapshot(`
            [
              DefaultStepResult {
                "content": [
                  {
                    "providerMetadata": {
                      "testProvider": {
                        "signature": "1234567890",
                      },
                    },
                    "text": "I will open the conversation with witty banter.",
                    "type": "reasoning",
                  },
                  {
                    "providerMetadata": {
                      "testProvider": {
                        "redactedData": "redacted-reasoning-data",
                      },
                    },
                    "text": "",
                    "type": "reasoning",
                  },
                  {
                    "providerMetadata": {
                      "testProvider": {
                        "signature": "1234567890",
                      },
                    },
                    "text": " Once the user has relaxed, I will pry for valuable information.",
                    "type": "reasoning",
                  },
                  {
                    "providerMetadata": {
                      "testProvider": {
                        "signature": "0987654321",
                      },
                    },
                    "text": " I need to think about this problem carefully.",
                    "type": "reasoning",
                  },
                  {
                    "providerMetadata": {
                      "testProvider": {
                        "signature": "0987654321",
                      },
                    },
                    "text": " The best solution requires careful consideration of all factors.",
                    "type": "reasoning",
                  },
                  {
                    "text": "Hi there!",
                    "type": "text",
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
                          "providerOptions": {
                            "testProvider": {
                              "signature": "1234567890",
                            },
                          },
                          "text": "I will open the conversation with witty banter.",
                          "type": "reasoning",
                        },
                        {
                          "providerOptions": {
                            "testProvider": {
                              "redactedData": "redacted-reasoning-data",
                            },
                          },
                          "text": "",
                          "type": "reasoning",
                        },
                        {
                          "providerOptions": {
                            "testProvider": {
                              "signature": "1234567890",
                            },
                          },
                          "text": " Once the user has relaxed, I will pry for valuable information.",
                          "type": "reasoning",
                        },
                        {
                          "providerOptions": {
                            "testProvider": {
                              "signature": "0987654321",
                            },
                          },
                          "text": " I need to think about this problem carefully.",
                          "type": "reasoning",
                        },
                        {
                          "providerOptions": {
                            "testProvider": {
                              "signature": "0987654321",
                            },
                          },
                          "text": " The best solution requires careful consideration of all factors.",
                          "type": "reasoning",
                        },
                        {
                          "text": "Hi there!",
                          "type": "text",
                        },
                      ],
                      "role": "assistant",
                    },
                  ],
                  "modelId": "mock-model-id",
                  "modelProvider": "mock-provider",
                  "modelVersion": "v2",
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

    it.todo('should add the sources from the model response to the step result', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithSourcesForVersion }],
        ...defaultSettings(),
      });

      await result.consumeStream();

      expect(await result.steps).toMatchInlineSnapshot(`
        [
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
                "providerMetadata": undefined,
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
                      "providerOptions": undefined,
                      "text": "Hello!",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "modelProvider": "mock-provider",
              "modelVersion": "v2",
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

    it('should add the files from the model response to the step result', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: [{ maxRetries: 0, id: 'test-model', model: modelWithFilesForVersion }],
        ...defaultSettings(),
        agentId: 'agent-id',
      });

      await result.consumeStream();

      const steps = await result.steps;

      expect(steps).toMatchSnapshot();
    });
  });

  describe('result.toolCalls', () => {
    it('should resolve with tool calls', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: createTestModelsForVersion({
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
              usage: testUsageForVersion,
            },
          ] as any) as any,
        }),
        tools: {
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.toolCalls).toMatchInlineSnapshot(`
        [
          {
            "from": "AGENT",
            "payload": {
              "args": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "toolCallId": "call-1",
              "toolName": "tool1",
            },
            "runId": "test-run-id",
            "type": "tool-call",
          },
        ]
      `);
    });
  });

  describe('result.toolResults', () => {
    it('should resolve with tool results', async () => {
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: createTestModelsForVersion({
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
              usage: testUsageForVersion,
            },
          ] as any) as any,
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }: { value: string }) => `${value}-result`,
          },
        },
        agentId: 'agent-id',
      });

      await result.consumeStream();

      expect(await result.toolResults).toMatchInlineSnapshot(`
        [
          {
            "from": "AGENT",
            "payload": {
              "args": {
                "value": "value",
              },
              "providerExecuted": undefined,
              "providerMetadata": undefined,
              "result": "value-result",
              "toolCallId": "call-1",
              "toolName": "tool1",
            },
            "runId": "test-run-id",
            "type": "tool-result",
          },
        ]
      `);
    });
  });
}
