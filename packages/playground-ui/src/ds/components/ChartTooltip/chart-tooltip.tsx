import type { ComponentPropsWithoutRef } from 'react';

import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type ChartTooltipProps = ComponentPropsWithoutRef<'div'>;

/**
 * The floating readout a chart shows on hover — scatter points, line series,
 * sankey nodes, lifeline markers.
 *
 * It is a raised surface, so it carries no border of its own: the rim lives in
 * the `shadow-overlay` utility. Call sites pass only what is genuinely local — positioning
 * and sizing — never background, border or shadow.
 */
export function ChartTooltip({ className, ...props }: ChartTooltipProps) {
  return (
    <div
      data-slot="chart-tooltip"
      className={cn(overlaySurfaceStyle, 'rounded-md px-3 py-2 text-caption text-foreground', className)}
      {...props}
    />
  );
}
