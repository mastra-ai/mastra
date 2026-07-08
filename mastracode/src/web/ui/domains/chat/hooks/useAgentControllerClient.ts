import { MastraClient } from '@mastra/client-js';
import { useMemo } from 'react';

export type AgentController = ReturnType<MastraClient['getAgentController']>;
export type AgentControllerSession = ReturnType<AgentController['session']>;

export interface UseAgentControllerClientArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerClient({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerClientArgs) {
  return useMemo(() => {
    if (!enabled) return { client: null, controller: null, session: null };
    const client = new MastraClient({ baseUrl, credentials: 'include' });
    const controller = client.getAgentController(agentControllerId);
    const session = controller.session(resourceId);
    return { client, controller, session };
  }, [agentControllerId, resourceId, baseUrl, enabled]);
}
