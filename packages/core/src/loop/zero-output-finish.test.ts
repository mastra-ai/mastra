import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MockLanguageModelV3 } from '@internal/ai-v6/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../mastra';
import type { ErrorProcessor } from '../processors';
import type { ModelManagerModelConfig } from '../stream/types';
import { loop } from './loop';
import { createMessageListWithUserMessage, createTestMastra, defaultSettings, testUsage } from './test-utils/utils';

/**
 * Issue #21897: a provider stream that closes cleanly with finishReason 'other'
 * and zero output parts must not re-enter the agentic loop. Without a terminal
 * signal, the loop re-issues the identical request until maxSteps.
 */
describe('zero-output finishReason "other"', () => {
  const mastraRef: { current?: Mastra } = {};
  let dispose: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    const created = await createTestMastra();
    mastraRef.current = created.mastra;
    dispose = created.dispose;
  });

  afterEach(async () => {
    await dispose?.();
    mastraRef.current = undefined;
    dispose = undefined;
  });

  const runLoop = async ({
    models,
    errorProcessors,
    maxProcessorRetries,
  }: {
    models: ModelManagerModelConfig[];
    errorProcessors?: ErrorProcessor[];
    maxProcessorRetries?: number;
  }) => {
    const settings = defaultSettings();
    const result = loop({
      ...settings,
      mastra: mastraRef.current as any,
      methodType: 'stream',
      runId: 'test-run-id',
      messageList: createMessageListWithUserMessage(),
      models,
      errorProcessors,
      maxProcessorRetries,
    } as any);

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }
    return chunks;
  };

  const zeroOutputOtherModel = (): ModelManagerModelConfig => ({
    id: 'zero-output-other',
    maxRetries: 0,
    model: new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([{ type: 'finish', finishReason: 'other', usage: testUsage }]),
      }),
    }),
  });

  it('terminates the run with a synthetic stream error instead of re-issuing the request', async () => {
    const model = zeroOutputOtherModel();
    const doStream = vi.spyOn(model.model as any, 'doStream');

    const chunks = await runLoop({ models: [model] });

    // The request must not be re-issued.
    expect(doStream).toHaveBeenCalledTimes(1);

    const errorChunk = chunks.find(chunk => chunk.type === 'error');
    expect(errorChunk).toBeDefined();
    expect(errorChunk.payload.error.id).toBe('AGENT_STREAM_ERROR');
    expect(errorChunk.payload.error.message).toContain('finishReason "other"');
  });

  it.each(['other', 'unknown'] as const)('terminates after output with an unmarked %s finish', async finishReason => {
    let call = 0;
    const model: ModelManagerModelConfig = {
      id: 'other-with-output',
      maxRetries: 0,
      model: new MockLanguageModelV2({
        doStream: async () => {
          call++;
          return {
            stream: convertArrayToReadableStream(
              call === 1
                ? [
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'partial output' },
                    { type: 'text-end', id: 'text-1' },
                    { type: 'finish', finishReason, usage: testUsage },
                  ]
                : [
                    { type: 'text-start', id: 'text-2' },
                    { type: 'text-delta', id: 'text-2', delta: 'done' },
                    { type: 'text-end', id: 'text-2' },
                    { type: 'finish', finishReason: 'stop', usage: testUsage },
                  ],
            ),
          };
        },
      }),
    };

    const chunks = await runLoop({ models: [model] });

    // A non-standard finish reason without tool calls must not resend the request.
    expect(call).toBe(1);
    expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
    expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
    expect(
      chunks
        .filter(chunk => chunk.type === 'text-delta')
        .map(chunk => chunk.payload.text)
        .join(''),
    ).toBe('partial output');
    expect(
      chunks.filter(chunk => chunk.type === 'step-finish').map(chunk => chunk.payload.stepResult.isContinued),
    ).toEqual([false]);
  });

  it.each([undefined, 'compaction', 'vendor-specific'])(
    'preserves V3 continuation semantics for rawReason %s',
    async rawReason => {
      let calls = 0;
      const model: ModelManagerModelConfig = {
        id: 'other-with-raw-reason',
        maxRetries: 0,
        model: new MockLanguageModelV3({
          doStream: async () => {
            const first = ++calls === 1;
            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'text-start',
                  id: 'text',
                  ...(first && rawReason === 'compaction'
                    ? { providerMetadata: { anthropic: { type: 'compaction' } } }
                    : {}),
                },
                { type: 'text-delta', id: 'text', delta: first ? 'summary' : 'done' },
                { type: 'text-end', id: 'text' },
                {
                  type: 'finish',
                  finishReason: first ? { unified: 'other', raw: rawReason } : { unified: 'stop', raw: 'end_turn' },
                  usage: {
                    inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 2, text: 2, reasoning: undefined },
                  },
                },
              ]),
            };
          },
        }),
      };

      const chunks = await runLoop({ models: [model] });
      const continued = rawReason !== undefined;
      expect(calls).toBe(continued ? 2 : 1);
      expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
      const steps = chunks.filter(chunk => chunk.type === 'step-finish');
      expect(steps[0].payload.stepResult).toMatchObject({ reason: 'other', isContinued: continued });
      expect(steps[0].payload.stepResult.rawReason).toBe(rawReason);
      expect(steps.map(chunk => chunk.payload.stepResult.isContinued)).toEqual(continued ? [true, false] : [false]);
    },
  );

  it('routes the synthetic error through error processors for bounded retries', async () => {
    const model = zeroOutputOtherModel();
    const doStream = vi.spyOn(model.model as any, 'doStream');

    const errorsSeen: unknown[] = [];
    const errorProcessor: ErrorProcessor = {
      id: 'bounded-retry',
      processAPIError: async (args: any) => {
        errorsSeen.push(args.error);
        return { retry: args.retryCount < 2 };
      },
    };

    const chunks = await runLoop({ models: [model], errorProcessors: [errorProcessor], maxProcessorRetries: 2 });

    // Initial attempt + 2 bounded retries, then fail loud.
    expect(doStream).toHaveBeenCalledTimes(3);
    expect(errorsSeen.length).toBeGreaterThanOrEqual(3);
    expect((errorsSeen[0] as any).id).toBe('AGENT_STREAM_ERROR');

    const errorChunk = chunks.find(chunk => chunk.type === 'error');
    expect(errorChunk).toBeDefined();
    expect(errorChunk.payload.error.id).toBe('AGENT_STREAM_ERROR');
  });
});
