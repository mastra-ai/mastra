import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UISpan } from '../types';
import type { SpanRowContext } from './span-rows';
import { SpanRows } from './span-rows';
import { SpanTimelineCol } from './span-timeline-col';
import { SpanTreeRow } from './span-tree-row';
import { SpanTypeLegend } from './span-type-legend';
import { TraceSpanTreeLoading } from './trace-span-tree';

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
  /** End-of-row cell. Defaults to the span bar on the shared time axis (`SpanTimelineCol`). */
  renderTrailing?: (ctx: SpanRowContext) => ReactNode;
};

const TICKS = [0, 0.25, 0.5, 0.75, 1];

function formatTick(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

const defaultTrailing = (ctx: SpanRowContext) => <SpanTimelineCol ctx={ctx} />;

/** Same hierarchy as `TraceSpanTree` (name + expansion controls) with a trailing column of bars on a shared time axis. */
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
  renderTrailing = defaultTrailing,
}: TraceSpanTimelineProps) {
  if (isLoading) return <TraceSpanTreeLoading />;

  const overallLatency = hierarchicalSpans[0]?.latency || 0;

  return (
    <>
      {leadingSlot && <div className="pt-1.5">{leadingSlot}</div>}
      <SpanTypeLegend spans={hierarchicalSpans} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(12rem,1fr)] content-start items-start gap-y-px overflow-hidden py-1">
        <div
          aria-label="Trace time axis"
          className="text-ui-xs text-neutral3 col-start-3 flex justify-between px-1 pr-2 pb-1"
        >
          {TICKS.map(tick => (
            <span key={tick}>{formatTick(overallLatency * tick)}</span>
          ))}
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
          renderRow={ctx => <SpanTreeRow ctx={ctx} trailing={renderTrailing} />}
        />
      </div>
    </>
  );
}
