import { describe, expect, it } from 'vitest';

import {
  EMPTY_USER_SESSION_FILTERS,
  MY_SESSIONS,
  activeUserSessionFilterCount,
  filterUserSessions,
  sessionOwnerFilterValue,
} from '../sessionFilters';
import type { UserSessionFilterCandidate, UserSessionFiltersState } from '../sessionFilters';
import type { FactoryUserSession } from '../user-sessions';

const now = new Date('2026-09-04T12:00:00.000Z').getTime();

function session(overrides: Partial<FactoryUserSession> = {}): FactoryUserSession {
  return {
    id: 'row-1',
    sessionId: 'session-abc',
    projectRepositoryId: 'repo-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title: 'Fix authentication',
    branch: 'user/fix-auth',
    baseBranch: 'main',
    sandboxId: 'sandbox-1',
    sandboxWorkdir: '/workspace',
    materializedAt: '2026-09-04T10:00:00.000Z',
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T11:00:00.000Z',
    ...overrides,
  };
}

function candidate(overrides: Partial<UserSessionFilterCandidate> = {}): UserSessionFilterCandidate {
  return {
    session: session(),
    ownerName: 'Romain',
    status: 'idle',
    ...overrides,
  };
}

function filters(overrides: Partial<UserSessionFiltersState>): UserSessionFiltersState {
  return { ...EMPTY_USER_SESSION_FILTERS, ...overrides };
}

describe('session filters', () => {
  it.each(['authentication', 'FIX-AUTH', 'romain', 'USER-1', 'SESSION-ABC'])(
    'matches search text across session presentation fields: %s',
    search => {
      expect(filterUserSessions([candidate()], filters({ search }), 'viewer', now)).toHaveLength(1);
    },
  );

  it('filters mine and specific owners by stable user id', () => {
    const sessions = [
      candidate(),
      candidate({ session: session({ id: 'row-2', sessionId: 'session-2', userId: 'user-2' }) }),
    ];

    expect(filterUserSessions(sessions, filters({ owner: MY_SESSIONS }), 'user-2', now)).toEqual([sessions[1]]);
    expect(filterUserSessions(sessions, filters({ owner: sessionOwnerFilterValue('user-1') }), 'user-2', now)).toEqual([
      sessions[0],
    ]);
  });

  it('combines status and updated filters with inclusive cutoff semantics', () => {
    const recentWorking = candidate({ status: 'working' });
    const oldWorking = candidate({
      status: 'working',
      session: session({ id: 'row-2', sessionId: 'session-2', updatedAt: '2026-09-03T11:59:59.999Z' }),
    });
    const recentIdle = candidate({
      session: session({ id: 'row-3', sessionId: 'session-3', updatedAt: '2026-09-03T12:00:00.000Z' }),
    });

    expect(
      filterUserSessions(
        [recentWorking, oldWorking, recentIdle],
        filters({ status: 'working', updated: '24h' }),
        'user-1',
        now,
      ),
    ).toEqual([recentWorking]);
    expect(filterUserSessions([recentIdle], filters({ updated: '24h' }), 'user-1', now)).toEqual([recentIdle]);
  });

  it('counts each active control once', () => {
    expect(activeUserSessionFilterCount(EMPTY_USER_SESSION_FILTERS)).toBe(0);
    expect(
      activeUserSessionFilterCount(filters({ search: 'auth', owner: MY_SESSIONS, status: 'working', updated: '7d' })),
    ).toBe(4);
  });
});
