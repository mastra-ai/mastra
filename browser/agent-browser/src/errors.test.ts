import { createError } from '@mastra/core/browser';
import type { ErrorCode } from '@mastra/core/browser';
import { describe, expect, it } from 'vitest';

describe('createError', () => {
  it('creates a structured error with code and message', () => {
    const error = createError('element_not_found', 'Element @e5 not found');
    expect(error).toEqual({
      success: false,
      code: 'element_not_found',
      message: 'Element @e5 not found',
      recoveryHint: undefined,
      canRetry: false,
    });
  });

  it('includes recoveryHint when provided', () => {
    const error = createError('stale_ref', 'Ref @e3 is stale', 'Take a new snapshot');
    expect(error.recoveryHint).toBe('Take a new snapshot');
  });

  it('sets canRetry=true for timeout errors', () => {
    const error = createError('timeout', 'Operation timed out');
    expect(error.canRetry).toBe(true);
  });

  it('sets canRetry=true for element_blocked errors', () => {
    const error = createError('element_blocked', 'Element blocked by overlay');
    expect(error.canRetry).toBe(true);
  });

  it('sets canRetry=false for non-retryable error codes', () => {
    const nonRetryable: ErrorCode[] = [
      'stale_ref',
      'element_not_found',
      'element_not_visible',
      'not_focusable',
      'browser_error',
    ];

    for (const code of nonRetryable) {
      const error = createError(code, `Error: ${code}`);
      expect(error.canRetry).toBe(false);
    }
  });

  it('always sets success to false', () => {
    const error = createError('browser_error', 'Something went wrong');
    expect(error.success).toBe(false);
  });
});
