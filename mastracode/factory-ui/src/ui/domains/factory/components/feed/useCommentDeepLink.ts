import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** A deep-linked comment can sit behind older pages; give up rather than paging a whole feed. */
const MAX_DEEP_LINK_PAGE_LOADS = 3;

/**
 * Walks back through the feed until the deep-linked comment is loaded, then
 * centres it. Both budgets reset when the link changes, so a second deep link
 * in the same mount gets its own attempts.
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
  const scrolled = useRef(false);
  const lastCommentId = useRef(commentId);

  if (lastCommentId.current !== commentId) {
    lastCommentId.current = commentId;
    pageLoads.current = 0;
    scrolled.current = false;
  }

  useEffect(() => {
    if (!commentId || loaded || !canLoadMore) return;
    if (pageLoads.current >= MAX_DEEP_LINK_PAGE_LOADS) return;
    pageLoads.current += 1;
    loadMore();
  }, [commentId, loaded, loadedPages, canLoadMore, loadMore]);

  useEffect(() => {
    if (!commentId || !loaded || scrolled.current) return;
    scrolled.current = true;
    const viewport = viewportRef.current;
    const target = viewport?.querySelector(`[data-comment-id="${CSS.escape(commentId)}"]`);
    if (!viewport || !(target instanceof HTMLElement)) return;
    // Scroll the feed viewport only: scrollIntoView would also scroll every
    // ancestor, yanking the page around behind the popover.
    const viewportRect = viewport.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    viewport.scrollTop += targetRect.top - viewportRect.top - (viewport.clientHeight - targetRect.height) / 2;
  }, [commentId, loaded, viewportRef]);
}
