import { useCallback, useMemo, useRef } from 'react';
import type { SpanTab, TraceDatePreset } from '../index';
import {
  ROOT_ENTITY_TYPE_OPTIONS,
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_PRESET_VALUES,
  TRACE_DATE_TO_PARAM,
  TRACE_PROPERTY_FILTER_FIELD_IDS,
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
  TRACE_ROOT_ENTITY_TYPE_PARAM,
  TRACE_STATUS_PARAM,
  TRACE_STATUS_VALUES,
  applyTracePropertyFilterTokens,
  getTracePropertyFilterTokens,
} from '../trace-filters';
import type { EntityOptions, TraceStatusFilter } from '../trace-filters';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

const TRACE_ID_PARAM = 'traceId';
const SPAN_ID_PARAM = 'spanId';
const TAB_PARAM = 'tab';
const SCORE_ID_PARAM = 'scoreId';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_MS: Partial<Record<TraceDatePreset, number>> = {
  'last-24h': DAY_MS,
  'last-3d': 3 * DAY_MS,
  'last-7d': 7 * DAY_MS,
  'last-14d': 14 * DAY_MS,
  'last-30d': 30 * DAY_MS,
};

/** Mutates `params` in place to drop the featured trace/span/tab/score selection.
 *  Used whenever a filter changes — selection no longer makes sense in the new result set. */
function clearSelectionParams(params: URLSearchParams) {
  params.delete(TRACE_ID_PARAM);
  params.delete(SPAN_ID_PARAM);
  params.delete(TAB_PARAM);
  params.delete(SCORE_ID_PARAM);
}

/** Minimal interface compatible with react-router's `setSearchParams`. */
export type SetURLSearchParamsLike = (
  next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  options?: { replace?: boolean; preventScrollReset?: boolean; state?: unknown },
) => void;

export interface UseTraceUrlStateOptions {
  /** Called after `handleRemoveAll` clears all filter URL params. Use this to reset page-local
   *  UI state (e.g. a "group by thread" toggle) without wrapping the handler. */
  onRemoveAll?: () => void;
}

export interface UseTraceUrlStateResult {
  // Raw search params passed through for convenience
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;

  // Date state (derived from URL)
  datePreset: TraceDatePreset;
  selectedDateFrom: Date | undefined;
  selectedDateTo: Date | undefined;
  /** Synchronously-updated ref of the latest preset. Used to ignore onDateChange callbacks
   *  the date picker fires after a non-custom preset switch. */
  datePresetRef: React.MutableRefObject<TraceDatePreset>;

  // Selection state (derived from URL)
  traceIdParam: string | undefined;
  spanIdParam: string | undefined;
  spanTabParam: SpanTab | undefined;
  scoreIdParam: string | undefined;

  // Filter state (derived from URL)
  selectedEntityOption: EntityOptions | undefined;
  selectedStatus: TraceStatusFilter | undefined;
  filterTokens: PropertyFilterToken[];

  // URL-modifying handlers
  handleTraceClick: (traceId: string) => void;
  /** Convenience: clears the featured trace selection. Equivalent to `handleTraceClick('')`. */
  handleTraceClose: () => void;
  handleSpanChange: (spanId: string | null) => void;
  /** Convenience: clears the featured span selection. Equivalent to `handleSpanChange(null)`. */
  handleSpanClose: () => void;
  handleSpanTabChange: (tab: SpanTab) => void;
  handleScoreChange: (scoreId: string | null) => void;
  handleFilterTokensChange: (nextTokens: PropertyFilterToken[]) => void;
  handleDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
  handleDatePresetChange: (preset: TraceDatePreset) => void;
  handleRemoveAll: () => void;

  /** Lower-level helper used by `handleClear`: writes a token set and clears the trace/span selection. */
  applyFilterTokens: (tokens: PropertyFilterToken[]) => void;
}

/**
 * Owns all URL-derived state and URL-modifying handlers for the traces page. Routing-agnostic —
 * pass `searchParams` and `setSearchParams` from whichever router the consumer uses.
 *
 * Stays focused on URL state: localStorage save/restore, filter discovery, and the error-view
 * short-circuit are intentionally NOT part of this hook so consumers can swap them independently.
 */
