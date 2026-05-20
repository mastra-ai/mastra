import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import type { UISpan } from '../types';
import { spanTypePrefixes, getSpanTypeUi } from './shared';
import { TraceTimelineSpan } from './trace-timeline-span';
import { Spinner } from '@/ds/components/Spinner';
import { cn } from '@/lib/utils';

type TraceTimelineProps = {
  hierarchicalSpans: UISpan[];
  onSpanClick: (id: string) => void;
  selectedSpanId?: string;
  isLoading?: boolean;
  fadedTypes?: string[];
  expandedSpanIds?: string[];
  setExpandedSpanIds?: Dispatch<SetStateAction<string[]>>;
  featuredSpanIds?: string[];
  chartWidth?: 'wide' | 'default';
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
  chartWidth = 'default',
}: TraceTimelineProps) {
  const overallLatency = hierarchicalSpans?.[0]?.latency || 0;
  const overallStartTime = hierarchicalSpans?.[0]?.startTime || '';

  const usedSpanTypes = useMemo(() => {
    const collectTypes = (spans: UISpan[]): Set<string> => {
      const types = new Set<string>();
      for (const span of spans) {
        const prefix = span.type?.toLowerCase().split('_')[0];
        if (prefix) types.add(prefix);
        if (span.spans) {
          for (const t of collectTypes(span.spans)) types.add(t);
        }
      }
      return types;
    };
    const types = collectTypes(hierarchicalSpans);
    const hasOther = [...types].some(t => !spanTypePrefixes.includes(t));
    const known = spanTypePrefixes.filter(p => p !== 'other' && types.has(p));
    if (hasOther) known.push('other');
    return known;
  }, [hierarchicalSpans]);

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
        <>
          {usedSpanTypes.length > 0 && (
            <div className="flex flex-wrap gap-3 px-2 py-1.5 justify-end">
              {usedSpanTypes.map(type => {
                const spanUI = getSpanTypeUi(type);
                return (
                  <div key={type} className="flex items-center gap-1 text-ui-sm text-neutral3">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: spanUI?.color }}
                    />
                    {spanUI?.label || type}
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start content-start gap-y-px overflow-hidden py-1">
            {hierarchicalSpans?.map(span => (
              <TraceTimelineSpan
                key={span.id}
                span={span}
                siblings={hierarchicalSpans}
                onSpanClick={onSpanClick}
                selectedSpanId={selectedSpanId}
                overallLatency={overallLatency}
                overallStartTime={overallStartTime}
                fadedTypes={fadedTypes}
                featuredSpanIds={featuredSpanIds}
                expandedSpanIds={expandedSpanIds}
                setExpandedSpanIds={setExpandedSpanIds}
                chartWidth={chartWidth}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
