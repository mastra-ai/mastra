import type { ReactNode } from 'react';
import type { WorkflowStepCardViewProps } from '../../types';
import { ClockDial, DurationDial } from './workflow-time-dial';
import type { DurationUnit } from './workflow-time-dial';
import { formatDate, formatShortDate } from '@/utils/date-format';
import { formatDuration } from '@/utils/duration';

const captionClasses = 'text-meta tracking-wider whitespace-nowrap text-muted-foreground uppercase';

function durationReading(duration: number): { amount: number; unit: DurationUnit } {
  if (duration < 1000) return { amount: duration, unit: 'ms' };
  if (duration < 60000) return { amount: duration / 1000, unit: 's' };
  if (duration < 3600000) return { amount: duration / 60000, unit: 'min' };
  return { amount: duration / 3600000, unit: 'h' };
}

function TimingReading({
  value,
  unit,
  caption,
  dial,
}: {
  value: string;
  unit?: string;
  caption: string;
  dial: ReactNode;
}) {
  return (
    <span className="mt-1 flex min-h-27 items-center justify-between gap-1 text-foreground">
      <span className="z-10 flex min-w-0 flex-col gap-2">
        <span className="flex items-baseline gap-1 text-display leading-none tracking-tighter whitespace-nowrap tabular-nums">
          {value}
          {unit && <small className="text-meta tracking-normal text-muted-foreground">{unit}</small>}
        </span>
        <span className={captionClasses}>{caption}</span>
      </span>
      {dial}
    </span>
  );
}

export function WorkflowTiming({ duration, date }: Pick<WorkflowStepCardViewProps, 'duration' | 'date'>) {
  if (date) {
    const scheduled = new Date(date);
    if (!Number.isFinite(scheduled.getTime())) {
      return <span className={captionClasses}>Schedule unavailable</span>;
    }
    return (
      <TimingReading
        value={formatDate(scheduled, 'time', { timeZone: 'UTC' }) ?? ''}
        unit="UTC"
        caption={formatShortDate(scheduled, { timeZone: 'UTC', now: 0 }) ?? ''}
        dial={<ClockDial date={scheduled} />}
      />
    );
  }
  if (duration === undefined) return null;
  if (!Number.isFinite(duration) || duration < 0) {
    return <span className={captionClasses}>Delay unavailable</span>;
  }
  const reading = durationReading(duration);
  return (
    <TimingReading
      value={formatDuration(duration) ?? ''}
      caption="Configured delay"
      dial={<DurationDial {...reading} />}
    />
  );
}
