/**
 * Messages between Factory sessions. A user session can message any session in
 * its Factory it can see; the receiver answers that exact message. Both
 * directions are `factory-session` notifications on the receiver's stored thread.
 */

import type {
  NotificationPriority,
  NotificationRecord,
  NotificationsStorage,
  SendNotificationSignalInput,
} from '@mastra/core/notifications';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import {
  FACTORY_SESSION_NOTIFICATION_SOURCE,
  deliverFactorySessionNotification,
  resolveSessionThread,
} from './deliver.js';
import type { FactoryDeliveryController, FactoryDeliveryResult } from './deliver.js';
import { workItemNumber } from './read-tools.js';
import { reportNotification, workItemReportAttributes, workItemReportRecipients } from './reports.js';
import { requirePerson } from './scope.js';
import type { FactoryToolScope } from './scope.js';
import { listSideSessions, sessionModel } from './side-sessions.js';

/** Messages plus replies, per sender session, per target thread, per window. */
export const SIGNAL_RATE_LIMIT = 10;
export const SIGNAL_RATE_WINDOW_MS = 10 * 60 * 1000;
/** How many recent `factory-session` notifications on a thread the rate and duplicate checks read. */
const RECENT_SCAN = 100;
/** How often a waiting queue is reconsidered. Delivery still waits for a free slot in the window. */
const QUEUE_FLUSH_MS = 1000;

/** A message accepted past the delivery cap, held until the window has a free slot. */
interface PendingMessage {
  notification: Omit<SendNotificationSignalInput, 'source'>;
  /** When the sender handed it over. Oldest goes first. */
  acceptedAt: number;
  actor: { actorId: string; actorType: 'human' | 'agent' };
}

interface QueuedDelivery extends PendingMessage {
  /** The moment a slot in the window is expected to free. Set once, when it joins the queue. */
  deliverAt: number;
  target: { sessionId: string; threadId: string };
}

/**
 * Waiting messages, per sender session and target thread, oldest first.
 * Process-local: a restart drops what was still waiting, the same as a message
 * that had not been handed to the tool yet. Delivered messages live in the
 * notification store and are unaffected.
 */
const pendingQueues = new Map<string, QueuedDelivery[]>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

const queueOwners = new WeakMap<object, number>();
let nextQueueOwnerId = 0;

const queueKey = (owner: object, senderSessionId: string, threadId: string): string => {
  let id = queueOwners.get(owner);
  if (id === undefined) {
    nextQueueOwnerId += 1;
    id = nextQueueOwnerId;
    queueOwners.set(owner, id);
  }
  return `${id}\0${senderSessionId}\0${threadId}`;
};
export interface FactoryMessaging {
  controller: FactoryDeliveryController;
  notifications: Pick<NotificationsStorage, 'listNotifications' | 'getNotification'>;
}

export interface FactoryMessagingToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId' | 'listByOrigin' | 'setOriginMuted'>;
  workItems: Pick<
    WorkItemsStorage,
    | 'findActiveRunBindingForSession'
    | 'getForProject'
    | 'hasRunBindingForSession'
    | 'listSessionSubscriptions'
    | 'listRunBindings'
    | 'listWorkItemSubscribers'
  >;
  auditRecorder: AuditRecorder;
  /** The live controller and notifications store; resolved per call because they exist only once the mount is up. */
  messaging: () => Promise<FactoryMessaging | null>;
}

const message = z.string().trim().min(1).max(4000);

function senderAttributes(scope: FactoryToolScope) {
  return {
    'from-session': scope.sessionId,
    'from-thread': scope.threadId,
    'from-user': scope.userId,
  };
}

function unavailable(result: Extract<FactoryDeliveryResult, { delivered: 'skipped' }>) {
  return new Error(`The session is not available (${result.reason}).`);
}

