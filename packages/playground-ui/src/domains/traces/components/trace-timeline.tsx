import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UISpan } from '../types';
import { TimelineTimingCol } from './timeline-timing-col';
import { TraceSpanTree } from './trace-span-tree';

type TraceTimelineProps = {
  hierarchicalSpans: UISpan[];
  onSpanClick: (id: string) => void;
  selectedSpanId?: string;
  isLoading?: boolean;
  fadedTypes?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: Dispatch<SetStateAction<string[]>>;
  featuredSpanIds?: string[];
  /** Row scrolled into view once it is mounted (ancestors auto-expand when the span is featured). */
  revealSpanId?: string;
  chartWidth?: 'wide' | 'default';
  /** Rendered full-width above the span type legend row. */
  leadingSlot?: ReactNode;
};

/**
 * @deprecated Use `TraceSpanTree` (hierarchy with duration) or `TraceSpanTimeline` (time bars).
 * This renders `TraceSpanTree` with the legacy timing bar as the trailing cell.
 */
export function TraceTimeline({ chartWidth = 'default', ...props }: TraceTimelineProps) {
  return (
    <TraceSpanTree
      {...props}
      renderTrailing={ctx => (
        <TimelineTimingCol
          span={ctx.span}
          selectedSpanId={ctx.isSelected ? ctx.span.id : undefined}
          isFaded={ctx.isFaded}
          overallLatency={ctx.overallLatency}
          overallStartTime={ctx.overallStartTime}
          color={ctx.spanUI?.color}
          chartWidth={chartWidth}
        />
      )}
    />
  );
}
