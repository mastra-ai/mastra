import { cn } from '@/lib/utils';
import { ChevronFirstIcon, ChevronLastIcon, ChevronsLeftRightIcon, ChevronsRightIcon, TimerIcon } from 'lucide-react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { KeyValueList } from '@/ds/components/KeyValueList';
import { type UISpan } from '../types';
import { format } from 'date-fns/format';
import { useLinkComponent } from '@/lib/framework';

type TimelineTimingColProps = {
  span: UISpan;
  selectedSpanId?: string;
  isFaded?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
  overallEndTime?: string;
  color?: string;
};

export function TimelineTimingCol({
  span,
  selectedSpanId,
  isFaded,
  overallLatency,
  overallStartTime,
  color,
}: TimelineTimingColProps) {
  const { Link } = useLinkComponent();
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
          'h-12 p-2 grid grid-cols-[1fr_auto] gap-4 items-center cursor-help pr-3 rounded-r-lg col-span-2 xl:col-span-1',
          '[&:hover>div]:bg-surface5',
          {
            'opacity-30 [&:hover]:opacity-60': isFaded,
            'bg-surface4': selectedSpanId === span.id,
          },
        )}
      >
        <div className={cn('w-full p-2.5 rounded-lg bg-surface4 transition-colors duration-1000')}>
          <div className="relative w-full h-1.5 rounded-sm">
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

        <div className={cn('flex justify-end text-neutral3 text-ui-sm')}>{(span.latency / 1000).toFixed(3)}&nbsp;s</div>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 w-auto max-w-[25rem] rounded-md bg-surface4 p-2 px-4 pr-6 text-ui-sm text-neutral5 text-center border border-border1"
          sideOffset={5}
          side="top"
        >
          <div
            className={cn(
              'text-ui-md flex items-center gap-2 mb-4',
              '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0 [&>svg]:opacity-50',
            )}
          >
            <TimerIcon /> Span Timing
          </div>
          <KeyValueList
            className=" [&>dd]:text-ui-md [&>dt]:text-ui-md [&>dt]:min-h-0 [&>dd]:min-h-0"
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
            LinkComponent={Link}
          />
          <HoverCard.Arrow className="fill-surface5" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
