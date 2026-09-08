// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
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

  it('cycles through the ellipsis states while preparing an empty composer', () => {
    const { result } = renderHook(() => useInitializingPlaceholder(true, true));
    expect(result.current).toBe('Initializing work session');

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('Initializing work session.');

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe('Initializing work session...');

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('Initializing work session');
  });

  it.each([
    { preparing: false, isEmpty: true },
    { preparing: true, isEmpty: false },
  ])('stays inactive when preparing is $preparing and isEmpty is $isEmpty', ({ preparing, isEmpty }) => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { result } = renderHook(() => useInitializingPlaceholder(preparing, isEmpty));

    expect(result.current).toBeUndefined();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('stops and resumes when the reduced-motion preference changes', () => {
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
