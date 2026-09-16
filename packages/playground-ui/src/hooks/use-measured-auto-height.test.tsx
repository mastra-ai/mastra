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

class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly observedElements = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe = (target: Element) => {
    this.observedElements.add(target);
  };

  unobserve = (target: Element) => {
    this.observedElements.delete(target);
  };

  disconnect = vi.fn(() => {
    this.observedElements.clear();
  });

  takeRecords = () => [];

  trigger(target: Element) {
    const contentRect = target.getBoundingClientRect();
    const entry = {
      target,
      contentRect,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } satisfies ResizeObserverEntry;

    this.callback([entry], this);
  }
}

afterEach(() => {
  MockResizeObserver.instances = [];
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

  it('re-measures when ResizeObserver reports a size change', async () => {
    let height = 72;
    let frameCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1;
    });
    const cancelAnimationFrame = vi.fn();

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => createRect(height));

    const { result } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.height).toBe(72);
      expect(result.current.heightStyle).toEqual({ height: 72 });
    });

    const observer = MockResizeObserver.instances[0];
    if (!observer) throw new Error('ResizeObserver was not created.');

    height = 96;

    act(() => {
      observer.trigger(element);
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    if (!frameCallback) throw new Error('ResizeObserver did not schedule a measurement frame.');

    act(() => {
      frameCallback(0);
    });

    await waitFor(() => {
      expect(result.current.height).toBe(96);
      expect(result.current.heightStyle).toEqual({ height: 96 });
    });
  });

  it('has no height style before an element is attached', () => {
    vi.stubGlobal('ResizeObserver', undefined);

    const { result } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    expect(result.current.height).toBeNull();
    expect(result.current.heightStyle).toEqual({});
    expect(result.current.measure()).toBeNull();
  });

  it('reports the height it measured on demand', async () => {
    vi.stubGlobal('ResizeObserver', undefined);

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(72.2));

    const { result } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    act(() => {
      result.current.ref(element);
    });

    // Fractional layout heights round up so the box never clips its content.
    await waitFor(() => expect(result.current.height).toBe(73));
    expect(result.current.measure()).toBe(73);
  });

  it('observes the element it was given', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(72));

    const { result } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => expect(MockResizeObserver.instances[0]?.observedElements.has(element)).toBe(true));
  });

  it('coalesces a burst of resizes into one measurement', async () => {
    const frames: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const cancelAnimationFrame = vi.fn();

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(72));

    const { result } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    act(() => {
      result.current.ref(element);
    });

    const observer = MockResizeObserver.instances[0];
    if (!observer) throw new Error('ResizeObserver was not created.');

    act(() => {
      observer.trigger(element);
      observer.trigger(element);
      observer.trigger(element);
    });

    // Each resize replaces the frame the one before it scheduled.
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrame).toHaveBeenNthCalledWith(1, 1);
    expect(cancelAnimationFrame).toHaveBeenNthCalledWith(2, 2);

    // And the one frame that survives is the one that takes the measurement.
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(96));
    act(() => {
      frames[frames.length - 1]?.(0);
    });

    expect(result.current.height).toBe(96);
  });

  it('stops observing and drops a pending frame when it goes away', async () => {
    const requestAnimationFrame = vi.fn(() => 7);
    const cancelAnimationFrame = vi.fn();

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(72));

    const { result, unmount } = renderHook(() => useMeasuredAutoHeight<HTMLDivElement>());

    act(() => {
      result.current.ref(element);
    });

    const observer = MockResizeObserver.instances[0];
    if (!observer) throw new Error('ResizeObserver was not created.');

    act(() => {
      observer.trigger(element);
    });

    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });
});
