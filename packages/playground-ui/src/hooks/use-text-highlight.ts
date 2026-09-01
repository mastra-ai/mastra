import { useState } from 'react';
import type { RefCallback } from 'react';

import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';
import './use-text-highlight.css';

/** Single registry entry, so only one search surface can be highlighted at a time. */
const HIGHLIGHT_NAME = 'search-result';

/**
 * Second registry entry for text that carries no occurrence of the term itself, but stands
 * for something elsewhere that does — a span name whose match hides in its metadata. Painted
 * in its own color so the two claims stay distinguishable.
 */
const INDIRECT_HIGHLIGHT_NAME = 'search-result-indirect';

/**
 * A single character matches almost everywhere, which paints noise instead of results.
 * Highlighting only starts once the term is discriminating enough.
 */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Opt-in marker: only text inside a `data-highlight` subtree can be painted. Highlighting
 * is a claim about which text is searchable, so surfaces state it explicitly rather than
 * having every piece of surrounding chrome remember to opt out.
 */
const INCLUDED_SELECTOR = '[data-highlight]';

/**
 * Opt-in marker for the indirect highlight: the whole text of such a subtree is painted
 * while a query is active, regardless of what the term is. Marking is the caller's decision
 * — it knows why the row survived the filter, this hook only knows the term.
 */
const INDIRECT_SELECTOR = '[data-highlight-indirect]';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The first text node the highlighter would paint under `root` for `search`, or `null`.
 * Mirrors the walker below exactly: only `data-highlight` / `data-highlight-indirect`
 * subtrees count; indirect text is painted whole, so any non-empty text node in one is a
 * hit; direct text needs a literal, case-insensitive occurrence of the term. Colocated
 * here so the scroll target (`useScrollToFirstHighlight`) can't drift from the paint.
 */
export function findFirstMatchTextNode(root: HTMLElement, search: string): Text | null {
  const regex = new RegExp(escapeRegExp(search), 'iu');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement as HTMLElement;
      return parent.closest(`${INCLUDED_SELECTOR}, ${INDIRECT_SELECTOR}`)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const parent = textNode.parentElement as HTMLElement;

    if (parent.closest(INDIRECT_SELECTOR)) {
      if (textNode.data.length > 0) return textNode;
      continue;
    }

    if (regex.test(textNode.data)) return textNode;
  }

  return null;
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
 * Text under `data-highlight-indirect` is painted in full, in a second color
 * (`::highlight(search-result-indirect)`), whatever the term is. That is for labels standing
 * in for a match that lives somewhere not on screen — a span name whose hit is in its
 * metadata. It wins over `data-highlight` when both apply, so a text is never painted twice.
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
      CSS?.highlights?.delete(INDIRECT_HIGHLIGHT_NAME);
      return;
    }

    let animationFrame: number | null = null;

    const updateHighlight = () => {
      const ranges: StaticRange[] = [];
      const indirectRanges: StaticRange[] = [];
      const regex = new RegExp(escapeRegExp(search), 'giu');

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          // Inside a rooted walker every text node has a parent element.
          const parent = node.parentElement as HTMLElement;
          return parent.closest(`${INCLUDED_SELECTOR}, ${INDIRECT_SELECTOR}`)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });

      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        const parent = textNode.parentElement as HTMLElement;

        // The indirect claim is about the whole text, so there is nothing to search for
        // inside it: the term lives in the payload this text stands for, not in the text.
        if (parent.closest(INDIRECT_SELECTOR)) {
          if (textNode.data.length > 0) {
            indirectRanges.push(
              new StaticRange({
                startContainer: textNode,
                startOffset: 0,
                endContainer: textNode,
                endOffset: textNode.data.length,
              }),
            );
          }
          continue;
        }

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
      CSS.highlights.set(INDIRECT_HIGHLIGHT_NAME, new Highlight(...indirectRanges));
    };

    const scheduleUpdate = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);

      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        updateHighlight();
      });
    };

    updateHighlight();

    // The opt-in attributes are watched too: a region can change which highlight it claims
    // while its text stays put, and that alone must repaint it.
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-highlight', 'data-highlight-indirect'],
    });

    return () => {
      observer.disconnect();
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      CSS.highlights.delete(HIGHLIGHT_NAME);
      CSS.highlights.delete(INDIRECT_HIGHLIGHT_NAME);
    };
  }, [root, search]);

  return { ref: setRoot };
}
