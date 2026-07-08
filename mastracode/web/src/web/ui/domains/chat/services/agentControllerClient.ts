import { MastraClient } from '@mastra/client-js';

export type AgentController = ReturnType<MastraClient['getAgentController']>;
export type AgentControllerSession = ReturnType<AgentController['session']>;

export interface CreateAgentControllerClientArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

type AgentControllerClientEntry = {
  client: MastraClient;
  controller: AgentController;
  session: AgentControllerSession;
};

const clientCache = new Map<string, AgentControllerClientEntry>();

const cacheKey = (agentControllerId: string, resourceId: string, baseUrl: string) =>
  JSON.stringify([baseUrl, agentControllerId, resourceId]);

export function requireAgentControllerSession(session: AgentControllerSession | null) {
  if (!session) throw new Error('Agent controller session is not available');
  return session;
}

export function createAgentControllerClient({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: CreateAgentControllerClientArgs) {
  if (!enabled) return { client: null, controller: null, session: null };

  const key = cacheKey(agentControllerId, resourceId, baseUrl);
  const cached = clientCache.get(key);
  if (cached) return cached;

  const client = new MastraClient({ baseUrl, credentials: 'include' });
  const controller = client.getAgentController(agentControllerId);
  const session = controller.session(resourceId);
  const entry = { client, controller, session };
  clientCache.set(key, entry);
  return entry;
}
