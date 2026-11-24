// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalStorageStore, useLocalStorageStore } from '../use-local-storage-store';

const KEY = 'test:tags';

function tagStore() {
  return createLocalStorageStore<ReadonlySet<string>>({
    key: KEY,
    defaultValue: new Set(),
    parse: stored => {
      if (!Array.isArray(stored)) throw new Error('not a tag list');
      return new Set(stored.filter(tag => typeof tag === 'string'));
    },
    toJSON: tags => [...tags],
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useLocalStorageStore', () => {
  it('updates every reader of the store when one writes', () => {
    const store = tagStore();
    const first = renderHook(() => useLocalStorageStore(store));
    const second = renderHook(() => useLocalStorageStore(store));

    act(() => store.write(new Set(['pinned'])));

    expect([...first.result.current]).toEqual(['pinned']);
    expect([...second.result.current]).toEqual(['pinned']);
    expect(localStorage.getItem(KEY)).toBe('["pinned"]');
  });

  it('keeps the same value identity until storage changes, so readers do not re-render in a loop', () => {
    localStorage.setItem(KEY, '["a"]');
    const store = tagStore();

    expect(store.read()).toBe(store.read());
  });

  it.each(['not json', '{"tags":["a"]}'])('reads %s as empty', stored => {
    localStorage.setItem(KEY, stored);

    expect(renderHook(() => useLocalStorageStore(tagStore())).result.current.size).toBe(0);
  });

  it('picks up a write from another tab', () => {
    const store = tagStore();
    const reader = renderHook(() => useLocalStorageStore(store));

    act(() => {
      localStorage.setItem(KEY, '["from-other-tab"]');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect([...reader.result.current]).toEqual(['from-other-tab']);
  });

  it('keeps a value in memory when storage refuses the write', () => {
    const store = tagStore();
    const reader = renderHook(() => useLocalStorageStore(store));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    act(() => store.write(new Set(['kept'])));

    expect([...reader.result.current]).toEqual(['kept']);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('reads storage again when another tab writes after a failed read', () => {
    localStorage.setItem(KEY, '["before"]');
    const store = tagStore();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('storage blocked');
    });
    const reader = renderHook(() => useLocalStorageStore(store));
    expect(reader.result.current.size).toBe(0);
    getItem.mockRestore();

    act(() => {
      localStorage.setItem(KEY, '["from-other-tab"]');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect([...reader.result.current]).toEqual(['from-other-tab']);
  });
});
