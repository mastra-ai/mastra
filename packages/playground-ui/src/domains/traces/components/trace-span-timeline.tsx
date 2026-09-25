import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UISpan } from '../types';
import { SpanRows } from './span-rows';
import { SpanTimelineRow } from './span-timeline-row';
import { SpanTypeLegend } from './span-type-legend';
import { TraceSpanTreeLoading } from './trace-span-tree';
import { cn } from '@/lib/utils';
import { formatDurationPrecise } from '@/utils/duration';

export type TraceSpanTimelineProps = {
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
  /** Rendered full-width above the span type legend row. */
  leadingSlot?: ReactNode;
};

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Gantt-style view of a trace: the same hierarchy and expansion state as `TraceSpanTree`,
 * but each row is a compact name cell plus a bar on a shared time axis. Rendered with its
 * own row component (`SpanTimelineRow`), independent from the tree's rows.
 */
export function TraceSpanTimeline({
  hierarchicalSpans = [],
  onSpanClick,
  selectedSpanId,
  isLoading,
  fadedTypes,
  expandedSpanIds,
  setExpandedSpanIds,
  featuredSpanIds,
  revealSpanId,
  leadingSlot,
}: TraceSpanTimelineProps) {
  if (isLoading) return <TraceSpanTreeLoading />;

  const overallLatency = hierarchicalSpans[0]?.latency || 0;

  return (
    <>
      {leadingSlot}
      <SpanTypeLegend spans={hierarchicalSpans} />
      <div className="grid grid-cols-[minmax(10rem,2fr)_minmax(12rem,3fr)] content-start gap-y-px overflow-hidden py-1">
        {/* Header row: empty name cell, then the axis aligned with the bars (same horizontal padding, minus the duration label). */}
        <div />
        <div aria-label="Trace time axis" className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 pb-1">
          <div className="flex justify-between text-meta text-muted-foreground tabular-nums">
            {TICKS.map((tick, index) => (
              <span
                key={tick}
                className={cn('whitespace-nowrap', index > 0 && index < TICKS.length - 1 && 'hidden sm:inline')}
              >
                {formatDurationPrecise(overallLatency * tick)}
              </span>
            ))}
          </div>
          <div className="w-12" />
        </div>
        <SpanRows
          spans={hierarchicalSpans}
          onSpanClick={onSpanClick}
          selectedSpanId={selectedSpanId}
          revealSpanId={revealSpanId}
          fadedTypes={fadedTypes}
          featuredSpanIds={featuredSpanIds}
          expandedSpanIds={expandedSpanIds}
          setExpandedSpanIds={setExpandedSpanIds}
          renderRow={ctx => <SpanTimelineRow ctx={ctx} />}
        />
      </div>
    </>
  );
}
