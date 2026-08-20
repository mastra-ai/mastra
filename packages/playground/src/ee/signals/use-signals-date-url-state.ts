import type { DateRangePreset } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

const DATE_PRESET_PARAM = 'datePreset';
const DATE_FROM_PARAM = 'dateFrom';
const DATE_TO_PARAM = 'dateTo';
const THEME_ID_PARAM = 'themeId';
const DEFAULT_DATE_PRESET = 'last-7d';

const DATE_PRESETS = new Set<DateRangePreset>([
  'all',
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
]);

const PRESET_MS: Partial<Record<DateRangePreset, number>> = {
  'last-24h': 24 * 60 * 60 * 1000,
  'last-3d': 3 * 24 * 60 * 60 * 1000,
  'last-7d': 7 * 24 * 60 * 60 * 1000,
  'last-14d': 14 * 24 * 60 * 60 * 1000,
  'last-30d': 30 * 24 * 60 * 60 * 1000,
};

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function useSignalsDateUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datePreset = useMemo<DateRangePreset>(() => {
    const value = searchParams.get(DATE_PRESET_PARAM);
    return value && DATE_PRESETS.has(value as DateRangePreset) ? (value as DateRangePreset) : DEFAULT_DATE_PRESET;
  }, [searchParams]);

  const selectedDateFrom = useMemo(() => {
    if (datePreset === 'custom') return parseDate(searchParams.get(DATE_FROM_PARAM));
    const presetMs = PRESET_MS[datePreset];
    return presetMs ? new Date(Date.now() - presetMs) : undefined;
  }, [datePreset, searchParams]);
  const selectedDateTo = useMemo(
    () => (datePreset === 'custom' ? parseDate(searchParams.get(DATE_TO_PARAM)) : undefined),
    [datePreset, searchParams],
  );
  const selectedThemeId = useMemo(() => {
    const value = searchParams.get(THEME_ID_PARAM);
    return value && /^\d+$/.test(value) ? value : undefined;
  }, [searchParams]);

  const datePresetRef = useRef(datePreset);
  datePresetRef.current = datePreset;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const handleDateChange = useCallback(
    (value: Date | undefined, type: 'from' | 'to') => {
      if (datePresetRef.current !== 'custom') return;
      const next = new URLSearchParams(searchParamsRef.current);
      const param = type === 'from' ? DATE_FROM_PARAM : DATE_TO_PARAM;
      if (value) next.set(param, value.toISOString());
      else next.delete(param);
      searchParamsRef.current = next;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  const handleThemeIdChange = useCallback(
    (themeId: string | undefined) => {
      const next = new URLSearchParams(searchParamsRef.current);
      if (themeId) next.set(THEME_ID_PARAM, themeId);
      else next.delete(THEME_ID_PARAM);
      searchParamsRef.current = next;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  const handleDatePresetChange = useCallback(
    (preset: DateRangePreset) => {
      datePresetRef.current = preset;
      const next = new URLSearchParams(searchParamsRef.current);
      if (preset === DEFAULT_DATE_PRESET) {
        next.delete(DATE_PRESET_PARAM);
        next.delete(DATE_FROM_PARAM);
        next.delete(DATE_TO_PARAM);
      } else if (preset === 'custom') {
        next.set(DATE_PRESET_PARAM, preset);
        if (!next.has(DATE_FROM_PARAM) && selectedDateFrom) {
          next.set(DATE_FROM_PARAM, selectedDateFrom.toISOString());
        }
      } else {
        next.set(DATE_PRESET_PARAM, preset);
        next.delete(DATE_FROM_PARAM);
        next.delete(DATE_TO_PARAM);
      }
      searchParamsRef.current = next;
      setSearchParams(next, { replace: true });
    },
    [selectedDateFrom, setSearchParams],
  );

  return {
    datePreset,
    selectedDateFrom,
    selectedDateTo,
    selectedThemeId,
    handleDateChange,
    handleDatePresetChange,
    handleThemeIdChange,
  };
}
