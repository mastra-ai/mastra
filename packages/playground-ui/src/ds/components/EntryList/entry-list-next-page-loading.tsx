export type EntryListNextPageLoadingProps = {
  isLoading?: boolean;
  hasMore?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  loadingText?: string;
  noMoreDataText?: string;
};

export function EntryListNextPageLoading({
  isLoading,
  hasMore,
  setEndOfListElement,
  loadingText = 'Loading more data...',
  noMoreDataText = 'No more data to load',
}: EntryListNextPageLoadingProps) {
  if (!setEndOfListElement) {
    return null;
  }

  return (
    <div ref={setEndOfListElement} className="text-ui-md text-neutral3 opacity-50 flex mt-8 justify-center">
      {isLoading && loadingText}
      {!hasMore && !isLoading && noMoreDataText}
    </div>
  );
}
