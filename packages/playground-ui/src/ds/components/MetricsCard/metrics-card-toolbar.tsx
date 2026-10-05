import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One row under the top bar for a card's controls: small tabs, a legend, list column headers.
 * The first child sits on the left, the last on the right; either side may be omitted.
 */
export function MetricsCardToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-4 [&>*:first-child]:min-w-0', className)}>
      {children}
    </div>
  );
}
