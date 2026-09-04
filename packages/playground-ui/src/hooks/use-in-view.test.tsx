// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInView } from './use-in-view';

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  readonly observed: Element[] = [];
  readonly disconnect = vi.fn();
  readonly unobserve = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.root = options?.root ?? null;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  trigger(isIntersecting: boolean) {
    const entry = { isIntersecting } as IntersectionObserverEntry;
    this.callback([entry], this);
  }
}

describe('useInView', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('observes against the viewport when no root is provided', () => {
    const { result } = renderHook(() => useInView());
    const sentinel = document.createElement('div');

    act(() => result.current.setRef(sentinel));

    const [observer] = MockIntersectionObserver.instances;
    expect(observer?.root).toBeNull();
    expect(observer?.observed).toEqual([sentinel]);
  });

  it('forwards the root scroll container to the IntersectionObserver', () => {
    const scrollContainer = document.createElement('div');
    const rootRef = { current: scrollContainer };

    const { result } = renderHook(() => useInView({ root: rootRef }));
    act(() => result.current.setRef(document.createElement('div')));

    const [observer] = MockIntersectionObserver.instances;
    expect(observer?.root).toBe(scrollContainer);
  });

  it('reflects intersection changes in inView', () => {
    const { result } = renderHook(() => useInView());
    act(() => result.current.setRef(document.createElement('div')));

    const [observer] = MockIntersectionObserver.instances;
    expect(result.current.inView).toBe(false);

    act(() => observer?.trigger(true));
    expect(result.current.inView).toBe(true);

    act(() => observer?.trigger(false));
    expect(result.current.inView).toBe(false);
  });
});
