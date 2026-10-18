import type { EntityType } from '@mastra/core/observability';
import { useMemo, useRef } from 'react';

export type MetricsDatePreset = '24h' | '3d' | '7d' | '14d' | '30d' | 'custom';

export type MetricsDateRange = { from?: Date; to?: Date };

/** Shape of the dimensional filter object fed into `MetricsFilter` on client
 *  calls. Kept compatible with `metricsFilterSchema` in @internal/core — every
 *  scalar field maps to a single-string column filter, and `tags` is the only
 *  array field (matched via `has()` / equivalent on backends). */
export type MetricsDimensionalFilter = {
  rootEntityType?: EntityType;
  entityName?: string;
  tags?: string[];
  serviceName?: string;
  environment?: string;
  provider?: string;
  model?: string;
  threadId?: string;
  resourceId?: string;
  userId?: string;
  organizationId?: string;
  runId?: string;
  sessionId?: string;
  requestId?: string;
  experimentId?: string;
};

export interface MetricsQueryFiltersInput {
  datePreset: MetricsDatePreset;
  customRange: MetricsDateRange | undefined;
  dimensionalFilter: MetricsDimensionalFilter;
  /** Stable JSON representation of `dimensionalFilter`, safe for query keys. */
  dimensionalFilterKey: string;
}

type Timestamp = { start: Date; end: Date };

export interface MetricsQueryFilters {
  datePreset: MetricsDatePreset;
  customRange: MetricsDateRange | undefined;
  timestamp: Timestamp;
  filters: MetricsDimensionalFilter & { timestamp: Timestamp };
  dimensionalFilter: MetricsDimensionalFilter;
  filterKey: string;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

const PRESET_MS: Record<string, number> = {
  '24h': DEFAULT_WINDOW_MS,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '14d': 14 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function buildTimestamp(
  preset: MetricsDatePreset,
  customRange: MetricsDateRange | undefined,
  anchor: number,
): Timestamp {
  if (preset !== 'custom') {
    const ms = PRESET_MS[preset] ?? DEFAULT_WINDOW_MS;
    return { start: new Date(anchor - ms), end: new Date(anchor) };
  }
  return {
    start: customRange?.from ?? new Date(anchor - DEFAULT_WINDOW_MS),
    end: customRange?.to ?? new Date(anchor),
  };
}

/**
 * Compose a ready-to-use metrics filter object from a date window and a
 * dimensional filter. Pass the result to the metrics hooks.
 *
 * Stability guarantees (important for react-query):
 *   - `timestamp` is frozen at the moment the inputs change and does NOT update
 *     on every render. Otherwise each render would mint a new `new Date()` and
 *     every metrics query would re-fetch on every keystroke.
 *   - `filters` and `filterKey` are referentially stable while inputs are
 *     unchanged, so `queryKey` hashing is cheap and caches hit.
 */
export function useMetricsQueryFilters({
  datePreset,
  customRange,
  dimensionalFilter,
  dimensionalFilterKey,
}: MetricsQueryFiltersInput): MetricsQueryFilters {
  // Anchor the "now" used for preset windows. We only recompute when the
  // preset or custom range changes — this gives a stable timestamp per query
  // boundary rather than a new Date on every render.
  const anchorRef = useRef<{ key: string; anchor: number } | null>(null);
  const windowKey =
    datePreset === 'custom'
      ? `custom:${customRange?.from?.getTime() ?? ''}:${customRange?.to?.getTime() ?? ''}`
      : `preset:${datePreset}`;
  if (!anchorRef.current || anchorRef.current.key !== windowKey) {
    anchorRef.current = { key: windowKey, anchor: Date.now() };
  }
  const anchor = anchorRef.current.anchor;

  const timestamp = useMemo(() => buildTimestamp(datePreset, customRange, anchor), [datePreset, customRange, anchor]);

  const filters = useMemo(
    () => ({ timestamp, ...dimensionalFilter }),
    // dimensionalFilterKey is a stringified digest, so this dep set gives a
    // stable ref while content is unchanged.
    [timestamp, dimensionalFilterKey],
  );

  // filterKey combines window + dimensions so react-query keys are cheap.
  const filterKey = useMemo(() => `${windowKey}|${dimensionalFilterKey}`, [windowKey, dimensionalFilterKey]);

  return { datePreset, customRange, timestamp, filters, dimensionalFilter, filterKey };
}
