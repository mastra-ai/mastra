import { afterEach, beforeEach, vi } from 'vitest';

/**
 * jsdom has no layout engine, so every element measures 0×0 and recharts never draws
 * its points. Gives every element a fixed box so charts render and can be hovered/clicked.
 * Call at the top of a `describe` block that interacts with a chart.
 */
export function useFixedChartSize(width = 600, height = 300) {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, width, height));
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
    vi.stubGlobal(
      'ResizeObserver',
      class FixedSizeResizeObserver implements ResizeObserver {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element) {
          const entry: ResizeObserverEntry = {
            target,
            contentRect: new DOMRect(0, 0, width, height),
            borderBoxSize: [{ inlineSize: width, blockSize: height }],
            contentBoxSize: [{ inlineSize: width, blockSize: height }],
            devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
          };
          this.callback([entry], this);
        }
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}
