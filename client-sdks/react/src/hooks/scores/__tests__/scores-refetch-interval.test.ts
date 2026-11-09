// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { getScoresRefetchInterval } from '../use-scorers';
import { getTraceSpanScoresRefetchInterval } from '../use-trace-span-scores';

const unavailableError = new Error(
  'HTTP error! status: 501 - {"error":"Observability storage domain is not available"}',
);
const scoresDomainUnavailableError = new Error(
  'HTTP error! status: 501 - {"error":"Scores storage domain is not available"}',
);
const unsupportedError = new Error('This storage provider does not support listing scores');

describe('getScoresRefetchInterval', () => {
  describe('when the observability storage domain is unavailable', () => {
    it('disables polling', () => {
      const query = { state: { error: unavailableError } };

      expect(getScoresRefetchInterval(query)).toBe(false);
    });
  });

  describe('when the storage provider cannot list scores', () => {
    it('disables polling', () => {
      const query = { state: { error: unsupportedError } };

      expect(getScoresRefetchInterval(query)).toBe(false);
    });
  });

  describe('when for supported scores queries', () => {
    it('keeps polling', () => {
      const query = { state: { error: null } };

      expect(getScoresRefetchInterval(query)).toBe(15_000);
    });
  });
});

describe('getTraceSpanScoresRefetchInterval', () => {
  describe('when the observability storage domain is unavailable', () => {
    it('disables polling', () => {
      const query = { state: { error: unavailableError } };

      expect(getTraceSpanScoresRefetchInterval(query)).toBe(false);
    });
  });

  describe('when the scores storage domain is unavailable', () => {
    it('disables polling', () => {
      const query = { state: { error: scoresDomainUnavailableError } };

      expect(getTraceSpanScoresRefetchInterval(query)).toBe(false);
    });
  });

  describe('when for supported queries', () => {
    it('keeps polling', () => {
      const query = { state: { error: null } };

      expect(getTraceSpanScoresRefetchInterval(query)).toBe(15_000);
    });
  });
});
