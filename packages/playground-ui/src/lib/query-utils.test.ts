import { describe, expect, it } from 'vitest';

import { isUnsupportedObservabilityOperationError } from './query-utils';

describe('isUnsupportedObservabilityOperationError', () => {
  it('matches the requested unsupported observability operation', () => {
    const error = new Error('This storage provider does not support listing logs');

    expect(isUnsupportedObservabilityOperationError(error, 'logs')).toBe(true);
    expect(isUnsupportedObservabilityOperationError(error, 'metrics')).toBe(false);
  });
});
