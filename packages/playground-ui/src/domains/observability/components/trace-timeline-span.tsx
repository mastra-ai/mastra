import { cn } from '@/lib/utils';
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronsLeftRight,
  ChevronsLeftRightIcon,
  ChevronsRightIcon,
  TimerIcon,
} from 'lucide-react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { KeyValueList } from '@/components/ui/elements';
import { type UISpan } from '../types';
import { format } from 'date-fns/format';
import { useState } from 'react';
import { getSpanTypeUi } from './shared';
import { useLinkComponent } from '@/lib/framework';

type TraceTimelineSpanProps = {
  span: UISpan;
  depth?: number;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  isLastChild?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
  overallEndTime?: string;
};

export function TraceTimelineSpan({
  span,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  isLastChild,
  overallLatency,
  overallStartTime,
  overallEndTime,
}: TraceTimelineSpanProps) {
  const { Link } = useLinkComponent();
  const [isHovered, setIsHovered] = useState(false);
  const hasChildren = span.spans && span.spans.length > 0;
  const isRootSpan = depth === 0;
  const percentageSpanLatency = overallLatency ? Math.ceil((span.latency / overallLatency) * 100) : 0;
  const overallStartTimeDate = overallStartTime ? new Date(overallStartTime) : null;
  const spanStartTimeDate = span.startTime ? new Date(span.startTime) : null;
  const spanStartTimeShift =
    spanStartTimeDate && overallStartTimeDate ? spanStartTimeDate.getTime() - overallStartTimeDate.getTime() : 0;
  const percentageSpanStartTime = overallLatency && Math.floor((spanStartTimeShift / overallLatency) * 100);
  const spanUI = getSpanTypeUi(span?.type);

  return (
    <>
      <button
        onClick={() => onSpanClick?.(span.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        type="button"
        aria-label={`View details for span ${span.name}`}
        className={cn(
          'rounded-md transition-colors cursor-pointer flex py-[0.5rem] opacity-80 min-h-[3.5rem]',
          'mt-[1rem] xl:mt-0',
          {
            'bg-icon1/30 text-white': selectedSpanId === span.id,
            'bg-icon1/10 opacity-100': isHovered,
          },
        )}
        style={{ paddingLeft: `${depth * 1.4}rem` }}
      >
        <div className="flex items-center gap-[1rem] w-full">
          {!isRootSpan && <TreePositionMark isLastChild={isLastChild} hasChildren={Boolean(hasChildren)} />}
          <div className={cn('text-[0.875rem] flex items-center text-left break-all gap-[0.5rem] text-[#fff]  w-full')}>
            {spanUI?.icon && (
              <span className="[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0" style={{ color: spanUI?.color }}>
                {spanUI?.icon}
              </span>
            )}
            {span.name}
          </div>
        </div>
      </button>

      <HoverCard.Root openDelay={250}>
        <HoverCard.Trigger
          className={cn(
            'rounded-md transition-colors content-center cursor-help grid min-h-[3.5rem] opacity-80 px-[2.5rem] items-center relative',
            'bg-surface2 xl:bg-surface3',
            'xl:last-of-type:before:content-[""] last-of-type:before:absolute last-of-type:before:bottom-[-1rem] last-of-type:before:h-[1rem] last-of-type:before:w-full last-of-type:before:bg-surface3',
            'xl:first-of-type:before:content-[""] first-of-type:before:absolute first-of-type:before:top-[-1rem] first-of-type:before:h-[1rem] first-of-type:before:w-full first-of-type:before:bg-surface3',
            {
              'bg-icon1/10 xl:bg-icon1/10 opacity-100': isHovered,
            },
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="text-left text-[0.75rem] relative w-full h-[1.4rem] min-w-[6rem]">
            <span
              className={cn(
                'absolute flex pt-[0.1rem] items-center gap-[0.5rem] text-icon5',
                '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0 [&>svg]:opacity-50 mb-[0.1em] [&>svg]:mb-[0.1rem]',
              )}
              style={{ width: `${percentageSpanLatency}%`, left: `${percentageSpanStartTime}%` }}
            >
              <ChevronsLeftRight />
              <span
                style={{
                  transform:
                    percentageSpanStartTime && percentageSpanStartTime > 70
                      ? 'translateX(calc((100% + 2rem) * -1))'
                      : 'none',
                }}
              >
                {(span.latency / 1000).toFixed(3)}&nbsp;s
              </span>
            </span>
          </div>
          <div className="relative w-full bg-surface5  h-[3px] ">
            <div
              className={cn('bg-icon1 h-full absolute rounded-full')}
              style={{
                width: percentageSpanLatency ? `${percentageSpanLatency}%` : '2px',
                left: `${percentageSpanStartTime}%`,
                backgroundColor: spanUI?.color,
              }}
            ></div>
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

      {hasChildren &&
        span.spans?.map((childSpan: UISpan, idx: number, array: UISpan[]) => {
          const isLastChild = idx === array.length - 1;

          return (
            <TraceTimelineSpan
              key={childSpan.id}
              span={childSpan}
              depth={depth + 1}
              onSpanClick={onSpanClick}
              selectedSpanId={selectedSpanId}
              isLastChild={isLastChild}
              overallLatency={overallLatency}
              overallStartTime={overallStartTime}
            />
          );
        })}
    </>
  );
}

type TreeSymbolProps = {
  isLastChild?: boolean;
  hasChildren?: boolean;
};

function TreePositionMark({ isLastChild, hasChildren = false }: TreeSymbolProps) {
  return (
    <div
      className={cn(
        'w-[1.5rem] h-[2.2rem] relative opacity-50 ',
        'after:content-[""] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[0px] after:border-r-[0.5px] after:border-white after:border-dashed',
        'before:content-[""] before:absolute before:left-0  before:top-[50%] before:w-full before:h-[0px] before:border-b-[0.5px] before:border-white before:border-dashed',
        {
          'after:bottom-[50%]': isLastChild,
        },
      )}
    >
      {hasChildren && (
        <div className="absolute -right-[1px] top-[50%] bottom-0 w-[0px]  border-r-[0.5px] border-white border-dashed" />
      )}
    </div>
  );
}
