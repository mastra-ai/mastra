import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { CHART_MARGIN, ChartHideYAxis, X_AXIS_HEIGHT } from '@/ds/primitives/chart-layout';
import { cn } from '@/lib/utils';

export type ChartAreaProps = {
  /** No data in the range: the chart keeps its footprint and dates, under a "No data" message. */
  isEmpty?: boolean;
  /**
   * Only for a reason other than an empty range, e.g. a preview that can't run yet. An empty range
   * keeps the shared "No data in this range", so every empty chart reads the same.
   */
  emptyMessage?: string;
  /**
   * Previous data stays on screen, dimmed, while a new range or filter loads. For a body that loads
   * apart from its card, e.g. a table tab under tabs that stay put; a card that loads its own data
   * passes `isUpdating` to `ChartCard` instead.
   */
  isUpdating?: boolean;
  children: ReactNode;
};

/**
 * A card's chart or list, filling the card body. Every empty chart looks the same: the chart keeps
 * its footprint but is hidden (its dates stay), under three rulers and one message; the card's
 * title already says what's missing.
 */
export function ChartArea({
  isEmpty = false,
  emptyMessage = 'No data in this range',
  isUpdating,
  children,
}: ChartAreaProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col',
        isUpdating !== undefined && 'transition-opacity duration-200',
        isUpdating && 'opacity-50',
      )}
      data-chart-empty={isEmpty || undefined}
    >
      <div
        className={cn('flex min-h-0 flex-1 flex-col', isEmpty && 'invisible [&_.recharts-xAxis-tick-labels]:visible')}
      >
        {/* Without the y-axis, the first and last dates sit at the card's edges. */}
        <ChartHideYAxis.Provider value={isEmpty}>{children}</ChartHideYAxis.Provider>
      </div>
      {isEmpty && <ChartEmpty message={emptyMessage} />}
    </div>
  );
}

/** A dashed ruler, drawn like the charts' grid lines. */
function Ruler({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'h-px bg-[linear-gradient(to_right,var(--border)_3px,transparent_3px)] bg-size-[6px_1px] opacity-50',
        className,
      )}
    />
  );
}

/** Full-width rulers at the plot's top, middle and bottom, with the message on the middle one. */
function ChartEmpty({ message }: { message: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between"
      style={{
        paddingTop: CHART_MARGIN.top,
        paddingBottom: X_AXIS_HEIGHT,
      }}
    >
      <Ruler />
      <div className="flex items-center gap-3">
        <Ruler className="flex-1" />
        <Txt as="span" variant="body-sm" tone="muted" className="max-w-[70%] text-center font-[450] text-balance">
          {message}
        </Txt>
        <Ruler className="flex-1" />
      </div>
      <Ruler />
    </div>
  );
}
