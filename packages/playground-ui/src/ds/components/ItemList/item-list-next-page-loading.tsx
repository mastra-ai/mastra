export type ItemListNextPageLoadingProps = {
  isLoading?: boolean;
  hasMore?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  loadingText?: string;
  noMoreDataText?: string;
};

export function ItemListNextPageLoading({
  isLoading,
  hasMore,
  setEndOfListElement,
  loadingText = 'Loading more data...',
  noMoreDataText = 'No more data to load',
}: ItemListNextPageLoadingProps) {
  if (!setEndOfListElement) {
    return null;
  }

  return (
    <div ref={setEndOfListElement} className="mt-8 flex justify-center text-ui-md text-neutral3 opacity-50">
      {isLoading && loadingText}
      {!hasMore && !isLoading && noMoreDataText}
    </div>
  );
}
