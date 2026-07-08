import { MastraClient } from '@mastra/client-js';

export type AgentController = ReturnType<MastraClient['getAgentController']>;
export type AgentControllerSession = ReturnType<AgentController['session']>;

export interface CreateAgentControllerClientArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function createAgentControllerClient({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: CreateAgentControllerClientArgs) {
  if (!enabled) return { client: null, controller: null, session: null };
  const client = new MastraClient({ baseUrl, credentials: 'include' });
  const controller = client.getAgentController(agentControllerId);
  const session = controller.session(resourceId);
  return { client, controller, session };
}
