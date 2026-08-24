import { MastraClient } from '@mastra/client-js';

export type AgentController = ReturnType<MastraClient['getAgentController']>;
export type AgentControllerSession = ReturnType<AgentController['session']>;

export interface CreateAgentControllerClientArgs {
  agentControllerId: string;
  /** Omit for controller-level reads; without it there is no session to talk to. */
  resourceId?: string;
  /**
   * Per-worktree session scope (the worktree's project path). Sessions sharing
   * a resourceId but scoped differently are independent server-side sessions,
   * so the client cache must be keyed by scope too.
   */
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

type AgentControllerClientEntry = {
  client: MastraClient;
  controller: AgentController;
  session: AgentControllerSession | null;
};

const clientCache = new Map<string, AgentControllerClientEntry>();

const cacheKey = (
  agentControllerId: string,
  resourceId: string | undefined,
  baseUrl: string,
  scope: string | undefined,
) => JSON.stringify([baseUrl, agentControllerId, resourceId ?? null, scope ?? null]);

export function requireAgentControllerSession(session: AgentControllerSession | null) {
  if (!session) throw new Error('Agent controller session is not available');
  return session;
}

export function requireAgentController(controller: AgentController | null) {
  if (!controller) throw new Error('Agent controller client is not available');
  return controller;
}

export function createAgentControllerClient({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: CreateAgentControllerClientArgs) {
  if (!enabled) return { client: null, controller: null, session: null };

  const normalizedScope = scope || undefined;
  const key = cacheKey(agentControllerId, resourceId, baseUrl, normalizedScope);
  const cached = clientCache.get(key);
  if (cached) return cached;

  // query-client.ts owns retry policy; silently re-POSTing non-idempotent sends duplicates messages
  const client = new MastraClient({ baseUrl, credentials: 'include', retries: 0 });
  const controller = client.getAgentController(agentControllerId);
  const session = resourceId ? controller.session(resourceId, normalizedScope) : null;
  const entry = { client, controller, session };
  clientCache.set(key, entry);
  return entry;
}
