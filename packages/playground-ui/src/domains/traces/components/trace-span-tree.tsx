import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UISpan } from '../types';
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
  /** Optional end-of-row cell. By default rows have no trailing cell; the duration is shown under the span name. */
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

const durationMeta = (ctx: SpanRowContext) => <>{(ctx.span.latency / 1000).toFixed(3)}&nbsp;s</>;

/** Hierarchical span tree: expand toggle, name and duration per row, plus an optional trailing cell. */
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
  renderTrailing,
}: TraceSpanTreeProps) {
  if (isLoading) return <TraceSpanTreeLoading />;

  return (
    <>
      {leadingSlot}
      <SpanTypeLegend spans={hierarchicalSpans} />
      <div
        className={cn('grid content-start items-start gap-y-px overflow-hidden py-1', {
          'grid-cols-[minmax(0,1fr)]': !renderTrailing,
          'grid-cols-[minmax(0,1fr)_auto]': !!renderTrailing,
        })}
      >
        <SpanRows
          spans={hierarchicalSpans}
          onSpanClick={onSpanClick}
          selectedSpanId={selectedSpanId}
          revealSpanId={revealSpanId}
          fadedTypes={fadedTypes}
          featuredSpanIds={featuredSpanIds}
          expandedSpanIds={expandedSpanIds}
          setExpandedSpanIds={setExpandedSpanIds}
          renderRow={ctx => <SpanTreeRow ctx={ctx} meta={durationMeta} trailing={renderTrailing} />}
        />
      </div>
    </>
  );
}
