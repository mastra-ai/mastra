/**
 * The supervisor session: one per factory, addressed by a self-describing
 * resourceId so a restarted server can recover its scope without a lookup
 * table. The session has no repository, no sandbox and no work-item seat —
 * its tools talk to storage directly.
 */

import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController, AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext } from '../auth.js';
import { hydrateFactorySession } from '../session/factory-session.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SupervisorScope } from './read-tools.js';

const RESOURCE_PREFIX = 'factory-supervisor:';

type FactorySession = Awaited<ReturnType<AgentController<MastraCodeState>['createSession']>>;

export function supervisorResourceId(factoryProjectId: string): string {
  return `${RESOURCE_PREFIX}${factoryProjectId}`;
}

/** The supervisor thread shares the session's id: one thread per factory. */
export function supervisorThreadId(factoryProjectId: string): string {
  return supervisorResourceId(factoryProjectId);
}

export function parseSupervisorResourceId(resourceId: string | undefined | null): string | null {
  if (!resourceId?.startsWith(RESOURCE_PREFIX)) return null;
  const factoryProjectId = resourceId.slice(RESOURCE_PREFIX.length);
  return factoryProjectId.length > 0 ? factoryProjectId : null;
}

/** How a supervisor scope was established — drives which tools register. */
export interface ResolvedSupervisorScope extends SupervisorScope {
  /**
   * `auth`: a factory-authenticated caller whose org owns the project.
   * `session-state`: a signal-driven turn (notification wake) with no factory
   * auth, trusted from the hydration-stamped session state. Signal turns get
   * the read tools plus the approval-free v1 tools only, with agent-actor
   * attribution — never the human-gated write tools.
   */
  via: 'auth' | 'session-state';
}

/**
 * Scope a request to a supervisor session the caller is allowed to drive.
 * Two paths:
 *
 * - Authenticated: the resourceId must name a project and the caller's auth
 *   org must own it. An authenticated caller whose org does NOT own the
 *   project gets null — never a fallback to session state.
 * - Signal turn (no factory auth, e.g. a notification wake whose request
 *   context carries only the controller context): trust the session state
 *   that `hydrateSupervisorSession` stamped at (re)creation, but only when
 *   ALL of: the resourceId is supervisor-prefixed; the state's project id
 *   exactly equals the id parsed from the resourceId; and a fresh project
 *   lookup confirms the stated org still owns that project.
 *
 * Anything else yields null and the supervisor tools stay unregistered.
 */
export async function resolveSupervisorScope(options: {
  requestContext: RequestContext | undefined;
  projects: Pick<FactoryProjectsStorage, 'get' | 'getById'>;
}): Promise<ResolvedSupervisorScope | null> {
  const { requestContext } = options;
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  const factoryProjectId = parseSupervisorResourceId(context?.resourceId);
  if (!factoryProjectId) return null;
  const authOrgId = getFactoryAuthOrgId(getFactoryAuthUserFromContext(requestContext));
  if (authOrgId) {
    const project = await options.projects.get({ orgId: authOrgId, id: factoryProjectId });
    if (!project) return null;
    return { orgId: authOrgId, factoryProjectId, via: 'auth' };
  }
  // Signal turn: no factory auth anywhere in the request context. Trust the
  // state stamped by hydrateSupervisorSession, verified against storage.
  const state = context?.state as Partial<Pick<MastraCodeState, 'factoryProjectId' | 'factoryOrgId'>> | undefined;
  const stateProjectId = typeof state?.factoryProjectId === 'string' ? state.factoryProjectId : null;
  const stateOrgId = typeof state?.factoryOrgId === 'string' ? state.factoryOrgId : null;
  if (!stateProjectId || !stateOrgId) return null;
  if (stateProjectId !== factoryProjectId) return null;
  const project = await options.projects.getById({ id: factoryProjectId });
  if (!project || project.orgId !== stateOrgId) return null;
  return { orgId: project.orgId, factoryProjectId, via: 'session-state' };
}

/**
 * Session-start hook: stamp the owning project onto a supervisor session and
 * apply the factory's default model and memory settings. Runs on every
 * (re)creation so a restarted server heals the in-memory state. Sessions
 * that are not supervisors are left untouched.
 */
export async function hydrateSupervisorSession(
  session: FactorySession,
  deps: { projects: Pick<FactoryProjectsStorage, 'getById'>; memorySettings?: MemorySettingsStorage },
): Promise<void> {
  const factoryProjectId = parseSupervisorResourceId(session.identity.getResourceId());
  if (!factoryProjectId) return;
  const project = await deps.projects.getById({ id: factoryProjectId });
  if (!project) return;
  await session.state.set({
    factoryProjectId,
    factoryOrgId: project.orgId,
  });
  await hydrateFactorySession(session, {
    orgId: project.orgId,
    factoryProjectId,
    defaultModelId: project.defaultModelId ?? undefined,
    memorySettings: deps.memorySettings,
  });
}
