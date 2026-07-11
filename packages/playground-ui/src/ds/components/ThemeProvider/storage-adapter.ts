import type { Theme } from './theme-context';

const DEFAULT_KEY = 'mastra-theme';
const LEGACY_ZUSTAND_KEY = 'mastra-playground-store';

export interface ThemeStorageAdapter {
  get(): Theme | null;
  set(value: Theme): void;
  subscribe(listener: (next: Theme | null) => void): () => void;
}

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light' || value === 'system';

const readLegacyZustand = (storage: Storage): Theme | undefined => {
  try {
    const raw = storage.getItem(LEGACY_ZUSTAND_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { state?: { theme?: unknown } };
    const theme = parsed?.state?.theme;
    return isTheme(theme) ? theme : undefined;
  } catch {
    return undefined;
  }
};

export const createLocalStorageAdapter = (key: string = DEFAULT_KEY): ThemeStorageAdapter => ({
  get() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (isTheme(raw)) return raw;
      const migrated = readLegacyZustand(window.localStorage);
      if (migrated) {
        window.localStorage.setItem(key, migrated);
        return migrated;
      }
      return null;
    } catch {
      return null;
    }
  },
  set(value) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // private mode / quota — silent
    }
  },
  subscribe(listener) {
    if (typeof window === 'undefined') return () => {};
    const handler = (event: StorageEvent) => {
      if (event.key !== key) return;
      if (event.newValue === null) {
        listener(null);
        return;
      }
      if (isTheme(event.newValue)) listener(event.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },
});
