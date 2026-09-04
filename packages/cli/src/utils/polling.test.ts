import { describe, expect, it } from 'vitest';

import { isRetryablePollingError } from './polling';

describe('isRetryablePollingError', () => {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'];

  it.each(retryableCodes)('recognizes a top-level %s code', code => {
    expect(isRetryablePollingError({ code })).toBe(true);
  });

  it.each(retryableCodes)('recognizes a nested %s cause code', code => {
    expect(isRetryablePollingError({ cause: { code } })).toBe(true);
  });

  it('rejects unsupported error codes', () => {
    expect(isRetryablePollingError({ code: 'EINVAL' })).toBe(false);
  });
});
