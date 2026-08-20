import { useMemo } from 'react';

import { computeQueueHealth } from '../ui/domains/factory/queue-health';
import { useQueueHealthThresholds } from './useQueueHealthThresholds';
import { useRunningSessions, useWorkItemsQuery } from './useWorkItems';

const DEFAULT_THRESHOLDS = [14400, 86400, 259200];

/**
 * The live queue, aged against now. One computation for every reader — the
 * chart and the attention list must not disagree about which cards are stale.
 */
export function useQueueHealth(factoryProjectId: string | undefined) {
  const workItemsQuery = useWorkItemsQuery(factoryProjectId);
  const thresholdsQuery = useQueueHealthThresholds(factoryProjectId);
  const activeSessions = useRunningSessions(factoryProjectId);

  const thresholdsSeconds = thresholdsQuery.data?.thresholdsSeconds ?? DEFAULT_THRESHOLDS;
  const health = useMemo(
    () => computeQueueHealth(workItemsQuery.data ?? [], activeSessions, { thresholdsSeconds }, new Date()),
    [workItemsQuery.data, activeSessions, thresholdsSeconds],
  );

  return {
    health,
    thresholdsSeconds,
    isPending: !workItemsQuery.data || !thresholdsQuery.data,
    error: workItemsQuery.error ?? thresholdsQuery.error,
  };
}
