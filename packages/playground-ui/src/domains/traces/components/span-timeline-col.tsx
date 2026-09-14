import { getSpanTimingLayout } from '../utils/span-timing';
import type { SpanRowContext } from './span-rows';
import { SpanTimingHoverCard } from './span-timing-hover-card';
import { HoverCard, HoverCardTrigger } from '@/ds/components/HoverCard';
import { cn } from '@/lib/utils';

export type SpanTimelineColProps = {
  ctx: SpanRowContext;
};

/** Trailing cell of a `SpanTreeRow`: a bar positioned on the shared trace time axis plus the duration. */
export function SpanTimelineCol({ ctx }: SpanTimelineColProps) {
  const { span, spanUI, isSelected, isFaded, overallLatency, overallStartTime } = ctx;
  const { startShiftMs, leftPercent, widthPercent } = getSpanTimingLayout(span, overallLatency, overallStartTime);

  return (
    <HoverCard>
      <HoverCardTrigger
        render={<div />}
        className={cn('grid h-8 min-w-48 cursor-help grid-cols-[1fr_auto] items-center gap-2 rounded-r-md p-1 pr-2', {
          'opacity-40 [&:hover]:opacity-70 dark:opacity-30 dark:[&:hover]:opacity-60': isFaded,
          'bg-surface4': isSelected,
        })}
      >
        <div className="relative h-5 w-full rounded-sm bg-surface4">
          <div
            data-testid="span-timeline-bar"
            className="absolute top-0 h-5 rounded-sm"
            style={{
              left: `${leftPercent}%`,
              width: widthPercent ? `${widthPercent}%` : '2px',
              backgroundColor: spanUI?.color,
            }}
          />
        </div>
        <div className="text-ui-xs text-neutral3">{(span.latency / 1000).toFixed(3)}&nbsp;s</div>
      </HoverCardTrigger>
      <SpanTimingHoverCard span={span} startShiftMs={startShiftMs} />
    </HoverCard>
  );
}
