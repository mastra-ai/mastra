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
 * a narrow pane never squeezes cards into one row. One column, two, then three from 48rem for groups
 * of three or more, so one or two cards never leave an empty column, and four cards stay 2 + 2 there
 * rather than leave one alone. Up to four cards share one row
 * from 56rem; five stay 3 + 2 until they share one row from 72rem. Every card stays at least
 * 12rem wide, room for its value, change badge and footer on one line each.
 * The group owns their width, so each card's own `min-w-*` is neutralised.
 */
// An app that loads this package's CSS next to its own Tailwind output can emit the same utility
// (say `@xl:grid-cols-2`) again, later in the cascade. So no two column rules of equal specificity
// may apply at the same width, or the later copy wins whatever the breakpoint: each plain rule owns
// its own width range (one column needs no rule), and the `has-*` overrides win by specificity.
export function MetricsCardGroup({ children, className }: MetricsCardGroupProps) {
  return (
    <div className="@container">
      <div
        className={cn(
          'grid gap-4 *:min-w-0! @xl:@max-4xl:grid-cols-2 @3xl:@max-4xl:has-[>:nth-child(3)]:grid-cols-3 @3xl:@max-4xl:has-[>:nth-child(4):last-child]:grid-cols-2 @4xl:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] @4xl:@max-6xl:has-[>:nth-child(5)]:grid-cols-3',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
