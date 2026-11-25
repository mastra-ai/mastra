import { createHash } from 'node:crypto';

const weekdays = new Map([
  ['Sun', 0],
  ['Mon', 1],
  ['Tue', 2],
  ['Wed', 3],
  ['Thu', 4],
  ['Fri', 5],
  ['Sat', 6],
]);
const ranges = [59, 23, 31, 12, 6] as const;

/** Parse the supported five-field cron subset or return null for unsupported expressions. */
export function parseCron(cron: string): (number | null)[] | null {
  const parts = cron.split(' ');
  if (parts.length !== 5) return null;
  const values = parts.map((part, index) => {
    if (part === '*') return null;
    if (!/^\d{1,2}$/.test(part)) return NaN;
    const number = Number(part);
    return number >= (index === 2 || index === 3 ? 1 : 0) && number <= ranges[index]! ? number : NaN;
  });
  if (values.some(value => Number.isNaN(value))) return null;
  const [, , day, month, weekday] = values;
  const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Leap-day-only schedules can fall outside the bounded occurrence search.
  // A fixed weekday remains a valid alternative under the existing OR semantics.
  if (weekday === null && day != null && month != null && day > monthLengths[month - 1]!) return null;
  return values;
}

/** Extract timezone-local calendar fields used when matching scheduled occurrences. */
function localFields(date: Date, formatter: Intl.DateTimeFormat) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    minute: Number(parts.minute),
    hour: Number(parts.hour),
    day: Number(parts.day),
    month: Number(parts.month),
    weekday: weekdays.get(parts.weekday ?? '') ?? -1,
  };
}

/** Find the next supported cron occurrence in the specified timezone within the bounded search. */
export function nextOccurrence(cron: string, timezone: string, after: Date): Date {
  const values = parseCron(cron);
  if (!values) throw new Error('INVALID_CRON');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    minute: '2-digit',
    hour: '2-digit',
    day: '2-digit',
    month: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const start = Math.floor(after.getTime() / 60000) * 60000 + 60000;
  for (let index = 0; index < 527040; index++) {
    const candidate = new Date(start + index * 60000);
    const local = localFields(candidate, formatter);
    const [minute, hour, day, month, weekday] = values;
    const dayMatches = day === null || local.day === day;
    const weekdayMatches = weekday === null || local.weekday === weekday;
    const calendarMatches =
      day === null || weekday === null ? dayMatches && weekdayMatches : dayMatches || weekdayMatches;
    if (
      (minute === null || local.minute === minute) &&
      (hour === null || local.hour === hour) &&
      (month === null || local.month === month) &&
      calendarMatches
    )
      return candidate;
  }
  throw new Error('CRON_OCCURRENCE_UNAVAILABLE');
}

export function scheduledEventId(targetId: string, revision: number, at: string) {
  return createHash('sha256').update(`${targetId}:${revision}:${at}`).digest('hex');
}
