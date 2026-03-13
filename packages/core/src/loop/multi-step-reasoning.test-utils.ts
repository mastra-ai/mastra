/**
 * Tests that multi-step tool calling with reasoning models preserves separate
 * assistant messages per step when reasoning text is empty (Azure-style).
 * Without the fix, empty reasoning items get identical cache keys, causing
 * deduplication to drop them during cross-step merge.
 */
import type { LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, mockId, mockValues } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import z from 'zod';
import type { loop } from './loop';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './test-utils/MastraLanguageModelV2Mock';
import { createMessageListWithUserMessage, testUsage } from './test-utils/utils';

export function multiStepReasoningTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('multi-step reasoning with tool calls', () => {
    let stepInputs: LanguageModelV2CallOptions[];
    let result: Awaited<ReturnType<typeof loop>>;

    beforeEach(() => {
      stepInputs = [];
    });

    /**
     * 3-step flow with empty reasoning (Azure-style):
     * Step 1: empty reasoning + tool-call(add) → tool-result
     * Step 2: empty reasoning + tool-call(multiply) → tool-result
     * Step 3: text response
     *
     * The reasoning items have different providerMetadata.azure.itemId values
     * but empty text. Without the fix, CacheKeyGenerator produces identical
     * keys and dedup drops the second reasoning item.
     */
    describe('3 steps with empty reasoning text (Azure-style)', () => {
      beforeEach(async () => {
        const messageList = createMessageListWithUserMessage();
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
                          {
                            type: 'reasoning-start',
                            id: 'rs-1',
                            providerMetadata: { azure: { itemId: 'rs-1' } },
                          },
                          {
                            type: 'reasoning-end',
                            id: 'rs-1',
                            providerMetadata: { azure: { itemId: 'rs-1' } },
                          },
                          {
                            type: 'tool-call',
                            id: 'call-add',
                            toolCallId: 'call-add',
                            toolName: 'add',
                            input: '{ "a": 3, "b": 5 }',
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
                          {
                            type: 'reasoning-start',
                            id: 'rs-2',
                            providerMetadata: { azure: { itemId: 'rs-2' } },
                          },
                          {
                            type: 'reasoning-end',
                            id: 'rs-2',
                            providerMetadata: { azure: { itemId: 'rs-2' } },
                          },
                          {
                            type: 'tool-call',
                            id: 'call-multiply',
                            toolCallId: 'call-multiply',
                            toolName: 'multiply',
                            input: '{ "a": 8, "b": 4 }',
                          },
                          {
                            type: 'finish',
                            finishReason: 'tool-calls',
                            usage: testUsage,
                          },
                        ]),
                        response: { headers: { call: '2' } },
                      };
                    }
                    case 2: {
                      return {
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-2',
                            modelId: 'mock-model-id',
                            timestamp: new Date(2000),
                          },
                          { type: 'text-start', id: 'text-1' },
                          { type: 'text-delta', id: 'text-1', delta: 'The result is 32.' },
                          { type: 'text-end', id: 'text-1' },
                          {
                            type: 'finish',
                            finishReason: 'stop',
                            usage: testUsage,
                          },
                        ]),
                        response: { headers: { call: '3' } },
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
            add: {
              inputSchema: z.object({ a: z.number(), b: z.number() }),
              execute: async ({ a, b }: { a: number; b: number }) => ({ result: a + b }),
            },
            multiply: {
              inputSchema: z.object({ a: z.number(), b: z.number() }),
              execute: async ({ a, b }: { a: number; b: number }) => ({ result: a * b }),
            },
          },
          messageList,
          options: {},
          stopWhen: stepCountIs(5),
          _internal: {
            now: mockValues(0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000),
            generateId: mockId({ prefix: 'id' }),
          },
          agentId: 'agent-id',
        });
      });

      it('step 3 prompt should preserve both empty reasoning items with separate assistant messages', async () => {
        await result.consumeStream();

        const step3Prompt = stepInputs[2]?.prompt;
        expect(step3Prompt).toBeDefined();

        const assistantMessages = step3Prompt!.filter(m => m.role === 'assistant');

        // CRITICAL: There must be 2 separate assistant messages
        expect(assistantMessages).toHaveLength(2);

        // Each assistant message must have a reasoning part
        for (const msg of assistantMessages) {
          const hasReasoning = Array.isArray(msg.content)
            ? msg.content.some((p: any) => p.type === 'reasoning')
            : false;
          expect(hasReasoning).toBe(true);
        }
      });
    });
  });
}
