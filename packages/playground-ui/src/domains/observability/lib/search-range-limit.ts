import { resolveTracesDateWindow } from '@/domains/traces/components/traces-explorer/traces-explorer-actions';
import type { TraceDatePreset } from '@/domains/traces/types';
import type { DateTimeRangePickerLimit } from '@/ds/components/DateTimeRangePicker';

/** How many days a word search may cover on hosts that cap it (the hosted trace query API does). */
export const SEARCH_MAX_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const PRESET_BY_DAYS: Partial<Record<number, TraceDatePreset>> = {
  1: 'last-24h',
  3: 'last-3d',
  7: 'last-7d',
  14: 'last-14d',
  30: 'last-30d',
};

export type SearchRangeDates = { datePreset: TraceDatePreset; dateFrom?: Date; dateTo?: Date };

/** The picker limit while a word search is active. */
export const searchRangeLimit = (maxDays: number): DateTimeRangePickerLimit => ({
  maxMs: maxDays * DAY_MS,
  reason: `Search covers at most ${maxDays} days`,
});

export const searchNarrowedNote = (maxDays: number) =>
  `Search covers at most ${maxDays} days, so we narrowed the range.`;

/**
 * The range a word search narrows `dates` to: the last `maxDays` days ending where the range
 * ends. `undefined` when the range already fits.
 */
export function narrowDatesForSearch(
  dates: SearchRangeDates,
  maxDays: number,
  now: Date = new Date(),
): SearchRangeDates | undefined {
  const maxMs = maxDays * DAY_MS;
  const { dateFrom, dateTo } = resolveTracesDateWindow(dates.datePreset, dates.dateFrom, dates.dateTo, now);
  if (dateFrom && (dateTo ?? now).getTime() - dateFrom.getTime() <= maxMs) return undefined;
  if (dateTo) return { datePreset: 'custom', dateFrom: new Date(dateTo.getTime() - maxMs), dateTo };
  const preset = PRESET_BY_DAYS[maxDays];
  return preset ? { datePreset: preset } : { datePreset: 'custom', dateFrom: new Date(now.getTime() - maxMs) };
}
