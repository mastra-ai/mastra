// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIsClamped } from './use-is-clamped';

const createElement = ({ scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) => {
  const element = document.createElement('p');
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
  return element;
};

class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];

  trigger() {
    this.callback([], this);
  }
}

afterEach(() => {
  MockResizeObserver.instances = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useIsClamped', () => {
  it('reports clamped when content overflows the element', async () => {
    vi.stubGlobal('ResizeObserver', undefined);

    const element = createElement({ scrollHeight: 60, clientHeight: 40 });
    const { result } = renderHook(() => useIsClamped());

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.isClamped).toBe(true);
    });
  });

  it('reports not clamped when content fits', async () => {
    vi.stubGlobal('ResizeObserver', undefined);

    const element = createElement({ scrollHeight: 40, clientHeight: 40 });
    const { result } = renderHook(() => useIsClamped());

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.isClamped).toBe(false);
    });
  });

  it('re-measures when the element resizes', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const element = createElement({ scrollHeight: 60, clientHeight: 40 });
    const { result } = renderHook(() => useIsClamped());

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.isClamped).toBe(true);
    });

    // Element grew tall enough to fit its content.
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: 60 });

    const observer = MockResizeObserver.instances[0];
    if (!observer) throw new Error('ResizeObserver was not created.');

    act(() => {
      observer.trigger();
    });

    await waitFor(() => {
      expect(result.current.isClamped).toBe(false);
    });
  });

  it('keeps the last measurement while disabled', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const element = createElement({ scrollHeight: 60, clientHeight: 40 });
    const { result, rerender } = renderHook(({ enabled }) => useIsClamped({ enabled }), {
      initialProps: { enabled: true },
    });

    act(() => {
      result.current.ref(element);
    });

    await waitFor(() => {
      expect(result.current.isClamped).toBe(true);
    });

    // Disabling (e.g. text expanded, clamp lifted) tears down the observer
    // and keeps the last value even though the element no longer overflows.
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: 60 });
    rerender({ enabled: false });

    const observer = MockResizeObserver.instances[0];
    if (!observer) throw new Error('ResizeObserver was not created.');
    expect(observer.disconnect).toHaveBeenCalled();
    expect(result.current.isClamped).toBe(true);
  });
});
