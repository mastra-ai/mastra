import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
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
    tools,
  }: {
    models: ModelManagerModelConfig[];
    tools?: Record<string, unknown>;
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
      ...(tools ? { tools } : {}),
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

  // Issue #26811: a non-standard finish reason after text output, with no tool calls,
  // must end the run instead of re-sending the same request until maxSteps.
  it.each(['other', 'unknown'] as const)(
    'ends the run when finishReason "%s" comes with text output and no tool calls',
    async finishReason => {
      let call = 0;
      const model: ModelManagerModelConfig = {
        id: `text-then-${finishReason}`,
        maxRetries: 0,
        model: new MockLanguageModelV2({
          doStream: async () => {
            call++;
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello.' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason, usage: testUsage },
              ]),
            };
          },
        }),
      };

      const chunks = await runLoop({ models: [model] });

      expect(call).toBe(1);
      expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
      const text = chunks
        .filter(chunk => chunk.type === 'text-delta')
        .map(chunk => chunk.payload.text)
        .join('');
      expect(text).toBe('Hello.');
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
    },
  );

  it('still continues the loop when finishReason "other" comes with a client tool call', async () => {
    let call = 0;
    const model: ModelManagerModelConfig = {
      id: 'other-with-tool-call',
      maxRetries: 0,
      model: new MockLanguageModelV2({
        doStream: async () => {
          call++;
          return {
            stream: convertArrayToReadableStream(
              call === 1
                ? [
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: '{ "value": "value" }',
                    },
                    { type: 'finish', finishReason: 'other', usage: testUsage },
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

    const chunks = await runLoop({
      models: [model],
      tools: {
        tool1: {
          inputSchema: z.object({ value: z.string() }),
          execute: async ({ value }: { value: string }) => `${value}-result`,
        },
      },
    });

    expect(call).toBe(2);
    expect(chunks.some(chunk => chunk.type === 'tool-result')).toBe(true);
    expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
  });

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
