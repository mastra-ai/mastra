import { cn } from '@/lib/utils';
import { ChevronFirstIcon, ChevronLastIcon, ChevronsLeftRightIcon, ChevronsRightIcon, TimerIcon } from 'lucide-react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { KeyValueList } from '@/components/ui/elements';
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
  overallEndTime,
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
          'h-[3rem] p[0.5rem] grid grid-cols-[1fr_auto] gap-4 items-center cursor-help pr-3 rounded-r-lg',
          '[&:hover>div]:bg-surface5',
          {
            'opacity-30 [&:hover]:opacity-60': isFaded,
            'bg-surface4': selectedSpanId === span.id,
          },
        )}
      >
        <div className={cn('w-full p-[0.6rem] rounded-lg bg-surface4 transition-colors duration-[1s]')}>
          <div className="relative w-full h-[0.4rem] rounded-sm">
            <div
              className={cn('bg-icon1 absolute rounded-sm h-[0.4rem] top-0')}
              style={{
                width: percentageSpanLatency ? `${percentageSpanLatency}%` : '2px',
                left: `${percentageSpanStartTime}%`,
                backgroundColor: color,
              }}
            ></div>
          </div>
        </div>

        <div className={cn('flex justify-end text-icon3 text-[0.75rem]')}>
          {(span.latency / 1000).toFixed(3)}&nbsp;s
        </div>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-[100] w-auto max-w-[25rem] rounded-md bg-[#222] p-[.5rem] px-[1rem] pr-[1.5rem] text-[.75rem] text-icon5 text-center border border-border1"
          sideOffset={5}
          side="top"
        >
          <div
            className={cn(
              'text-[0.875rem] flex items-center gap-[0.5rem] mb-[1rem]',
              '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0 [&>svg]:opacity-50',
            )}
          >
            <TimerIcon /> Span Timing
          </div>
          <KeyValueList
            className=" [&>dd]:text-[0.875rem] [&>dt]:text-[0.875rem] [&>dt]:min-h-0 [&>dd]:min-h-0"
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
