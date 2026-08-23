/**
 * AIMock Scenario: output processors and per-model-call error chunks
 *
 * A streaming output processor must only observe an error that the run actually
 * failed on. An error raised by one model call is not yet a run failure: an
 * error processor may retry it, or a fallback model may serve the request. If
 * processors see those raw per-call errors they react to failures that never
 * happened — e.g. a processor that surfaces rate limits fires on a transient
 * 429 that the very next retry recovers from.
 *
 * Asserts:
 * - a recovered error is never shown to output processors, while the recovered
 *   text still flows through them
 * - a terminal error is still shown to output processors exactly once
 */

import { it, expect } from 'vitest';
import type { ErrorProcessor, Processor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: output processors and error chunks', engine => {
  const getMock = useLoopScenarioAimock();

  function createRecordingProcessor(seen: string[]): Processor {
    return {
      id: 'error-chunk-recorder',
      name: 'Error Chunk Recorder',
      processOutputStream: async ({ part }) => {
        seen.push(part.type);
        return part;
      },
    };
  }

  it('does not show output processors an error that a retry recovered from', async () => {
    const seen: string[] = [];
    let retries = 0;

    const errorProcessor: ErrorProcessor = {
      id: 'retry-once-processor',
      processAPIError: async () => {
        retries++;
        return { retry: true };
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Say hello.',
      errorProcessors: [errorProcessor],
      outputProcessors: [createRecordingProcessor(seen)],
      fixtures: llm => {
        llm.onMessage(/.*/, { content: 'hello there' });
        // One transient failure, then the fixture above serves the retry.
        llm.nextRequestError(429, { message: 'Rate limited', type: 'rate_limit_error', code: 'rate_limit' });
      },
    });

    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('hello there');
    expect(retries).toBe(1);

    // The processor saw the recovered response and never saw the transient error.
    expect(seen).not.toContain('error');
    expect(seen).toContain('text-delta');
  });

  it('shows output processors a terminal error exactly once', async () => {
    const seen: string[] = [];

    const errorProcessor: ErrorProcessor = {
      id: 'no-retry-processor',
      processAPIError: async () => ({ retry: false }),
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Say hello.',
      errorProcessors: [errorProcessor],
      outputProcessors: [createRecordingProcessor(seen)],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: { message: 'Persistent error', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    expect(await output.finishReason).toBe('error');
    expect(seen.filter(type => type === 'error')).toHaveLength(1);
  });
});
