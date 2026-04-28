import * as HoverCard from '@radix-ui/react-hover-card';
import { format } from 'date-fns/format';
import type { UISpan } from '../types';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
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
  const percentageSpanLatency = overallLatency ? Math.ceil((span.latency / overallLatency) * 100) : 0;
  const overallStartTimeDate = overallStartTime ? new Date(overallStartTime) : null;
  const spanStartTimeDate = span.startTime ? new Date(span.startTime) : null;
  const spanStartTimeShift =
    spanStartTimeDate && overallStartTimeDate ? spanStartTimeDate.getTime() - overallStartTimeDate.getTime() : 0;

  const percentageSpanStartTime = overallLatency && Math.floor((spanStartTimeShift / overallLatency) * 100);

  return (
    <HoverCard.Root openDelay={250}>
      <HoverCard.Trigger
        className={cn(
          'h-8 p-1 grid grid-cols-[1fr_auto] gap-2 items-center cursor-help pr-2 rounded-r-md',
          chartWidth === 'wide' ? 'min-w-72' : 'min-w-32',
          '[&:hover>div]:bg-surface5',
          {
            'opacity-30 [&:hover]:opacity-60': isFaded,
            'bg-surface4': selectedSpanId === span.id,
          },
        )}
      >
        <div className={cn('w-full p-1.5 rounded-md bg-surface4 transition-colors duration-1000')}>
          <div className="relative w-full h-1.5 rounded-sm overflow-hidden">
            <div
              className={cn('bg-neutral1 absolute rounded-sm h-1.5 top-0')}
              style={{
                width: percentageSpanLatency ? `${percentageSpanLatency}%` : '2px',
                left: `${percentageSpanStartTime || 0}%`,
                backgroundColor: color,
              }}
            ></div>
          </div>
        </div>

        <div className={cn('flex justify-end text-neutral3 text-ui-xs')}>{(span.latency / 1000).toFixed(3)}&nbsp;s</div>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 w-auto max-w-100 rounded-md bg-surface4 p-2 px-4 pr-6 text-ui-sm text-neutral5 border border-border1"
          sideOffset={5}
          side="top"
        >
          <div className={cn('text-ui-sm flex items-center gap-2 mb-2 mt-1')}>Span Timing</div>
          <DataKeysAndValues>
            <DataKeysAndValues.Key>Latency</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{span.latency} ms</DataKeysAndValues.Value>
            <DataKeysAndValues.Key>Started at</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>
              {span.startTime ? format(new Date(span.startTime), 'hh:mm:ss:SSS a') : '-'}
            </DataKeysAndValues.Value>
            <DataKeysAndValues.Key>Ended at</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>
              {span.endTime ? format(new Date(span.endTime), 'hh:mm:ss:SSS a') : '-'}
            </DataKeysAndValues.Value>
            <DataKeysAndValues.Key>Start Shift</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{spanStartTimeShift}ms</DataKeysAndValues.Value>
          </DataKeysAndValues>
          <HoverCard.Arrow className="fill-surface5" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
