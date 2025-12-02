import { addMonths, differenceInCalendarMonths, startOfMonth } from 'date-fns';

/**
 * Return the months to display in the component according to the number of
 * months and the from/to date.
 */
export function getDisplayMonths(
  month: Date,
  {
    reverseMonths,
    numberOfMonths
  }: {
    reverseMonths?: boolean;
    numberOfMonths: number;
  }
): Date[] {
  const start = startOfMonth(month);
  const end = startOfMonth(addMonths(start, numberOfMonths));
  const monthsDiff = differenceInCalendarMonths(end, start);
  let months = [];

  for (let i = 0; i < monthsDiff; i++) {
    const nextMonth = addMonths(start, i);
    months.push(nextMonth);
  }

  if (reverseMonths) months = months.reverse();
  return months;
}
