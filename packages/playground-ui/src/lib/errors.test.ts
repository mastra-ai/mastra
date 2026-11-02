import { describe, expect, it } from 'vitest';
import { parseError } from './errors';

describe('parseError', () => {
  it('reads the `error` field', () => {
    expect(parseError(new Error('HTTP error! status: 500 - {"error":"boom"}')).error).toBe('boom');
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

  it('falls back to `message` when there are no issues', () => {
    expect(parseError(new Error('HTTP error! status: 409 - {"message":"Cursor conflict"}')).error).toBe(
      'Cursor conflict',
    );
  });

  it('uses the plain message when the body is not JSON', () => {
    expect(parseError(new Error('network down')).error).toBe('network down');
  });
});
