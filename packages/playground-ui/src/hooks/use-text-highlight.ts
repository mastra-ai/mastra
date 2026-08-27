import { useState } from 'react';
import type { RefCallback } from 'react';

import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';
import './use-text-highlight.css';

/** Single registry entry, so only one search surface can be highlighted at a time. */
const HIGHLIGHT_NAME = 'search-result';

/**
 * A single character matches almost everywhere, which paints noise instead of results.
 * Highlighting only starts once the term is discriminating enough.
 */
const MIN_SEARCH_LENGTH = 2;

/**
 * Opt-in marker: only text inside a `data-highlight` subtree can be painted. Highlighting
 * is a claim about which text is searchable, so surfaces state it explicitly rather than
 * having every piece of surrounding chrome remember to opt out.
 */
const INCLUDED_SELECTOR = '[data-highlight]';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface UseTextHighlightResult<TElement extends HTMLElement> {
  ref: RefCallback<TElement>;
}

/**
 * Paints every occurrence of `search` inside the referenced subtree using the CSS Custom
 * Highlight API. Only text under an element carrying `data-highlight` is painted, so a
 * surface names its searchable regions and everything else — headers, labels, metadata —
 * is left alone by default. The DOM is never mutated — no wrapper elements are injected — so text
 * selection, copy/paste and virtualised renderers are unaffected. Styling lives in
 * `use-text-highlight.css` (`::highlight(search-result)`).
 *
 * Terms shorter than two characters are ignored — they match too much to be useful.
 * Matching is case-insensitive and literal (the term is escaped, not a pattern). The
 * subtree is re-scanned on content changes, coalesced to one scan per frame. Browsers
 * without the API simply render nothing highlighted.
 */
export function useTextHighlight<TElement extends HTMLElement = HTMLElement>(
  search: string,
): UseTextHighlightResult<TElement> {
  const [root, setRoot] = useState<TElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (
      !root ||
      search.trim().length < MIN_SEARCH_LENGTH ||
      typeof CSS === 'undefined' ||
      !('highlights' in CSS) ||
      typeof StaticRange === 'undefined'
    ) {
      CSS?.highlights?.delete(HIGHLIGHT_NAME);
      return;
    }

    let animationFrame: number | null = null;

    const updateHighlight = () => {
      const ranges: StaticRange[] = [];
      const regex = new RegExp(escapeRegExp(search), 'giu');

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          // Inside a rooted walker every text node has a parent element.
          const parent = node.parentElement as HTMLElement;
          return parent.closest(INCLUDED_SELECTOR) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });

      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = regex.exec(textNode.data)) !== null) {
          ranges.push(
            new StaticRange({
              startContainer: textNode,
              startOffset: match.index,
              endContainer: textNode,
              endOffset: match.index + match[0].length,
            }),
          );
        }
      }

      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    };

    const scheduleUpdate = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);

      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        updateHighlight();
      });
    };

    updateHighlight();

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(root, { subtree: true, childList: true, characterData: true });

    return () => {
      observer.disconnect();
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      CSS.highlights.delete(HIGHLIGHT_NAME);
    };
  }, [root, search]);

  return { ref: setRoot };
}
