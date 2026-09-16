import { MessageMetadata } from './message';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const calendar = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' });

export function MessageTimestamp({ value }: { value: Date | string }) {
  const time = new Date(value);

  return (
    <MessageMetadata>
      <time dateTime={time.toISOString()} title={calendar.format(time)}>
        {clock.format(time)}
      </time>
    </MessageMetadata>
  );
}
