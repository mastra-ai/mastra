// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMeasuredAutoHeight } from './use-measured-auto-height';

const createRect = (height: number) => ({
  top: 0,
  bottom: height,
  left: 0,
  right: 100,
  width: 100,
  height,
  x: 0,
  y: 0,
  toJSON: () => ({}),
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useMeasuredAutoHeight', () => {
  it('measures a callback ref element and exposes a height style', async () => {
    vi.stubGlobal('ResizeObserver', undefined);

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(72));

    const { result } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.height).toBe(72);
      expect(result.current.heightStyle).toEqual({ height: 72 });
    });
  });

  it('falls back to scrollHeight when layout rect height is unavailable', async () => {
    vi.stubGlobal('ResizeObserver', undefined);

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(0));
    Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 48 });

    const { result } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.height).toBe(48);
      expect(result.current.heightStyle).toEqual({ height: 48 });
    });
  });
});
