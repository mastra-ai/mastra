import type { DASHBOARD_WIDGET_SPANS } from '@mastra/core/storage/dashboards';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DashboardSpan = (typeof DASHBOARD_WIDGET_SPANS)[number];

/**
 * Below `@5xl` every widget takes the row, as in `MetricsGrid`. From `@5xl` up each widget takes its
 * saved span, so a row keeps the widths it was arranged with and never wraps onto a second line.
 */
const SPAN_CLASSES: Record<DashboardSpan, string> = {
  12: 'col-span-full',
  6: '@5xl:col-span-6',
  4: '@5xl:col-span-4',
  3: '@5xl:col-span-3',
  2: '@5xl:col-span-2',
  1: '@5xl:col-span-1',
};

/** One dashboard row: its own grid, so a short row never pulls widgets up from the next. */
export function DashboardGridRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 @5xl:grid-cols-12">{children}</div>;
}

/**
 * A grid cell; the grid owns the width, so a card's own `min-w-*` is neutralised. The cell stretches
 * to its row and its card fills it, so a card whose title wraps doesn't stand taller than its neighbours.
 */
export function DashboardGridCell({ span, id, children }: { span: DashboardSpan; id?: string; children: ReactNode }) {
  return (
    <div data-widget-id={id} data-span={span} className={cn('min-w-0 *:size-full *:min-w-0!', SPAN_CLASSES[span])}>
      {children}
    </div>
  );
}

/** The dashboard's rows, sized by the container's width rather than the viewport's. */
export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('@container flex flex-col gap-4', className)}>{children}</div>;
}