export function useTraceUrlState(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  options?: UseTraceUrlStateOptions,
): UseTraceUrlStateResult {
  const { onRemoveAll } = options ?? {};
  const datePreset = useMemo<TraceDatePreset>(() => {
    const value = searchParams.get(TRACE_DATE_PRESET_PARAM);
    return value && TRACE_DATE_PRESET_VALUES.has(value as TraceDatePreset) ? (value as TraceDatePreset) : 'last-24h';
  }, [searchParams]);

  const dateFromParamRaw = searchParams.get(TRACE_DATE_FROM_PARAM);
  const dateToParamRaw = searchParams.get(TRACE_DATE_TO_PARAM);

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

  // Track the latest preset synchronously so onDateChange callbacks that follow
  // a non-custom preset switch can be ignored (router setSearchParams captures
  // searchParams in its closure, so multiple synchronous calls would otherwise
  // clobber each other).
  const datePresetRef = useRef(datePreset);
  datePresetRef.current = datePreset;

  const traceIdParam = searchParams.get(TRACE_ID_PARAM) || undefined;
  const spanIdParam = searchParams.get(SPAN_ID_PARAM) || undefined;
  const tabParam = searchParams.get(TAB_PARAM);
  const spanTabParam: SpanTab | undefined =
    tabParam === 'scoring'
      ? 'scoring'
      : tabParam === 'feedback'
        ? 'feedback'
        : tabParam === 'details'
          ? 'details'
          : undefined;
  const scoreIdParam = searchParams.get(SCORE_ID_PARAM) || undefined;

  const selectedEntityOption = useMemo(
    () => ROOT_ENTITY_TYPE_OPTIONS.find(option => option.entityType === searchParams.get(TRACE_ROOT_ENTITY_TYPE_PARAM)),
    [searchParams],
  );
  const selectedStatus = useMemo<TraceStatusFilter | undefined>(() => {
    const value = searchParams.get(TRACE_STATUS_PARAM);
    return value && TRACE_STATUS_VALUES.has(value as TraceStatusFilter) ? (value as TraceStatusFilter) : undefined;
  }, [searchParams]);
  const filterTokens = useMemo(() => getTracePropertyFilterTokens(searchParams), [searchParams]);

  const handleTraceClick = useCallback(
    (traceId: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (traceId) {
            next.set(TRACE_ID_PARAM, traceId);
          } else {
            next.delete(TRACE_ID_PARAM);
          }
          next.delete(SPAN_ID_PARAM);
          next.delete(TAB_PARAM);
          next.delete(SCORE_ID_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleTraceClose = useCallback(() => handleTraceClick(''), [handleTraceClick]);

  const handleSpanChange = useCallback(
    (spanId: string | null) => {
      const currentSpanId = searchParams.get(SPAN_ID_PARAM) || null;
      if (spanId === currentSpanId) return;

      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (spanId) {
            next.set(SPAN_ID_PARAM, spanId);
          } else {
            next.delete(SPAN_ID_PARAM);
          }
          // Tab + score are per-span; they'd point at the previous span's context otherwise.
          next.delete(TAB_PARAM);
          next.delete(SCORE_ID_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [searchParams, setSearchParams],
  );

  const handleSpanClose = useCallback(() => handleSpanChange(null), [handleSpanChange]);

  const handleSpanTabChange = useCallback(
    (tab: SpanTab) => {
      const currentTab = searchParams.get(TAB_PARAM) || null;
      if (tab === currentTab) return;

      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (tab && tab !== 'details') {
            next.set(TAB_PARAM, tab);
          } else {
            next.delete(TAB_PARAM);
          }
          next.delete(SCORE_ID_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [searchParams, setSearchParams],
  );

  const handleScoreChange = useCallback(
    (scoreId: string | null) => {
      const currentScoreId = searchParams.get(SCORE_ID_PARAM) || null;
      if (scoreId === currentScoreId) return;

      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (scoreId) {
            next.set(SCORE_ID_PARAM, scoreId);
          } else {
            next.delete(SCORE_ID_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [searchParams, setSearchParams],
  );

  const applyFilterTokens = useCallback(
    (tokens: PropertyFilterToken[]) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          // applyTracePropertyFilterTokens wipes all filter params (including
          // rootEntityType / status) and re-adds them in `nextTokens` order so
          // URL insertion order == filter creation order.
          applyTracePropertyFilterTokens(next, tokens);
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleFilterTokensChange = applyFilterTokens;

  // Only relevant for 'custom' — the picker also fires onDateChange after a
  // non-custom preset switch, which we ignore to avoid racing URL updates.
  const handleDateChange = useCallback(
    (value: Date | undefined, type: 'from' | 'to') => {
      if (datePresetRef.current !== 'custom') return;
      const param = type === 'from' ? TRACE_DATE_FROM_PARAM : TRACE_DATE_TO_PARAM;
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
    (preset: TraceDatePreset) => {
      // Update ref synchronously so any onDateChange fired by the picker in the
      // same tick (for non-custom presets) sees the new value and skips.
      datePresetRef.current = preset;
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (preset === 'last-24h') {
            // Default — clear all date params.
            next.delete(TRACE_DATE_PRESET_PARAM);
            next.delete(TRACE_DATE_FROM_PARAM);
            next.delete(TRACE_DATE_TO_PARAM);
          } else if (preset === 'custom') {
            next.set(TRACE_DATE_PRESET_PARAM, 'custom');
            // Keep existing dateFrom/dateTo for the user to adjust.
          } else {
            // `last-*` or 'all' — only the preset is stored; dates are derived.
            next.set(TRACE_DATE_PRESET_PARAM, preset);
            next.delete(TRACE_DATE_FROM_PARAM);
            next.delete(TRACE_DATE_TO_PARAM);
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
        next.delete(TRACE_ROOT_ENTITY_TYPE_PARAM);
        next.delete(TRACE_STATUS_PARAM);
        for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
          next.delete(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
        }
        clearSelectionParams(next);
        return next;
      },
      { replace: true },
    );
    onRemoveAll?.();
  }, [setSearchParams, onRemoveAll]);

  return {
    searchParams,
    setSearchParams,
    datePreset,
    selectedDateFrom,
    selectedDateTo,
    datePresetRef,
    traceIdParam,
    spanIdParam,
    spanTabParam,
    scoreIdParam,
    selectedEntityOption,
    selectedStatus,
    filterTokens,
    handleTraceClick,
    handleTraceClose,
    handleSpanChange,
    handleSpanClose,
    handleSpanTabChange,
    handleScoreChange,
    handleFilterTokensChange,
    handleDateChange,
    handleDatePresetChange,
    handleRemoveAll,
    applyFilterTokens,
  };
}
