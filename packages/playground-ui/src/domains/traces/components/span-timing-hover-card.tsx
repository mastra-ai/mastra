import { format } from 'date-fns/format';
import type { UISpan } from '../types';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { HoverCardContent } from '@/ds/components/HoverCard';
import { cn } from '@/lib/utils';

type SpanTimingHoverCardProps = {
  span: UISpan;
  startShiftMs: number;
};

export function SpanTimingHoverCard({ span, startShiftMs }: SpanTimingHoverCardProps) {
  return (
    <HoverCardContent className="pr-6">
      <div className={cn('mt-1 mb-2 flex items-center gap-2 text-ui-sm')}>Span Timing</div>
      <DataKeysAndValues>
        <DataKeysAndValues.Key>Latency</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{span.latency} ms</DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Started at</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>
          {span.startTime ? format(new Date(span.startTime), 'hh:mm:ss:SSS a') : '-'}
        </DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Ended at</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>
          {span.endTime ? format(new Date(span.endTime), 'hh:mm:ss:SSS a') : '-'}
        </DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Start Shift</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{startShiftMs}ms</DataKeysAndValues.Value>
      </DataKeysAndValues>
    </HoverCardContent>
  );
}
