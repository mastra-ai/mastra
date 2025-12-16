import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { convertArrayToReadableStream as convertArrayToReadableStreamV2 } from '@internal/ai-sdk-v5/test';
import { convertArrayToReadableStream as convertArrayToReadableStreamV3 } from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import { createMessageListWithUserMessage } from './utils';
import { testUsage as testUsageV2 } from '../../stream/aisdk/v5/test-utils';
import { testUsageV3 } from './utils-v3';
import type { loop } from '../loop';
import { MastraLanguageModelV2Mock } from './MastraLanguageModelV2Mock';
import { MastraLanguageModelV3Mock } from './MastraLanguageModelV3Mock';

export function textStreamTests({
  loopFn,
  runId,
  modelVersion = 'v2',
}: {
  loopFn: typeof loop;
  runId: string;
  modelVersion?: 'v2' | 'v3';
}) {
  const MockModel = modelVersion === 'v2' ? MastraLanguageModelV2Mock : MastraLanguageModelV3Mock;
  const convertArrayToReadableStream =
    modelVersion === 'v2' ? convertArrayToReadableStreamV2 : convertArrayToReadableStreamV3;
  const testUsage = modelVersion === 'v2' ? testUsageV2 : testUsageV3;

  describe('result.textStream', () => {
    it('should send text deltas', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = loopFn({
        methodType: 'stream',
        runId,
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockModel({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                    { type: 'text-delta', id: 'text-1', delta: ', ' },
                    { type: 'text-delta', id: 'text-1', delta: `world!` },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ] as any),
                };
              },
            } as any),
          },
        ],
        messageList,
        agentId: 'agent-id',
      });

      expect(await convertAsyncIterableToArray(result.textStream)).toStrictEqual(['Hello', ', ', 'world!']);
    });
  });
}
