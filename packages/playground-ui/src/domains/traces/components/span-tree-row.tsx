import type { ReactNode } from 'react';
import type { SpanRowContext } from './span-rows';
import { TimelineNameCol } from './timeline-name-col';

export type SpanTreeRowProps = {
  ctx: SpanRowContext;
  /** Second grid cell rendered at the end of the row (duration text, timing bar, ...). */
  trailing?: (ctx: SpanRowContext) => ReactNode;
};

/** One hierarchy row: expand toggle + name, then an optional trailing cell. Expects a 2-column grid parent. */
export function SpanTreeRow({ ctx, trailing }: SpanTreeRowProps) {
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
      />

      {trailing?.(ctx)}
    </>
  );
}
