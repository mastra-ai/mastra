export type DataListNextPageLoadingProps = {
  isLoading?: boolean;
  hasMore?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  loadingText?: string;
  noMoreDataText?: string;
};

export function DataListNextPageLoading({
  isLoading,
  hasMore,
  setEndOfListElement,
  loadingText = 'Loading more data...',
  noMoreDataText = 'No more data to load',
}: DataListNextPageLoadingProps) {
  if (!setEndOfListElement) {
    return null;
  }

  return (
    <div
      ref={setEndOfListElement}
      className="col-span-full text-ui-md text-neutral3 opacity-50 flex py-4 justify-center"
    >
      {isLoading && loadingText}
      {!hasMore && !isLoading && noMoreDataText}
    </div>
  );
}
