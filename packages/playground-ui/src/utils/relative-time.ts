import { formatShortDate, toDate } from './date-format';
import type { DateInput } from './date-format';

const UNITS = [
  { limit: 60_000, size: 1_000, unit: 's' },
  { limit: 3_600_000, size: 60_000, unit: 'm' },
  { limit: 86_400_000, size: 3_600_000, unit: 'h' },
  { limit: 7 * 86_400_000, size: 86_400_000, unit: 'd' },
];

/** Short relative label (`5m ago`, `in 5m`); falls back to an absolute date beyond 7 days. */
export function formatRelativeTime(value: DateInput, options: { now?: Date | number; locale?: string } = {}) {
  const date = toDate(value);
  if (!date) return undefined;
  const now = new Date(options.now ?? Date.now()).getTime();
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);

  if (abs < 5_000) return 'just now';

  const match = UNITS.find(({ limit }) => abs < limit);
  if (!match) return formatShortDate(date, { locale: options.locale, now });

  const label = `${Math.floor(abs / match.size)}${match.unit}`;
  return diff < 0 ? `${label} ago` : `in ${label}`;
}
