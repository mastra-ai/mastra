import type { ReactNode } from 'react';
import type { SpanRowContext } from './span-rows';
import { TimelineNameCol } from './timeline-name-col';

export type SpanTreeRowProps = {
  ctx: SpanRowContext;
  /** Secondary line rendered under the span name (duration, ...). */
  meta?: (ctx: SpanRowContext) => ReactNode;
  /** Second grid cell rendered at the end of the row (timing bar, ...). */
  trailing?: (ctx: SpanRowContext) => ReactNode;
};

/** One hierarchy row: expand toggle + name (+ meta line), then an optional trailing cell. Expects a grid parent with one column per cell. */
export function SpanTreeRow({ ctx, meta, trailing }: SpanTreeRowProps) {
  const { span, spanUI, depth, isRootSpan, isLastChild, isExpanded, isSelected, isFaded, onSpanClick, expansion } = ctx;

  return (
    <>
      <TimelineNameCol
        span={span}
        spanUI={spanUI}
        isFaded={isFaded}
        depth={depth}
        onSpanClick={onSpanClick}
        selectedSpanId={isSelected ? span.id : undefined}
        revealSpanId={ctx.isRevealed ? span.id : undefined}
        isLastChild={isLastChild}
        hasChildren={expansion.hasChildren}
        numOfChildren={expansion.numOfChildren}
        isRootSpan={isRootSpan}
        isExpanded={isExpanded}
        toggleChildren={expansion.toggleChildren}
        meta={meta?.(ctx)}
      />

      {trailing?.(ctx)}
    </>
  );
}
