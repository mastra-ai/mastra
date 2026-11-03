import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import type { ReactNode } from 'react';
import { useEffect, useEffectEvent, useState } from 'react';

interface LoadMoreSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** How many rows the list shows now; a page that leaves it unchanged stops the scroll loading. */
  itemCount: number;
  /** Accessible label, e.g. "Load more issues". */
  label: string;
  /** Optional list-shaped placeholder for surfaces where a spinner would shift the layout. Pass null to hide it. */
  loadingIndicator?: ReactNode;
}

/**
 * Keeps loading pages while it stays in view and each page adds rows. A page
 * that adds nothing (filtered out, already on the board) stops it there, so the
 * button loads the next one rather than chaining through pages nobody sees.
 */
export function LoadMoreSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  itemCount,
  label,
  loadingIndicator,
}: LoadMoreSentinelProps) {
  const { inView, setRef } = useInView();
  // Row count when the last scroll load started; null until one has.
  const [countAtLastLoad, setCountAtLastLoad] = useState<number | null>(null);
  const stalled = countAtLastLoad === itemCount;
  const autoLoads = inView && hasNextPage && !stalled;

  const loadFromScroll = useEffectEvent(() => {
    if (isFetchingNextPage) return;
    setCountAtLastLoad(itemCount);
    onLoadMore();
  });

  useEffect(() => {
    if (autoLoads && !isFetchingNextPage) loadFromScroll();
  }, [autoLoads, isFetchingNextPage, itemCount]);

  // Scrolling away and back again is a fresh request for more.
  useEffect(() => {
    if (!inView) setCountAtLastLoad(null);
  }, [inView]);

  if (!hasNextPage) return null;

  const loading = isFetchingNextPage || autoLoads;

  return (
    <div ref={setRef} className="py-2">
      {loading ? (
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
