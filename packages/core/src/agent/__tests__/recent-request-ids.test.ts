import { describe, expect, it } from 'vitest';

import { createRecentRequestIds } from '../recent-request-ids';

describe('createRecentRequestIds', () => {
  it('reports the first sighting of an id and every repeat', () => {
    const ids = createRecentRequestIds();

    expect(ids.remember('a')).toBe(true);
    expect(ids.remember('a')).toBe(false);
    expect(ids.remember('a')).toBe(false);
    expect(ids.remember('b')).toBe(true);
  });

  it('forgets the oldest id once the cap is reached, never a first delivery', () => {
    const ids = createRecentRequestIds(2);

    expect(ids.remember('a')).toBe(true);
    expect(ids.remember('b')).toBe(true);
    // 'a' is evicted to make room, so it reads as unseen rather than being
    // suppressed — an undersized tracker reprocesses, it does not drop.
    expect(ids.remember('c')).toBe(true);
    expect(ids.size).toBe(2);
    expect(ids.remember('a')).toBe(true);
  });

  it('clears every remembered id', () => {
    const ids = createRecentRequestIds();

    ids.remember('a');
    ids.clear();

    expect(ids.size).toBe(0);
    expect(ids.remember('a')).toBe(true);
  });
});
