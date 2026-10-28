import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DashboardSpan = 1 | 2 | 3 | 4 | 6 | 12;

/**
 * Twelve columns on wide containers. Below `@3xl` every widget takes the row, as in `MetricsGrid`;
 * between `@3xl` and `@7xl`, widgets narrower than half take half, like the Metrics page's 3-up grids.
 */
const SPAN_CLASSES: Record<DashboardSpan, string> = {
  12: 'col-span-full',
  6: '@3xl:col-span-6',
  4: '@3xl:col-span-6 @7xl:col-span-4',
  3: '@3xl:col-span-6 @7xl:col-span-3',
  2: '@3xl:col-span-4 @7xl:col-span-2',
  1: '@3xl:col-span-2 @7xl:col-span-1',
};

/** One dashboard row: its own grid, so a short row never pulls widgets up from the next. */
export function DashboardGridRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 @3xl:grid-cols-12">{children}</div>;
}

/** A grid cell; the grid owns the width, so a card's own `min-w-*` is neutralised. */
export function DashboardGridCell({ span, id, children }: { span: DashboardSpan; id?: string; children: ReactNode }) {
  return (
    <div data-widget-id={id} className={cn('min-w-0 *:w-full *:min-w-0!', SPAN_CLASSES[span])}>
      {children}
    </div>
  );
}

/** The dashboard's rows, sized by the container's width rather than the viewport's. */
export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('@container flex flex-col gap-4', className)}>{children}</div>;
}
