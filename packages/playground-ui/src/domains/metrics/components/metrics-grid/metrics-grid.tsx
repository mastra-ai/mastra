import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MetricsGridColumns = 2 | 3;
export type MetricsGridItemSpan = 1 | 2 | 'full';

/**
 * Breakpoints follow the grid's own width (container queries), not the viewport,
 * so the sidebar or any surrounding layout doesn't skew the column count.
 */
const columnClasses: Record<MetricsGridColumns, string> = {
  2: '@3xl:grid-cols-2',
  3: '@3xl:grid-cols-2 @7xl:grid-cols-3',
};

const spanClasses: Record<MetricsGridItemSpan, string> = {
  1: '',
  2: '@3xl:col-span-2',
  full: 'col-span-full',
};

export type MetricsGridProps = {
  children: ReactNode;
  /** Maximum number of columns on wide containers. Pick a divisor of the card count to avoid a ragged last row. */
  columns?: MetricsGridColumns;
  className?: string;
};

/** Responsive grid of metrics cards: one column on narrow containers, up to `columns` on wide ones. */
export function MetricsGrid({ children, columns = 3, className }: MetricsGridProps) {
  return (
    <div className={cn('@container', className)}>
      <div className={cn('grid gap-4', columnClasses[columns])}>{children}</div>
    </div>
  );
}

export type MetricsGridItemProps = {
  children: ReactNode;
  span?: MetricsGridItemSpan;
  className?: string;
};

/** A grid cell. The grid owns the width, so each card's own `min-w-*` is neutralised. */
function MetricsGridItem({ children, span = 1, className }: MetricsGridItemProps) {
  return <div className={cn('min-w-0 *:w-full *:min-w-0!', spanClasses[span], className)}>{children}</div>;
}

MetricsGrid.Item = MetricsGridItem;
