import { MastraClientError } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { classifyAgentRunContinuationError } from '../agent-run-continuation-error';

describe('classifyAgentRunContinuationError', () => {
  describe('when the server rejects a version-policy change on a pinned run', () => {
    it('returns stable explanatory copy instead of trusting mutable server text', () => {
      const error = new MastraClientError(409, 'Conflict', 'Conflict', {
        error: {
          code: 'PINNED_VERSION_CONFLICT',
          message: 'Internal implementation detail.',
        },
      });

      expect(classifyAgentRunContinuationError(error)).toEqual({
        type: 'pinned-version-conflict',
        message: 'This active run cannot change version policy. Start a new run to use a different version or label.',
      });
    });
  });

  describe('when execute authorization has been revoked', () => {
    it('returns permission-specific copy for the fail-closed path', () => {
      const error = new MastraClientError(403, 'Forbidden', 'Execute access was revoked.');

      expect(classifyAgentRunContinuationError(error)).toEqual({
        type: 'authorization',
        message: 'You no longer have permission to continue this run. Studio refreshed your access and stopped it.',
      });
    });
  });

  describe('when the continuation fails for another reason', () => {
    it('preserves the original error for the existing generic treatment', () => {
      const error = new Error('Network disconnected');

      expect(classifyAgentRunContinuationError(error)).toEqual({ type: 'other', error });
    });
  });
});
