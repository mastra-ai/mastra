// @vitest-environment jsdom
import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTextHighlight } from './use-text-highlight';
import { FakeHighlight, installHighlightApi } from '@/test/highlight-api';
import type { HighlightApiHarness } from '@/test/highlight-api';

const originalFrameApi = {
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
};

let harness: HighlightApiHarness;
let highlights: HighlightApiHarness['highlights'];
let lastHighlightedText: HighlightApiHarness['highlightedText'];
let frames: Map<number, () => void>;
let nextFrameId: number;

/** The element the hook's ref is attached to. */
const rootOf = (container: HTMLElement) => {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error('Expected the panel root to be rendered');
  }
  return root;
};

/** Lets queued MutationObserver callbacks (microtasks) run. */
const flushMutations = () => act(async () => {});

/** Runs every rAF callback queued so far, the way a browser paint would. */
const flushFrames = () => {
  const queued = [...frames.values()];
  frames.clear();
  act(() => {
    queued.forEach(callback => callback());
  });
};

beforeEach(() => {
  harness = installHighlightApi();
  highlights = harness.highlights;
  lastHighlightedText = harness.highlightedText;
  frames = new Map();
  nextFrameId = 1;

  Object.assign(globalThis, {
    requestAnimationFrame: (callback: () => void) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    },
  });
});

afterEach(() => {
  harness.restore();
  Object.assign(globalThis, originalFrameApi);
});

function Panel({ search, children }: { search: string; children?: React.ReactNode }) {
  const { ref } = useTextHighlight(search);
  return <div ref={ref}>{children ?? <p data-highlight>the agent called the agent tool</p>}</div>;
}

