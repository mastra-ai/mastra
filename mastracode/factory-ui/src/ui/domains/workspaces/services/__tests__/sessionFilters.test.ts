import { describe, expect, it } from 'vitest';

import {
  ALL_SESSION_OWNERS,
  EMPTY_SESSION_FILTERS,
  MY_SESSIONS,
  activeSessionFilterCount,
  sessionOwnerFilterValue,
  sessionOwnerOptions,
} from '../sessionFilters';

describe('session filters', () => {
  it('offers every owner by stable user id, and Mine only to a signed-in viewer', () => {
    const owners = [{ userId: 'user-1', name: 'Ada' }];

    expect(sessionOwnerOptions(owners, 'user-2').map(option => option.value)).toEqual([
      ALL_SESSION_OWNERS,
      MY_SESSIONS,
      sessionOwnerFilterValue('user-1'),
    ]);
    expect(sessionOwnerOptions(owners, undefined).map(option => option.value)).toEqual([
      ALL_SESSION_OWNERS,
      sessionOwnerFilterValue('user-1'),
    ]);
  });

  it('counts each active control once', () => {
    expect(activeSessionFilterCount(EMPTY_SESSION_FILTERS)).toBe(0);
    expect(
      activeSessionFilterCount({ ...EMPTY_SESSION_FILTERS, owner: MY_SESSIONS, status: 'working', updated: '7d' }),
    ).toBe(3);
  });
});
