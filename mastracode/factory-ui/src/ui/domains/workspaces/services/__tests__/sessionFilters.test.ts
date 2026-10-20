import { describe, expect, it } from 'vitest';

import {
  ALL_SESSION_OWNERS,
  EMPTY_SESSION_FILTERS,
  MY_SESSIONS,
  activeSessionFilterCount,
  defaultSessionFilters,
  filterSessionRows,
  sessionOwnerFilterValue,
  sessionOwnerOptions,
} from '../sessionFilters';
import type { SessionFiltersState } from '../sessionFilters';
import { factoryRow, testSession, testWorkItem, userRow } from './fixtures/sessionRows';

const now = new Date('2026-09-04T12:00:00.000Z').getTime();
const recently = '2026-09-04T11:00:00.000Z';

function filters(overrides: Partial<SessionFiltersState>): SessionFiltersState {
  return { ...EMPTY_SESSION_FILTERS, ...overrides };
}

describe('session filters', () => {
  it('filters mine and specific owners by stable user id', () => {
    const rows = [userRow('session-1', { userId: 'user-1' }), userRow('session-2', { userId: 'user-2' })];

    expect(filterSessionRows(rows, filters({ owner: MY_SESSIONS }), 'user-2', now)).toEqual([rows[1]]);
    expect(filterSessionRows(rows, filters({ owner: sessionOwnerFilterValue('user-1') }), 'user-2', now)).toEqual([
      rows[0],
    ]);
  });

  it('labels owners by their profile, else the saved owner name, else their user id', () => {
    const rows = [
      userRow('session-1', { userId: 'user-1', owner: { id: 'user-1', name: 'Ada' }, ownerName: 'Old Ada' }),
      userRow('session-2', { userId: 'user-2', ownerName: 'ward@example.com' }),
      userRow('session-3', { userId: 'user-3', ownerName: null }),
    ];

    expect(sessionOwnerOptions(rows, undefined).map(option => option.label)).toEqual([
      'All owners',
      'Ada',
      'user-3',
      'ward@example.com',
    ]);
  });

  it('combines status and updated filters with inclusive cutoff semantics', () => {
    const recentWorking = userRow('session-1', { updatedAt: recently }, { running: true });
    const oldWorking = userRow('session-2', { updatedAt: '2026-09-03T11:59:59.999Z' }, { running: true });
    const recentIdle = userRow('session-3', { updatedAt: '2026-09-03T12:00:00.000Z' });

    expect(
      filterSessionRows(
        [recentWorking, oldWorking, recentIdle],
        filters({ status: 'working', updated: '24h' }),
        'user-1',
        now,
      ),
    ).toEqual([recentWorking]);
    expect(filterSessionRows([recentIdle], filters({ updated: '24h' }), 'user-1', now)).toEqual([recentIdle]);
  });

  it('keeps only settled factory rows under Done and only rows awaiting a person under Waiting on you', () => {
    const done = factoryRow(testSession('done'), { item: testWorkItem({ stages: ['done'] }) });
    const waiting = factoryRow(testSession('waiting'), { attention: true });
    const idleFactory = factoryRow(testSession('idle'));
    const idleUser = userRow('user-idle');
    const rows = [done, waiting, idleFactory, idleUser];

    expect(filterSessionRows(rows, filters({ status: 'done' }), 'user-1', now)).toEqual([done]);
    expect(filterSessionRows(rows, filters({ status: 'waiting' }), 'user-1', now)).toEqual([waiting]);
  });

  it('counts each active control once', () => {
    expect(activeSessionFilterCount(EMPTY_SESSION_FILTERS)).toBe(0);
    expect(activeSessionFilterCount(filters({ owner: MY_SESSIONS, status: 'working', updated: '7d' }))).toBe(3);
  });

  it("defaults a known viewer to their own sessions and an unknown viewer to everyone's", () => {
    expect(defaultSessionFilters('user-1')).toEqual(filters({ owner: MY_SESSIONS }));
    expect(defaultSessionFilters(undefined)).toEqual(EMPTY_SESSION_FILTERS);
  });

  it('counts controls against the defaults, so the resting view is not active', () => {
    const defaults = defaultSessionFilters('user-1');

    expect(activeSessionFilterCount(defaults, defaults)).toBe(0);
    expect(activeSessionFilterCount(filters({ owner: ALL_SESSION_OWNERS }), defaults)).toBe(1);
    expect(activeSessionFilterCount({ ...defaults, status: 'working' }, defaults)).toBe(1);
  });
});
