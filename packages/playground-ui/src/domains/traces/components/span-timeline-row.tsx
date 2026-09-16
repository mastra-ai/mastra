import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { getSpanTimingLayout } from '../utils/span-timing';
import type { SpanRowContext } from './span-rows';
import { SpanTimingHoverCard } from './span-timing-hover-card';
import { TimelineStructureSign } from './timeline-structure-sign';
import { HoverCard, HoverCardTrigger } from '@/ds/components/HoverCard';
import { cn } from '@/lib/utils';

export type SpanTimelineRowProps = {
  ctx: SpanRowContext;
};

function formatDuration(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/**
 * One row of `TraceSpanTimeline`: compact single-line name cell plus a bar on the
 * shared trace time axis. The row spans both grid columns (subgrid) so hover and
 * selection cover the name and the bar together.
 */
export function SpanTimelineRow({ ctx }: SpanTimelineRowProps) {
  const {
    span,
    spanUI,
    depth,
    isRootSpan,
    isLastChild,
    isExpanded,
    isSelected,
    isFaded,
    isRevealed,
    overallLatency,
    overallStartTime,
    onSpanClick,
    expansion,
  } = ctx;
  const rowRef = useRef<HTMLDivElement>(null);
  const shouldScrollIntoView = isSelected || isRevealed;

  // Nested rows mount late, once expansion opens, so scroll on mount as well as on change.
  useEffect(() => {
    if (!shouldScrollIntoView) return;
    rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [shouldScrollIntoView]);

  const { startShiftMs, leftPercent, widthPercent } = getSpanTimingLayout(span, overallLatency, overallStartTime);
  const toggleLabel = isExpanded
    ? `Collapse children (${expansion.numOfChildren})`
    : `Expand children (${expansion.numOfChildren})`;

  return (
    <div
      ref={rowRef}
      aria-label={`View details for span ${span.name}`}
      // The whole row selects the span; the name button is the keyboard target and its click bubbles here.
      onClick={() => onSpanClick?.(span.id)}
      className={cn(
        'col-span-2 grid h-7 cursor-pointer grid-cols-subgrid items-stretch rounded-md opacity-80 transition-colors hover:bg-surface4',
        {
          'opacity-40 [&:hover]:opacity-70 dark:opacity-30 dark:[&:hover]:opacity-60': isFaded,
          'bg-surface4': isSelected,
        },
      )}
    >
      <div className="flex min-w-0 items-stretch" style={{ paddingLeft: `${depth}rem` }}>
        {!isRootSpan && <TimelineStructureSign isLastChild={isLastChild} />}

        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-ui-sm text-neutral6',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:ring-inset',
          )}
        >
          {spanUI?.color && (
            <span
              aria-hidden
              title={spanUI.label}
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: spanUI.color }}
            />
          )}
          <span
            data-highlight={span.matchedInPayloadOnly ? undefined : ''}
            data-highlight-indirect={span.matchedInPayloadOnly ? '' : undefined}
            title={span.matchedInPayloadOnly ? 'Matches your search in this span’s details' : undefined}
            className="min-w-0 truncate"
          >
            {span.name}
          </span>
        </button>

        {/* Slot is always present so names stay aligned whether or not the span has children. */}
        <div className="flex w-7 shrink-0 items-center justify-center">
          {expansion.hasChildren && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                expansion.toggleChildren();
              }}
              aria-label={toggleLabel}
              aria-expanded={isExpanded}
              className={cn(
                'flex size-5 cursor-pointer items-center justify-center rounded-md transition-colors',
                'hover:bg-surface5 [&:hover>svg]:opacity-100 [&>svg]:size-4 [&>svg]:opacity-50',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent1',
              )}
            >
              {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </button>
          )}
        </div>
      </div>

      <HoverCard>
        <HoverCardTrigger
          render={<div />}
          className="grid min-w-0 cursor-help grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2"
        >
          <div className="bg-surface5/40 relative h-4 w-full rounded-sm">
            <div
              data-testid="span-timeline-bar"
              className="absolute inset-y-0 rounded-sm"
              style={{
                left: `${leftPercent}%`,
                width: widthPercent ? `${widthPercent}%` : '2px',
                backgroundColor: spanUI?.color,
              }}
            />
          </div>
          <div className="text-ui-xs text-neutral3 w-12 text-right tabular-nums">{formatDuration(span.latency)}</div>
        </HoverCardTrigger>
        <SpanTimingHoverCard span={span} startShiftMs={startShiftMs} />
      </HoverCard>
    </div>
  );
}
