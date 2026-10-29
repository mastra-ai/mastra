import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UISpan } from '../types';
import { TIMELINE_TICKS, TIMELINE_TRACK_PADDING } from '../utils/span-timeline';
import { getOverallLatency } from '../utils/span-timing';
import { SpanRows } from './span-rows';
import { SpanTimelineRow, TimelineGridlines } from './span-timeline-row';
import { TraceSpanTreeLoading } from './trace-span-tree';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/** Axis ticks are approximate gridline marks, so two decimals are enough: `250 ms`, `3.74 s`. */
function formatTick(durationMs: number) {
  return durationMs < 1_000 ? `${Math.round(durationMs)} ms` : `${(durationMs / 1_000).toFixed(2)} s`;
}

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
  /** Rendered full-width above the span rows. */
  leadingSlot?: ReactNode;
};

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

  const overallLatency = getOverallLatency(hierarchicalSpans);

  return (
    <>
      {leadingSlot}
      <div className="grid grid-cols-[minmax(12rem,2fr)_minmax(12rem,3fr)] content-start gap-y-px overflow-hidden py-1">
        {/* Header row: empty name cell, then the axis on the same track as the bars. */}
        <div />
        <div aria-label="Trace time axis" className={cn('flex', TIMELINE_TRACK_PADDING)}>
          <div className="relative h-6 flex-1 tabular-nums">
            <TimelineGridlines />
            {TIMELINE_TICKS.map((tick, index) => (
              <Txt
                tone="muted"
                as="span"
                variant="meta"
                key={tick}
                style={{ left: `${tick * 100}%` }}
                // Each label sits just after its gridline; the last one lands in the track's right padding.
                className={cn(
                  'absolute top-0.5 px-1.5 whitespace-nowrap',
                  index > 0 && index < TIMELINE_TICKS.length - 1 && 'hidden sm:inline',
                )}
              >
                {formatTick(overallLatency * tick)}
              </Txt>
            ))}
          </div>
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
