import type { Query } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { getTraceFeedbackRefetchInterval } from '../use-trace-feedback';

describe('getTraceFeedbackRefetchInterval', () => {
  it('disables polling when the observability storage domain is unavailable', () => {
    const query = {
      state: {
        error: new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}'),
      },
    } as Query;

    expect(getTraceFeedbackRefetchInterval(query)).toBe(false);
  });

  it('disables polling when the storage provider cannot list feedback', () => {
    const query = {
      state: { error: new Error('This storage provider does not support listing feedback') },
    } as Query;

    expect(getTraceFeedbackRefetchInterval(query)).toBe(false);
  });

  it('keeps polling for supported feedback queries', () => {
    const query = { state: { error: null } } as Query;

    expect(getTraceFeedbackRefetchInterval(query)).toBe(3000);
  });
});
