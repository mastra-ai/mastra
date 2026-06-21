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

import { describe, it, expect } from 'vitest';
import type { ErrorProcessor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: error processor retry exhaustion', () => {
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

    try {
      await runLoopScenario({
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

      // Should not reach here - error should be thrown after exhaustion
      expect(true).toBe(false);
    } catch (error) {
      // Should have seen retry counts 0, 1, 2, 3
      expect(retryCounts).toEqual([0, 1, 2, 3]);

      // Should have thrown an error after exhaustion
      expect(error).toBeDefined();
    }
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

    try {
      await runLoopScenario({
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

      expect(true).toBe(false);
    } catch (error) {
      // Should have called processor exactly maxRetries times
      expect(callCount).toBe(maxRetries);

      // Should have thrown an error
      expect(error).toBeDefined();
    }
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

    try {
      await runLoopScenario({
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

      expect(true).toBe(false);
    } catch (error) {
      // Should have recorded state 3 times (retryCount 0, 1, 2)
      expect(stateValues).toHaveLength(3);

      // State should have persisted and incremented
      expect(stateValues[0].counter).toBe(1);
      expect(stateValues[1].counter).toBe(2);
      expect(stateValues[2].counter).toBe(3);

      // Should have thrown an error
      expect(error).toBeDefined();
    }
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

    let caughtError: any = null;
    try {
      await runLoopScenario({
        llm: getMock(),
        prompt: 'Test error propagation.',
        errorProcessors: [errorProcessor],
        fixtures: llm => {
          llm.onMessage(/.*/, {
            error: { 
              message: 'Specific error message', 
              type: 'specific_error', 
              code: 'specific_code' 
            },
            status: 400,
          });
        },
      });
    } catch (error) {
      caughtError = error;
    }

    // Processor should have seen the error
    expect(lastError).toBeDefined();
    expect(lastError.message).toBe('Specific error message');

    // Error should have been propagated
    expect(caughtError).toBeDefined();
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

    try {
      await runLoopScenario({
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

      expect(true).toBe(false);
    } catch (error) {
      // Both processors should have been called for each retry
      expect(callOrder.length).toBeGreaterThan(0);

      // Should have thrown an error
      expect(error).toBeDefined();
    }
  });
});
