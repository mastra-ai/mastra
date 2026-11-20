import { useEffect } from 'react';

export type LoadMoreWhenInViewProps = {
  /** The end of the list is on screen. */
  inView: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onLoadMore: () => void;
};

/** Asks the host for the next page once the end of the list scrolls into view. Renders nothing. */
export function LoadMoreWhenInView({
  inView,
  hasNextPage,
  isFetchingNextPage,
  isError,
  onLoadMore,
}: LoadMoreWhenInViewProps) {
  const shouldLoad = inView && hasNextPage && !isFetchingNextPage && !isError;
  useEffect(() => {
    if (shouldLoad) onLoadMore();
  }, [shouldLoad, onLoadMore]);
  return null;
}
