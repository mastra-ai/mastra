import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import { cn } from '@mastra/playground-ui/utils/cn';
import * as HoverCard from '@radix-ui/react-hover-card';
import { format } from 'date-fns/format';
import { ChevronFirstIcon, ChevronLastIcon, ChevronsLeftRightIcon, ChevronsRightIcon, TimerIcon } from 'lucide-react';
import type { ExperimentUISpan } from '../types';

type ExperimentTraceTimelineTimingColProps = {
  span: ExperimentUISpan;
  selectedSpanId?: string;
  isFaded?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
  overallEndTime?: string;
  color?: string;
};

export function ExperimentTraceTimelineTimingCol({
  span,
  selectedSpanId,
  isFaded,
  overallLatency,
  overallStartTime,
  color,
}: ExperimentTraceTimelineTimingColProps) {
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
          'col-span-2 grid h-12 cursor-help grid-cols-[1fr_auto] items-center gap-4 rounded-r-lg p-2 pr-3 xl:col-span-1 ',
          '[&:hover>div]:bg-surface5',
          {
            'opacity-30 [&:hover]:opacity-60': isFaded,
            'bg-surface4': selectedSpanId === span.id,
          },
        )}
        style={{ border: '2px dashed blue' }}
      >
        <div className={cn('w-full min-w-40 rounded-lg bg-surface4 p-2.5 transition-colors duration-1000')}>
          <div className="relative h-1.5 w-full rounded-sm">
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

        <div className={cn('flex justify-end text-ui-sm text-neutral3')}>{(span.latency / 1000).toFixed(3)}&nbsp;s</div>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="max-w-100 z-50 w-auto rounded-md border border-border1 bg-surface4 p-2 px-4 pr-6 text-center text-ui-sm text-neutral5"
          sideOffset={5}
          side="top"
        >
          <div
            className={cn(
              'mb-4 flex items-center gap-2 text-ui-md',
              '[&>svg]:size-[1.25em] [&>svg]:shrink-0 [&>svg]:opacity-50',
            )}
          >
            <TimerIcon /> Span Timing
          </div>
          <KeyValueList
            className="[&>dd]:min-h-0 [&>dd]:text-ui-md [&>dt]:min-h-0 [&>dt]:text-ui-md"
            data={[
              {
                key: 'Latency',
                label: 'Latency',
                value: `${span.latency} ms`,
                icon: <ChevronsLeftRightIcon />,
              },
              {
                key: 'startTime',
                label: 'Started at',
                value: span.startTime ? format(new Date(span.startTime), 'hh:mm:ss:SSS a') : '-',
                icon: <ChevronFirstIcon />,
              },
              {
                key: 'endTime',
                label: 'Ended at',
                value: span.endTime ? format(new Date(span.endTime), 'hh:mm:ss:SSS a') : '-',
                icon: <ChevronLastIcon />,
              },
              {
                key: 'startShift',
                label: 'Start Shift',
                value: `${spanStartTimeShift}ms`,
                icon: <ChevronsRightIcon />,
              },
            ]}
          />
          <HoverCard.Arrow className="fill-surface5" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
