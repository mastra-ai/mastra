import { useCallback } from 'react';

import { buildLogsDrilldownUrl, buildTracesDrilldownUrl, narrowWindowToBucket } from '../drilldown';
import type { DrilldownScope, DrilldownWindow } from '../drilldown';
import { useMetrics } from './use-metrics';

/** Consolidates the current metrics dashboard's date + dimensional context so
 *  each card only has to supply its own scope (`{ rootEntityType, entityName,
 *  ... }`) to produce a full drilldown URL. */
export function useDrilldown() {
  const { datePreset, customRange, dimensionalFilter } = useMetrics();

  const getTracesHref = useCallback(
    (scope: DrilldownScope = {}): string =>
      buildTracesDrilldownUrl({
        preset: datePreset,
        customRange,
        dashboardFilter: dimensionalFilter,
        scope,
      }),
    [datePreset, customRange, dimensionalFilter],
  );

  const getLogsHref = useCallback(
    (scope: DrilldownScope = {}): string =>
      buildLogsDrilldownUrl({
        preset: datePreset,
        customRange,
        dashboardFilter: dimensionalFilter,
        scope,
      }),
    [datePreset, customRange, dimensionalFilter],
  );

  const getBucketTracesHref = useCallback(
    (scope: Omit<DrilldownScope, 'window'>, tsMs: number, interval: '1h' | '1d'): string => {
      const window: DrilldownWindow = narrowWindowToBucket(tsMs, interval);
      return buildTracesDrilldownUrl({
        preset: datePreset,
        customRange,
        dashboardFilter: dimensionalFilter,
        scope: { ...scope, window },
      });
    },
    [datePreset, customRange, dimensionalFilter],
  );

  return { getTracesHref, getLogsHref, getBucketTracesHref };
}
