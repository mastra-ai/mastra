import type { EntityType } from '@mastra/core/observability';
import { bucketPlan, bucketWindow } from '../lib/metrics-buckets';
import { useDrilldown } from './use-drilldown';
import { useMetricsFilters } from './use-metrics-filters';
import { useLinkComponent } from '@/lib/framework';

type Scope = { rootEntityType?: EntityType; status?: 'error' };

/**
 * Opens a chart bucket's traces: the click handler for a chart's `onBucketClick`, for buckets
 * of `stepHours` (defaults to the bar charts' bucket for the current range).
 */
export function useBucketTracesNav(stepHours?: number) {
  const { navigate } = useLinkComponent();
  const { getTracesHref } = useDrilldown();
  const { timestamp } = useMetricsFilters();
  const step = stepHours ?? bucketPlan(timestamp.start, timestamp.end).stepHours;
  return (scope: Scope) => (row: Record<string, unknown>) => {
    const ts = Number(row.ts);
    if (!Number.isFinite(ts)) return;
    navigate(getTracesHref({ ...scope, window: bucketWindow(ts, step) }));
  };
}
