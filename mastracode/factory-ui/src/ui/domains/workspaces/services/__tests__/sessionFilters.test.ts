import {
  SESSION_ROW_ALL_OWNERS,
  SESSION_ROW_MY_SESSIONS,
  sessionRowOwnerKey,
} from '@mastra/factory/session/session-row-query';
import { describe, expect, it } from 'vitest';

import { EMPTY_SESSION_FILTERS, activeSessionFilterCount, sessionOwnerOptions } from '../sessionFilters';

describe('session filters', () => {
  it('offers every owner by stable user id, and Mine only to a signed-in viewer', () => {
    const owners = [{ userId: 'user-1', name: 'Ada' }];

    expect(sessionOwnerOptions(owners, 'user-2').map(option => option.value)).toEqual([
      SESSION_ROW_ALL_OWNERS,
      SESSION_ROW_MY_SESSIONS,
      sessionRowOwnerKey('user-1'),
    ]);
    expect(sessionOwnerOptions(owners, undefined).map(option => option.value)).toEqual([
      SESSION_ROW_ALL_OWNERS,
      sessionRowOwnerKey('user-1'),
    ]);
  });

  it('counts each active control once', () => {
    expect(activeSessionFilterCount(EMPTY_SESSION_FILTERS)).toBe(0);
    expect(
      activeSessionFilterCount({
        ...EMPTY_SESSION_FILTERS,
        owner: SESSION_ROW_MY_SESSIONS,
        status: 'working',
        updated: '7d',
      }),
    ).toBe(3);
  });
});
