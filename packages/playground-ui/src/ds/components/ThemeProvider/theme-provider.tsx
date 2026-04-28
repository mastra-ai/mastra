import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { createLocalStorageAdapter } from './storage-adapter';
import { ThemeContext } from './theme-context';
import type { ResolvedTheme, Theme, ThemeContextValue } from './theme-context';

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  target?: HTMLElement;
}

const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia(SYSTEM_QUERY).matches ? 'dark' : 'light';
};

const subscribeSystemTheme = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(SYSTEM_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};

const applyThemeClass = (target: HTMLElement, resolved: ResolvedTheme) => {
  target.classList.remove(resolved === 'dark' ? 'light' : 'dark');
  target.classList.add(resolved);
};

export const ThemeProvider = ({ children, defaultTheme = 'system', storageKey, target }: ThemeProviderProps) => {
  const adapter = useMemo(() => createLocalStorageAdapter(storageKey), [storageKey]);
  const previousTargetRef = useRef<HTMLElement | null>(null);

  const [theme, setThemeState] = useState<Theme>(() => adapter.get() ?? defaultTheme);
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => 'dark' as const);

  useEffect(() => adapter.subscribe(next => setThemeState(next ?? defaultTheme)), [adapter, defaultTheme]);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  useIsomorphicLayoutEffect(() => {
    const el = target ?? (typeof window === 'undefined' ? null : window.document.documentElement);
    if (previousTargetRef.current && previousTargetRef.current !== el) {
      previousTargetRef.current.classList.remove('dark', 'light');
    }
    if (el) applyThemeClass(el, resolvedTheme);
    previousTargetRef.current = el;
  }, [resolvedTheme, target]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      systemTheme,
      setTheme: next => {
        setThemeState(next);
        adapter.set(next);
      },
    }),
    [theme, resolvedTheme, systemTheme, adapter],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const noop = () => {};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => 'dark' as const);
  return useMemo<ThemeContextValue>(
    () => ctx ?? { theme: 'system', resolvedTheme: systemTheme, systemTheme, setTheme: noop },
    [ctx, systemTheme],
  );
};
