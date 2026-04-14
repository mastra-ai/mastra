import { Spinner, cn } from '@mastra/playground-ui';
import { TraceTimelineSpan } from './trace-timeline-span';
import type { UISpan } from './types';

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

  return (
    <>
      {isLoading ? (
        <div
          className={cn(
            'flex items-center text-ui-sm gap-3 bg-surface3/50 rounded-md p-3 justify-center text-neutral3',
            '[&_svg]:w-[1.25em] [&_svg]:h-[1.25em] [&_svg]:opacity-50',
          )}
        >
          <Spinner /> Loading Trace Timeline ...
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start content-start gap-y-px overflow-hidden py-1">
          {hierarchicalSpans?.map(span => (
            <TraceTimelineSpan
              key={span.id}
              span={span}
              onSpanClick={onSpanClick}
              selectedSpanId={selectedSpanId}
              overallLatency={overallLatency}
              overallStartTime={overallStartTime}
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
