// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInitializingPlaceholder } from './useInitializingPlaceholder';

class TestMediaQueryListEvent extends Event implements MediaQueryListEvent {
  readonly matches: boolean;
  readonly media: string;

  constructor(matches: boolean, media: string) {
    super('change');
    this.matches = matches;
    this.media = media;
  }
}

class TestMediaQueryList extends EventTarget implements MediaQueryList {
  matches: boolean;
  readonly media = '(prefers-reduced-motion: reduce)';
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;

  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }

  addListener() {}

  removeListener() {}

  setMatches(next: boolean) {
    this.matches = next;
    this.dispatchEvent(new TestMediaQueryListEvent(next, this.media));
  }
}

function stubMatchMedia(matches: boolean) {
  const mediaQuery = new TestMediaQueryList(matches);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => mediaQuery,
  });
  return mediaQuery;
}

describe('useInitializingPlaceholder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cycles through the ellipsis states while preparing and empty', () => {
    const { result } = renderHook(() => useInitializingPlaceholder(true, true));
    expect(result.current).toBe('Initializing work session');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('Initializing work session.');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('Initializing work session..');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('Initializing work session...');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('Initializing work session');
  });

  it('returns undefined and does not schedule an interval when the composer is non-empty', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { result } = renderHook(() => useInitializingPlaceholder(true, false));
    expect(result.current).toBeUndefined();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('returns undefined when sandboxPreparing is false', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { result } = renderHook(() => useInitializingPlaceholder(false, true));
    expect(result.current).toBeUndefined();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('returns a static ellipsis string and does not schedule an interval under reduced motion', () => {
    stubMatchMedia(true);
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { result } = renderHook(() => useInitializingPlaceholder(true, true));
    expect(result.current).toBe('Initializing work session...');
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('reacts when the reduced-motion preference changes during initialization', () => {
    const mediaQuery = stubMatchMedia(false);
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { result } = renderHook(() => useInitializingPlaceholder(true, true));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => mediaQuery.setMatches(true));
    expect(result.current).toBe('Initializing work session...');

    act(() => mediaQuery.setMatches(false));
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
  });
});
