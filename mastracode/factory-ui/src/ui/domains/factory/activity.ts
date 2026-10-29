export function startOfLocalDay(ms: number): number {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** A day is 23 or 25 hours long when the clocks change, so step the calendar rather than the clock. */
function previousLocalDay(dayMs: number): number {
  const day = new Date(dayMs);
  day.setDate(day.getDate() - 1);
  return day.getTime();
}

/** Consecutive runs of the same local day, in the order the moves arrive. */
export function groupByDay<T extends { at: number }>(events: T[]): Array<{ dayMs: number; items: T[] }> {
  const days: Array<{ dayMs: number; items: T[] }> = [];

  for (const event of events) {
    const dayMs = startOfLocalDay(event.at);
    const open = days.at(-1);
    if (open?.dayMs === dayMs) open.items.push(event);
    else days.push({ dayMs, items: [event] });
  }

  return days;
}

/** Today and yesterday get their names; older days get their date. */
export function dayHeading(dayMs: number, nowMs: number): string {
  const today = startOfLocalDay(nowMs);
  if (dayMs === today) return 'Today';
  if (dayMs === previousLocalDay(today)) return 'Yesterday';
  return new Date(dayMs).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
