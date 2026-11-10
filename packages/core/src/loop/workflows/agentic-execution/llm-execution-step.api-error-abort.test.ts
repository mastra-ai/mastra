/**
 * An error processor can wait on work that the run's abort signal cancels (for example,
 * Observational Memory recovering from a context overflow, #27792). When the run aborts
 * during that wait, the processor rejects, the runner reports `{ retry: false }`, and the
 * step must still exit as an abort rather than surface the original API error.
 */

import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MockLanguageModelV2, convertArrayToReadableStream } from '../../../agent/__tests__/mock-model';
import { Agent } from '../../../agent/agent';
import type { Processor } from '../../../processors';

const overflowError = () =>
  new APICallError({
    message: 'prompt is too long: 210345 tokens > 200000 maximum',
    url: 'https://api.example.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
  });

describe('API error processor cancelled by the run abort', () => {
  it('exits the step as an abort when the run aborts while processAPIError is waiting', async () => {
    const controller = new AbortController();
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'error', error: overflowError() },
          ]),
        };
      },
    });
    const abortingProcessor: Processor = {
      id: 'abort-during-recovery',
      processAPIError: async ({ abortSignal }) => {
        controller.abort();
        abortSignal?.throwIfAborted();
        return { retry: true };
      },
    };
    const agent = new Agent({
      id: 'api-error-abort-agent',
      name: 'API error abort agent',
      instructions: 'Answer.',
      model,
      errorProcessors: [abortingProcessor],
    });

    let aborted = 0;
    const output = await agent.stream('Hello', {
      maxSteps: 1,
      abortSignal: controller.signal,
      onAbort: () => {
        aborted++;
      },
    });
    const chunkTypes: string[] = [];
    for await (const chunk of output.fullStream) chunkTypes.push(chunk.type);

    expect(calls).toBe(1);
    expect(aborted).toBe(1);
    expect(chunkTypes).toContain('abort');
    expect(chunkTypes).not.toContain('error');
  });
});
