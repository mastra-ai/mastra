// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from './theme-provider';

type SystemPreference = {
  /** Move the system to the other scheme and tell everyone listening for 'change'. */
  set(matchesDark: boolean): void;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

const mockMatchMedia = (matchesDark: boolean): SystemPreference => {
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();
  const addEventListener = vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)?.add(listener);
  });
  const removeEventListener = vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
    listeners.get(type)?.delete(listener);
  });
  const mql: Partial<MediaQueryList> = {
    matches: matchesDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: addEventListener as unknown as MediaQueryList['addEventListener'],
    removeEventListener: removeEventListener as unknown as MediaQueryList['removeEventListener'],
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;

  return {
    set(next: boolean) {
      mql.matches = next;
      for (const listener of listeners.get('change') ?? []) listener({ matches: next } as MediaQueryListEvent);
    },
    addEventListener,
    removeEventListener,
  };
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

// The suite above scopes its own setup to its describe block.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark', 'light');
  vi.restoreAllMocks();
});

describe('ThemeProvider — the class it puts on the page', () => {
  const wrapperFor = (props: Partial<React.ComponentProps<typeof ThemeProvider>> = {}) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <ThemeProvider storageKey="theme-provider-target-test" {...props}>
          {children}
        </ThemeProvider>
      );
    };

  it('marks the document root with the resolved theme', () => {
    mockMatchMedia(false);
    renderHook(() => useTheme(), { wrapper: wrapperFor({ defaultTheme: 'dark' }) });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('swaps the class when the theme changes, never keeping both', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor({ defaultTheme: 'dark' }) });

    act(() => result.current.setTheme('light'));

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('swaps the class the other way round too', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper: wrapperFor({ defaultTheme: 'light' }) });
    expect(document.documentElement.classList.contains('light')).toBe(true);

    act(() => result.current.setTheme('dark'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('marks the element the caller names instead of the document root', () => {
    mockMatchMedia(false);
    document.documentElement.classList.remove('dark', 'light');
    const target = document.createElement('div');
    document.body.appendChild(target);

    renderHook(() => useTheme(), { wrapper: wrapperFor({ defaultTheme: 'dark', target }) });

    expect(target.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    target.remove();
  });

  it('cleans the element it was marking when the caller moves it', () => {
    mockMatchMedia(false);
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);

    const { rerender } = render(
      <ThemeProvider defaultTheme="dark" storageKey="theme-provider-move-test" target={first} />,
    );
    expect(first.classList.contains('dark')).toBe(true);

    rerender(<ThemeProvider defaultTheme="dark" storageKey="theme-provider-move-test" target={second} />);

    expect(first.classList.contains('dark')).toBe(false);
    expect(second.classList.contains('dark')).toBe(true);

    first.remove();
    second.remove();
  });
});

describe('ThemeProvider — following the system', () => {
  it('resolves a system theme to what the system says', () => {
    mockMatchMedia(true);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="system" storageKey="theme-provider-system-test">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('stops following the system once a theme is picked', () => {
    mockMatchMedia(true);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="system" storageKey="theme-provider-pick-test">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme('light'));

    expect(result.current.resolvedTheme).toBe('light');
    // The system reading stays available for a settings screen to show.
    expect(result.current.systemTheme).toBe('dark');
  });

  it('follows the system while the page is open', () => {
    const system = mockMatchMedia(false);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="system" storageKey="theme-provider-live-test">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.resolvedTheme).toBe('light');
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');

    act(() => system.set(true));

    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('stops listening to the system once it is gone', () => {
    const system = mockMatchMedia(false);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="system" storageKey="theme-provider-unmount-test">
        {children}
      </ThemeProvider>
    );

    const { unmount } = renderHook(() => useTheme(), { wrapper });
    const listener = system.addEventListener.mock.calls[0]?.[1];
    expect(system.addEventListener).toHaveBeenCalledWith('change', listener);

    unmount();

    expect(system.removeEventListener).toHaveBeenCalledWith('change', listener);
  });

  it('opens on the system reading when the caller names no default', () => {
    mockMatchMedia(true);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider storageKey="theme-provider-no-default-test">{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('assumes dark where the browser cannot be asked', () => {
    const matchMedia = window.matchMedia;
    // @ts-expect-error -- removing the API is the case under test
    delete window.matchMedia;

    const { result } = renderHook(() => useTheme());
    expect(result.current.systemTheme).toBe('dark');

    window.matchMedia = matchMedia;
  });
});

describe('ThemeProvider — remembering the choice', () => {
  it('stores the theme that was picked', () => {
    mockMatchMedia(false);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="system" storageKey="theme-provider-store-test">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme('light'));

    expect(window.localStorage.getItem('theme-provider-store-test')).toBe('light');
  });

  it('opens on the stored theme rather than the default', () => {
    mockMatchMedia(false);
    window.localStorage.setItem('theme-provider-restore-test', 'light');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="dark" storageKey="theme-provider-restore-test">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('light');
  });

  it('watches the key it was last given', () => {
    mockMatchMedia(false);
    const Reader = () => {
      const { theme } = useTheme();
      return <span data-testid="theme">{theme}</span>;
    };
    const { rerender, getByTestId } = render(
      <ThemeProvider defaultTheme="dark" storageKey="theme-provider-first-key">
        <Reader />
      </ThemeProvider>,
    );

    rerender(
      <ThemeProvider defaultTheme="dark" storageKey="theme-provider-second-key">
        <Reader />
      </ThemeProvider>,
    );

    act(() => {
      window.localStorage.setItem('theme-provider-second-key', 'light');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'theme-provider-second-key', newValue: 'light', storageArea: localStorage }),
      );
    });

    expect(getByTestId('theme').textContent).toBe('light');
  });

  it('follows a theme picked in another tab, and the default when it is cleared', () => {
    mockMatchMedia(false);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="dark" storageKey="theme-provider-sync-test">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      window.localStorage.setItem('theme-provider-sync-test', 'light');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'theme-provider-sync-test', newValue: 'light', storageArea: localStorage }),
      );
    });
    expect(result.current.theme).toBe('light');

    act(() => {
      window.localStorage.removeItem('theme-provider-sync-test');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'theme-provider-sync-test', newValue: null, storageArea: localStorage }),
      );
    });
    expect(result.current.theme).toBe('dark');
  });
});
