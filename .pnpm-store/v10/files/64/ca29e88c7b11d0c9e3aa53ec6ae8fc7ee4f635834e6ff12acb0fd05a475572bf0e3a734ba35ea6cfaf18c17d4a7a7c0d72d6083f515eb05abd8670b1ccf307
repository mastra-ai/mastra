import { differenceInCalendarDays, isAfter, isDate, isSameDay } from 'date-fns';

import {
  isDateAfterType,
  isDateBeforeType,
  isDateInterval,
  isDateRange,
  isDayOfWeekType,
  Matcher
} from 'types/Matchers';

import { isDateInRange } from './isDateInRange';

/** Returns true if `value` is a Date type. */
function isDateType(value: unknown): value is Date {
  return isDate(value);
}

/** Returns true if `value` is an array of valid dates. */
function isArrayOfDates(value: unknown): value is Date[] {
  return Array.isArray(value) && value.every(isDate);
}

/**
 * Returns whether a day matches against at least one of the given Matchers.
 *
 * ```
 * const day = new Date(2022, 5, 19);
 * const matcher1: DateRange = {
 *    from: new Date(2021, 12, 21),
 *    to: new Date(2021, 12, 30)
 * }
 * const matcher2: DateRange = {
 *    from: new Date(2022, 5, 1),
 *    to: new Date(2022, 5, 23)
 * }
 *
 * const isMatch(day, [matcher1, matcher2]); // true, since day is in the matcher1 range.
 * ```
 * */
export function isMatch(day: Date, matchers: Matcher[]): boolean {
  return matchers.some((matcher: Matcher) => {
    if (typeof matcher === 'boolean') {
      return matcher;
    }
    if (isDateType(matcher)) {
      return isSameDay(day, matcher);
    }
    if (isArrayOfDates(matcher)) {
      return matcher.includes(day);
    }
    if (isDateRange(matcher)) {
      return isDateInRange(day, matcher);
    }
    if (isDayOfWeekType(matcher)) {
      return matcher.dayOfWeek.includes(day.getDay());
    }
    if (isDateInterval(matcher)) {
      const diffBefore = differenceInCalendarDays(matcher.before, day);
      const diffAfter = differenceInCalendarDays(matcher.after, day);
      const isDayBefore = diffBefore > 0;
      const isDayAfter = diffAfter < 0;
      const isClosedInterval = isAfter(matcher.before, matcher.after);
      if (isClosedInterval) {
        return isDayAfter && isDayBefore;
      } else {
        return isDayBefore || isDayAfter;
      }
    }
    if (isDateAfterType(matcher)) {
      return differenceInCalendarDays(day, matcher.after) > 0;
    }
    if (isDateBeforeType(matcher)) {
      return differenceInCalendarDays(matcher.before, day) > 0;
    }
    if (typeof matcher === 'function') {
      return matcher(day);
    }
    return false;
  });
}
