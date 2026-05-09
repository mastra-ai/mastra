import { useCallback, useMemo, useRef } from 'react';
import type { SetURLSearchParamsLike } from '../../traces/hooks/use-trace-url-state';
import {
  LOGS_DATE_FROM_PARAM,
  LOGS_DATE_PRESET_PARAM,
  LOGS_DATE_PRESET_VALUES,
  LOGS_DATE_TO_PARAM,
  LOGS_PROPERTY_FILTER_FIELD_IDS,
  LOGS_PROPERTY_FILTER_PARAM_BY_FIELD,
  LOGS_ROOT_ENTITY_TYPE_OPTIONS,
  LOGS_ROOT_ENTITY_TYPE_PARAM,
  applyLogsPropertyFilterTokens,
  getLogsPropertyFilterTokens,
} from '../log-filters';
import type { LogsDatePreset, LogsEntityOptions } from '../log-filters';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

const LOG_PARAM = 'logId';
const TRACE_PARAM = 'traceId';
const SPAN_PARAM = 'spanId';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_MS: Partial<Record<LogsDatePreset, number>> = {
  'last-24h': DAY_MS,
  'last-3d': 3 * DAY_MS,
  'last-7d': 7 * DAY_MS,
  'last-14d': 14 * DAY_MS,
  'last-30d': 30 * DAY_MS,
};

/** Mutates `params` in place to drop the featured log/trace/span selection.
 *  Used whenever a filter changes — selection no longer makes sense in the new result set. */
function clearSelectionParams(params: URLSearchParams) {
  params.delete(LOG_PARAM);
  params.delete(TRACE_PARAM);
  params.delete(SPAN_PARAM);
}

export interface LogsFeaturedIds {
  logId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
}

export interface UseLogsUrlStateOptions {
  /** Called after `handleRemoveAll` clears all filter URL params. */
  onRemoveAll?: () => void;
}

export interface UseLogsUrlStateResult {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;

  datePreset: LogsDatePreset;
  selectedDateFrom: Date | undefined;
  selectedDateTo: Date | undefined;
  datePresetRef: React.MutableRefObject<LogsDatePreset>;

  featuredLogId: string | null;
  featuredTraceId: string | null;
  featuredSpanId: string | null;

  selectedEntityOption: LogsEntityOptions | undefined;
  filterTokens: PropertyFilterToken[];

  /** Partial update of the featured log/trace/span selection. Omitted keys are left as-is. */
  handleFeaturedChange: (ids: LogsFeaturedIds) => void;
  handleFilterTokensChange: (nextTokens: PropertyFilterToken[]) => void;
  handleDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
  handleDatePresetChange: (preset: LogsDatePreset) => void;
  handleRemoveAll: () => void;

  /** Lower-level helper used by `handleClear`: writes a token set and clears the log/trace/span selection. */
  applyFilterTokens: (tokens: PropertyFilterToken[]) => void;
}

/**
 * Owns all URL-derived state and URL-modifying handlers for the logs page. Routing-agnostic —
 * pass `searchParams` and `setSearchParams` from whichever router the consumer uses.
 */
