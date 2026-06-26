import { useMemo, useRef } from 'react';

import { useMetrics } from './use-metrics';
import type { DatePreset, DateRange } from './use-metrics';

const PRESET_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '14d': 14 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

type Timestamp = { start: Date; end: Date };

function buildTimestamp(preset: DatePreset, customRange: DateRange | undefined, anchor: number): Timestamp {
  if (preset !== 'custom') {
    const ms = PRESET_MS[preset] ?? PRESET_MS['24h'];
    return { start: new Date(anchor - ms), end: new Date(anchor) };
  }
  return {
    start: customRange?.from ?? new Date(anchor - PRESET_MS['24h']),
    end: customRange?.to ?? new Date(anchor),
  };
}

/**
 * Compose a ready-to-use metrics filter object: merges the active date range
 * with the dimensional filter pulled from the provider (sourced from URL +
 * toolbar).
 *
 * Hooks should spread `filters` directly into their backend call — do not pass
 * only `timestamp` or filters set via the toolbar will be silently ignored.
 *
 * Stability guarantees (important for react-query):
 *   - `timestamp` is frozen at the moment the inputs change and does NOT update
 *     on every render. Otherwise each render would mint a new `new Date()` and
 *     every metrics query would re-fetch on every keystroke.
 *   - `filters` and `filterKey` are referentially stable while inputs are
 *     unchanged, so `queryKey` hashing is cheap and caches hit.
 */
export function useMetricsFilters() {
  const { datePreset, customRange, dimensionalFilter, dimensionalFilterKey } = useMetrics();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timestamp, dimensionalFilterKey],
  );

  // filterKey combines window + dimensions so react-query keys are cheap.
  const filterKey = useMemo(() => `${windowKey}|${dimensionalFilterKey}`, [windowKey, dimensionalFilterKey]);

  return { datePreset, customRange, timestamp, filters, dimensionalFilter, filterKey };
}
