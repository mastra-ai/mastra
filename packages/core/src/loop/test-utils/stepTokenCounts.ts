import { convertArrayToReadableStream, mockId, mockValues } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import z from 'zod';
import type { MastraDBMessage } from '../../agent/message-list/state/types';
import type { loop } from '../loop';
import { createMessageListWithUserMessage, defaultSettings } from './utils';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';

function getMastraMetadata(m: MastraDBMessage): Record<string, unknown> | undefined {
  return (m.content?.metadata as Record<string, unknown> | undefined)?.mastra as Record<string, unknown> | undefined;
}

const step0Usage = {
  inputTokens: 50,
  outputTokens: 20,
  totalTokens: 70,
  reasoningTokens: undefined,
  cachedInputTokens: undefined,
};

const step1Usage = {
  inputTokens: 150,
  outputTokens: 35,
  totalTokens: 185,
  reasoningTokens: 5,
  cachedInputTokens: undefined,
};

export function stepTokenCountsTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('stepTokenCounts accumulation', () => {
    it('should accumulate stepTokenCounts on a single assistant message across tool-call steps', async () => {
      const messageList = createMessageListWithUserMessage();

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
                  case 0: {
                    // Step 0: model calls a tool
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
                          toolName: 'calculator',
                          input: '{ "a": 1, "b": 2 }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: step0Usage,
                        },
                      ]),
                    };
                  }
                  case 1: {
                    // Step 1: model responds with text after tool result
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'id-1',
                          modelId: 'mock-model-id',
                          timestamp: new Date(1000),
                        },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'The result is 3.' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: step1Usage,
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
          calculator: {
            inputSchema: z.object({ a: z.number(), b: z.number() }),
            execute: async ({ a, b }: { a: number; b: number }) => ({ sum: a + b }),
          },
        },
        messageList,
        ...defaultSettings(),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000),
          generateId: mockId({ prefix: 'id' }),
        },
      });

      await result.consumeStream();

      // Find all assistant response messages
      const responseMessages = messageList.get.response.db();

      // There should be assistant message(s) with stepTokenCounts
      const messagesWithTokenCounts = responseMessages.filter(
        (m: MastraDBMessage) => m.role === 'assistant' && Array.isArray(getMastraMetadata(m)?.stepTokenCounts),
      );

      expect(messagesWithTokenCounts.length).toBeGreaterThanOrEqual(1);

      // Collect all stepTokenCounts across assistant messages
      const allStepTokenCounts: Record<string, number>[] = [];
      for (const msg of messagesWithTokenCounts) {
        const mastra = getMastraMetadata(msg)!;
        const counts = mastra.stepTokenCounts as Record<string, number>[];
        allStepTokenCounts.push(...counts);
      }

      // Should have entries from both steps
      expect(allStepTokenCounts.length).toBe(2);

      // Step 0: tool-call step
      expect(allStepTokenCounts[0]).toEqual(
        expect.objectContaining({
          outputTokens: step0Usage.outputTokens,
          inputTokens: step0Usage.inputTokens,
          totalTokens: step0Usage.totalTokens,
        }),
      );

      // Step 1: text response step
      expect(allStepTokenCounts[1]).toEqual(
        expect.objectContaining({
          outputTokens: step1Usage.outputTokens,
          inputTokens: step1Usage.inputTokens,
          totalTokens: step1Usage.totalTokens,
          reasoningTokens: step1Usage.reasoningTokens,
        }),
      );
    });

    it('should have tool-invocation parts on the same assistant message as stepTokenCounts', async () => {
      const messageList = createMessageListWithUserMessage();

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
                          toolName: 'greet',
                          input: '{ "name": "Alice" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: step0Usage,
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
                        { type: 'text-delta', id: 'text-1', delta: 'Done!' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: step1Usage,
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
          greet: {
            inputSchema: z.object({ name: z.string() }),
            execute: async ({ name }: { name: string }) => `Hello, ${name}!`,
          },
        },
        messageList,
        ...defaultSettings(),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000),
          generateId: mockId({ prefix: 'id' }),
        },
      });

      await result.consumeStream();

      // Find assistant messages with stepTokenCounts
      const responseMessages = messageList.get.response.db();
      const assistantMessages = responseMessages.filter(
        (m: MastraDBMessage) => m.role === 'assistant' && Array.isArray(getMastraMetadata(m)?.stepTokenCounts),
      );

      // The tool-invocation parts should be on one of these messages
      const messagesWithToolParts = assistantMessages.filter((m: MastraDBMessage) =>
        m.content?.parts?.some(p => p.type === 'tool-invocation'),
      );

      expect(messagesWithToolParts.length).toBeGreaterThanOrEqual(1);

      // The tool-invocation should include both call and result states
      const toolParts = messagesWithToolParts[0]!.content.parts.filter(p => p.type === 'tool-invocation');
      expect(toolParts.length).toBeGreaterThanOrEqual(1);

      // At least one tool invocation should have a result
      const resultParts = toolParts.filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result');
      expect(resultParts.length).toBeGreaterThanOrEqual(1);
    });

    it('should annotate stepTokenCounts for a single text-only step', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = await loopFn({
        methodType: 'stream',
        runId,
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
                  { type: 'text-delta', id: 'text-1', delta: 'Hello, world!' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: {
                      inputTokens: 10,
                      outputTokens: 5,
                      totalTokens: 15,
                    },
                  },
                ]),
              }),
            }),
          },
        ],
        messageList,
        ...defaultSettings(),
      });

      await result.consumeStream();

      const responseMessages = messageList.get.response.db();
      const assistantMsg = responseMessages.find(
        (m: MastraDBMessage) => m.role === 'assistant' && Array.isArray(getMastraMetadata(m)?.stepTokenCounts),
      );

      expect(assistantMsg).toBeDefined();

      const mastra = getMastraMetadata(assistantMsg!)!;
      const stepTokenCounts = mastra.stepTokenCounts as Record<string, number>[];

      expect(stepTokenCounts).toHaveLength(1);
      expect(stepTokenCounts[0]).toEqual(
        expect.objectContaining({
          outputTokens: 5,
          inputTokens: 10,
          totalTokens: 15,
        }),
      );
    });
  });
}
