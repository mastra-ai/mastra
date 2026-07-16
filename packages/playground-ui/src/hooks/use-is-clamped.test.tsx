// @vitest-environment jsdom
import assert from 'node:assert';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsClamped } from './use-is-clamped';

interface ElementSize {
  scrollHeight: number;
  clientHeight: number;
}

// jsdom performs no layout, so overflow is stubbed per element.
const setElementSize = (element: HTMLElement, { scrollHeight, clientHeight }: ElementSize) => {
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
  });
};

const createClampableElement = (size: ElementSize) => {
  const element = document.createElement('p');
  setElementSize(element, size);
  return element;
};

const observers: MockResizeObserver[] = [];

class MockResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = (): ResizeObserverEntry[] => [];

  resize() {
    this.callback([], this);
  }
}

const lastObserver = () => {
  const observer = observers.at(-1);
  assert(observer, 'expected the hook to create a ResizeObserver');
  return observer;
};

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'fonts');
});

describe('useIsClamped', () => {
  it('reports clamped when content overflows the element', () => {
    const { result } = renderHook(() => useIsClamped());

    act(() => result.current.ref(createClampableElement({ scrollHeight: 60, clientHeight: 40 })));

    expect(result.current.isClamped).toBe(true);
  });

  it('reports not clamped when content fits', () => {
    const { result } = renderHook(() => useIsClamped());

    act(() => result.current.ref(createClampableElement({ scrollHeight: 40, clientHeight: 40 })));

    expect(result.current.isClamped).toBe(false);
  });

  it('still measures once when ResizeObserver is unsupported', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { result } = renderHook(() => useIsClamped());

    act(() => result.current.ref(createClampableElement({ scrollHeight: 60, clientHeight: 40 })));

    expect(result.current.isClamped).toBe(true);
  });

  it('re-measures on font load even when ResizeObserver is unsupported', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    let fontsReady!: () => void;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>(resolve => (fontsReady = resolve)) },
    });

    const element = createClampableElement({ scrollHeight: 60, clientHeight: 40 });
    const { result } = renderHook(() => useIsClamped());

    act(() => result.current.ref(element));
    expect(result.current.isClamped).toBe(true);

    setElementSize(element, { scrollHeight: 60, clientHeight: 60 });
    fontsReady();
    await act(async () => {});

    expect(result.current.isClamped).toBe(false);
  });

  it('re-measures when the element resizes', () => {
    const element = createClampableElement({ scrollHeight: 60, clientHeight: 40 });
    const { result } = renderHook(() => useIsClamped());

    act(() => result.current.ref(element));
    expect(result.current.isClamped).toBe(true);

    setElementSize(element, { scrollHeight: 60, clientHeight: 60 });
    act(() => lastObserver().resize());

    expect(result.current.isClamped).toBe(false);
  });

  it('keeps the last measurement while disabled', () => {
    const element = createClampableElement({ scrollHeight: 60, clientHeight: 40 });
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useIsClamped({ enabled }), {
      initialProps: { enabled: true },
    });

    act(() => result.current.ref(element));
    expect(result.current.isClamped).toBe(true);

    setElementSize(element, { scrollHeight: 60, clientHeight: 60 });
    rerender({ enabled: false });

    expect(lastObserver().disconnect).toHaveBeenCalled();
    expect(result.current.isClamped).toBe(true);
  });
});
