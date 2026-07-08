import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient } from '../services/agentControllerClient';

interface UseAgentControllerThreadMessagesArgs {
  agentControllerId: string;
  resourceId: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  /**
   * Session sync epoch (`dataUpdatedAt` of the sync query). Part of the query
   * key so every re-sync (e.g. after an SSE drop) fetches fresh history
   * instead of reusing a cache that may predate the disconnect.
   */
  syncEpoch?: number;
}

export function useAgentControllerThreadMessages({
  agentControllerId,
  resourceId,
  threadId,
  baseUrl = '',
  enabled = true,
  syncEpoch,
}: UseAgentControllerThreadMessagesArgs) {
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useQuery({
    queryKey: queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, threadId, syncEpoch),
    queryFn: () => session!.listMessages(threadId!),
    enabled: enabled && Boolean(session) && Boolean(threadId),
    refetchOnWindowFocus: false,
  });
}