export function useLogsUrlState(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  options?: UseLogsUrlStateOptions,
): UseLogsUrlStateResult {
  const { onRemoveAll } = options ?? {};

  const datePreset = useMemo<LogsDatePreset>(() => {
    const value = searchParams.get(LOGS_DATE_PRESET_PARAM);
    return value && LOGS_DATE_PRESET_VALUES.has(value as LogsDatePreset) ? (value as LogsDatePreset) : 'last-24h';
  }, [searchParams]);

  const dateFromParamRaw = searchParams.get(LOGS_DATE_FROM_PARAM);
  const dateToParamRaw = searchParams.get(LOGS_DATE_TO_PARAM);

  const selectedDateFrom = useMemo(() => {
    if (datePreset === 'custom') {
      if (!dateFromParamRaw) return undefined;
      const parsed = new Date(dateFromParamRaw);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    if (datePreset === 'all') return undefined;
    const ms = PRESET_MS[datePreset];
    return ms ? new Date(Date.now() - ms) : undefined;
  }, [datePreset, dateFromParamRaw]);

  const selectedDateTo = useMemo(() => {
    if (datePreset !== 'custom' || !dateToParamRaw) return undefined;
    const parsed = new Date(dateToParamRaw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [datePreset, dateToParamRaw]);

  const datePresetRef = useRef(datePreset);
  datePresetRef.current = datePreset;

  const featuredLogId = searchParams.get(LOG_PARAM);
  const featuredTraceId = searchParams.get(TRACE_PARAM);
  const featuredSpanId = searchParams.get(SPAN_PARAM);

  const selectedEntityOption = useMemo(
    () =>
      LOGS_ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === searchParams.get(LOGS_ROOT_ENTITY_TYPE_PARAM)),
    [searchParams],
  );

  const filterTokens = useMemo(() => getLogsPropertyFilterTokens(searchParams), [searchParams]);

  const handleFeaturedChange = useCallback(
    (ids: LogsFeaturedIds) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          for (const [field, value] of Object.entries(ids)) {
            const param = field === 'logId' ? LOG_PARAM : field === 'traceId' ? TRACE_PARAM : SPAN_PARAM;
            if (value) {
              next.set(param, value);
            } else {
              next.delete(param);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const applyFilterTokens = useCallback(
    (tokens: PropertyFilterToken[]) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          applyLogsPropertyFilterTokens(next, tokens);
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleFilterTokensChange = applyFilterTokens;

  const handleDateChange = useCallback(
    (value: Date | undefined, type: 'from' | 'to') => {
      if (datePresetRef.current !== 'custom') return;
      const param = type === 'from' ? LOGS_DATE_FROM_PARAM : LOGS_DATE_TO_PARAM;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set(param, value.toISOString());
          } else {
            next.delete(param);
          }
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleDatePresetChange = useCallback(
    (preset: LogsDatePreset) => {
      datePresetRef.current = preset;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === 'last-24h') {
            next.delete(LOGS_DATE_PRESET_PARAM);
            next.delete(LOGS_DATE_FROM_PARAM);
            next.delete(LOGS_DATE_TO_PARAM);
          } else if (preset === 'custom') {
            next.set(LOGS_DATE_PRESET_PARAM, 'custom');
          } else {
            next.set(LOGS_DATE_PRESET_PARAM, preset);
            next.delete(LOGS_DATE_FROM_PARAM);
            next.delete(LOGS_DATE_TO_PARAM);
          }
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleRemoveAll = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete(LOGS_ROOT_ENTITY_TYPE_PARAM);
        for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
          next.delete(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
        }
        next.delete(LOGS_DATE_PRESET_PARAM);
        next.delete(LOGS_DATE_FROM_PARAM);
        next.delete(LOGS_DATE_TO_PARAM);
        clearSelectionParams(next);
        return next;
      },
      { replace: true },
    );
    onRemoveAll?.();
  }, [setSearchParams, onRemoveAll]);

  return useMemo(
    () => ({
      searchParams,
      setSearchParams,
      datePreset,
      selectedDateFrom,
      selectedDateTo,
      datePresetRef,
      featuredLogId,
      featuredTraceId,
      featuredSpanId,
      selectedEntityOption,
      filterTokens,
      handleFeaturedChange,
      handleFilterTokensChange,
      handleDateChange,
      handleDatePresetChange,
      handleRemoveAll,
      applyFilterTokens,
    }),
    [
      searchParams,
      setSearchParams,
      datePreset,
      selectedDateFrom,
      selectedDateTo,
      datePresetRef,
      featuredLogId,
      featuredTraceId,
      featuredSpanId,
      selectedEntityOption,
      filterTokens,
      handleFeaturedChange,
      handleFilterTokensChange,
      handleDateChange,
      handleDatePresetChange,
      handleRemoveAll,
      applyFilterTokens,
    ],
  );
}
