import { TimestampZones } from '@/ds/components/RelativeTimestamp/timestamp-zones';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { formatLogLineTimestamp, toDate } from '@/utils/date-format';
import type { FractionDigits } from '@/utils/date-format';

export interface LogStreamTimeProps {
  timestamp: Date | string;
  fractionDigits?: FractionDigits;
}

export function LogStreamTime({ timestamp, fractionDigits = 2 }: LogStreamTimeProps) {
  const date = toDate(timestamp);
  const parts = formatLogLineTimestamp(timestamp, { fractionDigits });
  if (!date || !parts) return <time>{String(timestamp)}</time>;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time dateTime={date.toISOString()}>
            {parts.day} <span className="text-foreground">{parts.time}</span>
            {parts.fraction}
          </time>
        }
      />
      <TooltipContent side="top" align="start">
        <TimestampZones date={date} fractionDigits={fractionDigits} />
      </TooltipContent>
    </Tooltip>
  );
}
