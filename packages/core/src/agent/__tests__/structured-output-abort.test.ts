import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { IMastraLogger } from '../../logger';
import { Agent } from '../agent';

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function mainModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'There are 3 files.' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

// Streams JSON in pieces 40ms apart and calls onFirstDelta after the first piece is emitted.
function slowStructuringModel(onFirstDelta: () => void, seenSignals: (AbortSignal | undefined)[]) {
  const pieces = ['{"summary":', '"There are', ' 3 files."', ',"filesFound":3}'];
  return new MockLanguageModelV2({
    doStream: async ({ abortSignal }) => {
      seenSignals.push(abortSignal);
      let timer: ReturnType<typeof setTimeout> | undefined;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            let i = 0;
            const next = () => {
              if (i < pieces.length) {
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: pieces[i++] });
                if (i === 1) onFirstDelta();
                timer = setTimeout(next, 40);
                return;
              }
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
              controller.close();
            };
            next();
          },
          cancel() {
            clearTimeout(timer);
          },
        }),
      };
    },
  });
}

describe('structured output when the run is aborted during structuring', () => {
  it('forwards the abort signal to the structuring model and does not report a structuring failure', async () => {
    const abortController = new AbortController();
    const seenSignals: (AbortSignal | undefined)[] = [];
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trackException: vi.fn(),
      getTransports: vi.fn(() => new Map()),
      listLogs: vi.fn(),
      listLogsByRunId: vi.fn(),
    } as unknown as IMastraLogger;

    const agent = new Agent({
      id: 'structured-output-abort',
      name: 'Structured Output Abort',
      instructions: 'You are a helpful assistant.',
      model: mainModel(),
    });
    agent.__setLogger(logger);

    const schema = z.object({ summary: z.string(), filesFound: z.number() });
    const result = await agent.stream('Summarize the directory.', {
      abortSignal: abortController.signal,
      structuredOutput: {
        schema,
        model: slowStructuringModel(() => setTimeout(() => abortController.abort(), 10), seenSignals),
      },
    });

    for await (const _ of result.fullStream) {
      // drain
    }
    // Let any late structuring work settle before checking logs.
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(seenSignals).toHaveLength(1);
    expect(seenSignals[0]?.aborted).toBe(true);
    expect(await result.finishReason).toBe('aborted');
    expect(logger.error).not.toHaveBeenCalled();
  });
});
