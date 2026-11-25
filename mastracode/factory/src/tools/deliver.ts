import type { MountedMastraCode } from '@mastra/code-sdk';
import type { SendNotificationSignalInput } from '@mastra/core/notifications';

import { createSessionAsRowOwner } from '../integrations/subscription-session.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { listFactorySessionThreads, sessionMemoryResourceId, sessionStampCounts } from '../session/session-threads.js';
import type { FactorySessionOwnership, SessionRunBindings } from '../session/session-threads.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/** Notifications between Factory sessions all carry this source. */
export const FACTORY_SESSION_NOTIFICATION_SOURCE = 'factory-session';

export type FactoryDeliveryController = Pick<
  MountedMastraCode['controller'],
  | 'queryThreadById'
  | 'queryThreads'
  | 'setThreadModel'
  | 'listAvailableModels'
  | 'getSession'
  | 'createSession'
  | 'getCurrentAgent'
>;

export interface FactoryDeliveryTarget {
  /** The target's source-control session id. */
  sessionId: string;
  /** The stored thread the notification belongs to. Never the session's current thread by default. */
  threadId: string;
}

export type FactoryDeliveryResult =
  /**
   * `woken`: the target was idle and the notification started a run.
   * `mid-run`: the target was already running; it reads the notification when that run
   * next checks its inbox, not now.
   */
  | { delivered: 'woken' | 'mid-run' | 'persisted' | 'summarized'; notificationId: string; reason?: string }
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
  runs,
}: {
  controller: FactoryDeliveryController;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  /** Run bindings, which decide whether a session may use its Factory's resource. */
  runs: SessionRunBindings | undefined;
  target: FactoryDeliveryTarget;
  notification: Omit<SendNotificationSignalInput, 'source'>;
  /** Skip, without creating anything, when no live session owns the target (stage notices). */
  onlyIfLive?: boolean;
}): Promise<FactoryDeliveryResult> {
  const thread = await controller.queryThreadById({ threadId: target.threadId });
  if (!thread) return { delivered: 'skipped', reason: 'thread-not-found' };
  // Sessions share their Factory's or owner's resource, so a thread is this
  // session's when it is the session's own thread or carries its session stamp
  // (or, before migration, sits under the session id). Anything else is not
  // this session's, whatever the caller paired it with.
  let targetRow: ReturnType<SourceControlSessionLookup['getBySessionId']> | undefined;
  const loadRow = () => (targetRow ??= sessions.getBySessionId(target.sessionId));
  if (!(await isSessionThread(controller, runs, thread, target.sessionId, loadRow))) {
    return { delivered: 'skipped', reason: 'thread-not-owned' };
  }
  const ownerResourceId = thread.resourceId || target.sessionId;

  // No request context: without a user the controller's access check is a no-op,
  // and this is a server-side lookup on the target's behalf, not the sender's.
  let session = await controller.getSession(target.sessionId);
  if (!session) {
    if (onlyIfLive) return { delivered: 'skipped', reason: 'offline' };
    const row = await loadRow();
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

  // Read before sending: the send itself starts a run on an idle target. Delivery is per thread,
  // so a run on another thread of the same session leaves the target thread idle.
  const busy = session.stream.isActive() && session.thread.getId() === target.threadId;
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
      return { delivered: busy ? 'mid-run' : 'woken', notificationId, ...reason };
    case 'summarize':
      return { delivered: 'summarized', notificationId, ...reason };
    case 'discard':
      return { delivered: 'skipped', notificationId, reason: 'discarded' };
    default:
      return { delivered: 'persisted', notificationId, ...reason };
  }
}

export interface FactorySessionActivity {
  /** Whether the session's agent is mid-run in this process. */
  running: boolean;
  /** When the session's thread last changed (a message saved, a run step persisted), ISO. */
  lastActivityAt: string | null;
}

/** Whether a session is busy right now, and when its thread last moved, so a stuck run is told apart from a long one. */
export async function sessionActivity(
  controller: Pick<FactoryDeliveryController, 'getSession' | 'queryThreadById'>,
  sessionId: string,
  threadId: string,
): Promise<FactorySessionActivity> {
  const [live, thread] = await Promise.all([
    controller.getSession(sessionId),
    controller.queryThreadById({ threadId }),
  ]);
  const updatedAt = thread?.updatedAt ? new Date(thread.updatedAt) : null;
  return {
    running: live?.stream.isActive() ?? false,
    lastActivityAt: updatedAt && Number.isFinite(updatedAt.getTime()) ? updatedAt.toISOString() : null,
  };
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
  controller: Pick<FactoryDeliveryController, 'getSession' | 'queryThreads' | 'queryThreadById'>;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingForSession' | 'hasRunBindingForSession'>;
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
  const live = await controller.getSession(sessionId);
  const current = live?.thread.getId();
  if (current) return current;
  // Without a row no resource is the session's to claim stamped threads on.
  const threads = await listFactorySessionThreads(controller, row ?? { sessionId, userId: '' }, workItems);
  const newest = [...threads].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
  return newest?.id ?? null;
}

async function isSessionThread(
  controller: Pick<FactoryDeliveryController, 'queryThreadById'>,
  runs: SessionRunBindings | undefined,
  thread: { id: string; resourceId?: string | null; metadata?: Record<string, unknown> | null },
  sessionId: string,
  loadRow: () => Promise<FactorySessionOwnership | null>,
): Promise<boolean> {
  // Before resources were shared a session's threads ran under its own id.
  if (thread.resourceId === sessionId) return true;
  if (thread.id !== sessionId && thread.metadata?.factorySessionId !== sessionId) return false;
  // Thread ids and stamps are client-writable: either only counts under the
  // session's own memory resource.
  const row = await loadRow();
  if (!row) return false;
  if (thread.id !== sessionId && !sessionStampCounts(row, thread.resourceId)) return false;
  return thread.resourceId === (await sessionMemoryResourceId(controller, row, runs));
}
