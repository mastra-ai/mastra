import { describe, expect, it } from 'vitest';

import { getLogsRefetchInterval } from '../use-logs';

describe('getLogsRefetchInterval', () => {
  describe('when the storage provider cannot list logs', () => {
    it('disables polling', () => {
      const query = {
        state: {
          error: new Error('This storage provider does not support listing logs'),
        },
      };

      expect(getLogsRefetchInterval(query)).toBe(false);
    });
  });

  describe('when the observability storage domain is unavailable', () => {
    it('disables polling', () => {
      const query = {
        state: {
          error: new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}'),
        },
      };

      expect(getLogsRefetchInterval(query)).toBe(false);
    });
  });

  describe('when for supported logs queries', () => {
    it('keeps polling', () => {
      const query = { state: { error: null } };

      expect(getLogsRefetchInterval(query)).toBe(10000);
    });
  });
});
