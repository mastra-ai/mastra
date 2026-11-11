import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import type { WorkItemActivity } from '../../../../api/types';
import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { useSidebarWorkItemsQuery, workItemActivityQueryOptions } from '../../../../hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { liveSessionCounts, periodActivity } from '../periodActivity';
import type { ActivityPeriod, RunStarts } from '../periodActivity';
import { useRunStarts } from './useRunStarts';

export interface RunsState {
  status: 'pending' | 'error' | 'success';
  complete: boolean;
}

const NO_RUN_STARTS: RunStarts = { starts: [], completeAfter: Number.NEGATIVE_INFINITY };
const NO_CARD_TIMES: WorkItemActivity = { total: 0, createdAt: [], doneAt: [] };

export function useFactoryActivity(factoryId: string, period: ActivityPeriod) {
  const { baseUrl } = useApiConfig();
  const cardTimes = useQuery(workItemActivityQueryOptions(baseUrl, factoryId, period));
  const runs = useRunStarts(factoryId, period);
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  // Only a card holding a session can be working or waiting, and the sidebar already reads those.
  const sessionCards = useSidebarWorkItemsQuery(factoryId, false).data;
  const { total } = cardTimes.data ?? NO_CARD_TIMES;
  const activity = periodActivity({
    period,
    now: Math.max(cardTimes.dataUpdatedAt, runs.dataUpdatedAt),
    cardTimes: cardTimes.data ?? NO_CARD_TIMES,
    runStarts: runs.data ?? NO_RUN_STARTS,
  });
  const runsState: RunsState = { status: runs.status, complete: activity.ranComplete };
  return {
    hasCards: total > 0,
    activity,
    runs: runsState,
    live: liveSessionCounts(sessionCards?.workItems ?? [], running, new Set(sessionCards?.parkedSessionIds)),
  };
}
