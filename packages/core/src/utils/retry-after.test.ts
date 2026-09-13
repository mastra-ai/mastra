import { describe, expect, it } from 'vitest';
import { clampDelayMs, getRetryAfterMs } from './retry-after';

const NOW = 1_000_000;

function errorWithHeaders(headers: Record<string, unknown>, cause?: unknown): Error {
  return Object.assign(new Error('rate limited'), { responseHeaders: headers, cause });
}

describe('getRetryAfterMs', () => {
  it('reads delay-seconds from Retry-After', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': '5' }), NOW)).toBe(5_000);
  });

  it('reads Retry-After-Ms and prefers it over Retry-After', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after-ms': '250', 'retry-after': '5' }), NOW)).toBe(250);
  });

  it('honors a Retry-After of 0', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': '0' }), NOW)).toBe(0);
  });

  it('matches header names case-insensitively', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'Retry-After': '3' }), NOW)).toBe(3_000);
  });

  it('reads an HTTP-date in the future as a delay', () => {
    const httpDate = new Date(NOW + 4_000).toUTCString();
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': httpDate }), NOW)).toBe(4_000);
  });

  it('ignores an HTTP-date in the past', () => {
    const httpDate = new Date(NOW - 60_000).toUTCString();
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': httpDate }), NOW)).toBeUndefined();
  });

  it('walks the cause chain for a usable header', () => {
    const error = errorWithHeaders({}, errorWithHeaders({ 'retry-after': '7' }));
    expect(getRetryAfterMs(error, NOW)).toBe(7_000);
  });

  // A bare number is not an HTTP-date: `Date.parse('-3')` reads it as a year and
  // returns a timestamp decades away. These values must read as "no usable
  // delay" so the caller falls back to its own backoff.
  it.each(['-3', '+3', '1.5', '-0.5', '1e3'])('treats the malformed Retry-After %j as no delay', value => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': value }), NOW)).toBeUndefined();
  });

  it('does not let a malformed Retry-After shadow a usable one in the cause chain', () => {
    const error = errorWithHeaders({ 'retry-after': '-3' }, errorWithHeaders({ 'retry-after': '5' }));
    expect(getRetryAfterMs(error, NOW)).toBe(5_000);
  });

  it('falls through a malformed Retry-After-Ms to a usable Retry-After on the same error', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after-ms': 'soon', 'retry-after': '2' }), NOW)).toBe(2_000);
  });

  it('returns undefined when no header carries a usable value', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': 'whenever' }), NOW)).toBeUndefined();
    expect(getRetryAfterMs(new Error('no headers'), NOW)).toBeUndefined();
    expect(getRetryAfterMs(undefined, NOW)).toBeUndefined();
  });

  it('terminates on a cyclic cause chain', () => {
    const first = errorWithHeaders({ 'retry-after': 'nope' });
    const second = errorWithHeaders({ 'retry-after': '9' }, first);
    (first as { cause?: unknown }).cause = second;
    expect(getRetryAfterMs(first, NOW)).toBe(9_000);
  });
});

describe('clampDelayMs', () => {
  it('clamps non-positive and non-finite delays to 0', () => {
    expect(clampDelayMs(-1)).toBe(0);
    expect(clampDelayMs(0)).toBe(0);
    expect(clampDelayMs(Number.NaN)).toBe(0);
    expect(clampDelayMs(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('passes a positive finite delay through', () => {
    expect(clampDelayMs(1_500)).toBe(1_500);
  });
});
