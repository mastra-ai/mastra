import { MastraClientError } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import {
  RUN_COUNTS_REFETCH_INTERVAL_MS,
  isRunCountsUnsupported,
  runCountsRefetchInterval,
} from '../use-workflows-run-counts';

describe('runCountsRefetchInterval', () => {
  describe('when the server does not have the endpoint', () => {
    it('stops polling on a 404 from the client', () => {
      const notFound = new MastraClientError(404, 'Not Found', 'HTTP error! status: 404');

      expect(isRunCountsUnsupported(notFound)).toBe(true);
      expect(runCountsRefetchInterval(notFound)).toBe(false);
    });
  });

  describe('when the failure is transient', () => {
    it('keeps polling on server errors', () => {
      const serverError = new MastraClientError(500, 'Internal Server Error', 'HTTP error! status: 500');

      expect(runCountsRefetchInterval(serverError)).toBe(RUN_COUNTS_REFETCH_INTERVAL_MS);
    });

    it('keeps polling on non-HTTP errors', () => {
      expect(runCountsRefetchInterval(new Error('network down'))).toBe(RUN_COUNTS_REFETCH_INTERVAL_MS);
    });
  });

  describe('when there is no error', () => {
    it('polls at the standard interval', () => {
      expect(runCountsRefetchInterval(null)).toBe(RUN_COUNTS_REFETCH_INTERVAL_MS);
    });
  });
});
