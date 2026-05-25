// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from './theme-provider';

const mockMatchMedia = (matchesDark: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql: Partial<MediaQueryList> = {
    matches: matchesDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
};

describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('outside ThemeProvider', () => {
    it('does not throw and returns system-derived theme when system prefers dark', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useTheme());
      expect(result.current.resolvedTheme).toBe('dark');
      expect(result.current.systemTheme).toBe('dark');
      expect(result.current.theme).toBe('system');
    });

    it('returns light when system prefers light', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      expect(result.current.resolvedTheme).toBe('light');
      expect(result.current.systemTheme).toBe('light');
    });

    it('exposes a no-op setTheme so callers do not crash', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      const initialTheme = result.current.theme;
      const initialResolvedTheme = result.current.resolvedTheme;
      expect(() => result.current.setTheme('dark')).not.toThrow();
      expect(result.current.theme).toBe(initialTheme);
      expect(result.current.resolvedTheme).toBe(initialResolvedTheme);
    });
  });

  describe('inside ThemeProvider', () => {
    it('returns the configured default when nothing is stored', () => {
      mockMatchMedia(false);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="dark" storageKey="useTheme-test-default">
          {children}
        </ThemeProvider>
      );
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
    });
  });
});
