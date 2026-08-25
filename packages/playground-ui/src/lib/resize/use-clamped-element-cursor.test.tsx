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

  it('measures each axis from its own edge', () => {
    const rect = makeRect({ left: 10, top: 20, width: 100, height: 80 });

    expect(getClampedElementCursorOffset({ clientX: 50, clientY: 50 }, rect, 'x')).toBe(40);
    expect(getClampedElementCursorOffset({ clientX: 50, clientY: 50 }, rect, 'y')).toBe(30);
  });

  it('clamps to the element itself when no margin is given', () => {
    const rect = makeRect({ left: 10, top: 20, width: 100, height: 80 });

    expect(getClampedElementCursorOffset({ clientX: 0, clientY: 0 }, rect, 'x')).toBe(0);
    expect(getClampedElementCursorOffset({ clientX: 999, clientY: 0 }, rect, 'x')).toBe(100);
    expect(getClampedElementCursorOffset({ clientX: 0, clientY: 999 }, rect, 'y')).toBe(80);
  });

  it('keeps the margin when it does not fit twice over', () => {
    // A 100px-wide element with a 60px margin has no room left: the cursor
    // pins to the margin rather than to a negative upper bound.
    const rect = makeRect({ left: 0, width: 100 });

    expect(getClampedElementCursorOffset({ clientX: 10, clientY: 0 }, rect, 'x', 60)).toBe(60);
    expect(getClampedElementCursorOffset({ clientX: 90, clientY: 0 }, rect, 'x', 60)).toBe(60);
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

  it('tracks the horizontal axis with no margin', () => {
    const element = document.createElement('div');
    element.getBoundingClientRect = vi.fn(() => makeRect({ left: 10, width: 100 }));

    const { result } = renderHook(() =>
      useClampedElementCursor<HTMLDivElement>({ axis: 'x', variableName: '--cursor-x' }),
    );

    result.current.elementRef.current = element;

    act(() => {
      result.current.beginTracking({ clientX: 60, clientY: 0 });
    });

    expect(element.style.getPropertyValue('--cursor-x')).toBe('50px');

    act(() => {
      result.current.updateTracking({ clientX: -50, clientY: 0 });
    });

    expect(element.style.getPropertyValue('--cursor-x')).toBe('0px');
  });

  it('measures on the first update when tracking never began', () => {
    const element = document.createElement('div');
    const getBoundingClientRect = vi.fn(() => makeRect({ top: 0, height: 100 }));
    element.getBoundingClientRect = getBoundingClientRect;

    const { result } = renderHook(() =>
      useClampedElementCursor<HTMLDivElement>({ axis: 'y', variableName: '--cursor-y' }),
    );

    result.current.elementRef.current = element;

    act(() => {
      result.current.updateTracking({ clientX: 0, clientY: 40 });
    });

    expect(element.style.getPropertyValue('--cursor-y')).toBe('40px');
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it('does nothing until an element is attached', () => {
    const { result } = renderHook(() =>
      useClampedElementCursor<HTMLDivElement>({ axis: 'y', variableName: '--cursor-y' }),
    );

    expect(() => {
      act(() => {
        result.current.beginTracking({ clientX: 0, clientY: 10 });
        result.current.updateTracking({ clientX: 0, clientY: 10 });
      });
    }).not.toThrow();
  });

  it('picks up a change of axis, margin or variable name', () => {
    const element = document.createElement('div');
    element.getBoundingClientRect = vi.fn(() => makeRect({ left: 0, top: 0, width: 100, height: 100 }));

    const { result, rerender } = renderHook(props => useClampedElementCursor<HTMLDivElement>(props), {
      initialProps: { axis: 'x' as const, margin: 0, variableName: '--cursor-x' as `--${string}` },
    });

    result.current.elementRef.current = element;

    act(() => {
      result.current.beginTracking({ clientX: 40, clientY: 90 });
    });
    expect(element.style.getPropertyValue('--cursor-x')).toBe('40px');

    rerender({ axis: 'y' as const, margin: 20, variableName: '--cursor-y' as `--${string}` });

    act(() => {
      result.current.beginTracking({ clientX: 40, clientY: 90 });
    });
    expect(element.style.getPropertyValue('--cursor-y')).toBe('80px');

    // The move handler must follow the same options, not the ones it closed over.
    act(() => {
      result.current.updateTracking({ clientX: 40, clientY: 50 });
    });
    expect(element.style.getPropertyValue('--cursor-y')).toBe('50px');
  });

  it('re-measures the element each time tracking begins', () => {
    const element = document.createElement('div');
    let rect = makeRect({ top: 0, height: 100 });
    element.getBoundingClientRect = vi.fn(() => rect);

    const { result } = renderHook(() =>
      useClampedElementCursor<HTMLDivElement>({ axis: 'y', variableName: '--cursor-y' }),
    );

    result.current.elementRef.current = element;

    act(() => {
      result.current.beginTracking({ clientX: 0, clientY: 40 });
    });
    expect(element.style.getPropertyValue('--cursor-y')).toBe('40px');

    // The panel scrolled between two drags; the stale rect must not be reused.
    rect = makeRect({ top: 30, height: 100 });

    act(() => {
      result.current.beginTracking({ clientX: 0, clientY: 40 });
    });
    expect(element.style.getPropertyValue('--cursor-y')).toBe('10px');
  });
});