export function createFactoryMessagingTools(
  scope: FactoryToolScope,
  deps: FactoryMessagingToolDependencies,
): IntegrationTools {
  const requireMessaging = async () => {
    const messaging = await deps.messaging();
    if (!messaging) throw new Error('Session messaging is not available on this server.');
    return messaging;
  };
  // Only a user-session turn the person started is the person's act. Workers
  // (even when someone types into one) and turns nobody signed in started
  // (wakes, webhooks) act as the thread's agent.
  const human = scope.kind === 'user' && scope.interactive;
  const audit = (input: { targetSessionId: string; priority: NotificationPriority; kind: string; delivery: string }) =>
    deps.auditRecorder.record({
      orgId: scope.orgId,
      actorId: human ? scope.userId : `agent:${scope.threadId}`,
      actorType: human ? 'human' : 'agent',
      action: 'factory.agent.signaled',
      factoryProjectId: scope.factoryProjectId,
      targets: [{ type: 'session', id: input.targetSessionId }],
      metadata: {
        targetSessionId: input.targetSessionId,
        priority: input.priority,
        kind: input.kind,
        delivery: input.delivery,
      },
    });
  /** Why this session can't reach `row`, or null when it can: the rule for message targets and reply targets alike. */
  const unreachable = (row: SourceControlSession | null): 'not-found' | 'private' | null => {
    if (!row || row.orgId !== scope.orgId || row.factoryProjectId !== scope.factoryProjectId) return 'not-found';
    if (row.visibility === 'private' && row.userId !== scope.userId) return 'private';
    return null;
  };
  const overRateLimit = (records: NotificationRecord[]) => countedInWindow(records).length >= SIGNAL_RATE_LIMIT;
  /** This session's delivered messages on the thread that still sit inside the window, oldest first. */
  const countedInWindow = (records: NotificationRecord[]): NotificationRecord[] => {
    const since = Date.now() - SIGNAL_RATE_WINDOW_MS;
    return records
      .filter(
        record =>
          // Everything this session sends counts except coalescing progress updates.
          record.kind !== 'progress' &&
          record.kind !== 'stage' &&
          record.attributes?.['from-session'] === scope.sessionId &&
          record.createdAt.getTime() >= since,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  };
  /**
   * When the next message can be delivered: one window after the oldest message
   * that has to age out to free a slot, given how many are already waiting.
   */
  const nextDeliveryAt = (counted: NotificationRecord[], waiting: number): number => {
    const blocking = counted[counted.length + waiting - SIGNAL_RATE_LIMIT];
    return (blocking ? blocking.createdAt.getTime() : Date.now()) + SIGNAL_RATE_WINDOW_MS;
  };
  const queuedResult = (deliverAt: number) => ({
    delivered: 'queued' as const,
    deliverAt: new Date(deliverAt).toISOString(),
    note: `Queued; it will be delivered at about ${new Date(deliverAt).toISOString()}. Do not send it again.`,
  });
  const recent = (notifications: FactoryMessaging['notifications'], threadId: string) =>
    notifications.listNotifications({ threadId, source: FACTORY_SESSION_NOTIFICATION_SOURCE, limit: RECENT_SCAN });

  const actor = (): QueuedDelivery['actor'] => ({
    actorId: human ? scope.userId : `agent:${scope.threadId}`,
    actorType: human ? 'human' : 'agent',
  });

  /**
   * Deliver now, or hold until the window has a slot. The cap limits how fast
   * messages are delivered, not whether they are accepted.
   */
  const accept = async (
    messaging: FactoryMessaging,
    target: { sessionId: string; threadId: string },
    notification: Omit<SendNotificationSignalInput, 'source'>,
  ): Promise<
    { notificationId: string; delivered: FactoryDeliveryResult['delivered'] } | ReturnType<typeof queuedResult>
  > => {
    const counted = countedInWindow(await recent(messaging.notifications, target.threadId));
    if (counted.length < SIGNAL_RATE_LIMIT) {
      const result = await deliverFactorySessionNotification({
        controller: messaging.controller,
        sessions: deps.sessions,
        runs: deps.workItems,
        target,
        notification,
      });
      if (result.delivered === 'skipped') throw unavailable(result);
      await audit({
        targetSessionId: target.sessionId,
        priority: notification.priority ?? 'medium',
        kind: notification.kind,
        delivery: result.delivered,
      });
      return { notificationId: result.notificationId, delivered: result.delivered };
    }
    const key = queueKey(deps, scope.sessionId, target.threadId);
    const waiting = pendingQueues.get(key)?.length ?? 0;
    const deliverAt = nextDeliveryAt(counted, waiting);
    enqueue(key, {
      notification,
      acceptedAt: Date.now(),
      actor: actor(),
      deliverAt,
      target,
    });
    return queuedResult(deliverAt);
  };

  const enqueue = (key: string, delivery: QueuedDelivery): void => {
    const queue = pendingQueues.get(key) ?? [];
    queue.push(delivery);
    queue.sort((a, b) => a.acceptedAt - b.acceptedAt);
    pendingQueues.set(key, queue);
    scheduleFlush(key);
  };

  /**
   * Deliver the oldest waiting message once the window has a free slot, then
   * the next, in the order they were accepted. A target that is gone by then
   * is dropped and recorded, the same way an undeliverable live message is.
   */
  const flush = async (key: string): Promise<void> => {
    flushTimers.delete(key);
    const queue = pendingQueues.get(key);
    if (!queue || queue.length === 0) {
      pendingQueues.delete(key);
      return;
    }
    const messaging = await deps.messaging();
    if (!messaging) {
      scheduleFlush(key);
      return;
    }
    const head = queue[0];
    if (!head || head.deliverAt > Date.now()) {
      scheduleFlush(key);
      return;
    }
    const counted = countedInWindow(await recent(messaging.notifications, head.target.threadId));
    if (counted.length >= SIGNAL_RATE_LIMIT) {
      scheduleFlush(key);
      return;
    }
    queue.shift();
    if (queue.length === 0) pendingQueues.delete(key);
    const result = await deliverFactorySessionNotification({
      controller: messaging.controller,
      sessions: deps.sessions,
      runs: deps.workItems,
      target: head.target,
      notification: head.notification,
    });
    await deps.auditRecorder.record({
      orgId: scope.orgId,
      actorId: head.actor.actorId,
      actorType: head.actor.actorType,
      action: 'factory.agent.signaled',
      factoryProjectId: scope.factoryProjectId,
      targets: [{ type: 'session', id: head.target.sessionId }],
      metadata: {
        targetSessionId: head.target.sessionId,
        priority: head.notification.priority ?? 'medium',
        kind: head.notification.kind,
        delivery: result.delivered === 'skipped' ? 'dropped' : result.delivered,
        ...(result.delivered === 'skipped' ? { reason: result.reason } : {}),
      },
    });
    if (queue.length > 0) scheduleFlush(key);
  };

  function scheduleFlush(key: string): void {
    if (flushTimers.has(key)) return;
    if (!pendingQueues.get(key)?.[0]) return;
    const timer = setTimeout(() => {
      flushTimers.delete(key);
      void flush(key).catch(() => {
        // A failed flush leaves the rest of the queue waiting; the next tick retries the head.
        if ((pendingQueues.get(key)?.length ?? 0) > 0) scheduleFlush(key);
      });
    }, QUEUE_FLUSH_MS);
    // Keep the wait on the real clock. A fake clock that jumps the window would
    // skip a timer scheduled for the old deadline, and the message would sit.
    timer.unref?.();
    flushTimers.set(key, timer);
  }

  /** On turns nobody signed in started, only sessions working on items this session follows. */
  const followedWorkers = async () => {
    const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
    const follows = await deps.workItems.listSessionSubscriptions({ ...project, sessionId: scope.sessionId });
    const bindings = await Promise.all(
      follows.map(follow => deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId, follow.workItemId)),
    );
    const sideSessions = await deps.sessions.listByOrigin({ orgId: scope.orgId, originSessionId: scope.sessionId });
    return new Set([
      ...bindings
        .flat()
        .filter(binding => binding.status === 'active')
        .map(binding => binding.sessionId),
      ...sideSessions.map(session => session.sessionId),
    ]);
  };

  const workItemAttribute = async (sessionId: string, orgId: string, factoryProjectId: string) => {
    const binding = await deps.workItems.findActiveRunBindingForSession({ orgId, factoryProjectId, sessionId });
    if (!binding) return {};
    const item = await deps.workItems.getForProject(orgId, factoryProjectId, binding.workItemId);
    if (!item) return {};
    const number = workItemNumber(item);
    return { 'work-item': number === null ? item.id : `#${number}` };
  };

  const signal = createTool({
    id: 'factory_signal_session',
    description: [
      'Send a message to another session in this Factory: a work item role session, or a teammate session you can see.',
      'Replies come back to this session as `factory-session` notifications with kind `reply` and an `in-reply-to` attribute naming your message.',
      'Priority `medium` (default) wakes an idle session and waits for a busy one to finish its step; use `urgent` only to make it stop and change course.',
      '`delivered` is `woken` when the session was idle and is now running, `mid-run` when it was already busy and will read the message when its run next checks in.',
      ...(scope.interactive
        ? []
        : ['On this turn you can only message your side sessions and sessions working on items this session follows.']),
    ].join(' '),
    inputSchema: z
      .object({
        sessionId: z.string().trim().min(1).max(200).describe('The session to message.'),
        message: message.describe('What to say. It arrives as-is, so make it self-contained.'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      })
      .strict(),
    execute: async ({ sessionId, message: text, priority }) => {
      if (sessionId === scope.sessionId) throw new Error("You can't message your own session.");
      const row = await deps.sessions.getBySessionId(sessionId);
      const blocked = unreachable(row);
      if (blocked === 'not-found' || !row) throw new Error(`No session ${sessionId} was found in this Factory.`);
      if (blocked === 'private') throw new Error(`Session ${sessionId} is private to its owner.`);
      if (!scope.interactive && !(await followedWorkers()).has(sessionId)) {
        throw new Error(
          `On this turn you can only message this session's side sessions and sessions working on items it follows; ${sessionId} isn't one.`,
        );
      }

      const messaging = await requireMessaging();
      const threadId = await resolveSessionThread({
        controller: messaging.controller,
        sessions: deps.sessions,
        workItems: deps.workItems,
        sessionId,
      });
      if (!threadId) throw new Error('The session is not available (thread-not-found).');

      return accept(
        messaging,
        { sessionId, threadId },
        {
          kind: 'message',
          priority,
          summary: text,
          payload: { message: text },
          sourceId: scope.sessionId,
          attributes: {
            ...(await workItemAttribute(sessionId, row.orgId, scope.factoryProjectId)),
            ...senderAttributes(scope),
          },
        },
      );
    },
  });

  const reply = createTool({
    id: 'factory_message_origin',
    description: [
      'Answer a message another Factory session sent you, or report on your work.',
      'With `inReplyTo` (the id of a `factory-session` notification of kind `message`) the answer goes back to the session and thread that sent it; each message can be answered once.',
      'Without it, the report goes to whoever follows your work: the session that started you, or everyone following your work item.',
      "Set `status`: `progress` for an update, `blocked` when you need an answer to go on, `done` when finished, `failed` when you can't finish. Send one `done` or `failed` when you finish.",
    ].join(' '),
    inputSchema: z
      .object({
        message: message.describe('Your answer.'),
        inReplyTo: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe('Id of the message notification you are answering.'),
        status: z.enum(['progress', 'blocked', 'done', 'failed']).optional(),
      })
      .strict(),
    execute: async ({ message: text, inReplyTo, status }) => {
      if (!inReplyTo) return report(text, status);
      const messaging = await requireMessaging();
      // Only a message that reached this session's own thread can be answered,
      // and the answer goes where that message came from: never to an address
      // the model supplies.
      const original: NotificationRecord | null = await messaging.notifications.getNotification({
        threadId: scope.threadId,
        id: inReplyTo,
      });
      if (!original || original.source !== FACTORY_SESSION_NOTIFICATION_SOURCE) {
        throw new Error(`No message ${inReplyTo} was sent to this session.`);
      }
      if (original.kind !== 'message') {
        throw new Error(`Only messages can be answered; ${inReplyTo} is a ${original.kind}.`);
      }
      const fromSession = original.attributes?.['from-session'];
      const fromThread = original.attributes?.['from-thread'];
      if (typeof fromSession !== 'string' || typeof fromThread !== 'string' || original.sourceId !== fromSession) {
        throw new Error(`Message ${inReplyTo} doesn't say which session sent it.`);
      }
      // Notification records can be written outside these tools, so the
      // sender they name gets the same checks a message to it would.
      const blocked = unreachable(await deps.sessions.getBySessionId(fromSession));
      if (blocked === 'not-found') throw new Error(`Message ${inReplyTo} didn't come from a session in this Factory.`);
      if (blocked === 'private') {
        throw new Error(`Message ${inReplyTo} came from a private session this session can't answer.`);
      }
      const onSenderThread = await recent(messaging.notifications, fromThread);
      // Replies count toward the same cap as messages, so records written to
      // this session can't turn it into an unlimited high-priority sender.
      const answered = onSenderThread.some(
        record =>
          record.kind === 'reply' &&
          record.attributes?.['in-reply-to'] === inReplyTo &&
          record.attributes?.['from-session'] === scope.sessionId,
      );
      if (answered) throw new Error(`You already answered ${inReplyTo}.`);

      return accept(
        messaging,
        { sessionId: fromSession, threadId: fromThread },
        {
          kind: 'reply',
          priority: 'high',
          summary: text,
          payload: { message: text },
          sourceId: scope.sessionId,
          attributes: {
            ...senderAttributes(scope),
            'in-reply-to': inReplyTo,
            ...(status ? { status } : {}),
          },
        },
      );
    },
  });

  /** A report with no message to answer: to the origin, else to the item's followers. */
  async function report(text: string, status: 'progress' | 'blocked' | 'done' | 'failed' | undefined) {
    const sender = { sessionId: scope.sessionId, threadId: scope.threadId, userId: scope.userId };
    let recipients: Array<{ sessionId: string; threadId: string }>;
    let attributes: Record<string, string> = {};
    if (scope.origin) {
      // The origin can mute this side session; the session keeps working, its reports just stop.
      // Blocked reports still go through, since the session cannot go on until the origin answers.
      const row = await deps.sessions.getBySessionId(scope.sessionId);
      if (row?.originMutedAt && status !== 'blocked') {
        return { delivered: 0, recipients: [], muted: true, note: 'Your origin muted your reports; keep working.' };
      }
      recipients = [scope.origin];
    } else {
      const binding = await deps.workItems.findActiveRunBindingForSession({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        sessionId: scope.sessionId,
      });
      if (!binding) throw new Error('Nothing started this session; pass inReplyTo to answer a message.');
      recipients = await workItemReportRecipients(deps.workItems, {
        orgId: scope.orgId,
        workItemId: binding.workItemId,
        senderSessionId: scope.sessionId,
      });
      ({ attributes } = await workItemReportAttributes(deps.workItems, {
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        workItemId: binding.workItemId,
        role: binding.role,
      }));
    }
    if (recipients.length === 0) return { delivered: 0, recipients: [] };

    const messaging = await requireMessaging();
    const notification = reportNotification({ sender, status, message: text, attributes });
    const results: Array<{
      sessionId: string;
      delivered: FactoryDeliveryResult['delivered'] | 'queued';
      reason?: string;
      deliverAt?: string;
    }> = [];
    for (const recipient of recipients) {
      // Progress replaces itself while unread; anything else can wake a follower, so it counts.
      if (status !== 'progress' && overRateLimit(await recent(messaging.notifications, recipient.threadId))) {
        const counted = countedInWindow(await recent(messaging.notifications, recipient.threadId));
        const key = queueKey(deps, scope.sessionId, recipient.threadId);
        const waiting = pendingQueues.get(key)?.length ?? 0;
        const at = nextDeliveryAt(counted, waiting);
        enqueue(key, {
          notification,
          acceptedAt: Date.now(),
          actor: actor(),
          deliverAt: at,
          target: recipient,
        });
        results.push({
          sessionId: recipient.sessionId,
          delivered: 'queued',
          deliverAt: new Date(at).toISOString(),
        });
        continue;
      }
      const result = await deliverFactorySessionNotification({
        controller: messaging.controller,
        sessions: deps.sessions,
        runs: deps.workItems,
        target: recipient,
        notification,
      });
      results.push({ sessionId: recipient.sessionId, delivered: result.delivered });
      if (result.delivered === 'skipped') continue;
      await audit({
        targetSessionId: recipient.sessionId,
        priority: notification.priority ?? 'high',
        kind: notification.kind,
        delivery: result.delivered,
      });
    }
    const delivered = results.filter(result => result.delivered !== 'skipped' && result.delivered !== 'queued').length;
    const queued = results.filter(result => result.delivered === 'queued').length;
    return {
      delivered,
      recipients: results,
      ...(queued > 0
        ? {
            queued,
            note: 'Queued past the delivery cap. It will be delivered when the window allows. Do not send it again.',
          }
        : {}),
    };
  }

  const listSide = createTool({
    id: 'factory_list_side_sessions',
    description: [
      'List the side sessions this session started with factory_start_session: state (running, parked waiting on an answer, idle), last report, whether you muted it, its model, and the work item it works on.',
      'Use the session ids with factory_signal_session and factory_switch_session_model. On a turn a person started, also with factory_answer_approval, factory_unsubscribe_session and factory_subscribe_session.',
    ].join(' '),
    inputSchema: z
      .object({
        state: z.enum(['running', 'parked', 'idle']).optional().describe('Only sessions in this state.'),
        muted: z.boolean().optional().describe('true for only muted sessions, false for only unmuted ones.'),
      })
      .strict(),
    execute: async ({ state, muted }) => {
      const messaging = await deps.messaging();
      const sessions = await listSideSessions(
        {
          sessions: deps.sessions,
          workItems: deps.workItems,
          notifications: messaging?.notifications ?? null,
          isRunning: async sessionId => (await messaging?.controller.getSession(sessionId))?.stream.isActive() ?? false,
          model: messaging
            ? sessionId => sessionModel(messaging.controller, deps.sessions, deps.workItems, sessionId)
            : undefined,
        },
        scope,
      );
      return {
        sessions: sessions.filter(
          row => (!state || row.state === state) && (muted === undefined || (row.mutedAt !== null) === muted),
        ),
      };
    },
  });

  /** A side session this session started, or an error naming why it isn't one. */
  const ownSideSession = async (sessionId: string) => {
    const row = await deps.sessions.getBySessionId(sessionId);
    if (
      !row ||
      row.orgId !== scope.orgId ||
      row.factoryProjectId !== scope.factoryProjectId ||
      row.originSessionId !== scope.sessionId
    ) {
      throw new Error(`Session ${sessionId} is not a side session you started; see factory_list_side_sessions.`);
    }
    return row;
  };
  const sideSessionId = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('The side session, from factory_list_side_sessions.');

  const unsubscribe = createTool({
    id: 'factory_unsubscribe_session',
    description:
      "Mute a side session you started: its reports and run-end notices stop reaching you, but it keeps working. Approval requests and blocked reports still arrive, since the session can't go on without an answer. Undo with factory_subscribe_session. Only on a turn a person started.",
    inputSchema: z.object({ sessionId: sideSessionId }).strict(),
    execute: async ({ sessionId }) => {
      requirePerson(scope, 'mute a side session');
      const row = await ownSideSession(sessionId);
      if (row.originMutedAt) return { sessionId, muted: true, mutedAt: row.originMutedAt.toISOString() };
      await deps.sessions.setOriginMuted({ sessionId, muted: true });
      const updated = await deps.sessions.getBySessionId(sessionId);
      return { sessionId, muted: true, mutedAt: updated?.originMutedAt?.toISOString() ?? null };
    },
  });

  const subscribe = createTool({
    id: 'factory_subscribe_session',
    description:
      'Unmute a side session you muted with factory_unsubscribe_session, so its reports reach you again. Reports it sent while muted are not replayed. Only on a turn a person started.',
    inputSchema: z.object({ sessionId: sideSessionId }).strict(),
    execute: async ({ sessionId }) => {
      requirePerson(scope, 'unmute a side session');
      const row = await ownSideSession(sessionId);
      if (row.originMutedAt) await deps.sessions.setOriginMuted({ sessionId, muted: false });
      return { sessionId, muted: false };
    },
  });

  if (scope.kind === 'worker') return { factory_message_origin: reply };
  return {
    factory_signal_session: signal,
    factory_message_origin: reply,
    factory_list_side_sessions: listSide,
    factory_unsubscribe_session: unsubscribe,
    factory_subscribe_session: subscribe,
  };
}
