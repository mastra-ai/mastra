import { useEffect, useState } from 'react';
import type { RefCallback } from 'react';

import { MIN_SEARCH_LENGTH, findFirstMatchTextNode } from './use-text-highlight';

export interface UseScrollToFirstHighlightResult<TElement extends HTMLElement> {
  ref: RefCallback<TElement>;
}

/**
 * Scrolls the first text-highlight match inside the referenced subtree into view. The
 * CSS Custom Highlight API paints ranges without wrapping DOM nodes, so there is no
 * `<mark>` to scroll to — instead the first text node `useTextHighlight` would paint is
 * located (same matching rules) and its parent element is brought into view.
 *
 * Content often arrives after the effect runs: the span payload loads async, and when a
 * different span is selected the panel briefly still shows the previous span's DOM. So a
 * MutationObserver stays attached for the effect's lifetime (rescans coalesced to one per
 * frame) and re-scrolls whenever the previously scrolled-to node is gone or no longer
 * contains the term — i.e. the content it scrolled to was replaced. While the matched
 * node stays put, mutations never re-scroll, so the user can scroll freely afterwards.
 * Pass `resetKey` to re-trigger the scroll for the same query, e.g. when a different
 * span is selected.
 */
export function useScrollToFirstHighlight<TElement extends HTMLElement = HTMLElement>(
  search: string,
  resetKey?: unknown,
): UseScrollToFirstHighlightResult<TElement> {
  const [root, setRoot] = useState<TElement | null>(null);

  useEffect(() => {
    if (!root || search.trim().length < MIN_SEARCH_LENGTH) return;

    let animationFrame: number | null = null;
    let scrolledTo: Text | null = null;
    let scrolledToData = '';

    const scan = () => {
      const match = findFirstMatchTextNode(root, search);
      if (!match) return;

      scrolledTo = match;
      scrolledToData = match.data;
      const target = match.parentElement;
      // jsdom guard: scrollIntoView is not implemented there.
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center' });
      }
    };

    // The scrolled-to content survived the mutation iff the node is still attached with
    // its text unchanged. React reuses text nodes and edits characterData in place, so
    // swapped-in content (e.g. another span's payload matching the same term) shows up
    // as a data change on the same node, not as a removal.
    const scrolledContentIntact = () =>
      scrolledTo !== null && scrolledTo.isConnected && scrolledTo.data === scrolledToData;

    scan();

    const observer = new MutationObserver(() => {
      if (animationFrame !== null) return;

      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        if (!scrolledContentIntact()) scan();
      });
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });

    return () => {
      observer.disconnect();
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    };
  }, [root, search, resetKey]);

  return { ref: setRoot };
}
