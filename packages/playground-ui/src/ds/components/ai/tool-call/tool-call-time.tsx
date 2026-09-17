const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const calendar = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'medium' });

export function ToolCallTime({ at }: { at?: number }) {
  if (at === undefined) return null;
  const time = new Date(at);

  return (
    <time
      className="text-ui-xs text-icon3 shrink-0 tabular-nums"
      dateTime={time.toISOString()}
      title={calendar.format(time)}
    >
      {clock.format(time)}
    </time>
  );
}
