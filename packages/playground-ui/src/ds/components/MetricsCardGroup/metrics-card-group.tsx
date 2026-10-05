import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MetricsCardGroupProps = {
  children: ReactNode;
  className?: string;
};

/**
 * A row of metrics cards (KPI, chart, …) held as one unit. No frame of its own: the cards
 * sit directly on the page with the page's 16px gap, so there is never a card inside a card.
 * Columns follow the group's own width (container queries), not the viewport, so a sidebar or
 * a narrow pane never squeezes five cards into one row: one column, then two, three once a group
 * of five or more can fill two rows, and a single equal-width row only from 72rem, where every
 * card has room for its value, change badge and footer on one line each.
 * The group owns their width, so each card's own `min-w-*` is neutralised.
 */
export function MetricsCardGroup({ children, className }: MetricsCardGroupProps) {
  return (
    <div className="@container">
      <div
        className={cn(
          'grid grid-cols-1 gap-4 *:min-w-0! @xl:grid-cols-2 @3xl:has-[>:nth-child(5)]:grid-cols-3 @6xl:flex @6xl:*:flex-1',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
