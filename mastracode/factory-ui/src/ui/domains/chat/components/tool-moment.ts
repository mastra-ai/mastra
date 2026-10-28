import { formatDate, formatShortDate } from '@mastra/playground-ui/utils/date-format';

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today at 10:44:44 AM", "Yesterday at …", "Oct 21 at …", "Oct 21, 2025 at …". */
export function toolMoment(time: Date, { now = new Date(), locale }: { now?: Date; locale?: string } = {}): string {
  const clock = formatDate(time, 'time-seconds', { locale });
  const days = Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS);
  if (days === 0) return `Today at ${clock}`;
  if (days === 1) return `Yesterday at ${clock}`;
  return `${formatShortDate(time, { locale, now })} at ${clock}`;
}
