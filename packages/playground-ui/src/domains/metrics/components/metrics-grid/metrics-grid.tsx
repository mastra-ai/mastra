import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MetricsGridMinItemWidth = 'sm' | 'md' | 'lg';
export type MetricsGridItemSpan = 1 | 2 | 'full';

const minItemWidthClasses: Record<MetricsGridMinItemWidth, string> = {
  sm: '[--metrics-grid-min:18rem]',
  md: '[--metrics-grid-min:24rem]',
  lg: '[--metrics-grid-min:32rem]',
};

/** `2` only applies from `lg`, where the grid is guaranteed to have room for two columns. */
const spanClasses: Record<MetricsGridItemSpan, string> = {
  1: '',
  2: 'lg:col-span-2',
  full: 'col-span-full',
};

export type MetricsGridProps = {
  children: ReactNode;
  /** Narrowest a card may get before the grid wraps it to a new row. */
  minItemWidth?: MetricsGridMinItemWidth;
  className?: string;
};

/**
 * Responsive grid of metrics cards. Fits as many columns as the container allows
 * without any card shrinking under `minItemWidth`, and never overflows on mobile.
 */
export function MetricsGrid({ children, minItemWidth = 'md', className }: MetricsGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(min(100%,var(--metrics-grid-min)),1fr))] gap-4',
        minItemWidthClasses[minItemWidth],
        className,
      )}
    >
      {children}
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
