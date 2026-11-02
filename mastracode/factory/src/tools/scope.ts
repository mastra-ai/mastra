import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import {
  FACTORY_INTERACTIVE_KEY,
  factoryUserOrgId,
  getFactoryAuthUserFromContext,
  getFactoryAuthUserId,
} from '../auth.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { isWorkerSession } from '../session/session-threads.js';
import { auditActorProfile } from '../storage/domains/audit/base.js';
import type { AuditActorProfileInput } from '../storage/domains/audit/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

export { FACTORY_INTERACTIVE_KEY };

/** Linked Slack sender, separate from the session owner's model-credential identity. */
export const FACTORY_SLACK_SENDER_KEY = 'mastra__factorySlackSender';

/** Who is calling Factory tools, and from which session. Everything a tool needs to stay in scope. */
export interface FactoryToolScope {
  orgId: string;
  factoryProjectId: string;
  /** The signed-in caller for a user session; the session row's owner for a worker. */
  userId: string;
  /** The source-control session id. */
  sessionId: string;
  /** The memory resource the session runs under. */
  resourceId: string;
  threadId: string;
  /** `worker` sessions are bound to a work item run; only `user` sessions manage the Factory. */
  kind: 'user' | 'worker';
  /** True only for turns a signed-in person started over HTTP (see {@link FACTORY_INTERACTIVE_KEY}). */
  interactive: boolean;
  /** The caller's name and avatar, stamped on audit events so the board can show who acted. */
  actorProfile?: AuditActorProfileInput;
  /** Set for a side session: the user session and thread that started it. */
  origin?: { sessionId: string; threadId: string };
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
  const sessionId = controller?.sessionId;
  const resourceId = controller?.resourceId;
  const threadId = controller?.threadId;
  if (!sessionId || !resourceId || !threadId) return null;

  let caller: { orgId: string; userId: string; actorProfile?: AuditActorProfileInput } | null = null;
  if (authEnabled) {
    const slackSender = requestContext.get(FACTORY_SLACK_SENDER_KEY) as { userId: string; orgId: string } | undefined;
    const user = getFactoryAuthUserFromContext(requestContext);
    if (slackSender && factoryUserOrgId(user) !== slackSender.orgId) return null;
    const userId = slackSender?.userId ?? getFactoryAuthUserId(user);
    const orgId = slackSender?.orgId ?? factoryUserOrgId(user);
    const actorProfile = slackSender ? undefined : auditActorProfile(user);
    if (userId && orgId) caller = { orgId, userId, ...(actorProfile ? { actorProfile } : {}) };
  } else {
    caller = { orgId: 'local', userId: 'local' };
  }

  const row = await sessions.getBySessionId(sessionId);
  if (!row?.factoryProjectId) return null;
  // A caller from another org never acts here, worker or not.
  if (caller && row.orgId !== caller.orgId) return null;

  const origin =
    row.originSessionId && row.originThreadId
      ? { sessionId: row.originSessionId, threadId: row.originThreadId }
      : undefined;
  const worker = await isWorkerSession(row, workItems);

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
    ...(origin ? { origin } : {}),
  };
}

/**
 * Refuses an action only a signed-in person may take. Turns nobody signed in
 * started (notification wakes, webhooks, dispatcher notices) carry text other
 * people wrote, so they can't approve, resolve proposals, or waive plan approval.
 */
export function requirePerson(scope: FactoryToolScope, action: string): void {
  if (scope.interactive) return;
  throw new Error(
    `Only a person can ${action}. Nobody signed in started this turn (it came from a notification, webhook or rule); ask the person to reply in their channel or message this session, and link the item so they can find it.`,
  );
}
