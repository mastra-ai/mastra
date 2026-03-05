import { type ExperimentUISpan } from '../types';
import { useEffect } from 'react';
import { getExperimentSpanTypeUi } from './experiment-trace-shared';
import { getSpanDescendantIds } from '../utils/get-span-descendant-ids';
import { ExperimentTraceTimelineNameCol } from './experiment-trace-timeline-name-col';
import { ExperimentTraceTimelineExpandCol } from './experiment-trace-timeline-expand-col';
import { ExperimentTraceTimelineTimingCol } from './experiment-trace-timeline-timing-col';

type ExperimentTraceTimelineSpanProps = {
  span: ExperimentUISpan;
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

export function ExperimentTraceTimelineSpan({
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
}: ExperimentTraceTimelineSpanProps) {
  const hasChildren = span.spans && span.spans.length > 0;
  const numOfChildren = span.spans ? span.spans.length : 0;
  const allDescendantIds = getSpanDescendantIds(span);
  const totalDescendants = allDescendantIds.length;
  const isRootSpan = depth === 0;
  const spanUI = getExperimentSpanTypeUi(span?.type);
  const isExpanded = expandedSpanIds ? expandedSpanIds.includes(span.id) : false;
  const isFadedBySearch = featuredSpanIds && featuredSpanIds.length > 0 ? !featuredSpanIds.includes(span.id) : false;
  const isFadedByType = fadedTypes && fadedTypes.length > 0 ? fadedTypes.includes(spanUI?.typePrefix || '') : false;
  const isFaded = isFadedByType || isFadedBySearch;

  useEffect(() => {
    isRootSpan && setExpandedSpanIds?.([span.id]);
  }, [isRootSpan, span.id, setExpandedSpanIds]);

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
      <ExperimentTraceTimelineNameCol
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
        toggleChildren={toggleChildren}
      />
      <ExperimentTraceTimelineExpandCol
        isSelected={selectedSpanId === span.id}
        isFaded={isFaded}
        isExpanded={isExpanded}
        toggleChildren={toggleChildren}
        expandAllDescendants={expandAllDescendants}
        totalDescendants={totalDescendants}
        allDescendantsExpanded={allDescendantsExpanded}
        numOfChildren={numOfChildren}
      />

      {/* <ExperimentTraceTimelineNameCol
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
        toggleChildren={toggleChildren}
      />

      <ExperimentTraceTimelineExpandCol
        isSelected={selectedSpanId === span.id}
        isFaded={isFaded}
        isExpanded={isExpanded}
        toggleChildren={toggleChildren}
        expandAllDescendants={expandAllDescendants}
        totalDescendants={totalDescendants}
        allDescendantsExpanded={allDescendantsExpanded}
        numOfChildren={numOfChildren}
      />

      <ExperimentTraceTimelineTimingCol
        span={span}
        selectedSpanId={selectedSpanId}
        isFaded={isFaded}
        overallLatency={overallLatency}
        overallStartTime={overallStartTime}
        overallEndTime={overallEndTime}
        color={spanUI?.color}
      /> */}

      {hasChildren &&
        isExpanded &&
        span.spans?.map((childSpan: ExperimentUISpan, idx: number, array: ExperimentUISpan[]) => {
          const isLastChild = idx === array.length - 1;

          return (
            <ExperimentTraceTimelineSpan
              key={childSpan.id}
              span={childSpan}
              depth={depth + 1}
              onSpanClick={onSpanClick}
              selectedSpanId={selectedSpanId}
              isLastChild={isLastChild}
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
