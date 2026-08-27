import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { WorkItemCommentPage } from '../../services/commentsWire';

/** A deep-linked comment can sit behind older pages; hold this many rather than page a whole feed. */
const MAX_DEEP_LINK_PAGES = 4;

interface LoadedPages {
  data?: { pages: WorkItemCommentPage[] };
  hasNextPage: boolean;
}

/** Pages back through the feed until the deep-linked comment lands, or the budget runs out. */
export function useCommentDeepLink({
  commentId,
  loaded,
  loadMore,
}: {
  commentId: string | undefined;
  loaded: boolean;
  loadMore: () => Promise<LoadedPages>;
}) {
  useEffect(() => {
    if (!commentId || loaded) return;
    let hunting = true;
    void (async () => {
      // Bounded twice over: by the pages held, and by the attempts it takes to
      // hold them, so a fetch that keeps failing cannot spin here.
      for (let attempt = 0; hunting && attempt < MAX_DEEP_LINK_PAGES; attempt += 1) {
        const { data, hasNextPage } = await loadMore();
        const pages = data?.pages ?? [];
        if (pages.some(page => page.comments.some(comment => comment.id === commentId))) return;
        if (!hasNextPage || pages.length >= MAX_DEEP_LINK_PAGES) return;
      }
    })();
    return () => {
      hunting = false;
    };
  }, [commentId, loaded, loadMore]);
}

/**
 * A ref for the one row that should sit mid-viewport when it lands. Scrolls the
 * given viewport only: `scrollIntoView` would also scroll every ancestor,
 * yanking the page around behind the popover.
 */
export function useCentreInViewport(viewportRef: RefObject<HTMLDivElement | null>) {
  const centred = useRef<HTMLElement | undefined>(undefined);

  return (row: HTMLDivElement | null) => {
    const viewport = viewportRef.current;
    if (!row || !viewport || centred.current === row) return;
    centred.current = row;
    const viewportRect = viewport.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    viewport.scrollTop += rowRect.top - viewportRect.top - (viewport.clientHeight - rowRect.height) / 2;
  };
}
