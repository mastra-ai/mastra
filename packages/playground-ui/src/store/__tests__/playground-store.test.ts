import { beforeEach, describe, expect, it, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });
Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  configurable: true,
});

describe('playground-store theme persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('defaults theme to dark', async () => {
    const { usePlaygroundStore } = await import('../playground-store');

    expect(usePlaygroundStore.getState().theme).toBe('dark');
  });

  it('updates theme to light and writes to persisted store', async () => {
    const { usePlaygroundStore } = await import('../playground-store');

    usePlaygroundStore.getState().setTheme('light');

    expect(usePlaygroundStore.getState().theme).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalled();

    const storedValue = localStorageMock.setItem.mock.calls.at(-1)?.[1] as string;
    const parsed = JSON.parse(storedValue);
    expect(parsed.state.theme).toBe('light');
  });

  it('updates theme to system and writes to persisted store', async () => {
    const { usePlaygroundStore } = await import('../playground-store');

    usePlaygroundStore.getState().setTheme('system');

    expect(usePlaygroundStore.getState().theme).toBe('system');
    expect(localStorageMock.setItem).toHaveBeenCalled();

    const storedValue = localStorageMock.setItem.mock.calls.at(-1)?.[1] as string;
    const parsed = JSON.parse(storedValue);
    expect(parsed.state.theme).toBe('system');
  });
});
