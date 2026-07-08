import type { Query } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { getLogsRefetchInterval } from './use-logs';

describe('getLogsRefetchInterval', () => {
  it('disables polling when the storage provider cannot list logs', () => {
    const query = {
      state: {
        error: new Error('This storage provider does not support listing logs'),
      },
    } as Query;

    expect(getLogsRefetchInterval(query)).toBe(false);
  });

  it('keeps polling for supported logs queries', () => {
    const query = { state: { error: null } } as Query;

    expect(getLogsRefetchInterval(query)).toBe(10000);
  });
});
