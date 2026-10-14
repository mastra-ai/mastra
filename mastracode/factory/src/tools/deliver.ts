import type { MountedMastraCode } from '@mastra/code-sdk';
import type { SendNotificationSignalInput } from '@mastra/core/notifications';

import { createSessionAsRowOwner } from '../integrations/subscription-session.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/** Notifications between Factory sessions all carry this source. */
export const FACTORY_SESSION_NOTIFICATION_SOURCE = 'factory-session';

export type FactoryDeliveryController = Pick<
  MountedMastraCode['controller'],
  'queryThreadById' | 'queryThreads' | 'getSessionByResource' | 'createSession' | 'getCurrentAgent'
>;

export interface FactoryDeliveryTarget {
  /** The target's source-control session id. */
  sessionId: string;
  /** The stored thread the notification belongs to. Never the session's current thread by default. */
  threadId: string;
}

export type FactoryDeliveryResult =
  | { delivered: 'woken' | 'persisted' | 'summarized'; notificationId: string; reason?: string }
  | {
      delivered: 'skipped';
      notificationId?: string;
      reason: 'thread-not-found' | 'thread-not-owned' | 'session-not-found' | 'offline' | 'discarded';
    };

/**
 * Deliver a notification to a Factory session's stored thread.
 *
 * Sent through the target's agent with an explicit `{ resourceId, threadId }`,
 * never `Session.sendNotificationSignal`: that one builds the wake from the
 * sender's request context and aims at the target's current thread. On this
 * path the SDK builds the wake from the session that owns the target resource,
 * so the woken run is the target row's owner, with that owner's credentials.
 *
 * A target that isn't live is created first, as its row's owner and bound to
 * the stored thread: waking a resource no session owns starts a run with no
 * model. A live session's thread is never switched.
 */
export async function deliverFactorySessionNotification({
  controller,
  sessions,
  target,
  notification,
  onlyIfLive = false,
}: {
  controller: FactoryDeliveryController;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  target: FactoryDeliveryTarget;
  notification: Omit<SendNotificationSignalInput, 'source'>;
  /** Skip, without creating anything, when no live session owns the target. */
  onlyIfLive?: boolean;
}): Promise<FactoryDeliveryResult> {
  const thread = await controller.queryThreadById({ threadId: target.threadId });
  if (!thread) return { delivered: 'skipped', reason: 'thread-not-found' };
  // A Factory session's threads live under its session id. A thread owned by
  // anything else is not this session's, whatever the caller paired it with.
  if (thread.resourceId && thread.resourceId !== target.sessionId) {
    return { delivered: 'skipped', reason: 'thread-not-owned' };
  }
  const ownerResourceId = target.sessionId;

  // No request context: without a user the controller's access check is a no-op,
  // and this is a server-side lookup on the target's behalf, not the sender's.
  let session = await controller.getSessionByResource(ownerResourceId);
  if (!session) {
    if (onlyIfLive) return { delivered: 'skipped', reason: 'offline' };
    const row = await sessions.getBySessionId(target.sessionId);
    if (!row?.factoryProjectId) return { delivered: 'skipped', reason: 'session-not-found' };
    session = await createSessionAsRowOwner(controller, {
      sessionId: target.sessionId,
      ownerResourceId,
      row,
      tags: {
        factoryProjectId: row.factoryProjectId,
        ...(row.projectRepositoryId ? { projectRepositoryId: row.projectRepositoryId } : {}),
      },
      threadId: target.threadId,
    });
  }

  const result = await controller
    .getCurrentAgent(session)
    .sendNotificationSignal(
      { ...notification, source: FACTORY_SESSION_NOTIFICATION_SOURCE },
      { resourceId: ownerResourceId, threadId: target.threadId },
    );
  await Promise.all([result.persisted, result.accepted].filter(Boolean));

  const notificationId = result.record.id;
  const reason = result.decision.reason ? { reason: result.decision.reason } : {};
  switch (result.decision.action) {
    case 'deliver':
      return { delivered: 'woken', notificationId, ...reason };
    case 'summarize':
      return { delivered: 'summarized', notificationId, ...reason };
    case 'discard':
      return { delivered: 'skipped', notificationId, reason: 'discarded' };
    default:
      return { delivered: 'persisted', notificationId, ...reason };
  }
}

/**
 * The thread a message to a session should land on: the thread its role runs
 * on, else the thread it has open, else its most recently updated thread.
 */
export async function resolveSessionThread({
  controller,
  sessions,
  workItems,
  sessionId,
}: {
  controller: Pick<FactoryDeliveryController, 'getSessionByResource' | 'queryThreads'>;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingForSession'>;
  sessionId: string;
}): Promise<string | null> {
  const row = await sessions.getBySessionId(sessionId);
  if (row?.factoryProjectId) {
    const binding = await workItems.findActiveRunBindingForSession({
      orgId: row.orgId,
      factoryProjectId: row.factoryProjectId,
      sessionId,
    });
    if (binding) return binding.threadId;
  }
  const live = await controller.getSessionByResource(sessionId);
  const current = live?.thread.getId();
  if (current) return current;
  const threads = await controller.queryThreads({ resourceId: sessionId });
  const newest = [...threads].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
  return newest?.id ?? null;
}
