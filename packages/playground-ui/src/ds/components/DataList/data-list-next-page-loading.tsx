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
      className={cn('col-span-full text-ui-md text-neutral3 opacity-50 flex justify-center min-h-1', {
        'py-4': isLoading,
        'py-0': !hasMore,
      })}
    >
      {isLoading && loadingText}
    </div>
  );
}
