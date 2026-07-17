/**
 * AIMock Scenario: Error Processor Retry Exhaustion
 *
 * Tests that error processors properly handle retry exhaustion when they
 * repeatedly attempt to recover from persistent API errors. This pins the
 * retry counter logic and ensures proper error propagation after exhaustion.
 *
 * Asserts:
 * - retryCount increments correctly across retry attempts
 * - processor can decide when to stop retrying based on retryCount
 * - error is properly propagated after retry exhaustion
 * - processor state persists across retry attempts
 */

import { it, expect } from 'vitest';
import type { ErrorProcessor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: error processor retry exhaustion', engine => {
  const getMock = useLoopScenarioAimock();

  it('increments retryCount across multiple retry attempts', async () => {
    const retryCounts: number[] = [];

    const errorProcessor: ErrorProcessor = {
      id: 'retry-counter-processor',
      processAPIError: async (args: any) => {
        retryCounts.push(args.retryCount);
        // Retry 3 times, then stop
        return { retry: args.retryCount < 3 };
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Test retry counting.',
      errorProcessors: [errorProcessor],
      fixtures: llm => {
        // Always return 400 error
        llm.onMessage(/.*/, {
          error: { message: 'Persistent error', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    // After exhaustion the run terminates with an error finish reason. This is
    // asserted directly (not via a swallowed sentinel) so a regression where the
    // error is no longer surfaced fails the test.
    expect(await output.finishReason).toBe('error');

    // The processor saw retryCount increment 0 → 3 across attempts.
    expect(retryCounts).toEqual([0, 1, 2, 3]);
  });

  it('processor can exhaust retries and stop based on custom logic', async () => {
    let callCount = 0;
    const maxRetries = 2;

    const errorProcessor: ErrorProcessor = {
      id: 'custom-exhaustion-processor',
      processAPIError: async (args: any) => {
        callCount++;

        // Use state to track custom exhaustion logic
        if (!args.state.attempts) {
          args.state.attempts = 0;
        }
        args.state.attempts++;

        // Stop after custom max retries, even if retryCount allows more
        if (args.state.attempts >= maxRetries) {
          return { retry: false };
        }

        return { retry: true };
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Test custom exhaustion.',
      errorProcessors: [errorProcessor],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: { message: 'Still failing', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    // The run errors out, and the processor stopped itself after maxRetries
    // (via its own state counter) even though retryCount would have allowed more.
    expect(await output.finishReason).toBe('error');
    expect(callCount).toBe(maxRetries);
  });

  it('processor state persists across retry attempts', async () => {
    const stateValues: any[] = [];

    const errorProcessor: ErrorProcessor = {
      id: 'state-persistence-processor',
      processAPIError: async (args: any) => {
        // Initialize state on first call
        if (!args.state.counter) {
          args.state.counter = 0;
        }

        // Increment and record
        args.state.counter++;
        stateValues.push({ ...args.state });

        // Retry twice
        return { retry: args.retryCount < 2 };
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Test state persistence.',
      errorProcessors: [errorProcessor],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: { message: 'Retry me', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    expect(await output.finishReason).toBe('error');

    // Should have recorded state 3 times (retryCount 0, 1, 2)
    expect(stateValues).toHaveLength(3);

    // State should have persisted and incremented
    expect(stateValues[0].counter).toBe(1);
    expect(stateValues[1].counter).toBe(2);
    expect(stateValues[2].counter).toBe(3);
  });

  it('error is properly propagated after retry exhaustion', async () => {
    let lastError: any = null;

    const errorProcessor: ErrorProcessor = {
      id: 'error-propagation-processor',
      processAPIError: async (args: any) => {
        lastError = args.error;
        // Don't retry - exhaust immediately
        return { retry: false };
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Test error propagation.',
      errorProcessors: [errorProcessor],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: {
            message: 'Specific error message',
            type: 'specific_error',
            code: 'specific_code',
          },
          status: 400,
        });
      },
    });

    // Processor should have seen the exact error payload.
    expect(lastError).toBeDefined();
    expect(lastError.message).toBe('Specific error message');

    // The error is surfaced on the run's finish reason.
    expect(await output.finishReason).toBe('error');
  });

  it('multiple error processors chain correctly during retry exhaustion', async () => {
    const callOrder: string[] = [];

    const processor1: ErrorProcessor = {
      id: 'processor-1',
      processAPIError: async (args: any) => {
        callOrder.push(`p1-retry${args.retryCount}`);
        return { retry: args.retryCount < 2 };
      },
    };

    const processor2: ErrorProcessor = {
      id: 'processor-2',
      processAPIError: async (args: any) => {
        callOrder.push(`p2-retry${args.retryCount}`);
        return { retry: args.retryCount < 2 };
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Test processor chaining.',
      errorProcessors: [processor1, processor2],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: { message: 'Chain test', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    expect(await output.finishReason).toBe('error');

    // processor1 drives the retries until it stops requesting them
    // (retry on retryCount 0 and 1, no retry at 2), with retryCount
    // incrementing on each attempt. Then processor2 runs at the final
    // retryCount. This pins the exact chaining + retryCount accounting.
    expect(callOrder).toEqual(['p1-retry0', 'p1-retry1', 'p1-retry2', 'p2-retry2']);
  });
});
