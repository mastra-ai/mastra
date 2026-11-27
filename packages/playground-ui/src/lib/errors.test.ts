import { describe, expect, it } from 'vitest';
import { parseError } from './errors';

describe('parseError', () => {
  it.each([
    ['reads the `error` field', 'HTTP error! status: 500 - {"error":"boom"}', 'boom'],
    [
      'falls back to `message` when there are no issues',
      'HTTP error! status: 409 - {"message":"Cursor conflict"}',
      'Cursor conflict',
    ],
    ['uses the plain message when the body is not JSON', 'network down', 'network down'],
  ] as const)('%s', (_title, input, expected) => {
    expect(parseError(new Error(input)).error).toBe(expected);
  });

  it('reads trace-query validation issues', () => {
    const body = JSON.stringify({
      code: 'TRACE_QUERY_INVALID',
      message: 'The trace query is invalid',
      issues: [{ message: 'The time range cannot exceed 31 days' }],
    });
    expect(parseError(new Error(`HTTP error! status: 422 - ${body}`)).error).toBe(
      'The time range cannot exceed 31 days',
    );
  });
});
