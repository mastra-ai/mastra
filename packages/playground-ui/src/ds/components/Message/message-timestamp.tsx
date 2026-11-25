import { MessageMetadata } from './message';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useClock } from '@/hooks/use-clock';
import { formatDate, toDate } from '@/utils/date-format';

/** `just now` for a message's first minute, then `7 minutes ago`, `yesterday`, `last week`. */
function sentAgo(time: Date, now: number) {
  return now - time.getTime() < 60_000 ? 'just now' : formatDate(time, 'relative-long', { now });
}

/** When a message was sent, as how long ago, kept current; the full date and time show on hover. */
export function MessageTimestamp({ value }: { value: Date | string }) {
  const time = toDate(value);
  const ago = useClock(now => time && sentAgo(time, now));
  if (!time) return null;

  return (
    <Tooltip>
      <TooltipTrigger render={<MessageMetadata tabIndex={0} />}>
        <time dateTime={time.toISOString()} className="whitespace-nowrap">
          {ago}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDate(time, 'date-time')}</TooltipContent>
    </Tooltip>
  );
}
