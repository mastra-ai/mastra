export function EntryListNextPageLoading({
  isLoading,
  hasMore,
  setEndOfListElement,
}: {
  isLoading?: boolean;
  hasMore?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
}) {
  if (!setEndOfListElement) {
    return null;
  }

  return (
    <div ref={setEndOfListElement} className="text-[0.875rem] text-icon3 opacity-50 flex mt-[2rem] justify-center">
      {isLoading && 'Loading...'}
      {!hasMore && !isLoading && 'No more data to load'}
    </div>
  );
}
