import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import type { WorkItemActivity } from '../../../../api/types';
import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { useSidebarWorkItemsQuery, workItemActivityQueryOptions } from '../../../../hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { activityDepth, liveSessionCounts, periodActivity } from '../periodActivity';
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
  const depth = activityDepth(period);
  const week = useQuery({ ...workItemActivityQueryOptions(baseUrl, factoryId, 'week'), enabled: depth === 'week' });
  const month = useQuery({ ...workItemActivityQueryOptions(baseUrl, factoryId, 'month'), enabled: depth === 'month' });
  // A period just chosen has no answer yet: the other depth's stands in, so the band and its menu stay up.
  // The month's instants contain the week's, and the week's show the last seven days of a month still loading.
  const [asked, other] = depth === 'month' ? [month, week] : [week, month];
  const shown = asked.data ? asked : other;
  const cardTimes = shown.data ?? NO_CARD_TIMES;
  const runs = useRunStarts(factoryId, period);
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  // Only a card holding a session can be working or waiting, and the sidebar already reads those.
  const sessionCards = useSidebarWorkItemsQuery(factoryId).data;
  const activity = periodActivity({
    period,
    now: Math.max(shown.dataUpdatedAt, runs.dataUpdatedAt),
    cardTimes,
    runStarts: runs.data ?? NO_RUN_STARTS,
  });
  const runsState: RunsState = { status: runs.status, complete: activity.ranComplete };
  return {
    // A server too old to count cards answers 404: the band then stays hidden.
    hasCards: cardTimes.total > 0,
    activity,
    runs: runsState,
    live: liveSessionCounts(sessionCards?.workItems ?? [], running, new Set(sessionCards?.parkedSessionIds)),
  };
}
