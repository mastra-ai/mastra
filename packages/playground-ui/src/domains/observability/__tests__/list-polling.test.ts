import { MastraClientError } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import {
  fixedWindowRefetchInterval,
  isRejectedListRequest,
  OBSERVABILITY_LIST_REFETCH_INTERVAL_MS,
  recoveryRefetchInterval,
} from '../list-polling';

const clientError = (status: number) => new MastraClientError(status, '', `HTTP error! status: ${status}`);

describe('list polling', () => {
  it('stops polling a request the server refused', () => {
    expect(isRejectedListRequest(clientError(422))).toBe(true);
    expect(fixedWindowRefetchInterval(clientError(400))).toBe(false);
    expect(recoveryRefetchInterval(clientError(403))).toBe(false);
  });

  it('keeps polling through a rate limit, which clears once the window moves on', () => {
    const rateLimited = clientError(429);
    expect(isRejectedListRequest(rateLimited)).toBe(false);
    expect(fixedWindowRefetchInterval(rateLimited)).toBe(OBSERVABILITY_LIST_REFETCH_INTERVAL_MS);
    expect(recoveryRefetchInterval(rateLimited)).toBe(OBSERVABILITY_LIST_REFETCH_INTERVAL_MS);
  });

  it('retries transient failures and leaves a healthy list alone', () => {
    expect(recoveryRefetchInterval(clientError(503))).toBe(OBSERVABILITY_LIST_REFETCH_INTERVAL_MS);
    expect(recoveryRefetchInterval(null)).toBe(false);
  });
});
