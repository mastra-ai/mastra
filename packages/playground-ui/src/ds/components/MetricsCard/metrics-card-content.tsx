import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Tables inside a card drop the last row's border: the card edge already closes them. */
export function MetricsCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto [&_tbody>tr:last-child]:border-b-0', className)}>{children}</div>;
}
