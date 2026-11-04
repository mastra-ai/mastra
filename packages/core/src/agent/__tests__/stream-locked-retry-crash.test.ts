import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../processors';
import { BatchPartsProcessor } from '../../processors/processors/batch-parts';
import { RegexFilterProcessor } from '../../processors/processors/regex-filter';
import { StreamErrorRetryProcessor } from '../../processors/stream-error-retry-processor';
import { createTool } from '../../tools/tool';
import { Agent } from '../agent';

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/25532.
 *
 * A provider error mid-stream, retried by an error processor, while output
 * processors are configured, used to leak a `step-finish` into an already
 * consumed per-step output. That output then took a second reader on its
 * locked base stream, producing an unhandled `ReadableStream is locked`
 * rejection that exits Node 22.
 */

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function createMidStreamErrorModel() {
  let callCount = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      const preamble = [
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: `id-${callCount}`, modelId: 'mock', timestamp: new Date(0) },
      ];

      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            ...preamble,
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{"q":"x"}' },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ]),
        };
      }

      if (callCount === 2) {
        const stream = new ReadableStream({
          async start(controller) {
            for (const chunk of preamble) controller.enqueue(chunk);
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'partial ' });
            // Let BatchPartsProcessor's maxWaitTime elapse while text is buffered.
            await new Promise(resolve => setTimeout(resolve, 60));
            controller.enqueue({ type: 'error', error: { code: 502, message: 'Bad gateway' } });
            controller.enqueue({ type: 'finish', finishReason: 'error', usage });
            controller.close();
          },
        });
        return { rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream };
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          ...preamble,
          { type: 'text-start', id: 'text-2' },
          { type: 'text-delta', id: 'text-2', delta: 'All good.' },
          { type: 'text-end', id: 'text-2' },
          { type: 'finish', finishReason: 'stop', usage },
        ]),
      };
    },
  });
  return { model, getCallCount: () => callCount };
}

const lookup = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({ q: z.string() }),
  execute: async () => ({ found: true }),
});

describe('mid-stream provider error with output processors and a retrying error processor (#25532)', () => {
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  it.each<[string, () => Processor]>([
    ['BatchPartsProcessor', () => new BatchPartsProcessor({ batchSize: 2, maxWaitTime: 40, emitOnNonText: true })],
    [
      'RegexFilterProcessor',
      () => new RegexFilterProcessor({ presets: ['secrets'], strategy: 'redact', phase: 'output' }),
    ],
  ])('retries and completes without an unhandled rejection (%s)', async (_name, createOutputProcessor) => {
    const { model, getCallCount } = createMidStreamErrorModel();

    const agent = new Agent({
      id: 'locked-stream-retry-agent',
      name: 'Locked Stream Retry Agent',
      instructions: 'test',
      model: [{ model, maxRetries: 0 }],
      tools: { lookup },
      outputProcessors: [createOutputProcessor()],
      errorProcessorDefaults: false,
      errorProcessors: [
        new StreamErrorRetryProcessor({
          maxRetries: 1,
          matchers: [{ match: (error: any) => error?.code === 502 }],
          delayMs: () => 10,
        }),
      ],
    });

    const result = await agent.stream('hi', { maxSteps: 5 });
    const chunks: { type: string }[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);
    const text = await result.text;

    // Give any fire-and-forget rejection a chance to surface.
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(unhandled).toEqual([]);
    expect(getCallCount()).toBe(3);
    expect(text).toContain('All good.');
    expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
  });
});
