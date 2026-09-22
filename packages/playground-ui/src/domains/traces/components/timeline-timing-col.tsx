import type { UISpan } from '../types';
import { getSpanTimingLayout } from '../utils/span-timing';
import { SpanTimingHoverCard } from './span-timing-hover-card';
import { HoverCard, HoverCardTrigger } from '@/ds/components/HoverCard';
import { cn } from '@/lib/utils';

type TimelineTimingColProps = {
  span: UISpan;
  selectedSpanId?: string;
  isFaded?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
  color?: string;
  chartWidth?: 'wide' | 'default';
};

export function TimelineTimingCol({
  span,
  selectedSpanId,
  isFaded,
  overallLatency,
  overallStartTime,
  color,
  chartWidth = 'default',
}: TimelineTimingColProps) {
  const { startShiftMs, leftPercent, widthPercent } = getSpanTimingLayout(span, overallLatency, overallStartTime);

  return (
    <HoverCard>
      <HoverCardTrigger
        className={cn(
          'grid h-8 cursor-help grid-cols-[1fr_auto] items-center gap-2 rounded-r-md p-1 pr-2',
          chartWidth === 'wide' ? 'min-w-72' : 'min-w-32',
          '[&:hover>div]:bg-fill',
          {
            'opacity-40 [&:hover]:opacity-70 dark:opacity-30 dark:[&:hover]:opacity-60': isFaded,
            'bg-fill-hover': selectedSpanId === span.id,
          },
        )}
      >
        <div className={cn('w-full rounded-md bg-muted p-1.5')}>
          <div className="relative h-1.5 w-full overflow-hidden rounded-sm">
            <div
              className={cn('absolute top-0 h-1.5 rounded-sm bg-neutral1')}
              style={{
                width: widthPercent ? `${widthPercent}%` : '2px',
                left: `${leftPercent}%`,
                backgroundColor: color,
              }}
            ></div>
          </div>
        </div>

        <div className={cn('flex justify-end text-meta text-muted-foreground')}>
          {(span.latency / 1000).toFixed(3)}&nbsp;s
        </div>
      </HoverCardTrigger>
      <SpanTimingHoverCard span={span} startShiftMs={startShiftMs} />
    </HoverCard>
  );
}
