import type { ExecutionResult } from './executor';
import { TOOL_MOCK_EXHAUSTED, TOOL_MOCK_MISMATCH, TOOL_MOCK_NOT_DECLARED } from './tool-mocks';

/**
 * Tool-mock failures are deterministic: the matcher state can't change between
 * attempts, so retrying would always fail identically.
 */
const NON_RETRYABLE_ERROR_CODES = new Set<string>([TOOL_MOCK_MISMATCH, TOOL_MOCK_EXHAUSTED, TOOL_MOCK_NOT_DECLARED]);

/**
 * Run one item, retrying a failed execution up to `maxRetries` times with
 * exponential backoff (1s doubling, capped at 30s, plus up to 20% jitter).
 * Abort/timeout errors and tool-mock failures are never retried. Throws an
 * `AbortError` when `cancelSignal` is aborted between attempts.
 */
export async function executeWithRetries(
  execute: () => Promise<ExecutionResult>,
  options: { maxRetries: number; cancelSignal?: AbortSignal },
): Promise<{ execResult: ExecutionResult; retryCount: number }> {
  let retryCount = 0;
  let execResult = await execute();

  while (execResult.error && retryCount < options.maxRetries) {
    if (execResult.error.message.toLowerCase().includes('abort')) break;
    if (execResult.error.code && NON_RETRYABLE_ERROR_CODES.has(execResult.error.code)) break;

    retryCount++;
    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
    const jitter = delay * 0.2 * Math.random();
    await new Promise(r => setTimeout(r, delay + jitter));

    if (options.cancelSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    execResult = await execute();
  }

  return { execResult, retryCount };
}
