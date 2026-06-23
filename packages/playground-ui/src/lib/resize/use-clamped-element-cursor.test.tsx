// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getClampedElementCursorOffset, useClampedElementCursor } from './use-clamped-element-cursor';

const makeRect = (rect: Partial<DOMRect>) =>
  ({
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON: () => {},
    ...rect,
  }) as DOMRect;

describe('getClampedElementCursorOffset', () => {
  it('clamps pointer coordinates to the configured margin on each axis', () => {
    const rect = makeRect({ left: 10, top: 20, width: 100, height: 80 });

    expect(getClampedElementCursorOffset({ clientX: 5, clientY: 0 }, rect, 'y', 12)).toBe(12);
    expect(getClampedElementCursorOffset({ clientX: 5, clientY: 120 }, rect, 'y', 12)).toBe(68);
    expect(getClampedElementCursorOffset({ clientX: 35, clientY: 0 }, rect, 'x', 12)).toBe(25);
  });
});

describe('useClampedElementCursor', () => {
  it('writes a CSS variable and reuses the measured rect until tracking ends', () => {
    const element = document.createElement('div');
    const getBoundingClientRect = vi.fn(() => makeRect({ top: 10, height: 100 }));
    element.getBoundingClientRect = getBoundingClientRect;

    const { result } = renderHook(() =>
      useClampedElementCursor<HTMLDivElement>({ axis: 'y', margin: 22, variableName: '--cursor-y' }),
    );

    result.current.elementRef.current = element;

    act(() => {
      result.current.beginTracking({ clientX: 0, clientY: 5 });
    });

    expect(element.style.getPropertyValue('--cursor-y')).toBe('22px');
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateTracking({ clientX: 0, clientY: 200 });
    });

    expect(element.style.getPropertyValue('--cursor-y')).toBe('78px');
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.endTracking();
      result.current.updateTracking({ clientX: 0, clientY: 44 });
    });

    expect(element.style.getPropertyValue('--cursor-y')).toBe('34px');
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });
});
