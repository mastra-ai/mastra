import { CalendarClockIcon, TimerIcon } from 'lucide-react';
import { getSpanDurationMs } from '../utils/span-utils';
import { DataPanel } from '@/ds/components/DataPanel';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';
import { formatDate, formatTimestampPrecise } from '@/utils/date-format';
import { formatDuration, formatDurationPrecise } from '@/utils/duration';

export interface SpanSummaryDescriptionProps {
  span: {
    startedAt: Date | string;
    endedAt?: Date | string | null;
  };
}

/** Compact span timing shown under the span side-panel heading. */
export function SpanSummaryDescription({ span }: SpanSummaryDescriptionProps) {
  const startedAt = formatDate(span.startedAt, 'time');
  const exactStartedAt = formatTimestampPrecise(span.startedAt);
  const durationMs = getSpanDurationMs(span.startedAt, span.endedAt);
  const duration = formatDuration(durationMs);
  const exactDuration = formatDurationPrecise(durationMs);

  return (
    <DataPanel.Metadata>
      {startedAt && exactStartedAt && (
        <DataPanel.Meta icon={<CalendarClockIcon />} tooltip={`Started at ${exactStartedAt}`}>
          {startedAt}
        </DataPanel.Meta>
      )}
      {duration && exactDuration && (
        <DataPanel.Meta icon={<TimerIcon />} tooltip={`Duration ${exactDuration}`}>
          {duration}
        </DataPanel.Meta>
      )}
    </DataPanel.Metadata>
  );
}

/** The run a span belongs to, labelled and copyable like the span id next to it. */
export function SpanRunId({ runId }: { runId: string }) {
  return (
    <div className={cn('inline-flex shrink-0 items-center gap-1 px-1 text-foreground', controlSizeClasses.sm)}>
      Run id
      <DataPanel.CopyId id={runId} maxLength={6} ellipsis={false} />
    </div>
  );
}
