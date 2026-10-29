import { ChevronDownIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useIsCurrentTimelineSpan } from '../hooks/use-timeline-current-span';
import { useTraceTimeCursor } from '../hooks/use-trace-time-cursor';
import { splitSpanName, TIMELINE_TICKS, TIMELINE_TRACK_PADDING } from '../utils/span-timeline';
import { getSpanTimingLayout } from '../utils/span-timing';
import type { SpanRowContext } from './span-rows';
import { SpanTimingHoverCard } from './span-timing-hover-card';
import { SPAN_TREE_INDENT, SPAN_TREE_LINE, SPAN_TREE_PAD_Y, SpanTreeRail } from './span-tree-rail';
import { SpanTypeBadge } from './span-type-badge';
import { Badge } from '@/ds/components/Badge';
import { HoverCard, HoverCardTrigger } from '@/ds/components/HoverCard';
import { SegmentedName } from '@/ds/components/SegmentedName';
import { Txt } from '@/ds/components/Txt/Txt';
import { focusRing, focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/duration';

/** Vertical gridline per tick; runs 1px past the row to bridge the gap to the next one. */
export function TimelineGridlines() {
  return TIMELINE_TICKS.map(tick => (
    <span
      key={tick}
      aria-hidden
      className="absolute top-0 -bottom-px w-px bg-border"
      style={{ left: `${tick * 100}%` }}
    />
  ));
}

export type SpanTimelineRowProps = {
  ctx: SpanRowContext;
};

/**
 * One row of `TraceSpanTimeline`: the span tree's name cell on a single line, then a bar on the
 * shared trace time axis with the duration printed right after it. The row spans both grid columns
 * (subgrid) so hover and selection cover the name and the bar together.
 */
export function SpanTimelineRow({ ctx }: SpanTimelineRowProps) {
  const {
    span,
    spanUI,
    isRootSpan,
    isLastChild,
    guides,
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
  const startMs = Date.parse(span.startTime);
  // Spans with no end yet are live: they keep running whatever the cursor time.
  const endMs = span.endTime ? startMs + span.latency : Infinity;
  const isStarted = useTraceTimeCursor(t => t == null || t >= startMs);
  // Elapsed ms at the cursor (`null` without one). Constant once the span has ended, so only the rows
  // running at the cursor re-render while it moves.
  const elapsedMs = useTraceTimeCursor(t => (t == null ? null : Math.max(0, Math.min(t, endMs) - startMs)));
  const isCurrent = useIsCurrentTimelineSpan(span.id);

  // Follow the cursor: keep the lowest span it crosses on screen while scrubbing.
  useEffect(() => {
    if (!isCurrent) return;
    rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [isCurrent]);

  // Nested rows mount late, once expansion opens, so scroll on mount as well as on change.
  useEffect(() => {
    if (!shouldScrollIntoView) return;
    // A highlighted span is centered so it never sits at the panel's edge; a clicked one only moves if hidden.
    rowRef.current?.scrollIntoView({ block: isRevealed ? 'center' : 'nearest', behavior: 'smooth' });
  }, [shouldScrollIntoView, isRevealed]);

  // Spans start after their parent, so hiding a row also hides its not-yet-started descendants.
  if (!isStarted) return null;

  const {
    startShiftMs,
    leftPercent,
    widthPercent: fullWidthPercent,
  } = getSpanTimingLayout(span, overallLatency, overallStartTime);
  const isRunning = elapsedMs != null && elapsedMs < endMs - startMs;
  const widthPercent = isRunning ? (overallLatency ? (elapsedMs / overallLatency) * 100 : 0) : fullWidthPercent;
  const toggleLabel = isExpanded
    ? `Collapse children (${expansion.numOfChildren})`
    : `Expand children (${expansion.numOfChildren})`;
  const depth = isRootSpan ? 0 : guides.length + 1;
  const [kind, value] = splitSpanName(span.name);
  const color = spanUI?.color;

  return (
    <div
      ref={rowRef}
      aria-label={`View details for span ${span.name}`}
      aria-selected={isSelected}
      // The whole row selects the span; the name button is the keyboard target and its click bubbles here.
      onClick={() => onSpanClick?.(span.id)}
      className={cn('col-span-2 grid cursor-pointer grid-cols-subgrid items-stretch rounded-md hover:bg-fill-subtle', {
        'opacity-40 dark:opacity-30 [&:hover]:opacity-70 dark:[&:hover]:opacity-60': isFaded,
        'bg-fill-hover': isSelected,
      })}
    >
      <div className="relative flex min-w-0 items-stretch pl-1">
        <SpanTreeRail
          depth={depth}
          guides={guides}
          isLastChild={isLastChild}
          hasStem={expansion.hasChildren && isExpanded}
        />

        <div
          className="flex min-w-0 flex-1 items-center"
          style={{ paddingLeft: depth * SPAN_TREE_INDENT, paddingBlock: SPAN_TREE_PAD_Y }}
        >
          <span
            className="flex shrink-0 items-center justify-center"
            style={{ width: SPAN_TREE_INDENT, height: SPAN_TREE_LINE }}
          >
            <SpanTypeBadge type={span.type} spanUI={spanUI} />
          </span>

          <button
            type="button"
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer rounded-md px-2 text-left text-foreground',
              focusRingInset,
            )}
          >
            <Txt
              as="span"
              variant="body-sm"
              data-highlight={span.matchedInPayloadOnly ? undefined : ''}
              data-highlight-indirect={span.matchedInPayloadOnly ? '' : undefined}
              title={span.matchedInPayloadOnly ? 'Matches your search in this span’s details' : undefined}
              className="min-w-0 truncate font-[450]"
            >
              {kind ? <SegmentedName parts={[kind, value]} /> : span.name}
            </Txt>
          </button>

          {span.signalLabel && (
            <Badge size="xs" title={span.signalLabel} className="mr-1 max-w-1/2 min-w-0 shrink">
              <span className="truncate">{span.signalLabel}</span>
            </Badge>
          )}
        </div>

        {/* Slot is always present so names stay aligned whether or not the span has children. */}
        <div className="flex w-8 shrink-0 items-center justify-center pr-1">
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
                'flex size-5 cursor-pointer items-center justify-center rounded-md',
                'hover:bg-fill [&:hover>svg]:opacity-100 [&>svg]:size-4 [&>svg]:opacity-50',
                focusRing,
              )}
            >
              {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </button>
          )}
        </div>
      </div>

      <HoverCard>
        <HoverCardTrigger render={<div />} className={cn('flex min-w-0 cursor-help', TIMELINE_TRACK_PADDING)}>
          <div className="relative flex-1">
            <TimelineGridlines />
            <div
              data-testid="span-timeline-bar"
              data-running={isRunning || undefined}
              className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm"
              style={{
                left: `${leftPercent}%`,
                width: widthPercent ? `${widthPercent}%` : '2px',
                // A running bar fades out toward the cursor: it has no end yet.
                background: isRunning
                  ? `linear-gradient(to right, color-mix(in oklab, ${color} 40%, transparent), color-mix(in oklab, ${color} 5%, transparent))`
                  : `color-mix(in oklab, ${color} 40%, transparent)`,
                boxShadow: isRunning
                  ? `inset 1px 0 0 0 color-mix(in oklab, ${color} 70%, transparent)`
                  : `inset 0 0 0 1px color-mix(in oklab, ${color} 70%, transparent)`,
              }}
            />
            <Txt
              as="span"
              variant="body-sm"
              tone="muted"
              className="absolute top-1/2 ml-1.5 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap tabular-nums"
              style={{ left: `${leftPercent + widthPercent}%` }}
            >
              {isRunning && <Loader2Icon aria-label="Running" className="size-3 motion-safe:animate-spin" />}
              {formatDuration(isRunning ? elapsedMs : span.latency)}
            </Txt>
          </div>
        </HoverCardTrigger>
        <SpanTimingHoverCard span={span} startShiftMs={startShiftMs} />
      </HoverCard>
    </div>
  );
}
