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
});
