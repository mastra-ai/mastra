import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useEffect, useRef } from 'react';

interface LoadMoreSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Accessible label, e.g. "Load more issues". */
  label: string;
}

/**
 * Infinite-scroll trigger for the Factory lists. Fetches the next page when it
 * scrolls into view; the visible "Load more" button is both the observed node
 * and a keyboard/no-IntersectionObserver fallback.
 */
export function LoadMoreSentinel({ hasNextPage, isFetchingNextPage, onLoadMore, label }: LoadMoreSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) onLoadMore();
      },
      // Start the fetch shortly before the end of the list is reached.
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

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
