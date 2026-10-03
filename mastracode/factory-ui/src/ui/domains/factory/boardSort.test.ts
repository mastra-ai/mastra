import { describe, expect, it } from 'vitest';

import { boardSortFromParams, boardSortParams } from './boardSort';

describe('board sort URL state', () => {
  it('defaults unknown or absent values to recent Factory activity', () => {
    expect(boardSortFromParams(new URLSearchParams())).toBe('recent');
    expect(boardSortFromParams(new URLSearchParams('sort=provider-updated'))).toBe('recent');
  });

  it('preserves other board state while changing the sort', () => {
    const params = boardSortParams(new URLSearchParams('q=login&item=work-1'), 'recent-mine');

    expect(params.toString()).toBe('q=login&item=work-1&sort=recent-mine');
    expect(boardSortFromParams(params, 'user-1')).toBe('recent-mine');
  });

  it('keeps the default out of the URL', () => {
    expect(boardSortParams(new URLSearchParams('sort=created-oldest&q=login'), 'recent').toString()).toBe('q=login');
  });

  it('does not claim to sort by the viewer when there is no signed-in user', () => {
    const params = new URLSearchParams('sort=recent-mine');

    expect(boardSortFromParams(params)).toBe('recent');
    expect(boardSortFromParams(params, 'user-1')).toBe('recent-mine');
  });
});
