import { describe, expect, it } from 'vitest';

import { nestSideSessions, sideSessionDescendants } from '../sessionNesting';
import type { NestedSessionRows } from '../sessionNesting';
import { userRow } from './fixtures/sessionRows';

const sessionIds = (rows: NestedSessionRows['rows']) => rows.map(row => row.session.sessionId);

function sideSessionIds(nested: NestedSessionRows) {
  return Object.fromEntries([...nested.sideSessions].map(([originId, rows]) => [originId, sessionIds([...rows])]));
}

describe('nestSideSessions', () => {
  it('moves side sessions under the session that started them, keeping their order', () => {
    const nested = nestSideSessions([
      userRow('side-2', { originSessionId: 'origin' }),
      userRow('origin'),
      userRow('other'),
      userRow('side-1', { originSessionId: 'origin' }),
    ]);

    expect(sessionIds(nested.rows)).toEqual(['origin', 'other']);
    expect(sideSessionIds(nested)).toEqual({ origin: ['side-2', 'side-1'] });
  });

  it('nests side sessions of side sessions under their own origin', () => {
    const nested = nestSideSessions([
      userRow('origin'),
      userRow('side', { originSessionId: 'origin' }),
      userRow('grandchild', { originSessionId: 'side' }),
    ]);

    expect(sessionIds(nested.rows)).toEqual(['origin']);
    expect(sideSessionIds(nested)).toEqual({ origin: ['side'], side: ['grandchild'] });
    expect(sessionIds(sideSessionDescendants(nested.rows[0], nested.sideSessions))).toEqual(['side', 'grandchild']);
  });

  it('keeps a side session at the top level when its origin is not listed', () => {
    const nested = nestSideSessions([
      userRow('side', { originSessionId: 'filtered-out' }),
      userRow('plain', { originSessionId: null }),
    ]);

    expect(sessionIds(nested.rows)).toEqual(['side', 'plain']);
    expect(nested.sideSessions.size).toBe(0);
  });
});
