import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

export function NavigationQueryState({
  isLoading,
  hasError,
  isEmpty,
  children,
}: {
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  children: ReactNode;
}) {
  if (hasError) {
    return (
      <Txt role="alert" tone="muted" className="px-4 py-3">
        Navigation unavailable. See the page for details.
      </Txt>
    );
  }
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading navigation">
        <Skeleton className="m-3 h-24" />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <Txt role="status" tone="muted" className="px-4 py-3">
        No matching items.
      </Txt>
    );
  }
  return children;
}
