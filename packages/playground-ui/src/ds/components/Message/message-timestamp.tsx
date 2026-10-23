import { MessageMetadata } from './message';
import { formatDate, toDate } from '@/utils/date-format';

export function MessageTimestamp({ value }: { value: Date | string }) {
  const time = toDate(value);
  if (!time) return null;

  return (
    <MessageMetadata>
      <time dateTime={time.toISOString()} title={formatDate(time, 'date-time')}>
        {formatDate(time, 'time')}
      </time>
    </MessageMetadata>
  );
}
