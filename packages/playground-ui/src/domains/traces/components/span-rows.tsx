import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Fragment, useEffect } from 'react';
import { getSpanDescendantIds } from '../hooks/get-all-span-ids';
import type { UISpan, UISpanStyle } from '../types';
import { getSpanTypeUi } from './shared';

export type SpanRowExpansion = {
  hasChildren: boolean;
  numOfChildren: number;
  toggleChildren: () => void;
};

export type SpanRowContext = {
  span: UISpan;
  spanUI: UISpanStyle | null | undefined;
  depth: number;
  isRootSpan: boolean;
  isLastChild: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isFaded: boolean;
  isRevealed: boolean;
  overallLatency: number;
  overallStartTime: string;
  onSpanClick?: (id: string) => void;
  expansion: SpanRowExpansion;
};

type SharedRowProps = {
  renderRow: (ctx: SpanRowContext) => ReactNode;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  /** Row flagged as revealed once mounted (ancestors auto-expand when the span is featured). */
  revealSpanId?: string;
  fadedTypes?: string[];
  featuredSpanIds?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: Dispatch<SetStateAction<string[]>>;
};

export type SpanRowsProps = SharedRowProps & {
  spans: UISpan[];
};

/**
 * Headless depth-first walker over a span hierarchy. Owns the expansion / fade /
 * reveal state of each row and delegates all markup to `renderRow`. Children are
 * only mounted while their parent is expanded.
 */
export function SpanRows({ spans, ...rowProps }: SpanRowsProps) {
  const overallLatency = spans[0]?.latency || 0;
  const overallStartTime = spans[0]?.startTime || '';

  return (
    <>
      {spans.map((span, idx) => (
        <SpanRow
          key={span.id}
          span={span}
          depth={0}
          isLastChild={idx === spans.length - 1}
          overallLatency={overallLatency}
          overallStartTime={overallStartTime}
          {...rowProps}
        />
      ))}
    </>
  );
}

type SpanRowProps = SharedRowProps & {
  span: UISpan;
  depth: number;
  isLastChild: boolean;
  overallLatency: number;
  overallStartTime: string;
};

function SpanRow({
  span,
  depth,
  isLastChild,
  overallLatency,
  overallStartTime,
  renderRow,
  onSpanClick,
  selectedSpanId,
  revealSpanId,
  fadedTypes,
  featuredSpanIds,
  expandedSpanIds,
  setExpandedSpanIds,
}: SpanRowProps) {
  const hasChildren = Boolean(span.spans && span.spans.length > 0);
  const numOfChildren = span.spans ? span.spans.length : 0;
  const allDescendantIds = getSpanDescendantIds(span);
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

  const ctx: SpanRowContext = {
    span,
    spanUI,
    depth,
    isRootSpan,
    isLastChild,
    isExpanded,
    isSelected: selectedSpanId === span.id,
    isFaded,
    isRevealed: revealSpanId === span.id,
    overallLatency,
    overallStartTime,
    onSpanClick,
    expansion: {
      hasChildren,
      numOfChildren,
      toggleChildren,
    },
  };

  return (
    <Fragment>
      {renderRow(ctx)}
      {hasChildren &&
        isExpanded &&
        span.spans?.map((childSpan, idx, array) => (
          <SpanRow
            key={childSpan.id}
            span={childSpan}
            depth={depth + 1}
            isLastChild={idx === array.length - 1}
            overallLatency={overallLatency}
            overallStartTime={overallStartTime}
            renderRow={renderRow}
            onSpanClick={onSpanClick}
            selectedSpanId={selectedSpanId}
            revealSpanId={revealSpanId}
            fadedTypes={fadedTypes}
            featuredSpanIds={featuredSpanIds}
            expandedSpanIds={expandedSpanIds}
            setExpandedSpanIds={setExpandedSpanIds}
          />
        ))}
    </Fragment>
  );
}
