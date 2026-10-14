import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionSort } from './useSessionSort';

const STORAGE_KEY = 'mastracode.sessionSort';

function storedSorts() {
  return {
    work: renderHook(() => useSessionSort('work')).result.current[0],
    review: renderHook(() => useSessionSort('review')).result.current[0],
    user: renderHook(() => useSessionSort('user')).result.current[0],
  };
}

describe('useSessionSort', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps each list's valid stored sort and defaults the others", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ work: 'bogus', review: 'created', user: 'activity' }));

    expect(storedSorts()).toEqual({ work: 'activity', review: 'created', user: 'updated' });
  });

  it('opens every list on its default when the stored value is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    expect(storedSorts()).toEqual({ work: 'activity', review: 'activity', user: 'updated' });
  });

  it('keeps the chosen sort for the session when localStorage writes fail', () => {
    const { result } = renderHook(() => useSessionSort('review'));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    act(() => result.current[1]('updated'));

    expect(result.current[0]).toBe('updated');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    setItem.mockRestore();
    act(() => result.current[1]('activity'));
  });
});
