const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const calendar = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'medium' });

export function ToolCallTime({ at }: { at?: number }) {
  if (at === undefined) return null;
  const time = new Date(at);
  if (Number.isNaN(time.getTime())) return null;

  return (
    <time
      className="text-meta text-icon3 shrink-0 tabular-nums"
      dateTime={time.toISOString()}
      title={calendar.format(time)}
    >
      {clock.format(time)}
    </time>
  );
}
