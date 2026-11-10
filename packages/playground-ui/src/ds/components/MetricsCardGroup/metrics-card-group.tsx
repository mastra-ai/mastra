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
 * a narrow pane never squeezes cards into one row. One column, two, then three from 48rem, except
 * that four cards stay 2 + 2 there rather than leave one alone. Up to four cards share one row
 * from 56rem; five stay 3 + 2 until they share one row from 72rem. Every card stays at least
 * 12rem wide, room for its value, change badge and footer on one line each.
 * The group owns their width, so each card's own `min-w-*` is neutralised.
 */
// No base `grid-cols-1` and no display switch: an app that loads this package's CSS next to
// its own Tailwind output can emit the same plain utility later in the cascade, which would
// beat a container-query utility of equal specificity. The rows are grid track lists; the
// five-card single row is important so it wins over the `has-*` three-column rule.
export function MetricsCardGroup({ children, className }: MetricsCardGroupProps) {
  return (
    <div className="@container">
      <div
        className={cn(
          'grid gap-4 *:min-w-0! @xl:grid-cols-2 @3xl:grid-cols-3 @3xl:has-[>:nth-child(5)]:grid-cols-3 @3xl:@max-4xl:has-[>:nth-child(4):last-child]:grid-cols-2 @4xl:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] @6xl:has-[>:nth-child(5)]:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]!',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
