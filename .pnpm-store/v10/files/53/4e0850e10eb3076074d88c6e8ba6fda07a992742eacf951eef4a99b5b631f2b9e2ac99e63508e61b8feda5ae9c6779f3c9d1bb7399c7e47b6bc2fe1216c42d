/**
 * A value or a function that matches a specific day.
 *
 *
 * Matchers are passed to DayPicker via {@link DayPickerBase.disabled},
 * {@link DayPickerBase.hidden]] or [[DayPickerProps.selected} and are used to
 * determine if a day should get a {@link Modifier}.
 *
 * Matchers can be of different types:
 *
 * ```
 * // will always match the day
 * const booleanMatcher: Matcher = true;
 *
 *  // will match the today's date
 * const dateMatcher: Matcher = new Date();
 *
 * // will match the days in the array
 * const arrayMatcher: Matcher = [new Date(2019, 1, 2), new Date(2019, 1, 4)];
 *
 * // will match days after the 2nd of February 2019
 * const afterMatcher: DateAfter = { after: new Date(2019, 1, 2) };
 *  // will match days before the 2nd of February 2019 }
 * const beforeMatcher: DateBefore = { before: new Date(2019, 1, 2) };
 *
 * // will match Sundays
 * const dayOfWeekMatcher: DayOfWeek = {
 *  dayOfWeek: 0
 * };
 *
 * // will match the included days, except the two dates
 * const intervalMatcher: DateInterval = {
 *    after: new Date(2019, 1, 2),
 *    before: new Date(2019, 1, 5)
 * };
 *
 * // will match the included days, including the two dates
 * const rangeMatcher: DateRange = {
 *    from: new Date(2019, 1, 2),
 *    to: new Date(2019, 1, 5)
 * };
 *
 * // will match when the function return true
 * const functionMatcher: Matcher = (day: Date) => {
 *  return day.getMonth() === 2 // match when month is March
 * };
 * ```
 *
 * @see {@link isMatch}
 *
 * */
export type Matcher =
  | boolean
  | ((date: Date) => boolean)
  | Date
  | Date[]
  | DateRange
  | DateBefore
  | DateAfter
  | DateInterval
  | DayOfWeek;

/** A matcher to match a day falling after the specified date, with the date not included. */
export type DateAfter = { after: Date };

/** A matcher to match a day falling before the specified date, with the date not included. */
export type DateBefore = { before: Date };

/** A matcher to match a day falling before and/or after two dates, where the dates are not included. */
export type DateInterval = { before: Date; after: Date };

/** A matcher to match a range of dates. The range can be open. Differently from {@link DateInterval}, the dates here are included. */
export type DateRange = { from: Date | undefined; to?: Date | undefined };

/** A matcher to match a date being one of the specified days of the week (`0-6`, where `0` is Sunday). */
export type DayOfWeek = { dayOfWeek: number[] };

/** Returns true if `matcher` is of type {@link DateInterval}. */
export function isDateInterval(matcher: unknown): matcher is DateInterval {
  return Boolean(
    matcher &&
      typeof matcher === 'object' &&
      'before' in matcher &&
      'after' in matcher
  );
}

/** Returns true if `value` is a {@link DateRange} type. */
export function isDateRange(value: unknown): value is DateRange {
  return Boolean(value && typeof value === 'object' && 'from' in value);
}

/** Returns true if `value` is of type {@link DateAfter}. */
export function isDateAfterType(value: unknown): value is DateAfter {
  return Boolean(value && typeof value === 'object' && 'after' in value);
}

/** Returns true if `value` is of type {@link DateBefore}. */
export function isDateBeforeType(value: unknown): value is DateBefore {
  return Boolean(value && typeof value === 'object' && 'before' in value);
}

/** Returns true if `value` is a {@link DayOfWeek} type. */
export function isDayOfWeekType(value: unknown): value is DayOfWeek {
  return Boolean(value && typeof value === 'object' && 'dayOfWeek' in value);
}
