import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { createMessageListWithUserMessage } from './utils';
import { testUsage } from '../../stream/aisdk/v5/test-utils';
import type { loop } from '../loop';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';

export function textStreamTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('result.textStream', () => {
    it('should send text deltas', async () => {
      const messageList = createMessageListWithUserMessage();

      const result = await loopFn({
        methodType: 'stream',
        runId,
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockLanguageModelV2({
              doStream: async ({ prompt }) => {
                console.dir({ prompt }, { depth: null });
                expect(prompt).toStrictEqual([
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                    // providerOptions: undefined,
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
                  ]),
                };
              },
            }),
          },
        ],
        messageList,
        agentId: 'agent-id',
      });

      expect(await convertAsyncIterableToArray(result.textStream)).toStrictEqual(['Hello', ', ', 'world!']);
    });
  });
}
