import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Scrolls sideways only (wide tables). Vertical overflow is hidden: a chart filling a card with a
 * fractional height rounds 1px past it, which otherwise turns the content into a scroll box.
 * Tables inside a card drop the last row's border: the card edge already closes them.
 */
export function MetricsCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto overflow-y-hidden [&_tbody>tr:last-child]:border-b-0', className)}>
      {children}
    </div>
  );
}
