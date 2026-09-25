import type { UISpan } from '../types';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { HoverCardContent } from '@/ds/components/HoverCard';
import { cn } from '@/lib/utils';
import { formatTimestampPrecise } from '@/utils/date-format';
import { formatDurationPrecise } from '@/utils/duration';

type SpanTimingHoverCardProps = {
  span: UISpan;
  startShiftMs: number;
};

export function SpanTimingHoverCard({ span, startShiftMs }: SpanTimingHoverCardProps) {
  return (
    <HoverCardContent className="pr-6">
      <div className={cn('mt-1 mb-2 flex items-center gap-2 text-caption')}>Span Timing</div>
      <DataKeysAndValues>
        <DataKeysAndValues.Key>Latency</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{formatDurationPrecise(span.latency) ?? '-'}</DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Started at</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{formatTimestampPrecise(span.startTime) ?? '-'}</DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Ended at</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{formatTimestampPrecise(span.endTime) ?? '-'}</DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Start Shift</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{formatDurationPrecise(startShiftMs) ?? '-'}</DataKeysAndValues.Value>
      </DataKeysAndValues>
    </HoverCardContent>
  );
}
