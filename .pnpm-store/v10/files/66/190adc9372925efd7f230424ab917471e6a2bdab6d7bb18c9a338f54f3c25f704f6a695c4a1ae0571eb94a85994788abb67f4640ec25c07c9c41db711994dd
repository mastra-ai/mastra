import {
  addWeeks,
  endOfMonth,
  getWeeksInMonth,
  Locale,
  startOfMonth
} from 'date-fns';

import { daysToMonthWeeks } from './daysToMonthWeeks';

/** Represents a week in the month.*/
export type MonthWeek = {
  /** The week number from the start of the year. */
  weekNumber: number;
  /** The dates in the week. */
  dates: Date[];
};

/**
 * Return the weeks belonging to the given month, adding the "outside days" to
 * the first and last week.
 */
export function getMonthWeeks(
  month: Date,
  options: {
    locale: Locale;
    useFixedWeeks?: boolean;
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    firstWeekContainsDate?: 1 | 4;
    ISOWeek?: boolean;
  }
): MonthWeek[] {
  const weeksInMonth: MonthWeek[] = daysToMonthWeeks(
    startOfMonth(month),
    endOfMonth(month),
    options
  );

  if (options?.useFixedWeeks) {
    // Add extra weeks to the month, up to 6 weeks
    const nrOfMonthWeeks = getWeeksInMonth(month, options);
    if (nrOfMonthWeeks < 6) {
      const lastWeek = weeksInMonth[weeksInMonth.length - 1];
      const lastDate = lastWeek.dates[lastWeek.dates.length - 1];
      const toDate = addWeeks(lastDate, 6 - nrOfMonthWeeks);
      const extraWeeks = daysToMonthWeeks(
        addWeeks(lastDate, 1),
        toDate,
        options
      );
      weeksInMonth.push(...extraWeeks);
    }
  }
  return weeksInMonth;
}
