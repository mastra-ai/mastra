import { sessionRowStatus } from '@mastra/factory/session/session-row-status';
import type { SessionRowStatus } from '@mastra/factory/session/session-row-status';

import { useSessionActivityQuery } from '../../../../hooks/useSessionRows';
import type { WorkItem } from '../services/workItems';

/** A parked rule speaks through the card's own status row, not through the wick. */
export function useItemSessionStatuses({
  factoryProjectId,
  items,
  parkedSessionIds: parked,
}: {
  factoryProjectId: string;
  items: readonly WorkItem[];
  /** The sessions parked on a plan or a question, read with `items` so a card and its marker agree. */
  parkedSessionIds: readonly string[];
}): ReadonlyMap<string, SessionRowStatus> {
  const activity = useSessionActivityQuery(factoryProjectId).data;
  const runningSessionIds = new Set(activity?.runningSessionIds);
  const initializingSessionIds = new Set(activity?.initializingSessionIds);
  const parkedSessionIds = new Set(parked);

  const statuses = new Map<string, SessionRowStatus>();
  for (const item of items) {
    const refs = Object.values(item.sessions ?? {});
    if (refs.length === 0) continue;
    const status = sessionRowStatus({
      running: refs.some(ref => runningSessionIds.has(ref.sessionId)),
      initializing: refs.some(ref => initializingSessionIds.has(ref.sessionId)),
      attention: refs.some(ref => parkedSessionIds.has(ref.sessionId)),
    });
    if (status !== undefined) statuses.set(item.id, status);
  }
  return statuses;
}
