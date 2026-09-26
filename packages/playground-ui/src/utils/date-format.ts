export type DateInput = Date | string | number | null | undefined;
export type DatePreset = 'date' | 'date-time' | 'date-time-seconds' | 'time' | 'time-seconds' | 'relative-time';

type FormatOptions = { locale?: string; now?: Date | number; timeZone?: string };

export function toDate(value: DateInput): Date | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const PRESET_OPTIONS = {
  time: { hour: 'numeric', minute: '2-digit' },
  'time-seconds': { hour: 'numeric', minute: '2-digit', second: '2-digit' },
  'date-time': { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  'date-time-seconds': {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  },
  calendar: { year: 'numeric', month: 'numeric', day: 'numeric', calendar: 'gregory', numberingSystem: 'latn' },
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

function calendarDate(date: Date, timeZone?: string) {
  const parts = getFormatter('calendar', 'en-US', timeZone).formatToParts(date);
  return {
    year: parts.find(part => part.type === 'year')?.value,
    month: parts.find(part => part.type === 'month')?.value,
    day: parts.find(part => part.type === 'day')?.value,
  };
}

/** Short absolute date without time: `Sep 24` this year, `Sep 24, 2025` otherwise. */
export function formatShortDate(value: DateInput, { locale, now, timeZone }: FormatOptions = {}) {
  const date = toDate(value);
  if (!date) return undefined;
  const reference = new Date(now ?? Date.now());
  const key =
    calendarDate(date, timeZone).year === calendarDate(reference, timeZone).year ? 'dayMonth' : 'dayMonthYear';
  return getFormatter(key, locale, timeZone).format(date);
}

/**
 * Uses the browser locale unless `locale` is given.
 * - `date`: date only; omits the year when it matches `now` in the requested timezone
 * - `date-time`: date, year and time to minutes, including historical dates
 * - `date-time-seconds`: date, year and time to seconds
 * - `time`: time to minutes, without a date
 * - `time-seconds`: time to seconds, without a date
 * - `relative-time`: short relative label; delegates to `date` at seven days
 */
export function formatDate(value: DateInput, preset: DatePreset, options: FormatOptions = {}) {
  const date = toDate(value);
  if (!date) return undefined;
  const { locale, now, timeZone } = options;

  if (preset === 'relative-time') {
    const diff = date.getTime() - new Date(now ?? Date.now()).getTime();
    const abs = Math.abs(diff);
    if (abs < 5_000) return 'just now';
    const units = [
      { limit: 60_000, size: 1_000, unit: 's' },
      { limit: 3_600_000, size: 60_000, unit: 'm' },
      { limit: 86_400_000, size: 3_600_000, unit: 'h' },
      { limit: 7 * 86_400_000, size: 86_400_000, unit: 'd' },
    ];
    const match = units.find(({ limit }) => abs < limit);
    if (!match) return formatDate(date, 'date', options);
    const label = `${Math.floor(abs / match.size)}${match.unit}`;
    return diff < 0 ? `${label} ago` : `in ${label}`;
  }
  if (preset === 'date') return formatShortDate(date, options);

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
