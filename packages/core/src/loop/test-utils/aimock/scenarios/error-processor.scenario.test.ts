import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import type { ErrorProcessor } from '../../../../processors';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: error processor API error recovery.
 *
 * Error processors can intercept non-retryable API errors (400/422) and retry
 * after applying modifications. This pins the error recovery path, ensuring
 * error processors can handle API rejections gracefully.
 */
describe('AIMock loop scenario: error processor recovery', () => {
  const getMock = useLoopScenarioAimock();

  it('processAPIError gets called when API returns 400 error', async () => {
    let processorCalled = false;
    let errorSeen: unknown;
    let retryCountSeen: number | undefined;

    const errorProcessor: ErrorProcessor = {
      id: 'test-error-processor',
      processAPIError: async (args: any) => {
        processorCalled = true;
        errorSeen = args.error;
        retryCountSeen = args.retryCount;
        // Don't retry - just observe
        return { retry: false };
      },
    };

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Test error recovery.',
      stopWhen: stepCountIs(1),
      errorProcessors: [errorProcessor],
      fixtures: llm => {
        // Return 400 error
        llm.onMessage(/.*/, {
          error: { message: 'Invalid request', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    // The run surfaces the API error on its finish reason.
    expect(await output.finishReason).toBe('error');

    // The processor was invoked with the error and a numeric retry count.
    expect(processorCalled).toBe(true);
    expect(errorSeen).toBeDefined();
    expect(typeof retryCountSeen).toBe('number');
  });

  it('processAPIError can access messages and state', async () => {
    let messagesSeen: any[] | undefined;
    let stateSeen: Record<string, unknown> | undefined;

    const errorProcessor: ErrorProcessor = {
      id: 'context-processor',
      processAPIError: async (args: any) => {
        messagesSeen = args.messages;
        stateSeen = args.state;
        return { retry: false };
      },
    };

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Test context access.',
      stopWhen: stepCountIs(1),
      errorProcessors: [errorProcessor],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: { message: 'Bad request', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    expect(await output.finishReason).toBe('error');

    // Should have access to messages
    expect(messagesSeen).toBeDefined();
    expect(Array.isArray(messagesSeen)).toBe(true);

    // Should have access to state
    expect(stateSeen).toBeDefined();
    expect(typeof stateSeen).toBe('object');
  });

  it('processAPIError returning void does not retry', async () => {
    let processorCallCount = 0;

    const errorProcessor: ErrorProcessor = {
      id: 'void-processor',
      processAPIError: async () => {
        processorCallCount++;
        // Return void (undefined) - should not retry
      },
    };

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Test no retry.',
      stopWhen: stepCountIs(1),
      errorProcessors: [errorProcessor],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: { message: 'Permanent error', type: 'invalid_request_error', code: 'invalid_request' },
          status: 400,
        });
      },
    });

    // A void return means "do not retry": processor runs once and the run errors.
    expect(await output.finishReason).toBe('error');
    expect(processorCallCount).toBe(1);
  });
});