describe('useTextHighlight', () => {
  it('registers a range for every occurrence of the search term', () => {
    render(<Panel search="agent" />);

    expect(lastHighlightedText()).toEqual(['agent', 'agent']);
    expect(highlights.set).toHaveBeenCalledWith('search-result', expect.any(FakeHighlight));
  });

  it('matches regardless of case', () => {
    render(<Panel search="AGENT" />);

    expect(lastHighlightedText()).toEqual(['agent', 'agent']);
  });

  it('treats the search term as literal text, not a pattern', () => {
    render(
      <Panel search="a.ent">
        <p data-highlight>axent a.ent</p>
      </Panel>,
    );

    expect(lastHighlightedText()).toEqual(['a.ent']);
  });

  it('finds occurrences across sibling and nested text nodes', () => {
    render(
      <Panel search="span">
        <div data-highlight>
          <p>
            outer span <em>nested span</em>
          </p>
          <p>sibling span</p>
        </div>
      </Panel>,
    );

    expect(lastHighlightedText()).toEqual(['span', 'span', 'span']);
  });

  it('only paints text inside a region that opted in', () => {
    render(
      <Panel search="agent">
        <p>agent in surrounding chrome</p>
        <p data-highlight>searchable agent</p>
      </Panel>,
    );

    expect(lastHighlightedText()).toEqual(['agent']);
  });

  it('paints nothing when no region opted in', () => {
    render(
      <Panel search="agent">
        <p>agent</p>
      </Panel>,
    );

    expect(lastHighlightedText()).toEqual([]);
  });

  it('clears the highlight when the search term is blank', () => {
    render(<Panel search="   " />);

    expect(highlights.set).not.toHaveBeenCalled();
    expect(highlights.delete).toHaveBeenCalledWith('search-result');
  });

  it('ignores a single-character search term', () => {
    render(<Panel search="a" />);

    expect(highlights.set).not.toHaveBeenCalled();
    expect(highlights.delete).toHaveBeenCalledWith('search-result');
  });

  it('highlights from two characters on', () => {
    render(<Panel search="ag" />);

    expect(lastHighlightedText()).toEqual(['ag', 'ag']);
  });

  it('does nothing when the browser has no highlight registry', () => {
    Object.assign(globalThis, { CSS: {} });

    expect(() => render(<Panel search="agent" />)).not.toThrow();
    expect(highlights.set).not.toHaveBeenCalled();
  });

  it('does nothing when the environment has no CSS object at all', () => {
    Object.assign(globalThis, { CSS: undefined });

    expect(() => render(<Panel search="agent" />)).not.toThrow();
    expect(highlights.set).not.toHaveBeenCalled();
  });

  it('does nothing when the browser has no StaticRange', () => {
    Object.assign(globalThis, { StaticRange: undefined });

    render(<Panel search="agent" />);

    expect(highlights.set).not.toHaveBeenCalled();
    expect(highlights.delete).toHaveBeenCalledWith('search-result');
  });

  it('re-scans when the content changes', async () => {
    const { container } = render(<Panel search="agent" />);
    highlights.set.mockClear();

    act(() => {
      const paragraph = document.createElement('p');
      paragraph.setAttribute('data-highlight', '');
      paragraph.textContent = 'another agent';
      rootOf(container).append(paragraph);
    });
    await flushMutations();
    flushFrames();

    expect(lastHighlightedText()).toEqual(['agent', 'agent', 'agent']);
  });

  it('coalesces a burst of content changes into a single re-scan', async () => {
    const { container } = render(<Panel search="agent" />);
    highlights.set.mockClear();
    const root = rootOf(container);

    act(() => {
      root.append(document.createElement('p'));
    });
    await flushMutations();
    act(() => {
      root.append(document.createElement('p'));
    });
    await flushMutations();
    flushFrames();

    expect(harness.registrationCount()).toBe(1);
  });

  it('stops highlighting once unmounted', async () => {
    const { container, unmount } = render(<Panel search="agent" />);
    const root = rootOf(container);

    act(() => {
      root.append(document.createElement('p'));
    });
    await flushMutations();
    unmount();
    highlights.set.mockClear();
    flushFrames();

    expect(highlights.delete).toHaveBeenCalledWith('search-result');
    expect(highlights.set).not.toHaveBeenCalled();
  });

  it('clears the highlight when unmounted with no pending re-scan', () => {
    const { unmount } = render(<Panel search="agent" />);

    unmount();

    expect(highlights.delete).toHaveBeenCalledWith('search-result');
  });

  describe('indirect regions', () => {
    it('paints the whole text of an indirect region, term or not', () => {
      render(
        <Panel search="agent">
          <p data-highlight-indirect>a span named nothing like it</p>
        </Panel>,
      );

      expect(lastHighlightedText('search-result-indirect')).toEqual(['a span named nothing like it']);
      expect(lastHighlightedText()).toEqual([]);
    });

    it('keeps direct regions matching on the term only', () => {
      render(
        <Panel search="agent">
          <p data-highlight>searchable agent</p>
          <p data-highlight-indirect>weather span</p>
        </Panel>,
      );

      expect(lastHighlightedText()).toEqual(['agent']);
      expect(lastHighlightedText('search-result-indirect')).toEqual(['weather span']);
    });

    it('paints an indirect region once when it also opted in directly', () => {
      render(
        <Panel search="agent">
          <p data-highlight data-highlight-indirect>
            agent span
          </p>
        </Panel>,
      );

      expect(lastHighlightedText()).toEqual([]);
      expect(lastHighlightedText('search-result-indirect')).toEqual(['agent span']);
    });

    it('repaints a region that swaps which highlight it claims, text unchanged', async () => {
      const Row = ({ indirect }: { indirect: boolean }) => (
        <Panel search="agent">
          <p data-highlight={indirect ? undefined : ''} data-highlight-indirect={indirect ? '' : undefined}>
            agent run
          </p>
        </Panel>
      );

      const { rerender } = render(<Row indirect={false} />);
      expect(lastHighlightedText()).toEqual(['agent']);

      // Same text node, only the opt-in attribute moves — as when a row goes from a name
      // match to a payload-only one while the term stays put.
      rerender(<Row indirect />);
      await flushMutations();
      flushFrames();

      expect(lastHighlightedText('search-result-indirect')).toEqual(['agent run']);
      expect(lastHighlightedText()).toEqual([]);
    });

    it('clears the indirect highlight when the term gets too short', () => {
      render(
        <Panel search="a">
          <p data-highlight-indirect>weather span</p>
        </Panel>,
      );

      expect(highlights.set).not.toHaveBeenCalled();
      expect(highlights.delete).toHaveBeenCalledWith('search-result-indirect');
    });

    it('clears the indirect highlight once unmounted', () => {
      const { unmount } = render(
        <Panel search="agent">
          <p data-highlight-indirect>weather span</p>
        </Panel>,
      );

      unmount();

      expect(highlights.delete).toHaveBeenCalledWith('search-result-indirect');
    });
  });

  it('highlights text nodes that are direct children of the opted-in element', async () => {
    const { container } = render(<Panel search="agent" />);
    highlights.set.mockClear();
    const root = container.firstElementChild as HTMLElement;

    act(() => {
      root.setAttribute('data-highlight', '');
      root.replaceChildren(document.createTextNode('agent'));
    });
    await flushMutations();
    flushFrames();

    expect(lastHighlightedText()).toEqual(['agent']);
  });
});
