import { addDays, Locale, startOfISOWeek, startOfWeek } from 'date-fns';

/**
 * Generate a series of 7 days, starting from the week, to use for formatting
 * the weekday names (Monday, Tuesday, etc.).
 */
export function getWeekdays(
  locale?: Locale,
  /** The index of the first day of the week (0 - Sunday). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  /** Use ISOWeek instead of locale/ */
  ISOWeek?: boolean
): Date[] {
  const start = ISOWeek
    ? startOfISOWeek(new Date())
    : startOfWeek(new Date(), { locale, weekStartsOn });

  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    days.push(day);
  }
  return days;
}
