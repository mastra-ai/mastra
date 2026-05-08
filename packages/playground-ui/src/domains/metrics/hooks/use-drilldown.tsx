import { useCallback } from 'react';

import { buildLogsDrilldownUrl, buildTracesDrilldownUrl, narrowWindowToBucket } from '../drilldown';
import type { DrilldownScope, DrilldownWindow } from '../drilldown';
import { useMetrics } from './use-metrics';

/** Consolidates the current metrics dashboard's date + dimensional context so
 *  each card only has to supply its own scope (`{ rootEntityType, entityName,
 *  ... }`) to produce a full drilldown URL. */
export function useDrilldown() {
  const { datePreset, customRange, dimensionalFilter, tracesBasePath, logsBasePath } = useMetrics();

  const getTracesHref = useCallback(
    (scope: DrilldownScope = {}): string =>
      buildTracesDrilldownUrl({
        preset: datePreset,
        customRange,
        dashboardFilter: dimensionalFilter,
        scope,
        tracesBasePath,
      }),
    [datePreset, customRange, dimensionalFilter, tracesBasePath],
  );

  const getLogsHref = useCallback(
    (scope: DrilldownScope = {}): string =>
      buildLogsDrilldownUrl({
        preset: datePreset,
        customRange,
        dashboardFilter: dimensionalFilter,
        scope,
        logsBasePath,
      }),
    [datePreset, customRange, dimensionalFilter, logsBasePath],
  );

  const getBucketTracesHref = useCallback(
    (scope: Omit<DrilldownScope, 'window'>, tsMs: number, interval: '1h' | '1d'): string => {
      const window: DrilldownWindow = narrowWindowToBucket(tsMs, interval);
      return buildTracesDrilldownUrl({
        preset: datePreset,
        customRange,
        dashboardFilter: dimensionalFilter,
        scope: { ...scope, window },
        tracesBasePath,
      });
    },
    [datePreset, customRange, dimensionalFilter, tracesBasePath],
  );

  return { getTracesHref, getLogsHref, getBucketTracesHref };
}
