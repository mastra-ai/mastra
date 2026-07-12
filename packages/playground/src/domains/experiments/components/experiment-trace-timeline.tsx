import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ExperimentUISpan } from '../types';
import { ExperimentTraceTimelineSpan } from './experiment-trace-timeline-span';

type ExperimentTraceTimelineProps = {
  hierarchicalSpans: ExperimentUISpan[];
  onSpanClick: (id: string) => void;
  selectedSpanId?: string;
  isLoading?: boolean;
  fadedTypes?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: React.Dispatch<React.SetStateAction<string[]>>;
  featuredSpanIds?: string[];
};

export function ExperimentTraceTimeline({
  hierarchicalSpans = [],
  onSpanClick,
  selectedSpanId,
  isLoading,
  fadedTypes,
  expandedSpanIds,
  setExpandedSpanIds,
  featuredSpanIds,
}: ExperimentTraceTimelineProps) {
  const overallLatency = hierarchicalSpans?.[0]?.latency || 0;
  const overallStartTime = hierarchicalSpans?.[0]?.startTime || '';
  const overallEndTime = hierarchicalSpans?.[0]?.endTime || '';

  return (
    <>
      {isLoading ? (
        <div
          className={cn(
            'flex items-center justify-center gap-4 rounded-md bg-surface3/50 p-6 text-ui-md text-neutral3',
            '[&_svg]:size-[1.25em] [&_svg]:opacity-50',
          )}
        >
          <Spinner /> Loading Trace Timeline ...
        </div>
      ) : (
        <div
          // className={cn('grid items-start content-start gap-y-0.5 overflow-hidden grid-cols-[1fr_10rem] xl:py-4', {
          //   'xl:grid-cols-[1fr_auto_10rem]': !overallEndTime,
          //   'xl:grid-cols-[1fr_auto_20rem]': overallEndTime,
          // })}
          className="grid grid-cols-[1fr_auto]"
          // style={{ border: '2px dashed yellow' }}
        >
          {hierarchicalSpans?.map(span => (
            <ExperimentTraceTimelineSpan
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
