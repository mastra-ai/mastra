import { differenceInDays, differenceInHours, differenceInMinutes, format, isValid } from 'date-fns';

/**
 * Compact relative timestamp for dense UI (thread lists, activity rows):
 * "just now", "5m", "3h", "2d", then a short calendar date ("Jun 29") once
 * the value is a week or older. Invalid input renders as an empty string so
 * callers can interpolate without guarding.
 *
 * `now` is injectable for deterministic tests; production callers omit it.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (!isValid(then)) return '';
  const minutes = differenceInMinutes(now, then);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = differenceInHours(now, then);
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(now, then);
  if (days < 7) return `${days}d`;
  return format(then, 'MMM d');
}
