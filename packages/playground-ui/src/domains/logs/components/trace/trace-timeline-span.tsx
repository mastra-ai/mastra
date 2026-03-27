import { useEffect } from 'react';
import type { UISpan } from './types';
import { getSpanDescendantIds } from './get-descendant-ids';
import { getSpanTypeUi } from './shared';
import { TimelineExpandCol } from './timeline-expand-col';
import { TimelineNameCol } from './timeline-name-col';
import { TimelineTimingCol } from './timeline-timing-col';

type TraceTimelineSpanProps = {
  span: UISpan;
  depth?: number;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  isLastChild?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
  overallEndTime?: string;
  fadedTypes?: string[];
  searchPhrase?: string;
  featuredSpanIds?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: React.Dispatch<React.SetStateAction<string[]>>;
};

export function TraceTimelineSpan({
  span,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  isLastChild,
  overallLatency,
  overallStartTime,
  overallEndTime,
  fadedTypes,
  searchPhrase,
  featuredSpanIds,
  expandedSpanIds,
  setExpandedSpanIds,
}: TraceTimelineSpanProps) {
  const hasChildren = span.spans && span.spans.length > 0;
  const numOfChildren = span.spans ? span.spans.length : 0;
  const allDescendantIds = getSpanDescendantIds(span);
  const totalDescendants = allDescendantIds.length;
  const isRootSpan = depth === 0;
  const spanUI = getSpanTypeUi(span?.type);
  const isExpanded = expandedSpanIds ? expandedSpanIds.includes(span.id) : false;
  const isFadedBySearch = featuredSpanIds && featuredSpanIds.length > 0 ? !featuredSpanIds.includes(span.id) : false;
  const isFadedByType = fadedTypes && fadedTypes.length > 0 ? fadedTypes.includes(spanUI?.typePrefix || '') : false;
  const isFaded = isFadedByType || isFadedBySearch;

  useEffect(() => {
    if (!featuredSpanIds || !span.spans || span.spans.length === 0) return;
    const hasFeaturedChildren = span.spans.some(childSpan => featuredSpanIds.includes(childSpan.id));
    if (!isExpanded && hasFeaturedChildren) {
      toggleChildren();
    }
  }, [featuredSpanIds, span.spans, span.id, isExpanded, setExpandedSpanIds, expandedSpanIds]);

  const toggleChildren = () => {
    if (!setExpandedSpanIds || !expandedSpanIds) return;

    if (isExpanded) {
      const idsToRemove = [span.id, ...allDescendantIds];
      setExpandedSpanIds(expandedSpanIds.filter(id => !idsToRemove.includes(id)));
    } else {
      setExpandedSpanIds([...expandedSpanIds, span.id]);
    }
  };

  const expandAllDescendants = () => {
    if (!setExpandedSpanIds || !expandedSpanIds) return;

    setExpandedSpanIds([...expandedSpanIds, span.id, ...allDescendantIds]);
  };

  const allDescendantsExpanded = allDescendantIds.every(id => expandedSpanIds?.includes(id));

  return (
    <>
      <TimelineNameCol
        span={span}
        spanUI={spanUI}
        isFaded={isFaded}
        depth={depth}
        onSpanClick={onSpanClick}
        selectedSpanId={selectedSpanId}
        isLastChild={isLastChild}
        hasChildren={hasChildren}
        isRootSpan={isRootSpan}
        isExpanded={isExpanded}
      />

      <TimelineExpandCol
        isSelected={selectedSpanId === span.id}
        isFaded={isFaded}
        isExpanded={isExpanded}
        toggleChildren={toggleChildren}
        expandAllDescendants={expandAllDescendants}
        expandedSpanIds={expandedSpanIds}
        totalDescendants={totalDescendants}
        allDescendantsExpanded={allDescendantsExpanded}
        numOfChildren={numOfChildren}
      />

      <TimelineTimingCol
        span={span}
        selectedSpanId={selectedSpanId}
        isFaded={isFaded}
        overallLatency={overallLatency}
        overallStartTime={overallStartTime}
        overallEndTime={overallEndTime}
        color={spanUI?.color}
      />

      {hasChildren &&
        isExpanded &&
        span.spans?.map((childSpan: UISpan, idx: number, array: UISpan[]) => {
          const isLast = idx === array.length - 1;

          return (
            <TraceTimelineSpan
              key={childSpan.id}
              span={childSpan}
              depth={depth + 1}
              onSpanClick={onSpanClick}
              selectedSpanId={selectedSpanId}
              isLastChild={isLast}
              overallLatency={overallLatency}
              overallStartTime={overallStartTime}
              fadedTypes={fadedTypes}
              searchPhrase={searchPhrase}
              expandedSpanIds={expandedSpanIds}
              setExpandedSpanIds={setExpandedSpanIds}
              featuredSpanIds={featuredSpanIds}
            />
          );
        })}
    </>
  );
}
