import { vi } from 'vitest';

/**
 * Minimal fakes for the CSS Custom Highlight API, which jsdom does not implement.
 * Install with `installHighlightApi()` in `beforeEach` and undo with the returned
 * `restore` in `afterEach`.
 */
export interface FakeStaticRange {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
}

export class FakeHighlight {
  readonly ranges: FakeStaticRange[];
  constructor(...ranges: FakeStaticRange[]) {
    this.ranges = ranges;
  }
}

export interface HighlightApiHarness {
  highlights: { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  /** The text covered by the ranges of the most recent registration. */
  highlightedText: () => string[] | undefined;
  /** The elements owning the highlighted text of the most recent registration. */
  highlightedIn: () => (HTMLElement | null)[];
  restore: () => void;
}

export function installHighlightApi(): HighlightApiHarness {
  const originals = {
    CSS: globalThis.CSS,
    StaticRange: globalThis.StaticRange,
    Highlight: (globalThis as Record<string, unknown>).Highlight,
  };

  const highlights = { set: vi.fn(), delete: vi.fn() };

  Object.assign(globalThis, {
    CSS: { highlights },
    StaticRange: class {
      constructor(init: FakeStaticRange) {
        Object.assign(this, init);
      }
    },
    Highlight: FakeHighlight,
  });

  const lastRanges = () => {
    const call = highlights.set.mock.calls.at(-1);
    return call ? (call[1] as FakeHighlight).ranges : undefined;
  };

  return {
    highlights,
    highlightedText: () =>
      lastRanges()?.map(range => (range.startContainer as Text).data.slice(range.startOffset, range.endOffset)),
    highlightedIn: () => lastRanges()?.map(range => (range.startContainer as Text).parentElement) ?? [],
    restore: () => Object.assign(globalThis, originals),
  };
}
