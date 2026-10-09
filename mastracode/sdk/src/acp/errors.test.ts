import { describe, expect, it } from 'vitest';
import { withCleanupFailure } from './errors.js';

describe('withCleanupFailure', () => {
  it('preserves messages from thrown objects and retains both failures', () => {
    const failure = { message: 'Startup failed' };
    const cleanupFailure = new Error('Cleanup failed');
    expect(withCleanupFailure(failure, cleanupFailure)).toMatchObject({
      message: failure.message,
      cause: failure,
      errors: [failure, cleanupFailure],
    });
  });
});
