import { useMemo, useRef } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createCurrentSpanIdAt, TimelineCurrentSpanContext } from '../hooks/use-timeline-current-span';
import { useTimelineScrub } from '../hooks/use-timeline-scrub';
import type { TimelineRange } from '../hooks/use-timeline-scrub';
import type { UISpan } from '../types';
import { getTimelineEvents } from '../utils/span-snapshot';
import { TIMELINE_COLUMNS, TIMELINE_TICKS, TIMELINE_TRACK_PADDING } from '../utils/span-timeline';
import { getOverallLatency } from '../utils/span-timing';
import { SpanRows } from './span-rows';
import { SpanTimelineRow, TimelineGridlines } from './span-timeline-row';
import { TimelineCursorReadout, TimelineTimeCursor } from './timeline-time-cursor';
import { TraceSpanTreeLoading } from './trace-span-tree';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/** Axis ticks are approximate gridline marks, so two decimals are enough: `250 ms`, `3.74 s`. */
function formatTick(durationMs: number) {
  return durationMs < 1_000 ? `${Math.round(durationMs)} ms` : `${(durationMs / 1_000).toFixed(2)} s`;
}

function flattenSpans(spans: UISpan[]): UISpan[] {
  return spans.flatMap(span => [span, ...flattenSpans(span.spans ?? [])]);
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
 *
 * Inside a `TraceTimeCursorProvider`, the axis also scrubs a time cursor; this component never
 * subscribes to it, only the cursor overlay and the rows do.
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
  const trackRef = useRef<HTMLDivElement>(null);
  const overallLatency = getOverallLatency(hierarchicalSpans);
  const startTime = hierarchicalSpans[0]?.startTime;
  const range = useMemo<TimelineRange>(
    () => ({ startMs: startTime ? Date.parse(startTime) : 0, latency: overallLatency }),
    [startTime, overallLatency],
  );
  const events = useMemo(() => getTimelineEvents(flattenSpans(hierarchicalSpans)), [hierarchicalSpans]);
  const currentSpanIdAt = useMemo(
    () => createCurrentSpanIdAt(hierarchicalSpans, expandedSpanIds),
    [hierarchicalSpans, expandedSpanIds],
  );
  const scrub = useTimelineScrub(trackRef, range);

  if (isLoading) return <TraceSpanTreeLoading />;

  return (
    <>
      {leadingSlot}
      <div className={cn('relative grid content-start gap-y-px overflow-hidden py-1', TIMELINE_COLUMNS)}>
        {/* Header row: cursor readout in the name cell, then the axis on the same track as the bars. */}
        <div>
          <TimelineCursorReadout range={range} />
        </div>
        <div aria-label="Trace time axis" className={cn('flex', TIMELINE_TRACK_PADDING)}>
          <div
            ref={trackRef}
            {...scrub}
            className={cn('relative h-6 flex-1 tabular-nums', scrub.onPointerDown && 'cursor-pointer touch-none')}
          >
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
                  'absolute top-0.5 px-1.5 whitespace-nowrap select-none',
                  index > 0 && index < TIMELINE_TICKS.length - 1 && 'hidden sm:inline',
                )}
              >
                {formatTick(overallLatency * tick)}
              </Txt>
            ))}
          </div>
        </div>
        <TimelineCurrentSpanContext value={currentSpanIdAt}>
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
        </TimelineCurrentSpanContext>
        <TimelineTimeCursor trackRef={trackRef} range={range} events={events} />
      </div>
    </>
  );
}
