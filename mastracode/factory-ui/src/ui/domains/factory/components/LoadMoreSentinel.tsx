import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import type { ReactNode } from 'react';
import { useEffect, useEffectEvent } from 'react';

interface LoadMoreSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** How many rows the list holds. A page that adds some loads the next one while the end stays in view. */
  loaded: number;
  /** Accessible label, e.g. "Load more issues". */
  label: string;
  /** Optional list-shaped placeholder for surfaces where a spinner would shift the layout. Pass null to hide it. */
  loadingIndicator?: ReactNode;
}

/**
 * Loads a page when it comes into view, and the next one each time a page adds rows while it stays
 * in view. A page that adds nothing, or fails, stops there and leaves the button to ask again.
 */
export function LoadMoreSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  loaded,
  label,
  loadingIndicator,
}: LoadMoreSentinelProps) {
  const { inView, setRef } = useInView();
  const loadMoreUnlessFetching = useEffectEvent(() => {
    if (hasNextPage && !isFetchingNextPage) onLoadMore();
  });

  useEffect(() => {
    if (inView) loadMoreUnlessFetching();
  }, [inView, loaded]);

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
