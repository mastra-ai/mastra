import { describe, expect, it } from 'vitest';

import { getFeedbackRefetchInterval } from '../feedback-refetch-interval';

describe('getFeedbackRefetchInterval', () => {
  describe('when the observability storage domain is unavailable', () => {
    it('disables polling', () => {
      const query = {
        state: {
          error: new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}'),
        },
      };

      expect(getFeedbackRefetchInterval(query)).toBe(false);
    });
  });

  describe('when the storage provider cannot list feedback', () => {
    it('disables polling', () => {
      const query = {
        state: { error: new Error('This storage provider does not support listing feedback') },
      };

      expect(getFeedbackRefetchInterval(query)).toBe(false);
    });
  });

  describe('when the feedback query has no error', () => {
    it('keeps polling', () => {
      const query = { state: { error: undefined } };

      expect(getFeedbackRefetchInterval(query)).toBe(3000);
    });
  });
});
