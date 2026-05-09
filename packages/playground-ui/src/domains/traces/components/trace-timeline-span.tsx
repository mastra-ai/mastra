import { useEffect } from 'react';
import { getSpanDescendantIds } from '../hooks/get-all-span-ids';
import type { UISpan } from '../types';
import { getSpanTypeUi } from './shared';
import { TimelineExpandCol } from './timeline-expand-col';
import { TimelineNameCol } from './timeline-name-col';
import { TimelineTimingCol } from './timeline-timing-col';

type TraceTimelineSpanProps = {
  span: UISpan;
  siblings?: UISpan[];
  depth?: number;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  isLastChild?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
  fadedTypes?: string[];
  searchPhrase?: string;
  featuredSpanIds?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: React.Dispatch<React.SetStateAction<string[]>>;
  chartWidth?: 'wide' | 'default';
};

export function TraceTimelineSpan({
  span,
  siblings,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  isLastChild,
  overallLatency,
  overallStartTime,
  fadedTypes,
  searchPhrase,
  featuredSpanIds,
  expandedSpanIds,
  setExpandedSpanIds,
  chartWidth,
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
    if (!featuredSpanIds || allDescendantIds.length === 0) return;
    if (isExpanded) return;
    const hasFeaturedDescendant = allDescendantIds.some(id => featuredSpanIds.includes(id));
    if (hasFeaturedDescendant && setExpandedSpanIds) {
      setExpandedSpanIds(prev => (!prev || prev.includes(span.id) ? (prev ?? [span.id]) : [...prev, span.id]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredSpanIds, allDescendantIds]);

  const toggleChildren = () => {
    if (!setExpandedSpanIds) return;
    setExpandedSpanIds(prev => {
      if (!prev) return prev;
      return isExpanded ? prev.filter(id => id !== span.id) : [...prev, span.id];
    });
  };

  const expandAllDescendants = () => {
    if (!setExpandedSpanIds) return;
    setExpandedSpanIds(prev => {
      if (!prev) return prev;
      return Array.from(new Set([...prev, span.id, ...allDescendantIds]));
    });
  };

  const collapseAllDescendants = () => {
    if (!setExpandedSpanIds) return;
    setExpandedSpanIds(prev => {
      if (!prev) return prev;
      const idsToRemove = new Set(allDescendantIds);
      return prev.filter(id => !idsToRemove.has(id));
    });
  };

  const collapseAll = () => {
    if (!setExpandedSpanIds) return;
    setExpandedSpanIds(prev => {
      if (!prev) return prev;
      const idsToRemove = new Set([span.id, ...allDescendantIds]);
      return prev.filter(id => !idsToRemove.has(id));
    });
  };

  const allDescendantsExpanded = allDescendantIds.every(id => expandedSpanIds?.includes(id));

  const siblingsWithChildren = (siblings ?? []).filter(s => s.spans && s.spans.length > 0);
  const siblingsWithChildrenCount = siblingsWithChildren.length;
  const siblingsAllExpanded =
    siblingsWithChildrenCount > 0 && siblingsWithChildren.every(s => expandedSpanIds?.includes(s.id));

  const toggleSiblings = () => {
    if (!setExpandedSpanIds || siblingsWithChildrenCount === 0) return;
    setExpandedSpanIds(prev => {
      if (!prev) return prev;
      if (siblingsAllExpanded) {
        const idsToRemove = new Set<string>();
        siblingsWithChildren.forEach(s => {
          idsToRemove.add(s.id);
          getSpanDescendantIds(s).forEach(id => idsToRemove.add(id));
        });
        return prev.filter(id => !idsToRemove.has(id));
      }
      return Array.from(new Set([...prev, ...siblingsWithChildren.map(s => s.id)]));
    });
  };

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
        isRootSpan={isRootSpan}
        toggleChildren={toggleChildren}
        expandAllDescendants={expandAllDescendants}
        collapseAllDescendants={collapseAllDescendants}
        collapseAll={collapseAll}
        totalDescendants={totalDescendants}
        allDescendantsExpanded={allDescendantsExpanded}
        numOfChildren={numOfChildren}
        toggleSiblings={toggleSiblings}
        siblingsAllExpanded={siblingsAllExpanded}
        siblingsWithChildrenCount={siblingsWithChildrenCount}
      />

      <TimelineTimingCol
        span={span}
        selectedSpanId={selectedSpanId}
        isFaded={isFaded}
        overallLatency={overallLatency}
        overallStartTime={overallStartTime}
        color={spanUI?.color}
        chartWidth={chartWidth}
      />

      {hasChildren &&
        isExpanded &&
        span.spans?.map((childSpan: UISpan, idx: number, array: UISpan[]) => {
          const isLast = idx === array.length - 1;

          return (
            <TraceTimelineSpan
              key={childSpan.id}
              span={childSpan}
              siblings={array}
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
              chartWidth={chartWidth}
            />
          );
        })}
    </>
  );
}
