import { CalendarClockIcon, FlagIcon, HashIcon, TimerIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatSpanDurationSeconds, formatSpanTimestamp, formatSpanTimestampExact } from '../utils/span-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { truncateString } from '@/lib/truncate-string';
import { cn } from '@/lib/utils';

export interface SpanSummaryDescriptionProps {
  span: {
    startedAt: Date | string;
    endedAt?: Date | string | null;
    runId?: string | null;
  };
  className?: string;
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="flex shrink-0 cursor-help items-center gap-1 whitespace-nowrap"
          aria-label={label}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Compact span timing + run metadata shown under the span side-panel heading. */
export function SpanSummaryDescription({ span, className }: SpanSummaryDescriptionProps) {
  const startedAt = formatSpanTimestamp(span.startedAt);
  const exactStartedAt = formatSpanTimestampExact(span.startedAt);
  const endedAt = formatSpanTimestamp(span.endedAt);
  const exactEndedAt = formatSpanTimestampExact(span.endedAt);
  const duration = formatSpanDurationSeconds(span.startedAt, span.endedAt);

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-ui-xs leading-ui-xs text-neutral3',
        className,
      )}
    >
      {startedAt && exactStartedAt && (
        <SummaryItem label={`Started at ${exactStartedAt}`}>
          <CalendarClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{startedAt}</span>
        </SummaryItem>
      )}
      {endedAt && exactEndedAt && (
        <SummaryItem label={`Ended at ${exactEndedAt}`}>
          <FlagIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{endedAt}</span>
        </SummaryItem>
      )}
      {duration && (
        <SummaryItem label={`Duration ${duration}`}>
          <TimerIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{duration}</span>
        </SummaryItem>
      )}
      {span.runId && (
        <SummaryItem label={`Run Id ${span.runId}`}>
          <HashIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{truncateString(span.runId, 8)}</span>
        </SummaryItem>
      )}
    </div>
  );
}
