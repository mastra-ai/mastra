import { CalendarClockIcon, FlagIcon, HashIcon, TimerIcon } from 'lucide-react';
import { formatSpanDurationSeconds, formatSpanTimestamp, formatSpanTimestampExact } from '../utils/span-utils';
import { DataPanel } from '@/ds/components/DataPanel';
import { truncateString } from '@/lib/truncate-string';

export interface SpanSummaryDescriptionProps {
  span: {
    startedAt: Date | string;
    endedAt?: Date | string | null;
    runId?: string | null;
  };
}

/** Compact span timing + run metadata shown under the span side-panel heading. */
export function SpanSummaryDescription({ span }: SpanSummaryDescriptionProps) {
  const startedAt = formatSpanTimestamp(span.startedAt);
  const exactStartedAt = formatSpanTimestampExact(span.startedAt);
  const endedAt = formatSpanTimestamp(span.endedAt);
  const exactEndedAt = formatSpanTimestampExact(span.endedAt);
  const duration = formatSpanDurationSeconds(span.startedAt, span.endedAt);

  return (
    <DataPanel.Metadata>
      {startedAt && exactStartedAt && (
        <DataPanel.Meta icon={<CalendarClockIcon />} tooltip={`Started at ${exactStartedAt}`}>
          {startedAt}
        </DataPanel.Meta>
      )}
      {endedAt && exactEndedAt && (
        <DataPanel.Meta icon={<FlagIcon />} tooltip={`Ended at ${exactEndedAt}`}>
          {endedAt}
        </DataPanel.Meta>
      )}
      {duration && (
        <DataPanel.Meta icon={<TimerIcon />} tooltip={`Duration ${duration}`}>
          {duration}
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
