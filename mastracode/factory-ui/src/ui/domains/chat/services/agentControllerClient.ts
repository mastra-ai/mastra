import { MastraClient } from '@mastra/client-js';

export type AgentController = ReturnType<MastraClient['getAgentController']>;
export type AgentControllerSession = ReturnType<AgentController['session']>;

export interface CreateAgentControllerClientArgs {
  agentControllerId: string;
  /**
   * The session to talk to, addressed by its session id. Omit for
   * controller-level reads; without it there is no session to talk to.
   */
  sessionId?: string;
  baseUrl?: string;
  enabled?: boolean;
}

type AgentControllerClientEntry = {
  client: MastraClient;
  controller: AgentController;
  session: AgentControllerSession | null;
};

const clientCache = new Map<string, AgentControllerClientEntry>();

const cacheKey = (agentControllerId: string, sessionId: string | undefined, baseUrl: string) =>
  JSON.stringify([baseUrl, agentControllerId, sessionId ?? null]);

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
  sessionId,
  baseUrl = '',
  enabled = true,
}: CreateAgentControllerClientArgs) {
  if (!enabled) return { client: null, controller: null, session: null };

  const key = cacheKey(agentControllerId, sessionId, baseUrl);
  const cached = clientCache.get(key);
  if (cached) return cached;

  // query-client.ts owns retry policy; silently re-POSTing non-idempotent sends duplicates messages
  const client = new MastraClient({ baseUrl, credentials: 'include', retries: 0 });
  const controller = client.getAgentController(agentControllerId);
  const session = sessionId ? controller.session(sessionId) : null;
  const entry = { client, controller, session };
  clientCache.set(key, entry);
  return entry;
}

export interface InvokeWorkspaceSkillArgs {
  agentControllerId: string;
  sessionId: string;
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
  { agentControllerId, sessionId, name, arguments: skillArguments, baseUrl = '' }: InvokeWorkspaceSkillArgs,
): Promise<{ skill: string; message: string }> {
  const response = await fetch(
    `${baseUrl}/web/agent-controller/${encodeURIComponent(agentControllerId)}/skills/${action}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, name, arguments: skillArguments }),
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
