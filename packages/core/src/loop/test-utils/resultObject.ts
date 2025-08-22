import { tool } from 'ai-v5';
import { convertArrayToReadableStream } from 'ai-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MessageList } from '../../agent/message-list';
import type { loop } from '../loop';
import {
  createTestModel,
  defaultSettings,
  modelWithFiles,
  modelWithReasoning,
  modelWithSources,
  testUsage,
} from './utils';

export function resultObjectTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('result.warnings', () => {
    it('should resolve with warnings', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
        },
        'input',
      );

      const result = loopFn({
        runId,
        model: createTestModel({
          warnings: [{ type: 'other', message: 'test-warning' }],
        }),
        messageList,
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.warnings).toStrictEqual([{ type: 'other', message: 'test-warning' }]);
    });
  });

  describe('result.usage', () => {
    it('should resolve with token usage', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
        },
        'input',
      );

      const result = loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        messageList,
      });

      await result.aisdk.v5.consumeStream();

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

  describe('result.finishReason', () => {
    it('should resolve with finish reason', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
        },
        'input',
      );

      const result = loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        messageList,
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.finishReason).toStrictEqual('stop');
    });
  });

  describe('result.providerMetadata', () => {
    it('should resolve with provider metadata', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
        },
        'input',
      );

      const result = loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello' },
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
        messageList,
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.providerMetadata).toStrictEqual({
        testProvider: { testKey: 'testValue' },
      });
    });
  });

  describe('result.response.messages', () => {
    it.todo('should contain reasoning', async () => {
      const messageList = new MessageList();

      const result = loopFn({
        runId,
        model: modelWithReasoning,
        messageList,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      const messages = (await result.aisdk.v5.response).messages;

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
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
        },
        'input',
      );

      const result = loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
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
          request: { body: 'test body' },
        }),
        messageList,
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.request).toStrictEqual({
        body: 'test body',
      });
    });
  });

  describe('result.response', () => {
    it('should resolve with response information', async () => {
      const messageList = new MessageList();

      const result = loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
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
          response: { headers: { call: '2' } },
        }),
        messageList,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.aisdk.v5.response).toMatchInlineSnapshot(`
            {
              "headers": {
                "call": "2",
              },
              "id": "id-0",
              "messages": [
                {
                  "content": [
                    {
                      "text": "Hello",
                      "type": "text",
                    },
                  ],
                  "role": "assistant",
                },
              ],
              "modelId": "mock-model-id",
              "timestamp": 1970-01-01T00:00:00.000Z,
            }
          `);
    });
  });

  describe('result.text', () => {
    it('should resolve with full text', async () => {
      const result = loopFn({
        runId,
        model: createTestModel(),
        messageList: new MessageList(),
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.text).toMatchSnapshot();
    });
  });

  describe('result.reasoningText', () => {
    it('should contain reasoning text from model response', async () => {
      const result = loopFn({
        runId,
        messageList: new MessageList(),
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.aisdk.v5.reasoningText).toMatchSnapshot();
    });
  });

  describe('result.reasoning', () => {
    it('should contain reasoning from model response', async () => {
      const result = loopFn({
        runId,
        messageList: new MessageList(),
        model: modelWithReasoning,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.aisdk.v5.reasoning).toMatchSnapshot();
    });
  });

  describe('result.sources', () => {
    it('should contain sources', async () => {
      const result = loopFn({
        runId,
        messageList: new MessageList(),
        model: modelWithSources,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.aisdk.v5.sources).toMatchSnapshot();
    });
  });

  describe('result.files', () => {
    it('should contain files', async () => {
      const result = loopFn({
        runId,
        messageList: new MessageList(),
        model: modelWithFiles,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.aisdk.v5.files).toMatchSnapshot();
    });
  });

  describe('result.steps', () => {
    it.todo('should add the reasoning from the model response to the step result', async () => {
      const result = loopFn({
        runId,
        model: modelWithReasoning,
        messageList: new MessageList(),
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      const steps = result.aisdk.v5.steps;
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
        runId,
        messageList: new MessageList(),
        model: modelWithSources,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      expect(result.aisdk.v5.steps).toMatchInlineSnapshot(`
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
        runId,
        messageList: new MessageList(),
        model: modelWithFiles,
        ...defaultSettings(),
      });

      await result.aisdk.v5.consumeStream();

      const steps = await result.aisdk.v5.steps;

      expect(steps).toMatchInlineSnapshot(`
        [
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
                      "filename": undefined,
                      "mediaType": "text/plain",
                      "type": "file",
                    },
                    {
                      "text": "Hello!",
                      "type": "text",
                    },
                    {
                      "data": "QkFVRw==",
                      "filename": undefined,
                      "mediaType": "image/jpeg",
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
        ]
      `);
    });
  });

  describe('result.toolCalls', () => {
    it('should resolve with tool calls', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
        },
        'input',
      );

      const result = loopFn({
        runId,
        messageList,
        model: createTestModel({
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
          tool1: tool({
            inputSchema: z.object({ value: z.string() }),
          }),
        },
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.aisdk.v5.toolCalls).toMatchInlineSnapshot(`
            [
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
            ]
          `);
    });
  });

  describe('result.toolResults', () => {
    it('should resolve with tool results', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: [{ type: 'text', text: 'test-input' }],
        },
        'input',
      );

      const result = loopFn({
        runId,
        messageList,
        model: createTestModel({
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
            execute: async ({ value }: { value: string }) => `${value}-result`,
          },
        },
      });

      await result.aisdk.v5.consumeStream();

      expect(await result.aisdk.v5.toolResults).toMatchInlineSnapshot(`
            [
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
            ]
          `);
    });
  });
}
