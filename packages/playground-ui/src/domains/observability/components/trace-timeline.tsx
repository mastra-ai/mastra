import { cn } from '@/lib/utils';
import { TraceTimelineSpan } from './trace-timeline-span';
import { SideDialogHeading } from '@/components/ui/elements';
import { ListTreeIcon } from 'lucide-react';
import { TraceTimelineLegend } from './trace-timeline-legend';
import Spinner from '@/components/ui/spinner';
import { AISpanRecord } from '@mastra/core';
import { UISpan } from '../types';

type TraceTimelineProps = {
  spans?: AISpanRecord[];
  hierarchicalSpans: UISpan[];
  onSpanClick: (id: string) => void;
  selectedSpanId?: string;
  isLoading?: boolean;
  className?: string;
};

export function TraceTimeline({
  spans = [],
  hierarchicalSpans = [],
  onSpanClick,
  selectedSpanId,
  isLoading,
  className,
}: TraceTimelineProps) {
  const overallLatency = hierarchicalSpans?.[0]?.latency || 0;
  const overallStartTime = hierarchicalSpans?.[0]?.startTime || '';
  const overallEndTime = hierarchicalSpans?.[0]?.endTime || '';

  return (
    <div className={cn('grid gap-[1rem]', className)}>
      <div className="flex w-full justify-between pr-[2.5rem]">
        <SideDialogHeading as="h2">
          <ListTreeIcon /> Timeline
        </SideDialogHeading>
        <TraceTimelineLegend spans={spans} />
      </div>

      {isLoading ? (
        <div
          className={cn(
            'flex items-center text-[0.875rem] gap-[1rem] bg-surface3/50 rounded-md p-[1.5rem] mr-[1.5rem] justify-center text-icon3 mt-[.5rem]',
            '[&_svg]:w-[1.25em] [&_svg]:h-[1.25em] [&_svg]:opacity-50',
          )}
        >
          <Spinner /> Loading Trace Timeline ...
        </div>
      ) : (
        <div
          className={cn('grid items-start content-start gap-y-[2px]', 'xl:gap-x-[1rem] xl:py-[1rem]', {
            'xl:grid-cols-[3fr_auto]': !overallEndTime,
            'xl:grid-cols-[3fr_2fr]': overallEndTime,
          })}
        >
          {hierarchicalSpans?.map(span => (
            <TraceTimelineSpan
              key={span.id}
              span={span}
              onSpanClick={onSpanClick}
              selectedSpanId={selectedSpanId}
              overallLatency={overallLatency}
              overallStartTime={overallStartTime}
              overallEndTime={overallEndTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
