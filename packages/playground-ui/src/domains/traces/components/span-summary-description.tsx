import { CalendarClockIcon, HashIcon, TimerIcon, ZapIcon } from 'lucide-react';
import { getSpanDurationMs } from '../utils/span-utils';
import { DataPanel } from '@/ds/components/DataPanel';
import { truncateString } from '@/lib/truncate-string';
import { formatDate, formatTimestampPrecise } from '@/utils/date-format';
import { formatDurationPrecise } from '@/utils/duration';

export interface SpanSummaryDescriptionProps {
  span: {
    startedAt: Date | string;
    endedAt?: Date | string | null;
    runId?: string | null;
    attributes?: Record<string, unknown> | null;
  };
}

/** Compact span timing + run metadata shown under the span side-panel heading. */
export function SpanSummaryDescription({ span }: SpanSummaryDescriptionProps) {
  const startedAt = formatDate(span.startedAt, 'time');
  const exactStartedAt = formatTimestampPrecise(span.startedAt);
  const duration = formatDurationPrecise(getSpanDurationMs(span.startedAt, span.endedAt));
  // Agent run and model spans record when the first chunk arrived; time to first chunk counts from the span start.
  const completionStartTime = span.attributes?.completionStartTime;
  const timeToFirstChunk =
    completionStartTime instanceof Date || typeof completionStartTime === 'string'
      ? formatDurationPrecise(getSpanDurationMs(span.startedAt, completionStartTime))
      : undefined;

  return (
    <DataPanel.Metadata>
      {startedAt && exactStartedAt && (
        <DataPanel.Meta icon={<CalendarClockIcon />} tooltip={`Started at ${exactStartedAt}`}>
          {startedAt}
        </DataPanel.Meta>
      )}
      {duration && (
        <DataPanel.Meta icon={<TimerIcon />} tooltip={`Duration ${duration}`}>
          {duration}
        </DataPanel.Meta>
      )}
      {timeToFirstChunk && (
        <DataPanel.Meta icon={<ZapIcon />} tooltip={`Time to first chunk ${timeToFirstChunk}`}>
          {timeToFirstChunk}
        </DataPanel.Meta>
      )}
      {span.runId && (
        <DataPanel.Meta icon={<HashIcon />} tooltip={`Run Id ${span.runId}`}>
          {truncateString(span.runId, 8)}
        </DataPanel.Meta>
      )}
    </DataPanel.Metadata>
  );
}
