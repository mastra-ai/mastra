import { cn } from '@/lib/utils';

export type DataListNextPageLoadingProps = {
  isLoading?: boolean;
  hasMore?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  loadingText?: string;
};

export function DataListNextPageLoading({
  isLoading,
  setEndOfListElement,
  hasMore,
  loadingText = 'Loading more data...',
}: DataListNextPageLoadingProps) {
  if (!setEndOfListElement) {
    return null;
  }

  return (
    <div
      ref={setEndOfListElement}
      // Zero-height when idle so it adds no trailing space below the last row;
      // IntersectionObserver still fires for a zero-area target at the viewport edge.
      className={cn('col-span-full -mt-px flex justify-center text-ui-md text-neutral3 opacity-50', {
        'py-4': isLoading,
      })}
    >
      {isLoading && loadingText}
    </div>
  );
}
