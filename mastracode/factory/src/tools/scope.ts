import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import {
  FACTORY_INTERACTIVE_KEY,
  factoryUserOrgId,
  getFactoryAuthUserFromContext,
  getFactoryAuthUserId,
} from '../auth.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { auditActorProfile } from '../storage/domains/audit/base.js';
import type { AuditActorProfileInput } from '../storage/domains/audit/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

export { FACTORY_INTERACTIVE_KEY };

/** Who is calling Factory tools, and from which session. Everything a tool needs to stay in scope. */
export interface FactoryToolScope {
  orgId: string;
  factoryProjectId: string;
  /** The signed-in caller for a user session; the session row's owner for a worker. */
  userId: string;
  /** The source-control session id; equal to the controller resourceId. */
  sessionId: string;
  resourceId: string;
  threadId: string;
  /** `worker` sessions are bound to a work item run; only `user` sessions manage the Factory. */
  kind: 'user' | 'worker';
  /** True only for turns a signed-in person started over HTTP (see {@link FACTORY_INTERACTIVE_KEY}). */
  interactive: boolean;
  /** The caller's name and avatar, stamped on audit events so the board can show who acted. */
  actorProfile?: AuditActorProfileInput;
}

export interface ResolveFactoryToolScopeOptions {
  requestContext: RequestContext;
  /** `routeAuth.enabled()`; when false every caller is the shared `local` tenant. */
  authEnabled: boolean;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  projects: Pick<FactoryProjectsStorage, 'get'>;
  workItems: Pick<WorkItemsStorage, 'hasRunBindingForSession'>;
}

/**
 * Resolve the Factory a session's agent may act in. The scope comes from the
 * stored source-control session row and the authenticated caller, never from
 * the `factoryProjectId` thread tag alone: the browser sets that tag and
 * nothing clears it.
 */
export async function resolveFactoryToolScope({
  requestContext,
  authEnabled,
  sessions,
  projects,
  workItems,
}: ResolveFactoryToolScopeOptions): Promise<FactoryToolScope | null> {
  if (typeof requestContext?.get !== 'function') return null;
  const controller = requestContext.get('controller') as AgentControllerRequestContext<unknown> | undefined;
  const resourceId = controller?.resourceId;
  const threadId = controller?.threadId;
  if (!resourceId || !threadId) return null;

  let caller: { orgId: string; userId: string; actorProfile?: AuditActorProfileInput } | null = null;
  if (authEnabled) {
    const user = getFactoryAuthUserFromContext(requestContext);
    const userId = getFactoryAuthUserId(user);
    const orgId = factoryUserOrgId(user);
    const actorProfile = auditActorProfile(user);
    if (userId && orgId) caller = { orgId, userId, ...(actorProfile ? { actorProfile } : {}) };
  } else {
    caller = { orgId: 'local', userId: 'local' };
  }

  const row = await sessions.getBySessionId(resourceId);
  if (!row?.factoryProjectId) return null;
  // A caller from another org never acts here, worker or not.
  if (caller && row.orgId !== caller.orgId) return null;

  // Any binding, active or revoked, on any thread: a session that ever ran a role stays a worker.
  const worker = await workItems.hasRunBindingForSession({
    orgId: row.orgId,
    factoryProjectId: row.factoryProjectId,
    sessionId: row.sessionId,
  });

  // A worker acts as its session row: dispatcher-driven runs carry no signed-in user.
  // A user session acts as the signed-in caller, who must be able to see it.
  let identity: { orgId: string; userId: string; actorProfile?: AuditActorProfileInput };
  if (worker) {
    identity = { orgId: row.orgId, userId: row.userId };
  } else {
    if (!caller) return null;
    if (row.visibility === 'private' && row.userId !== caller.userId) return null;
    identity = caller;
  }

  const project = await projects.get({ orgId: identity.orgId, id: row.factoryProjectId });
  if (!project) return null;

  return {
    orgId: identity.orgId,
    factoryProjectId: row.factoryProjectId,
    userId: identity.userId,
    sessionId: row.sessionId,
    resourceId,
    threadId,
    kind: worker ? 'worker' : 'user',
    interactive: requestContext.get(FACTORY_INTERACTIVE_KEY) === true,
    ...(identity.actorProfile ? { actorProfile: identity.actorProfile } : {}),
  };
}
