import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One row under the top bar for a card's controls: small tabs, a legend, list column headers.
 * The first child sits on the left, the last on the right; either side may be omitted. When
 * both don't fit (a narrow card), the right side wraps to its own line, still on the right.
 */
export function MetricsCardToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 [&>*:first-child]:min-w-0 [&>*:last-child:not(:first-child)]:ml-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}
