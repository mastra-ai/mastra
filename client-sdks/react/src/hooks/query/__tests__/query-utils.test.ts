import { describe, expect, it } from 'vitest';

import {
  is401UnauthorizedError,
  is403ForbiddenError,
  is404NotFoundError,
  isBranchesNotSupportedError,
  isNonRetryableError,
  isObservabilityUnavailableError,
  isUnsupportedObservabilityOperationError,
  shouldRetryQuery,
} from '../query-utils';

const NON_OBJECTS = [
  ['null', null],
  ['undefined', undefined],
  ['a string', 'HTTP error! status: 401'],
  ['a number', 401],
] as const;

describe.each([
  ['is401UnauthorizedError', is401UnauthorizedError, 401, 403],
  ['is403ForbiddenError', is403ForbiddenError, 403, 401],
  ['is404NotFoundError', is404NotFoundError, 404, 401],
] as const)('%s', (_, matches, code, otherCode) => {
  describe('when called', () => {
    it('matches a direct status property', () => {
      expect(matches({ status: code })).toBe(true);
      expect(matches({ status: otherCode })).toBe(false);
    });
  });

  describe('when called', () => {
    it('matches a statusCode property', () => {
      expect(matches({ statusCode: code })).toBe(true);
      expect(matches({ statusCode: otherCode })).toBe(false);
    });
  });

  describe('when with or without a space', () => {
    it('matches the client-js message format,', () => {
      expect(matches(new Error(`HTTP error! status: ${code}`))).toBe(true);
      expect(matches(new Error(`HTTP error! status:${code}`))).toBe(true);
      expect(matches(new Error(`HTTP error! status: ${otherCode}`))).toBe(false);
    });
  });

  describe('when called', () => {
    it('requires the status code to stand alone in the message', () => {
      expect(matches(new Error(`HTTP error! status: ${code}7`))).toBe(false);
      expect(matches(new Error(`HTTP error! xstatus: ${code}`))).toBe(false);
    });
  });

  describe('when the status property does not match', () => {
    it('falls back to the message', () => {
      expect(matches({ status: 500, message: `HTTP error! status: ${code}` })).toBe(true);
    });
  });

  describe('when for a non-string message', () => {
    it('is false', () => {
      expect(matches({ message: code })).toBe(false);
      // A message must be read as text, never coerced into it: an object that
      // stringifies to a matching message is not a matching message.
      expect(matches({ message: { toString: () => `HTTP error! status: ${code}` } })).toBe(false);
    });
  });

  describe('when for an object carrying none of the three shapes', () => {
    it('is false', () => {
      expect(matches({ reason: code })).toBe(false);
    });
  });

  describe('when given each case', () => {
    it.each(NON_OBJECTS)('is false for %s', (__, value) => {
      expect(matches(value)).toBe(false);
    });
  });
});

describe('isBranchesNotSupportedError', () => {
  describe('when called', () => {
    it('matches the base-storage message text', () => {
      expect(isBranchesNotSupportedError(new Error('LibSQL does not support listing trace branches'))).toBe(true);
    });
  });

  describe('when called', () => {
    it('does not match unrelated errors', () => {
      expect(isBranchesNotSupportedError(new Error('does not support listing logs'))).toBe(false);
      expect(isBranchesNotSupportedError({ message: 42 })).toBe(false);
      expect(isBranchesNotSupportedError({ reason: 'nope' })).toBe(false);
      expect(isBranchesNotSupportedError(null)).toBe(false);
      expect(isBranchesNotSupportedError('does not support listing trace branches')).toBe(false);
    });
  });
});

