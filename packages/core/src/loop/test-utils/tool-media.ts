import { stepCountIs } from '@internal/ai-sdk-v5';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV2,
  mockValues,
  mockId,
} from '@internal/ai-sdk-v5/test';
import { convertArrayToReadableStream as convertArrayToReadableStreamV3 } from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { loop } from '../loop';
import { createMessageListWithUserMessage, defaultSettings, testUsage } from './utils';
import { testUsageV3 } from './utils-v3';
import { MastraLanguageModelV2Mock } from './MastraLanguageModelV2Mock';
import { MastraLanguageModelV3Mock } from './MastraLanguageModelV3Mock';

/**
 * Exercises the full agentic loop to assert that an image returned from a tool
 * via `toModelOutput` (as a `{ type: 'content', value: [{ type: 'media' }] }`
 * part) is delivered into the next model request in the shape the model's
 * provider can actually consume.
 *
 * - AI SDK v5 providers (spec `v2`) recognize only `media`.
 * - AI SDK v6 providers (spec `v3`, e.g. `@ai-sdk/anthropic@3`) recognize only
 *   `image-data`/`file-data` and have no `media` case, so the loop must
 *   translate `media` -> `image-data`/`file-data` before the prompt reaches them.
 *
 * Regression coverage for: https://github.com/mastra-ai/mastra/issues/17876
 */
export function toolMediaTests({
  loopFn,
  runId,
  modelVersion = 'v2',
}: {
  loopFn: typeof loop;
  runId: string;
  modelVersion?: 'v2' | 'v3';
}) {
  const MockModel = modelVersion === 'v2' ? MastraLanguageModelV2Mock : MastraLanguageModelV3Mock;
  const convertArray = modelVersion === 'v2' ? convertArrayToReadableStreamV2 : convertArrayToReadableStreamV3;
  const usage = modelVersion === 'v2' ? testUsage : testUsageV3;

  describe('tool-result image media delivery', () => {
    it(`delivers image media to the ${modelVersion === 'v3' ? 'v6' : 'v5'} model prompt`, async () => {
      // 1x1 transparent PNG
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

      const messageList = createMessageListWithUserMessage();
      const stepInputs: any[] = [];
      let responseCount = 0;

      const result = await loopFn({
        methodType: 'stream',
        runId,
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockModel({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                stepInputs.push({ prompt });
                switch (responseCount++) {
                  case 0:
                    return {
                      stream: convertArray([
                        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                        {
                          type: 'tool-call',
                          id: 'call-1',
                          toolCallId: 'call-1',
                          toolName: 'screenshot',
                          input: `{}`,
                        },
                        { type: 'finish', finishReason: 'tool-calls', usage },
                      ] as any),
                    };
                  case 1:
                    return {
                      stream: convertArray([
                        { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(1000) },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'I see the image.' },
                        { type: 'text-end', id: 'text-1' },
                        { type: 'finish', finishReason: 'stop', usage },
                      ] as any),
                    };
                  default:
                    throw new Error(`Unexpected response count: ${responseCount}`);
                }
              },
            } as any),
          },
        ],
        tools: {
          screenshot: {
            inputSchema: z.object({}),
            execute: async () => ({ base64: pngBase64 }),
            toModelOutput: (output: unknown) => {
              const data = output as { base64: string };
              return {
                type: 'content' as const,
                value: [{ type: 'media' as const, mediaType: 'image/png', data: data.base64 }],
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

      // The model was called twice: once to emit the tool call, once after the
      // tool result. The second prompt must carry the image.
      expect(stepInputs).toHaveLength(2);
      const secondPrompt = stepInputs[1].prompt as any[];
      const toolMessage = secondPrompt.find(m => m.role === 'tool');
      expect(toolMessage).toBeDefined();

      const toolResult = toolMessage.content.find((p: any) => p.type === 'tool-result');
      expect(toolResult).toBeDefined();
      expect(toolResult.output?.type).toBe('content');

      const mediaPart = toolResult.output.value[0];
      if (modelVersion === 'v3') {
        // v6 providers only recognize image-data/file-data, not media
        expect(mediaPart).toEqual({ type: 'image-data', data: pngBase64, mediaType: 'image/png' });
      } else {
        // v5 providers only recognize media
        expect(mediaPart).toEqual({ type: 'media', data: pngBase64, mediaType: 'image/png' });
      }
    });
  });
}
