import { format } from 'date-fns/format';
import type { UISpan } from '../types';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
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
    <HoverCard>
      <HoverCardTrigger
        className={cn(
          'grid h-8 cursor-help grid-cols-[1fr_auto] items-center gap-2 rounded-r-md p-1 pr-2',
          chartWidth === 'wide' ? 'min-w-72' : 'min-w-32',
          '[&:hover>div]:bg-surface5',
          {
            'opacity-30 [&:hover]:opacity-60': isFaded,
            'bg-surface4': selectedSpanId === span.id,
          },
        )}
      >
        <div className={cn('w-full rounded-md bg-surface4 p-1.5 transition-colors duration-1000')}>
          <div className="relative h-1.5 w-full overflow-hidden rounded-sm">
            <div
              className={cn('absolute top-0 h-1.5 rounded-sm bg-neutral1')}
              style={{
                width: percentageSpanLatency ? `${percentageSpanLatency}%` : '2px',
                left: `${percentageSpanStartTime || 0}%`,
                backgroundColor: color,
              }}
            ></div>
          </div>
        </div>

        <div className={cn('flex justify-end text-ui-xs text-neutral3')}>{(span.latency / 1000).toFixed(3)}&nbsp;s</div>
      </HoverCardTrigger>
      <HoverCardContent className="bg-surface4 pr-6">
        <div className={cn('mt-1 mb-2 flex items-center gap-2 text-ui-sm')}>Span Timing</div>
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
      </HoverCardContent>
    </HoverCard>
  );
}
