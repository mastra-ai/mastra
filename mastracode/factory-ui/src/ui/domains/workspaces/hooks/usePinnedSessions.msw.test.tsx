import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePinnedSessions } from './usePinnedSessions';

const STORAGE_KEY = 'mastracode.pinnedSessions';

describe('usePinnedSessions', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves in-memory pins when localStorage writes fail', () => {
    const { result } = renderHook(() => usePinnedSessions());
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    act(() => result.current.setPinned('session-1', true));

    expect(result.current.pinnedSessions.has('session-1')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    setItem.mockRestore();
    act(() => result.current.setPinned('session-1', false));
  });

  it('preserves cached pins when localStorage reads fail', () => {
    const { result } = renderHook(() => usePinnedSessions());

    act(() => result.current.setPinned('session-1', true));

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })));

    expect(result.current.pinnedSessions.has('session-1')).toBe(true);

    getItem.mockRestore();
    act(() => result.current.setPinned('session-1', false));
  });
});
