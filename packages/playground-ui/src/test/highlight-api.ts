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
  /** The text covered by the most recent registration under `name` (the direct one by default). */
  highlightedText: (name?: string) => string[] | undefined;
  /** The elements owning that text. */
  highlightedIn: (name?: string) => (HTMLElement | null)[];
  /** How many times `name` was registered — one per scan of the surface. */
  registrationCount: (name?: string) => number;
  restore: () => void;
}

const DIRECT_HIGHLIGHT_NAME = 'search-result';

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

  const callsFor = (name: string) => highlights.set.mock.calls.filter(call => call[0] === name);

  const lastRanges = (name: string) => {
    const call = callsFor(name).at(-1);
    return call ? (call[1] as FakeHighlight).ranges : undefined;
  };

  return {
    highlights,
    highlightedText: (name = DIRECT_HIGHLIGHT_NAME) =>
      lastRanges(name)?.map(range => (range.startContainer as Text).data.slice(range.startOffset, range.endOffset)),
    highlightedIn: (name = DIRECT_HIGHLIGHT_NAME) =>
      lastRanges(name)?.map(range => (range.startContainer as Text).parentElement) ?? [],
    registrationCount: (name = DIRECT_HIGHLIGHT_NAME) => callsFor(name).length,
    restore: () => Object.assign(globalThis, originals),
  };
}
