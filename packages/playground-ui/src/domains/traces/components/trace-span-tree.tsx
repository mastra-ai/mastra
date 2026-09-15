import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UISpan } from '../types';
import { SpanDurationCol } from './span-duration-col';
import type { SpanRowContext } from './span-rows';
import { SpanRows } from './span-rows';
import { SpanTreeRow } from './span-tree-row';
import { SpanTypeLegend } from './span-type-legend';
import { Spinner } from '@/ds/components/Spinner';
import { cn } from '@/lib/utils';

export type TraceSpanTreeProps = {
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
  /** End-of-row cell. Defaults to the span duration as `X.XXX s`. */
  renderTrailing?: (ctx: SpanRowContext) => ReactNode;
};

export function TraceSpanTreeLoading() {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 rounded-md bg-surface3/50 p-3 text-ui-sm text-neutral3',
        '[&_svg]:size-[1.25em] [&_svg]:opacity-50',
      )}
    >
      <Spinner /> Loading Trace Timeline ...
    </div>
  );
}

const defaultTrailing = (ctx: SpanRowContext) => (
  <SpanDurationCol span={ctx.span} isSelected={ctx.isSelected} isFaded={ctx.isFaded} />
);

/** Hierarchical span tree: name, expansion controls and a trailing cell per row. */
export function TraceSpanTree({
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
}: TraceSpanTreeProps) {
  if (isLoading) return <TraceSpanTreeLoading />;

  return (
    <>
      {leadingSlot}
      <SpanTypeLegend spans={hierarchicalSpans} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] content-start items-start gap-y-px overflow-hidden py-1">
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
