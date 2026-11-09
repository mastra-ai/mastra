import { afterEach, beforeEach } from 'vitest';

/**
 * jsdom has no IntersectionObserver. This stub records observers so a test can
 * fire an intersection on demand (e.g. to trigger an infinite-scroll sentinel).
 */
class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  readonly observed: Element[] = [];

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.root = options?.root ?? null;
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  fire(isIntersecting: boolean) {
    const entries = this.observed.map(target => ({ isIntersecting, target }) as IntersectionObserverEntry);
    this.callback(entries, this);
  }
}

/**
 * Installs the stub for the current `describe` block and returns a trigger that
 * reports every observed element as (not) intersecting. Wrap the call in `act`.
 */
export function useMockIntersectionObserver() {
  const original = globalThis.IntersectionObserver;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });

  return {
    intersect: (isIntersecting: boolean) => {
      MockIntersectionObserver.instances.forEach(observer => observer.fire(isIntersecting));
    },
  };
}