describe('isUnsupportedObservabilityOperationError', () => {
  describe('when called', () => {
    it('matches the requested unsupported observability operation', () => {
      const error = new Error('This storage provider does not support listing logs');

      expect(isUnsupportedObservabilityOperationError(error, 'logs')).toBe(true);
      expect(isUnsupportedObservabilityOperationError(error, 'metrics')).toBe(false);
    });
  });

  describe('when given each case', () => {
    it.each(['logs', 'metrics', 'scores', 'feedback'] as const)('matches the %s operation', operation => {
      expect(
        isUnsupportedObservabilityOperationError(
          new Error(`This storage provider does not support listing ${operation}`),
          operation,
        ),
      ).toBe(true);
    });
  });

  describe('when called', () => {
    it('does not match unrelated errors', () => {
      expect(isUnsupportedObservabilityOperationError(new Error('Network request failed'), 'logs')).toBe(false);
      expect(isUnsupportedObservabilityOperationError({ message: 42 }, 'logs')).toBe(false);
      expect(isUnsupportedObservabilityOperationError({ reason: 'nope' }, 'logs')).toBe(false);
      expect(isUnsupportedObservabilityOperationError(null, 'logs')).toBe(false);
    });
  });
});

describe('isObservabilityUnavailableError', () => {
  describe('when called', () => {
    it('matches the disabled observability domain error from the server', () => {
      const error = new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}');

      expect(isObservabilityUnavailableError(error)).toBe(true);
    });
  });

  describe('when called', () => {
    it('matches the disabled scores domain error from the span scores endpoint', () => {
      const error = new Error('HTTP error! status: 501 - {"error":"Scores storage domain is not available"}');

      expect(isObservabilityUnavailableError(error)).toBe(true);
    });
  });

  describe('when called', () => {
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
      expect(isObservabilityUnavailableError({ message: 42 })).toBe(false);
      expect(isObservabilityUnavailableError({ reason: 'nope' })).toBe(false);
    });
  });
});

describe('isNonRetryableError', () => {
  describe('when given each case', () => {
    it.each([400, 401, 403, 404, 501])('does not retry %i from a status property', status => {
      expect(isNonRetryableError({ status })).toBe(true);
      expect(isNonRetryableError({ statusCode: status })).toBe(true);
      expect(isNonRetryableError(new Error(`HTTP error! status: ${status}`))).toBe(true);
    });
  });

  describe('when given each case', () => {
    it.each([408, 429, 500, 502, 503])('retries %i', status => {
      expect(isNonRetryableError({ status })).toBe(false);
      expect(isNonRetryableError({ statusCode: status })).toBe(false);
      expect(isNonRetryableError(new Error(`HTTP error! status: ${status}`))).toBe(false);
    });
  });

  describe('when called', () => {
    it('trusts the status property over the message', () => {
      // A retryable transport error must not be blocked by a stale code in its text.
      expect(isNonRetryableError({ status: 500, message: 'HTTP error! status: 404' })).toBe(false);
      expect(isNonRetryableError({ statusCode: 500, message: 'HTTP error! status: 404' })).toBe(false);
    });
  });

  describe('when called', () => {
    it('requires the status code to stand alone in the message', () => {
      expect(isNonRetryableError(new Error('HTTP error! status: 4041'))).toBe(false);
      expect(isNonRetryableError(new Error('HTTP error! xstatus: 404'))).toBe(false);
      expect(isNonRetryableError(new Error('HTTP error! status:404'))).toBe(true);
    });
  });

  describe('when given each case', () => {
    it.each(NON_OBJECTS)('is false for %s', (_, value) => {
      expect(isNonRetryableError(value)).toBe(false);
    });
  });

  describe('when for an object carrying none of the three shapes', () => {
    it('is false', () => {
      expect(isNonRetryableError({ reason: 404 })).toBe(false);
      expect(isNonRetryableError({ message: 404 })).toBe(false);
      expect(isNonRetryableError({ message: { toString: () => 'HTTP error! status: 404' } })).toBe(false);
    });
  });
});

describe('shouldRetryQuery', () => {
  describe('when called', () => {
    it('does not retry 501 capability gaps', () => {
      const error = new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}');

      expect(shouldRetryQuery(0, error)).toBe(false);
    });
  });

  describe('when called', () => {
    it('never retries a client error, even on the first failure', () => {
      expect(shouldRetryQuery(0, { status: 404 })).toBe(false);
    });
  });

  describe('when called', () => {
    it('retries transient server errors up to 3 times', () => {
      const error = new Error('HTTP error! status: 503');

      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(true);
      expect(shouldRetryQuery(3, error)).toBe(false);
      expect(shouldRetryQuery(4, error)).toBe(false);
    });
  });
});
