import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerOMRecordArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  /** Gate the request so the record is only fetched while the panel is open. */
  enabled?: boolean;
  /** While the agent is observing or reflecting, the record changes under us. */
  active?: boolean;
}

/**
 * Reads the persisted observational memory record for a session's thread.
 *
 * The record is only fetched while `enabled` is true so that closing the panel
 * stops the traffic, and only polls while `active` is true so an idle session
 * settles to a single request.
 */
export function useAgentControllerOMRecord({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
  active = false,
}: UseAgentControllerOMRecordArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerOMRecord(agentControllerId, resourceId, scope),
    queryFn: () => session!.getOMRecord(),
    enabled: enabled && Boolean(session),
    refetchInterval: enabled && active ? 2000 : false,
  });
}
