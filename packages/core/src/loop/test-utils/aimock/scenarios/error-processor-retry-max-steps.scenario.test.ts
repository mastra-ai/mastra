/**
 * AIMock Scenario: Error processor retries vs. maxSteps
 *
 * A step that an error processor retries re-runs the same step, so it must
 * not count against `maxSteps`. With `maxSteps: 1` a transient provider error
 * is retried; when retries run out, the last attempt's provider error is
 * surfaced instead of an empty `finishReason: 'retry'` success.
 *
 * Regression for https://github.com/mastra-ai/mastra/issues/25757
 */

import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import type { ErrorProcessor } from '../../../../processors';
import { StreamErrorRetryProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

const serverError = (message: string) => ({
  error: { message, type: 'server_error', code: 'server_error' },
  status: 500,
});

const alwaysRetry: ErrorProcessor = {
  id: 'always-retry',
  processAPIError: async () => ({ retry: true }),
};

describeForAllEngines('AIMock loop scenario: error processor retries do not consume maxSteps', engine => {
  const getMock = useLoopScenarioAimock();

  it('retries a failed step when maxSteps is 1', async () => {
    let attempt = 0;
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Answer once.',
      maxSteps: 1,
      errorProcessors: [alwaysRetry],
      fixtures: llm => {
        llm.onMessage(/.*/, () => {
          attempt += 1;
          return attempt === 1 ? serverError('transient-1') : { content: 'recovered answer' };
        });
      },
    });

    expect(requests).toHaveLength(2);
    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('recovered answer');
  });

  it('retries a failed final step of a multi-step run', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 1 }),
    });

    let attempt = 0;
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tick once, then answer.',
      maxSteps: 2,
      tools: { tick: tickTool },
      errorProcessors: [alwaysRetry],
      fixtures: llm => {
        llm.onMessage(/.*/, () => {
          attempt += 1;
          if (attempt === 1) return { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: '{}' }] };
          if (attempt === 2) return serverError('transient-2');
          return { content: 'done after tick' };
        });
      },
    });

    expect(requests).toHaveLength(3);
    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('done after tick');
  });

  it('surfaces the last attempt error when maxProcessorRetries is exhausted', async () => {
    let attempt = 0;
    const errors: unknown[] = [];
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Answer once.',
      maxSteps: 1,
      errorProcessors: [alwaysRetry],
      onError: ({ error }: { error: unknown }) => {
        errors.push(error);
      },
      fixtures: llm => {
        llm.onMessage(/.*/, () => {
          attempt += 1;
          return serverError(`fail-${attempt}`);
        });
      },
    });

    // No explicit maxProcessorRetries: the safety cap (3) applies → 4 calls.
    expect(requests).toHaveLength(4);
    expect(await output.finishReason).toBe('error');
    expect(output.error).toMatchObject({ message: 'fail-4', statusCode: 500 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ message: 'fail-4', statusCode: 500 });
  });

  it('surfaces the last provider error when StreamErrorRetryProcessor stops retrying', async () => {
    let attempt = 0;
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Answer once.',
      maxSteps: 1,
      errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, delayMs: 0, retryUnknownErrors: true })],
      fixtures: llm => {
        llm.onMessage(/.*/, () => {
          attempt += 1;
          return serverError(`fail-${attempt}`);
        });
      },
    });

    expect(requests).toHaveLength(3);
    expect(await output.finishReason).toBe('error');
    expect(output.error).toMatchObject({ message: 'fail-3', statusCode: 500 });
    expect(await output.text).toBe('');
  });
});
