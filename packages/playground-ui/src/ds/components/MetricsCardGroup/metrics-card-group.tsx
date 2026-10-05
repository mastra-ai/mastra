import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MetricsCardGroupProps = {
  children: ReactNode;
  className?: string;
};

/**
 * A row of metrics cards (KPI, chart, …) held as one unit. No frame of its own: the cards
 * sit directly on the page with the page's 16px gap, so there is never a card inside a card.
 * One column below `md`, two below `lg`, then every card on a single row with equal widths.
 * The group owns their width, so each card's own `min-w-*` is neutralised.
 */
export function MetricsCardGroup({ children, className }: MetricsCardGroupProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 *:min-w-0! md:grid-cols-2 lg:flex lg:*:flex-1', className)}>
      {children}
    </div>
  );
}
