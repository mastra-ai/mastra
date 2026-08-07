// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from './use-is-mobile';

type MockMediaQueryList = MediaQueryList & {
  setMatches: (matches: boolean) => void;
  listenerCount: () => number;
};

const mediaQueries = new Map<string, MockMediaQueryList>();

const createMediaQueryList = (query: string): MockMediaQueryList => {
  const listeners = new Set<() => void>();
  let matches = false;

  return {
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(listener => {
      listeners.add(listener);
    }),
    removeListener: vi.fn(listener => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(() => false),
    setMatches: nextMatches => {
      matches = nextMatches;
      listeners.forEach(listener => listener());
    },
    listenerCount: () => listeners.size,
  };
};

const mockMatchMedia = () => {
  window.matchMedia = vi.fn((query: string) => {
    let mql = mediaQueries.get(query);
    if (!mql) {
      mql = createMediaQueryList(query);
      mediaQueries.set(query, mql);
    }
    return mql;
  }) as unknown as typeof window.matchMedia;
};

describe('useIsMobile', () => {
  beforeEach(() => {
    mediaQueries.clear();
    mockMatchMedia();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not resubscribe when rerendered with the same breakpoint', () => {
    const { rerender, unmount } = renderHook(({ breakpoint }) => useIsMobile(breakpoint), {
      initialProps: { breakpoint: 1024 },
    });

    const mql = mediaQueries.get('(max-width: 1023px)');
    expect(mql?.addEventListener).toHaveBeenCalledTimes(1);
    expect(mql?.listenerCount()).toBe(1);

    rerender({ breakpoint: 1024 });

    expect(mql?.removeEventListener).not.toHaveBeenCalled();
    expect(mql?.addEventListener).toHaveBeenCalledTimes(1);
    expect(mql?.listenerCount()).toBe(1);

    unmount();

    expect(mql?.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mql?.listenerCount()).toBe(0);
  });

  it('resubscribes and updates when the breakpoint changes', () => {
    const { result, rerender } = renderHook(({ breakpoint }) => useIsMobile(breakpoint), {
      initialProps: { breakpoint: 1024 },
    });

    const desktopQuery = mediaQueries.get('(max-width: 1023px)');

    rerender({ breakpoint: 768 });

    const tabletQuery = mediaQueries.get('(max-width: 767px)');
    expect(desktopQuery?.removeEventListener).toHaveBeenCalledTimes(1);
    expect(desktopQuery?.listenerCount()).toBe(0);
    expect(tabletQuery?.addEventListener).toHaveBeenCalledTimes(1);
    expect(tabletQuery?.listenerCount()).toBe(1);

    act(() => {
      tabletQuery?.setMatches(true);
    });

    expect(result.current).toBe(true);
  });
});
