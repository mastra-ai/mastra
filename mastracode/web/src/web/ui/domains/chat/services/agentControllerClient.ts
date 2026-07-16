import { MastraClient } from '@mastra/client-js';

export type AgentController = ReturnType<MastraClient['getAgentController']>;
export type AgentControllerSession = ReturnType<AgentController['session']>;

export interface CreateAgentControllerClientArgs {
  agentControllerId: string;
  resourceId: string;
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
  session: AgentControllerSession;
};

const clientCache = new Map<string, AgentControllerClientEntry>();

const cacheKey = (agentControllerId: string, resourceId: string, baseUrl: string, scope: string | undefined) =>
  JSON.stringify([baseUrl, agentControllerId, resourceId, scope ?? null]);

export function requireAgentControllerSession(session: AgentControllerSession | null) {
  if (!session) throw new Error('Agent controller session is not available');
  return session;
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

  const client = new MastraClient({ baseUrl, credentials: 'include' });
  const controller = client.getAgentController(agentControllerId);
  const session = controller.session(resourceId, normalizedScope);
  const entry = { client, controller, session };
  clientCache.set(key, entry);
  return entry;
}

export interface InvokeWorkspaceSkillArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  name: string;
  arguments?: string;
  baseUrl?: string;
}

export class WorkspaceSkillInvocationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'WorkspaceSkillInvocationError';
    this.status = status;
    this.code = code;
  }
}

export async function invokeWorkspaceSkill({
  agentControllerId,
  resourceId,
  scope,
  name,
  arguments: skillArguments,
  baseUrl = '',
}: InvokeWorkspaceSkillArgs): Promise<void> {
  const response = await fetch(
    `${baseUrl}/web/agent-controller/${encodeURIComponent(agentControllerId)}/skills/invoke`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resourceId, scope, name, arguments: skillArguments }),
    },
  );
  if (response.ok) return;

  let error: { error?: unknown; message?: unknown } = {};
  try {
    error = (await response.json()) as typeof error;
  } catch {
    // Preserve a useful status-based fallback when an intermediary returns HTML.
  }
  const code = typeof error.error === 'string' ? error.error : 'skill_invocation_failed';
  const message = typeof error.message === 'string' ? error.message : `Skill invocation failed (${response.status}).`;
  throw new WorkspaceSkillInvocationError(message, response.status, code);
}
