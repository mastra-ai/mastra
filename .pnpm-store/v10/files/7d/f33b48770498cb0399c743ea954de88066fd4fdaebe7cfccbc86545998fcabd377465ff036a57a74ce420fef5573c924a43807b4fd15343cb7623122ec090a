import { isAfter, isBefore, isSameDay } from 'date-fns';

import { DateRange } from 'types/Matchers';

/**
 * Add a day to an existing range.
 *
 * The returned range takes in account the `undefined` values and if the added
 * day is already present in the range.
 */
export function addToRange(
  day: Date,
  range?: DateRange
): DateRange | undefined {
  const { from, to } = range || {};
  if (from && to) {
    if (isSameDay(to, day) && isSameDay(from, day)) {
      return undefined;
    }
    if (isSameDay(to, day)) {
      return { from: to, to: undefined };
    }
    if (isSameDay(from, day)) {
      return undefined;
    }
    if (isAfter(from, day)) {
      return { from: day, to };
    }
    return { from, to: day };
  }
  if (to) {
    if (isAfter(day, to)) {
      return { from: to, to: day };
    }
    return { from: day, to };
  }
  if (from) {
    if (isBefore(day, from)) {
      return { from: day, to: from };
    }
    return { from, to: day };
  }
  return { from: day, to: undefined };
}
