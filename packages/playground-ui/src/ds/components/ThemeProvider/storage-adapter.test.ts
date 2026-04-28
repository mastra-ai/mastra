// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createLocalStorageAdapter } from './storage-adapter';

const DEFAULT_KEY = 'mastra-theme';

describe('createLocalStorageAdapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    const adapter = createLocalStorageAdapter();
    expect(adapter.get()).toBeNull();
  });

  it('round-trips a theme through set/get as a plain string', () => {
    const adapter = createLocalStorageAdapter();
    adapter.set('light');
    expect(window.localStorage.getItem(DEFAULT_KEY)).toBe('light');
    expect(adapter.get()).toBe('light');
  });

  it('migrates the legacy zustand-persist envelope on first read', () => {
    window.localStorage.setItem(
      'mastra-playground-store',
      JSON.stringify({ state: { theme: 'light', requestContext: { foo: 'bar' } }, version: 0 }),
    );
    const adapter = createLocalStorageAdapter();
    expect(adapter.get()).toBe('light');
    expect(window.localStorage.getItem(DEFAULT_KEY)).toBe('light');
    // Legacy entry must remain so the rest of the zustand state survives.
    expect(window.localStorage.getItem('mastra-playground-store')).not.toBeNull();
  });

  it('ignores legacy values that are not a valid theme', () => {
    window.localStorage.setItem(
      'mastra-playground-store',
      JSON.stringify({ state: { theme: 'neon-pink' }, version: 0 }),
    );
    const adapter = createLocalStorageAdapter();
    expect(adapter.get()).toBeNull();
    expect(window.localStorage.getItem(DEFAULT_KEY)).toBeNull();
  });

  it('returns null when stored value is not a known theme', () => {
    window.localStorage.setItem(DEFAULT_KEY, 'neon-pink');
    const adapter = createLocalStorageAdapter();
    expect(adapter.get()).toBeNull();
  });

  it('honours a custom storage key', () => {
    const adapter = createLocalStorageAdapter('custom-key');
    adapter.set('dark');
    expect(window.localStorage.getItem('custom-key')).toBe('dark');
    expect(window.localStorage.getItem(DEFAULT_KEY)).toBeNull();
  });

  it('subscribes to storage events for cross-tab sync', () => {
    const adapter = createLocalStorageAdapter();
    const seen: Array<string | null> = [];
    const unsubscribe = adapter.subscribe(value => seen.push(value));

    window.dispatchEvent(new StorageEvent('storage', { key: DEFAULT_KEY, newValue: 'light' }));
    window.dispatchEvent(new StorageEvent('storage', { key: DEFAULT_KEY, newValue: null }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: 'dark' }));
    window.dispatchEvent(new StorageEvent('storage', { key: DEFAULT_KEY, newValue: 'neon-pink' }));

    unsubscribe();
    expect(seen).toEqual(['light', null]);
  });
});
