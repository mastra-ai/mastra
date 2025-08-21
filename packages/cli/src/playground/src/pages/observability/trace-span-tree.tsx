import { cn } from '@/lib/utils';
import {
  BrainIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronsLeftRight,
  ChevronsLeftRightIcon,
  ChevronsRight,
  ChevronsRightIcon,
  TimerIcon,
} from 'lucide-react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { KeyValueList } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { format } from 'date-fns/format';

type TreeSymbolProps = {
  isLastChild?: boolean;
  isNextToLastChild?: boolean;
  isFirstChild?: boolean;
  hasChildren?: boolean;
};

function TreePositionMark({ isLastChild, isNextToLastChild, hasChildren }: TreeSymbolProps & { hasChildren: boolean }) {
  return (
    <div
      className={cn(
        'w-[1.5rem] h-[2.2rem]  relative opacity-25 ',
        'after:content-[""] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[0px] after:border-r-[0.5px] after:border-white after:border-dashed',
        'before:content-[""] before:absolute before:left-0  before:top-[50%] before:w-full before:h-[0px] before:border-b-[0.5px] before:border-white before:border-dashed',
        {
          'after:bottom-[50%]': isLastChild,
          'after:bg-gray-500 after:bottom-auto after:h-[200rem] ': isNextToLastChild,
        },
      )}
    >
      {hasChildren && (
        <div className="absolute -right-[1px] top-[50%] bottom-0 w-[0px]  border-r-[0.5px] border-white border-dashed" />
      )}
    </div>
  );
}

export function TraceSpanTree({
  span,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  isFirstChild,
  isLastChild,
  isNextToLastChild,
  overallLatency,
  overallStartTime,
}: {
  span: any;
  depth?: number;
  onSpanClick?: (span: any) => void;
  selectedSpanId?: string;
  isFirstChild?: boolean;
  isLastChild?: boolean;
  isNextToLastChild?: boolean;
  overallLatency?: number;
  overallStartTime?: string;
}) {
  const hasChildren = span.spans && span.spans.length > 0;
  const isRootSpan = depth === 0;
  const percentageSpanLatency = overallLatency ? Math.ceil((span.latency / overallLatency) * 100) : 0;

  const overallStartTimeDate = overallStartTime ? new Date(overallStartTime) : null;
  const spanStartTimeDate = span.startTime ? new Date(span.startTime) : null;
  const spanStartTimeShift =
    spanStartTimeDate && overallStartTimeDate ? spanStartTimeDate.getTime() - overallStartTimeDate.getTime() : 0;
  const percentageSpanStartTime = overallLatency && Math.floor((spanStartTimeShift / overallLatency) * 100);

  return (
    <div className={cn('pl-[1.5rem] grid overflow-hidden ')}>
      <button
        onClick={() => onSpanClick(span.id)}
        type="button"
        aria-label={`View details for span ${span.name}`}
        className={cn(
          'grid grid-cols-[2fr_20rem] items-center rounded-md transition-colors cursor-pointer',

          'hover:bg-icon1/20',
          {
            'bg-icon1/30 text-white': selectedSpanId === span.id,
          },
        )}
      >
        <div className="flex items-center gap-[1rem]">
          {!isRootSpan && (
            <TreePositionMark
              isLastChild={isLastChild}
              isNextToLastChild={isNextToLastChild}
              isFirstChild={isFirstChild}
              hasChildren={hasChildren}
            />
          )}
          <div
            className={cn(
              'text-[0.875rem] flex items-center gap-[0.5rem] text-icon5',
              '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0  [&>svg]:text-accent1 ',
              '[&>svg]:text-[#855fa9]',
            )}
          >
            {span.type === 'GENERATION' && <BrainIcon />}
            {span.name}
          </div>
          {/* {span.spans && span.spans.length > 0 && (
            <div className="">
              {span.spans.length} child{span.spans.length !== 1 ? 'ren' : ''}
            </div>
          )} */}
        </div>
        <div className="grid my-[.5rem] pr-[1.5rem]  ">
          <HoverCard.Root openDelay={250}>
            <HoverCard.Trigger>
              <>
                <div className="text-left text-[0.75rem] relative w-full h-[1.5rem]">
                  <span
                    className={cn(
                      'absolute flex pt-[0.1rem]  items-center gap-[0.5rem] text-icon5',
                      '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:shrink-0 [&>svg]:opacity-50',
                    )}
                    style={{ width: `${percentageSpanLatency}%`, left: `${percentageSpanStartTime}%` }}
                  >
                    <ChevronsLeftRight /> {(span.latency / 1000).toFixed(2)}&nbsp;s
                  </span>
                </div>
                <div className="relative w-full bg-surface5  h-[3px]">
                  <div
                    className={cn('bg-icon1 h-full absolute rounded-full', {
                      'bg-accent1': span.type === 'GENERATION',
                      'bg-[#855fa9]': span.type === 'GENERATION',
                    })}
                    style={{ width: `${percentageSpanLatency}%`, left: `${percentageSpanStartTime}%` }}
                  ></div>
                </div>
              </>
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
                      value: span.startTime ? format(new Date(span.startTime), 'hh:mm:ss:SSS a') : 'N/A',
                      icon: <ChevronFirstIcon />,
                    },
                    {
                      key: 'endTime',
                      label: 'Ended at',
                      value: span.endTime ? format(new Date(span.endTime), 'hh:mm:ss:SSS a') : 'N/A',
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
        </div>
      </button>

      {hasChildren > 0 && (
        <div>
          {span.spans.map((childSpan: any, idx: number, array: any[]) => {
            const isFirstChild = idx === 0;
            const isLastChild = idx === array.length - 1;
            const isNextToLastChild = idx === array.length - 2;

            return (
              <TraceSpanTree
                key={childSpan.id}
                span={childSpan}
                depth={depth + 1}
                onSpanClick={onSpanClick}
                selectedSpanId={selectedSpanId}
                isFirstChild={isFirstChild}
                isLastChild={isLastChild}
                isNextToLastChild={isNextToLastChild}
                overallLatency={overallLatency}
                overallStartTime={overallStartTime}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
