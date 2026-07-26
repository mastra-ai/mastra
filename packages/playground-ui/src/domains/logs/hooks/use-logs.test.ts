import { describe, expect, it } from 'vitest';

import { getLogsRefetchInterval } from './use-logs';

describe('getLogsRefetchInterval', () => {
  it('disables polling when the storage provider cannot list logs', () => {
    const query = {
      state: {
        error: new Error('This storage provider does not support listing logs'),
      },
    };

    expect(getLogsRefetchInterval(query)).toBe(false);
  });

  it('disables polling when the observability storage domain is unavailable', () => {
    const query = {
      state: {
        error: new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}'),
      },
    };

    expect(getLogsRefetchInterval(query)).toBe(false);
  });

  it('keeps polling for supported logs queries', () => {
    const query = { state: { error: null } };

    expect(getLogsRefetchInterval(query)).toBe(10000);
  });
});
