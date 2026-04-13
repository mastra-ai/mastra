import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PlaygroundTheme = 'dark' | 'light' | 'system';

interface PlaygroundStore {
  requestContext: Record<string, any>;
  theme: PlaygroundTheme;
  setRequestContext: (requestContext: Record<string, any>) => void;
  setTheme: (theme: PlaygroundTheme) => void;
}

export const usePlaygroundStore = create<PlaygroundStore>()(
  persist(
    set => ({
      requestContext: {},
      theme: 'dark',
      setRequestContext: requestContext => set({ requestContext }),
      setTheme: theme => set({ theme }),
    }),
    {
      name: 'mastra-playground-store',
    },
  ),
);

const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function subscribeToColorScheme(callback: () => void): () => void {
  darkQuery?.addEventListener('change', callback);
  return () => darkQuery?.removeEventListener('change', callback);
}

function getSystemIsDark(): boolean {
  return darkQuery?.matches ?? true;
}

/**
 * Returns a reactive `isDark` boolean that tracks the resolved theme.
 * When the store theme is `'system'`, this subscribes to OS-level
 * `prefers-color-scheme` changes so the value updates immediately.
 */
export function useIsDarkMode(): boolean {
  const storeTheme = usePlaygroundStore(s => s.theme);
  const systemIsDark = useSyncExternalStore(subscribeToColorScheme, getSystemIsDark, () => true);
  if (storeTheme === 'system') return systemIsDark;
  return storeTheme === 'dark';
}
