import type { MountedMastraCode } from '@mastra/code-sdk';
import { RequestContext } from '@mastra/core/request-context';

import { primeTenantCredentialsForRequestContext } from '../routes/tenant-credentials.js';
import { hasResolvedOrg, seedSessionOrg } from '../session/org-seed.js';
import type { IntegrationSubscription } from '../storage/domains/integrations/base.js';

/** The Factory session row fields a woken session has to run as. */
export type FactorySessionOwner = { userId: string; orgId: string };

export interface SubscriptionSessionLookup {
  sessions: { getBySessionId(sessionId: string): Promise<FactorySessionOwner | null> };
}

/**
 * Bring the session that owns a subscribed thread online so a provider event
 * can be delivered to it. Provider-neutral: GitHub and GitLab subscriptions
 * carry the same session binding and differ only in their target data.
 */
export type SubscriptionSessionRow = IntegrationSubscription<{
  projectRepositoryId: string;
  subscribedByUserId?: string | null;
}>;

/**
 * The request context a provider-triggered run executes under: the user who
 * subscribed the thread, in the subscription's organization. A webhook carries
 * no signed-in user and tenant credential resolution fails closed without one,
 * so a woken run would otherwise stop before it could persist or answer the
 * notification. The subscription row already names that user, so delivery
 * costs no extra read; an older row without one falls back to the Factory
 * session's owner, the identity used when a session is recreated for delivery.
 */
export async function subscriptionRunContext(
  subscription: SubscriptionSessionRow,
  sourceControl: SubscriptionSessionLookup | undefined,
): Promise<RequestContext | undefined> {
  let userId = subscription.data.subscribedByUserId ?? undefined;
  let orgId: string | undefined = subscription.orgId;
  if (!userId && subscription.sessionId && sourceControl) {
    const sessionRow = await sourceControl.sessions.getBySessionId(subscription.sessionId);
    userId = sessionRow?.userId;
    orgId = sessionRow?.orgId ?? orgId;
  }
  if (!userId || !hasResolvedOrg(orgId)) return undefined;
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: userId, organizationId: orgId });
  // The web auth middleware primes credential snapshots per request; a
  // webhook-triggered run has no request, so prime here or the model resolves
  // against an empty snapshot and the run fails closed before persisting. A
  // priming failure propagates: handing back an unprimed context would let the
  // caller accept the delivery, and retire a terminal subscription, for a run
  // that then fails without its credentials and cannot be redelivered.
  try {
    await primeTenantCredentialsForRequestContext(requestContext);
  } catch (error) {
    throw new Error(`Unable to prime tenant credentials for subscription ${subscription.id}; not delivered.`, {
      cause: error,
    });
  }
  return requestContext;
}

export async function resolveSubscriptionSession(
  controller: MountedMastraCode['controller'],
  subscription: SubscriptionSessionRow,
  options: { label: string; sourceControl?: SubscriptionSessionLookup },
) {
  const { label } = options;
  const { sessionId, resourceId, threadId } = subscription;
  if (!sessionId || !resourceId || !threadId) {
    throw new Error(`${label} subscription ${subscription.id} is missing its session binding.`);
  }
  // Read the thread straight from storage before touching sessions. This answers
  // two questions at once, and `queryThreadById` does it without constructing a
  // session (so no workspace or sandbox is provisioned just to make the check).
  //
  // First: do we even have this thread? A change request's events can reach a
  // deployment that never owned the subscribed thread, and delivery must not
  // fabricate a session for a thread that lives somewhere else.
  //
  // Second: which resource owns it? The subscription records the Factory project
  // as its `resourceId`, but an unscoped session is registered under its own id,
  // so the stored value routinely names a resource that does not own the thread.
  // The thread row is the authoritative answer; the stored id is only a fallback.
  const thread = await controller.queryThreadById({ threadId });
  if (!thread) return undefined;
  const ownerResourceId = thread.resourceId || resourceId;
  const scope = subscription.sessionScope || undefined;
  let session = await controller.getSessionByResource(ownerResourceId, scope);
  if (!session) {
    const tags = {
      factoryProjectId: resourceId,
      projectRepositoryId: subscription.data.projectRepositoryId,
    };
    // Creating the session resolves its workspace, which authorizes the caller
    // against the Factory session row — no signed-in user, so run as its owner.
    // The session is created under the resource that owns the thread, so the
    // thread switch below resolves; the persisted Factory session is keyed by
    // the subscription's session ID.
    const sessionRow = await options.sourceControl?.sessions.getBySessionId(sessionId);
    if (!sessionRow) {
      throw new Error(`${label} subscription ${subscription.id} has no Factory session ${sessionId} to run as.`);
    }
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: sessionRow.userId, organizationId: sessionRow.orgId });
    session = await controller.createSession({
      id: sessionId,
      ownerId: sessionRow.userId,
      resourceId: ownerResourceId,
      scope,
      tags,
      requestContext,
    });
    await seedSessionOrg(session, sessionRow.orgId);
  } else if (!hasResolvedOrg(session.state?.get()?.factoryOrgId)) {
    // A session created before the org seed existed carries the project tag and
    // no org, so capture would refuse for the rest of its life even though the
    // org is recoverable. Heal it — but only here, and only when it is missing:
    // hoisting the row fetch above would make an existing-session delivery throw
    // on a missing row where it previously succeeded, and fetching it every time
    // would add a storage read to every delivery. A row that is missing or a
    // lookup that throws leaves the session marked unresolved, and delivery
    // continues either way.
    try {
      const sessionRow = await options.sourceControl?.sessions.getBySessionId(sessionId);
      await seedSessionOrg(session, sessionRow?.orgId);
    } catch (error) {
      console.warn(`[${label} webhook] Unable to resolve the session organization.`, error);
      await seedSessionOrg(session, undefined);
    }
  } else if (session.state?.get()?.factoryOrgUnresolved) {
    // The org is present, so an earlier failed resolution left a stale marker
    // behind. Clear it without a storage read — nothing else re-seeds a session
    // once the start hook has run, so the marker would otherwise outlive its
    // cause.
    await seedSessionOrg(session, session.state.get()?.factoryOrgId);
  }
  if (session.thread.getId() !== threadId) {
    await session.thread.switch({ threadId, emitEvent: false });
  }
  if (session.thread.getId() !== threadId) {
    throw new Error(`Session ${sessionId} did not bind thread ${threadId}.`);
  }
  return session;
}
