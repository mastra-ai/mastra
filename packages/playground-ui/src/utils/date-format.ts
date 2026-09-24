export type DateInput = Date | string | number | null | undefined;
export type DatePreset = 'smart' | 'dateTime' | 'time';

type FormatOptions = { locale?: string; now?: Date | number; timeZone?: string };

export function toDate(value: DateInput): Date | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const PRESET_OPTIONS = {
  time: { hour: 'numeric', minute: '2-digit' },
  dateTime: { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  dayMonth: { month: 'short', day: 'numeric' },
  dayMonthYear: { month: 'short', day: 'numeric', year: 'numeric' },
  precise: {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  },
  timePrecise: { hour: 'numeric', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

type FormatterKey = keyof typeof PRESET_OPTIONS;

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(key: FormatterKey, locale?: string, timeZone?: string) {
  const cacheKey = `${locale ?? ''}|${timeZone ?? ''}|${key}`;
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...PRESET_OPTIONS[key], timeZone });
    formatters.set(cacheKey, formatter);
  }
  return formatter;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Short absolute date without time: `Sep 24` this year, `Sep 24, 2025` otherwise. */
export function formatShortDate(value: DateInput, { locale, now, timeZone }: FormatOptions = {}) {
  const date = toDate(value);
  if (!date) return undefined;
  const reference = new Date(now ?? Date.now());
  const key = date.getFullYear() === reference.getFullYear() ? 'dayMonth' : 'dayMonthYear';
  return getFormatter(key, locale, timeZone).format(date);
}

/**
 * Locale-aware absolute date. Uses the browser locale unless `locale` is given.
 * - `smart`: `Today 2:32 PM` / `Sep 24` / `Sep 24, 2025`
 * - `dateTime`: `Sep 24, 2026, 2:32 PM`
 * - `time`: `2:32 PM`
 */
export function formatDate(value: DateInput, preset: DatePreset, options: FormatOptions = {}) {
  const date = toDate(value);
  if (!date) return undefined;
  const { locale, now, timeZone } = options;

  if (preset === 'smart') {
    const reference = new Date(now ?? Date.now());
    if (isSameDay(date, reference)) return `Today ${getFormatter('time', locale, timeZone).format(date)}`;
    return formatShortDate(date, options);
  }

  return getFormatter(preset, locale, timeZone).format(date);
}

/** Locale-aware compact date range, e.g. `Sep 2 – 5, 2026`. */
export function formatDateRange(start: DateInput, end: DateInput, options: Omit<FormatOptions, 'now'> = {}) {
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) return undefined;
  return getFormatter('dayMonthYear', options.locale, options.timeZone)
    .formatRange(from, to)
    .replace(/\u2009/g, ' ');
}

/** Date and time down to milliseconds, for trace debugging. `withDate: false` keeps only the time. */
export function formatTimestampPrecise(
  value: DateInput,
  { locale, withDate = true }: { locale?: string; withDate?: boolean } = {},
) {
  const date = toDate(value);
  return date ? getFormatter(withDate ? 'precise' : 'timePrecise', locale).format(date) : undefined;
}
