import { formatDate, toDate } from '@/utils/date-format';

export function ToolCallTime({ at }: { at?: number }) {
  const time = toDate(at);
  if (!time) return null;

  return (
    <time
      className="shrink-0 text-meta text-muted-foreground tabular-nums"
      dateTime={time.toISOString()}
      title={formatDate(time, 'date-time-seconds')}
    >
      {formatDate(time, 'time-seconds')}
    </time>
  );
}
