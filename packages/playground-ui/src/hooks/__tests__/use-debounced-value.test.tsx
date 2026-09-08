// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '../use-debounced-value';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('returns the latest value after the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 750), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => vi.advanceTimersByTime(750));

    expect(result.current).toBe('updated');
  });

  it('restarts the delay when the value changes again', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 750), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'first' });
    act(() => vi.advanceTimersByTime(500));
    rerender({ value: 'second' });
    act(() => vi.advanceTimersByTime(250));

    expect(result.current).toBe('initial');

    act(() => vi.advanceTimersByTime(500));

    expect(result.current).toBe('second');
  });
});
