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

async function requestWorkspaceSkill(
  action: 'prepare' | 'invoke',
  { agentControllerId, resourceId, scope, name, arguments: skillArguments, baseUrl = '' }: InvokeWorkspaceSkillArgs,
): Promise<{ skill: string; message: string }> {
  const response = await fetch(
    `${baseUrl}/web/agent-controller/${encodeURIComponent(agentControllerId)}/skills/${action}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resourceId, scope, name, arguments: skillArguments }),
    },
  );
  if (response.ok) {
    let result: { skill?: unknown; message?: unknown };
    try {
      result = (await response.json()) as typeof result;
    } catch {
      throw new WorkspaceSkillInvocationError(
        'Skill invocation returned an invalid response.',
        502,
        'invalid_response',
      );
    }
    if (typeof result.skill === 'string' && typeof result.message === 'string') {
      return { skill: result.skill, message: result.message };
    }
    throw new WorkspaceSkillInvocationError('Skill invocation returned an invalid response.', 502, 'invalid_response');
  }

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

export function prepareWorkspaceSkill(args: InvokeWorkspaceSkillArgs): Promise<{ skill: string; message: string }> {
  return requestWorkspaceSkill('prepare', args);
}

export function invokeWorkspaceSkill(args: InvokeWorkspaceSkillArgs): Promise<{ skill: string; message: string }> {
  return requestWorkspaceSkill('invoke', args);
}
