// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInitializingPlaceholder } from './useInitializingPlaceholder';

type MediaQueryListStub = {
  matches: boolean;
  media: string;
  addEventListener: () => void;
  removeEventListener: () => void;
  addListener: () => void;
  removeListener: () => void;
  dispatchEvent: () => boolean;
  onchange: null;
};

function stubMatchMedia(matches: boolean) {
  const impl = (query: string): MediaQueryListStub => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  });
  // jsdom provides window.matchMedia in some setups; ensure our stub is used.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: impl,
  });
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
});
