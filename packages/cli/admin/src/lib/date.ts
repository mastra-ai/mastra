/**
 * Format date object to `month day` format
 *
 * @param date
 * @param month
 * @param day
 * @returns
 * @example
 * formatDate(new Date('2021-01-01'))
 * // 'January 1'
 * formatDate(new Date('2021-01-01'), 'short')
 * // 'Jan 1'
 */
export const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions): string | null => {
  if (!date) return null;

  const defaultOptions = {
    month: 'long',
    day: 'numeric',
  } as const;

  return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
};
