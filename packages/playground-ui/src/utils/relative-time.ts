import { formatDate } from './date-format';
import type { DateInput } from './date-format';

/** Short relative label (`5m ago`, `in 5m`); falls back to an absolute date beyond 7 days. */
export function formatRelativeTime(
  value: DateInput,
  options: { now?: Date | number; locale?: string; timeZone?: string } = {},
) {
  return formatDate(value, 'relative-time', options);
}
