import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useEffect, useEffectEvent, useRef } from 'react';

interface LoadMoreSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Accessible label, e.g. "Load more issues". */
  label: string;
}

/**
 * Infinite-scroll trigger for the Factory lists. Fetches the next page when it
 * is scrolled into view; the visible "Load more" button is both the observed
 * node and a keyboard/no-IntersectionObserver fallback. A sentinel that is
 * already in view — a short or filtered list — never fetches on its own, so a
 * page that adds nothing visible cannot chain into the next one.
 */
export function LoadMoreSentinel({ hasNextPage, isFetchingNextPage, onLoadMore, label }: LoadMoreSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const loadMoreUnlessFetching = useEffectEvent(() => {
    if (!isFetchingNextPage) onLoadMore();
  });

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    // The first notification reports where the node already is, not a scroll.
    let wasInView = true;
    const observer = new IntersectionObserver(
      entries => {
        const inView = entries.some(entry => entry.isIntersecting);
        if (inView && !wasInView) loadMoreUnlessFetching();
        wasInView = inView;
      },
      // Start the fetch shortly before the end of the list is reached.
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage]);

  if (!hasNextPage) return null;

  return (
    <div ref={ref} className="flex justify-center py-2">
      {isFetchingNextPage ? (
        <Spinner size="sm" aria-label="Loading more" />
      ) : (
        <Button variant="ghost" size="sm" onClick={() => onLoadMore()}>
          {label}
        </Button>
      )}
    </div>
  );
}
