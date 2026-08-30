import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INSTALL_BANNER_DISMISS_DURATION_MS,
  isManuallyInstalled,
  markDismissed,
  markManuallyInstalled,
  wasRecentlyDismissed,
} from './persistence';

const DISMISSED_KEY = 'mastracode.pwaInstallDismissedAt';
const INSTALLED_KEY = 'mastracode.pwaInstalledManually';

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-24T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('wasRecentlyDismissed', () => {
  it('is false when nothing is stored', () => {
    stubLocalStorage();
    expect(wasRecentlyDismissed()).toBe(false);
  });

  it('is true within the dismiss window', () => {
    const store = stubLocalStorage();
    store.set(DISMISSED_KEY, String(Date.now() - INSTALL_BANNER_DISMISS_DURATION_MS + 60_000));
    expect(wasRecentlyDismissed()).toBe(true);
  });

  it('is false once the dismiss window has expired', () => {
    const store = stubLocalStorage();
    store.set(DISMISSED_KEY, String(Date.now() - INSTALL_BANNER_DISMISS_DURATION_MS - 1));
    expect(wasRecentlyDismissed()).toBe(false);
  });

  it('is false for a corrupt stored value', () => {
    const store = stubLocalStorage();
    store.set(DISMISSED_KEY, 'not-a-number');
    expect(wasRecentlyDismissed()).toBe(false);
  });

  it('tolerates localStorage throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(wasRecentlyDismissed()).toBe(false);
  });
});

describe('markDismissed', () => {
  it('stores the current timestamp', () => {
    const store = stubLocalStorage();
    markDismissed();
    expect(store.get(DISMISSED_KEY)).toBe(String(Date.now()));
    expect(wasRecentlyDismissed()).toBe(true);
  });

  it('tolerates localStorage throwing', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(() => markDismissed()).not.toThrow();
  });
});

describe('manual install flag', () => {
  it('is false when unset', () => {
    stubLocalStorage();
    expect(isManuallyInstalled()).toBe(false);
  });

  it('round-trips through markManuallyInstalled', () => {
    const store = stubLocalStorage();
    markManuallyInstalled();
    expect(store.get(INSTALLED_KEY)).toBe('true');
    expect(isManuallyInstalled()).toBe(true);
  });

  it('tolerates localStorage throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(() => markManuallyInstalled()).not.toThrow();
    expect(isManuallyInstalled()).toBe(false);
  });
});

describe('INSTALL_BANNER_DISMISS_DURATION_MS', () => {
  it('is 7 days', () => {
    expect(INSTALL_BANNER_DISMISS_DURATION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
