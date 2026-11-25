import { TimestampZones } from './timestamp-zones';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { focusRing } from '@/ds/primitives/transitions';
import { useClock } from '@/hooks/use-clock';
import { cn } from '@/lib/utils';
import { formatDate, toDate } from '@/utils/date-format';
import type { DateInput } from '@/utils/date-format';
import { formatRelativeTime } from '@/utils/relative-time';

export interface RelativeTimestampProps {
  value: DateInput;
  label?: string;
  className?: string;
}

const SINCE_UNITS = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1_000],
] as const;

function formatUnit(count: number, unit: (typeof SINCE_UNITS)[number][0]) {
  return new Intl.NumberFormat(undefined, { style: 'unit', unit, unitDisplay: 'long' }).format(count);
}

function formatSince(date: Date, at: number) {
  const diff = at - date.getTime();
  let rest = Math.abs(diff);
  const parts: string[] = [];
  for (const [unit, size] of SINCE_UNITS) {
    const count = Math.floor(rest / size);
    rest %= size;
    if (parts.length > 0) {
      if (count > 0) parts.push(formatUnit(count, unit));
      break;
    }
    if (count > 0 || unit === 'second') parts.push(formatUnit(count, unit));
  }
  const label = parts.join(' ');
  return diff < 0 ? `${label} from now` : `${label} ago`;
}

function Relative({ date }: { date: Date }) {
  const parts = useClock(now => formatRelativeTime(date, { now }))?.split(/(\d+[smhd])/) ?? [];
  return parts.map((part, index) =>
    index % 2 ? (
      <span key={index} className="font-mono [font-size-adjust:cap-height_0.729]">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function Since({ date }: { date: Date }) {
  return <>{useClock(now => formatSince(date, now))}</>;
}

export function RelativeTimestamp({ value, label, className }: RelativeTimestampProps) {
  const date = toDate(value);
  if (!date) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={date.toISOString()}
            tabIndex={0}
            className={cn('rounded-sm whitespace-nowrap tabular-nums', focusRing, className)}
          />
        }
      >
        <span aria-hidden="true">
          <Relative date={date} />
        </span>
        <span className="sr-only">{[label, formatDate(date, 'date-time-seconds')].filter(Boolean).join(' ')}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-muted-foreground">
          {label ? `${label} ` : null}
          <Since date={date} />
        </span>
        <div className="mt-1.5 border-t border-border pt-1.5">
          <TimestampZones date={date} />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
