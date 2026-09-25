import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import type { ReactNode } from 'react';
import { useEffect, useEffectEvent } from 'react';

interface LoadMoreSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Accessible label, e.g. "Load more issues". */
  label: string;
  /** Optional list-shaped placeholder for surfaces where a spinner would shift the layout. Pass null to hide it. */
  loadingIndicator?: ReactNode;
}

/**
 * Loads one page each time it comes into view. A page that adds nothing to
 * scroll past leaves it where it is, so the button loads the next one.
 */
export function LoadMoreSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  label,
  loadingIndicator,
}: LoadMoreSentinelProps) {
  const { inView, setRef } = useInView();
  const loadMoreUnlessFetching = useEffectEvent(() => {
    if (!isFetchingNextPage) onLoadMore();
  });

  useEffect(() => {
    if (inView) loadMoreUnlessFetching();
  }, [inView]);

  if (!hasNextPage) return null;

  return (
    <div ref={setRef} className="py-2">
      {isFetchingNextPage ? (
        loadingIndicator === undefined ? (
          <div className="flex justify-center">
            <Spinner size="sm" aria-label="Loading more" />
          </div>
        ) : (
          loadingIndicator
        )
      ) : (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => onLoadMore()}>
            {label}
          </Button>
        </div>
      )}
    </div>
  );
}
