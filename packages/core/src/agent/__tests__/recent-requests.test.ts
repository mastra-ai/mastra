import { describe, expect, it } from 'vitest';

import { createRecentRequests } from '../recent-requests';

describe('createRecentRequests', () => {
  it('returns what was recorded for an id, and nothing for a first sighting', () => {
    const requests = createRecentRequests<{ published: boolean }>();

    expect(requests.get('a')).toBeUndefined();

    requests.set('a', { published: false });
    expect(requests.get('a')).toEqual({ published: false });
  });

  it('hands back the same record, so callers can update it in place', () => {
    const requests = createRecentRequests<{ published: boolean }>();
    requests.set('a', { published: false });

    requests.get('a')!.published = true;

    expect(requests.get('a')).toEqual({ published: true });
  });

  it('forgets the oldest id once the cap is reached, never a first delivery', () => {
    const requests = createRecentRequests<number>(2);

    requests.set('a', 1);
    requests.set('b', 2);
    // 'a' is evicted to make room, so it reads as unseen rather than being
    // suppressed — an undersized store reprocesses, it does not drop.
    requests.set('c', 3);

    expect(requests.size).toBe(2);
    expect(requests.get('a')).toBeUndefined();
    expect(requests.get('b')).toBe(2);
    expect(requests.get('c')).toBe(3);
  });

  it('clears every recorded id', () => {
    const requests = createRecentRequests<number>();
    requests.set('a', 1);

    requests.clear();

    expect(requests.size).toBe(0);
    expect(requests.get('a')).toBeUndefined();
  });
});
