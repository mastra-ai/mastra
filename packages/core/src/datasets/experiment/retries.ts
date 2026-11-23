import type { ExecutionResult } from './executor';
import { TOOL_MOCK_EXHAUSTED, TOOL_MOCK_MISMATCH, TOOL_MOCK_NOT_DECLARED } from './tool-mocks';

/**
 * Tool-mock failures are deterministic: the matcher state can't change between
 * attempts, so retrying would always fail identically.
 */
const NON_RETRYABLE_ERROR_CODES = new Set<string>([TOOL_MOCK_MISMATCH, TOOL_MOCK_EXHAUSTED, TOOL_MOCK_NOT_DECLARED]);

/** Resolves after `ms`, or as soon as `signal` aborts. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/**
 * Run one item, retrying a failed execution up to `maxRetries` times with
 * exponential backoff (1s doubling, capped at 30s, plus up to 20% jitter).
 * Abort/timeout errors and tool-mock failures are never retried. Throws an
 * `AbortError` when `cancelSignal` is aborted between attempts. When
 * `timeoutSignal` (the item timeout) fires during the backoff, the wait ends
 * and the item fails with the timeout error instead of retrying.
 */
export async function executeWithRetries(
  execute: () => Promise<ExecutionResult>,
  options: { maxRetries: number; cancelSignal?: AbortSignal; timeoutSignal?: AbortSignal },
): Promise<{ execResult: ExecutionResult; retryCount: number }> {
  let retryCount = 0;
  let execResult = await execute();

  while (execResult.error && retryCount < options.maxRetries) {
    if (execResult.error.message.toLowerCase().includes('abort')) break;
    if (execResult.error.code && NON_RETRYABLE_ERROR_CODES.has(execResult.error.code)) break;

    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    const jitter = delay * 0.2 * Math.random();
    await wait(delay + jitter, options.timeoutSignal);

    if (options.cancelSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (options.timeoutSignal?.aborted) {
      const reason: unknown = options.timeoutSignal.reason;
      return {
        execResult: {
          ...execResult,
          output: null,
          error: {
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
          },
        },
        retryCount,
      };
    }

    retryCount++;
    execResult = await execute();
  }

  return { execResult, retryCount };
}
