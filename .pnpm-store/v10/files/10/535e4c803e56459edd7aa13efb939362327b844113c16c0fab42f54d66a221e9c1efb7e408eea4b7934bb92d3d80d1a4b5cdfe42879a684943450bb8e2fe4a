import { addMonths, differenceInCalendarMonths, startOfMonth } from 'date-fns';

/**
 * Returns the next previous the user can navigate to, according to the given
 * options.
 *
 * Please note that the previous month is not always the previous calendar
 * month:
 *
 * - if before the `fromDate` date, is `undefined`;
 * - if the navigation is paged, is the number of months displayed before.
 *
 */
export function getPreviousMonth(
  startingMonth: Date,
  options: {
    numberOfMonths?: number;
    fromDate?: Date;
    toDate?: Date;
    pagedNavigation?: boolean;
    today?: Date;
    disableNavigation?: boolean;
  }
): Date | undefined {
  if (options.disableNavigation) {
    return undefined;
  }
  const { fromDate, pagedNavigation, numberOfMonths = 1 } = options;
  const offset = pagedNavigation ? numberOfMonths : 1;
  const month = startOfMonth(startingMonth);
  if (!fromDate) {
    return addMonths(month, -offset);
  }
  const monthsDiff = differenceInCalendarMonths(month, fromDate);

  if (monthsDiff <= 0) {
    return undefined;
  }

  // Jump back as the number of months when paged navigation
  return addMonths(month, -offset);
}
