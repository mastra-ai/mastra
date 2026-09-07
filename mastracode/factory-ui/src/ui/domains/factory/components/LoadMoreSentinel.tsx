import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import { useEffect, useEffectEvent } from 'react';

interface LoadMoreSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Accessible label, e.g. "Load more issues". */
  label: string;
}

/**
 * Loads one page each time it comes into view. A page that adds nothing to
 * scroll past leaves it where it is, so the button loads the next one.
 */
export function LoadMoreSentinel({ hasNextPage, isFetchingNextPage, onLoadMore, label }: LoadMoreSentinelProps) {
  const { inView, setRef } = useInView();
  const loadMoreUnlessFetching = useEffectEvent(() => {
    if (!isFetchingNextPage) onLoadMore();
  });

  useEffect(() => {
    if (inView) loadMoreUnlessFetching();
  }, [inView]);

  if (!hasNextPage) return null;

  return (
    <div ref={setRef} className="flex justify-center py-2">
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
