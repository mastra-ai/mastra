import type { Query } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { getScoresRefetchInterval } from '../use-scorers';
import { getTraceSpanScoresRefetchInterval } from '../use-trace-span-scores';

const unavailableError = new Error(
  'HTTP error! status: 501 - {"error":"Observability storage domain is not available"}',
);
// The span scores endpoint is backed by the separate `scores` storage domain
// and reports its own message when that domain is disabled.
const scoresDomainUnavailableError = new Error(
  'HTTP error! status: 501 - {"error":"Scores storage domain is not available"}',
);
const unsupportedError = new Error('This storage provider does not support listing scores');

describe('getScoresRefetchInterval', () => {
  it('disables polling when the observability storage domain is unavailable', () => {
    const query = { state: { error: unavailableError } } as Query;

    expect(getScoresRefetchInterval(query)).toBe(false);
  });

  it('disables polling when the storage provider cannot list scores', () => {
    const query = { state: { error: unsupportedError } } as Query;

    expect(getScoresRefetchInterval(query)).toBe(false);
  });

  it('keeps polling for supported scores queries', () => {
    const query = { state: { error: null } } as Query;

    expect(getScoresRefetchInterval(query)).toBe(5000);
  });
});

describe('getTraceSpanScoresRefetchInterval', () => {
  it('disables polling when the observability storage domain is unavailable', () => {
    const query = { state: { error: unavailableError } } as Query;

    expect(getTraceSpanScoresRefetchInterval(query)).toBe(false);
  });

  it('disables polling when the scores storage domain is unavailable', () => {
    const query = { state: { error: scoresDomainUnavailableError } } as Query;

    expect(getTraceSpanScoresRefetchInterval(query)).toBe(false);
  });

  it('keeps polling for supported queries', () => {
    const query = { state: { error: null } } as Query;

    expect(getTraceSpanScoresRefetchInterval(query)).toBe(3000);
  });
});
