import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** A deep-linked comment can sit behind older pages; give up rather than paging a whole feed. */
const MAX_DEEP_LINK_PAGE_LOADS = 3;

/**
 * Pages back through the feed until the deep-linked comment is loaded, and hands
 * the list a ref that centres that row the moment it mounts. A new link starts
 * over with its own page budget.
 */
export function useCommentDeepLink({
  commentId,
  loaded,
  loadedPages,
  canLoadMore,
  loadMore,
  viewportRef,
}: {
  commentId: string | undefined;
  loaded: boolean;
  /** Retriggers the hunt: each landed page is another chance to find the comment. */
  loadedPages: number;
  canLoadMore: boolean;
  loadMore: () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const pageLoads = useRef(0);
  const lastCommentId = useRef(commentId);
  const centred = useRef<HTMLElement | undefined>(undefined);

  if (lastCommentId.current !== commentId) {
    lastCommentId.current = commentId;
    pageLoads.current = 0;
  }

  useEffect(() => {
    if (!commentId || loaded || !canLoadMore) return;
    if (pageLoads.current >= MAX_DEEP_LINK_PAGE_LOADS) return;
    pageLoads.current += 1;
    loadMore();
  }, [commentId, loaded, loadedPages, canLoadMore, loadMore]);

  return (row: HTMLDivElement | null) => {
    const viewport = viewportRef.current;
    if (!row || !viewport || centred.current === row) return;
    centred.current = row;
    // Scroll the feed viewport only: scrollIntoView would also scroll every
    // ancestor, yanking the page around behind the popover.
    const viewportRect = viewport.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    viewport.scrollTop += rowRect.top - viewportRect.top - (viewport.clientHeight - rowRect.height) / 2;
  };
}
