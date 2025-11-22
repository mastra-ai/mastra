import { cn } from '@/lib/utils';
import { TraceTimelineSpan } from './trace-timeline-span';
import Spinner from '@/components/ui/spinner';
import { UISpan } from '../types';

type TraceTimelineProps = {
  hierarchicalSpans: UISpan[];
  onSpanClick: (id: string) => void;
  selectedSpanId?: string;
  isLoading?: boolean;
  fadedTypes?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: React.Dispatch<React.SetStateAction<string[]>>;
  featuredSpanIds?: string[];
};

export function TraceTimeline({
  hierarchicalSpans = [],
  onSpanClick,
  selectedSpanId,
  isLoading,
  fadedTypes,
  expandedSpanIds,
  setExpandedSpanIds,
  featuredSpanIds,
}: TraceTimelineProps) {
  const overallLatency = hierarchicalSpans?.[0]?.latency || 0;
  const overallStartTime = hierarchicalSpans?.[0]?.startTime || '';
  const overallEndTime = hierarchicalSpans?.[0]?.endTime || '';

  return (
    <>
      {isLoading ? (
        <div
          className={cn(
            'flex items-center text-[0.875rem] gap-[1rem] bg-surface3/50 rounded-md p-[1.5rem] justify-center text-icon3',
            '[&_svg]:w-[1.25em] [&_svg]:h-[1.25em] [&_svg]:opacity-50',
          )}
        >
          <Spinner /> Loading Trace Timeline ...
        </div>
      ) : (
        <div
          className={cn('grid items-start content-start gap-y-[2px] overflow-hidden', 'xl:py-[1rem]', {
            'xl:grid-cols-[1fr_auto_auto]': !overallEndTime,
            'xl:grid-cols-[2fr_auto_1fr]': overallEndTime,
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
              fadedTypes={fadedTypes}
              featuredSpanIds={featuredSpanIds}
              expandedSpanIds={expandedSpanIds}
              setExpandedSpanIds={setExpandedSpanIds}
            />
          ))}
        </div>
      )}
    </>
  );
}
