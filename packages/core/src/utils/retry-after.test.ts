import { describe, expect, it } from 'vitest';

import { clampDelayMs, getRetryAfterMs } from './retry-after';

const NOW = Date.parse('2026-09-15T12:00:00.000Z');

function errorWithHeaders(responseHeaders: Record<string, string>, cause?: unknown) {
  return { responseHeaders, cause };
}

describe('getRetryAfterMs', () => {
  it('parses delay-seconds', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': '5' }), NOW)).toBe(5_000);
  });

  it('prefers Retry-After-Ms over Retry-After', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': '5', 'retry-after-ms': '250' }), NOW)).toBe(250);
  });

  it('parses a future HTTP-date', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': 'Tue, 15 Sep 2026 12:00:05 GMT' }), NOW)).toBe(5_000);
  });

  it('ignores an expired HTTP-date', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': 'Tue, 15 Sep 2026 11:59:55 GMT' }), NOW)).toBeUndefined();
  });

  it('matches header names case-insensitively', () => {
    expect(getRetryAfterMs(errorWithHeaders({ 'Retry-After': '5' }), NOW)).toBe(5_000);
  });

  it.each(['-3', '+3', '1.5', '-0.5', '1e3', '2027.'])('ignores malformed numeric Retry-After value %s', value => {
    expect(getRetryAfterMs(errorWithHeaders({ 'retry-after': value }), NOW)).toBeUndefined();
  });

  it('continues through the cause chain after a malformed header', () => {
    const inner = errorWithHeaders({ 'retry-after': '5' });
    const outer = errorWithHeaders({ 'retry-after': '-3' }, inner);

    expect(getRetryAfterMs(outer, NOW)).toBe(5_000);
  });

  it('continues through the cause chain when no header is present', () => {
    const inner = errorWithHeaders({ 'retry-after-ms': '250' });

    expect(getRetryAfterMs({ cause: inner }, NOW)).toBe(250);
  });

  it('returns undefined for cyclic cause chains', () => {
    const first: { cause?: unknown } = {};
    const second = { cause: first };
    first.cause = second;

    expect(getRetryAfterMs(first, NOW)).toBeUndefined();
  });
});

describe('clampDelayMs', () => {
  it.each([
    [5, 5],
    [0, 0],
    [-1, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('clamps %s to %s', (value, expected) => {
    expect(clampDelayMs(value)).toBe(expected);
  });
});
