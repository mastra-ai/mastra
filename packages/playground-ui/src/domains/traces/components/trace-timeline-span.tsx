import type { Dispatch, SetStateAction } from 'react';
import type { UISpan } from '../types';
import { SpanRows } from './span-rows';
import { SpanTreeRow } from './span-tree-row';
import { TimelineTimingCol } from './timeline-timing-col';

type TraceTimelineSpanProps = {
  span: UISpan;
  siblings?: UISpan[];
  depth?: number;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  revealSpanId?: string;
  isLastChild?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
  fadedTypes?: string[];
  featuredSpanIds?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: Dispatch<SetStateAction<string[]>>;
  chartWidth?: 'wide' | 'default';
};

/**
 * @deprecated Use `SpanRows` with `SpanTreeRow` / `SpanTimelineCol`.
 * Renders a single root subtree with the legacy timing bar as the trailing cell.
 */
export function TraceTimelineSpan({
  span,
  onSpanClick,
  selectedSpanId,
  revealSpanId,
  fadedTypes,
  featuredSpanIds,
  expandedSpanIds,
  setExpandedSpanIds,
  chartWidth,
}: TraceTimelineSpanProps) {
  return (
    <SpanRows
      spans={[span]}
      onSpanClick={onSpanClick}
      selectedSpanId={selectedSpanId}
      revealSpanId={revealSpanId}
      fadedTypes={fadedTypes}
      featuredSpanIds={featuredSpanIds}
      expandedSpanIds={expandedSpanIds}
      setExpandedSpanIds={setExpandedSpanIds}
      renderRow={ctx => (
        <SpanTreeRow
          ctx={ctx}
          trailing={({ span, isSelected, isFaded, overallLatency, overallStartTime, spanUI }) => (
            <TimelineTimingCol
              span={span}
              selectedSpanId={isSelected ? span.id : undefined}
              isFaded={isFaded}
              overallLatency={overallLatency}
              overallStartTime={overallStartTime}
              color={spanUI?.color}
              chartWidth={chartWidth}
            />
          )}
        />
      )}
    />
  );
}
