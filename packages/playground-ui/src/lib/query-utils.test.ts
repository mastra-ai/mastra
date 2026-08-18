import { describe, expect, it } from 'vitest';

import {
  isObservabilityUnavailableError,
  isUnsupportedObservabilityOperationError,
  shouldRetryQuery,
} from './query-utils';

describe('isUnsupportedObservabilityOperationError', () => {
  it('matches the requested unsupported observability operation', () => {
    const error = new Error('This storage provider does not support listing logs');

    expect(isUnsupportedObservabilityOperationError(error, 'logs')).toBe(true);
    expect(isUnsupportedObservabilityOperationError(error, 'metrics')).toBe(false);
  });
});

describe('isObservabilityUnavailableError', () => {
  it('matches the disabled observability domain error from the server', () => {
    const error = new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}');

    expect(isObservabilityUnavailableError(error)).toBe(true);
  });

  it('matches the disabled scores domain error from the span scores endpoint', () => {
    const error = new Error('HTTP error! status: 501 - {"error":"Scores storage domain is not available"}');

    expect(isObservabilityUnavailableError(error)).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isObservabilityUnavailableError(new Error('Network request failed'))).toBe(false);
    expect(
      isObservabilityUnavailableError(new Error('HTTP error! status: 500 - {"error":"Storage is not available"}')),
    ).toBe(false);
    // Other domains share the message suffix but are not observability concerns.
    expect(
      isObservabilityUnavailableError(
        new Error('HTTP error! status: 500 - {"error":"Agents storage domain is not available"}'),
      ),
    ).toBe(false);
    expect(isObservabilityUnavailableError(null)).toBe(false);
  });
});

describe('shouldRetryQuery', () => {
  it('does not retry 501 capability gaps', () => {
    const error = new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}');

    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it('retries transient server errors up to 3 times', () => {
    const error = new Error('HTTP error! status: 503');

    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
  });
});
