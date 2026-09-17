import type { ReactNode } from 'react';
import type { SpanRowContext } from './span-rows';
import { TimelineExpandCol } from './timeline-expand-col';
import { TimelineNameCol } from './timeline-name-col';

export type SpanTreeRowProps = {
  ctx: SpanRowContext;
  /** Third grid cell rendered at the end of the row (duration text, timing bar, ...). */
  trailing?: (ctx: SpanRowContext) => ReactNode;
};

/** One hierarchy row: name + expansion controls + an optional trailing cell. Expects a 3-column grid parent. */
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
        isRootSpan={isRootSpan}
        isExpanded={isExpanded}
      />

      <TimelineExpandCol
        isSelected={isSelected}
        isFaded={isFaded}
        isExpanded={isExpanded}
        isRootSpan={isRootSpan}
        toggleChildren={expansion.toggleChildren}
        expandAllDescendants={expansion.expandAllDescendants}
        collapseAllDescendants={expansion.collapseAllDescendants}
        collapseAll={expansion.collapseAll}
        totalDescendants={expansion.totalDescendants}
        allDescendantsExpanded={expansion.allDescendantsExpanded}
        numOfChildren={expansion.numOfChildren}
        toggleSiblings={expansion.toggleSiblings}
        siblingsAllExpanded={expansion.siblingsAllExpanded}
        siblingsWithChildrenCount={expansion.siblingsWithChildrenCount}
      />

      {trailing?.(ctx)}
    </>
  );
}
