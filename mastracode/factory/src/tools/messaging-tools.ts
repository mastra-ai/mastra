/**
 * Messages between Factory sessions. A user session can message any session in
 * its Factory it can see; the receiver answers that exact message. Both
 * directions are `factory-session` notifications on the receiver's stored thread.
 */

import type { NotificationPriority, NotificationRecord, NotificationsStorage } from '@mastra/core/notifications';
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
import type { FactoryToolScope } from './scope.js';

/** Messages plus replies, per sender session, per target thread, per window. */
export const SIGNAL_RATE_LIMIT = 10;
export const SIGNAL_RATE_WINDOW_MS = 10 * 60 * 1000;
/** How many recent `factory-session` notifications on a thread the rate and duplicate checks read. */
const RECENT_SCAN = 100;
const SUMMARY_LENGTH = 200;

export interface FactoryMessaging {
  controller: FactoryDeliveryController;
  notifications: Pick<NotificationsStorage, 'listNotifications' | 'getNotification'>;
}

export interface FactoryMessagingToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<
    WorkItemsStorage,
    'findActiveRunBindingForSession' | 'getForProject' | 'listSessionSubscriptions' | 'listRunBindings'
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
  const audit = (input: { targetSessionId: string; priority: NotificationPriority; kind: string; delivery: string }) =>
    deps.auditRecorder.record({
      orgId: scope.orgId,
      // A worker answers as its thread's agent (the trail's `agent:<threadId>`
      // convention); a user session acts as its person.
      actorId: scope.kind === 'worker' ? `agent:${scope.threadId}` : scope.userId,
      actorType: scope.kind === 'worker' ? 'agent' : 'human',
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
  /** Messages and replies this session put on a thread inside the rate window. */
  const overRateLimit = (records: NotificationRecord[]) => {
    const since = Date.now() - SIGNAL_RATE_WINDOW_MS;
    return (
      records.filter(
        record =>
          (record.kind === 'message' || record.kind === 'reply') &&
          record.attributes?.['from-session'] === scope.sessionId &&
          record.createdAt.getTime() >= since,
      ).length >= SIGNAL_RATE_LIMIT
    );
  };
  const recent = (notifications: FactoryMessaging['notifications'], threadId: string) =>
    notifications.listNotifications({ threadId, source: FACTORY_SESSION_NOTIFICATION_SOURCE, limit: RECENT_SCAN });

  /** On turns nobody signed in started, only sessions working on items this session follows. */
  const followedWorkers = async () => {
    const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
    const follows = await deps.workItems.listSessionSubscriptions({ ...project, sessionId: scope.sessionId });
    const bindings = await Promise.all(
      follows.map(follow => deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId, follow.workItemId)),
    );
    return new Set(
      bindings
        .flat()
        .filter(binding => binding.status === 'active')
        .map(binding => binding.sessionId),
    );
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
      ...(scope.interactive
        ? []
        : ['On this turn you can only message sessions working on items this session follows.']),
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
          `On this turn you can only message sessions working on items this session follows; ${sessionId} isn't one.`,
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

      if (overRateLimit(await recent(messaging.notifications, threadId))) {
        throw new Error('Too many messages to this session; wait for a reply.');
      }

      const result = await deliverFactorySessionNotification({
        controller: messaging.controller,
        sessions: deps.sessions,
        target: { sessionId, threadId },
        notification: {
          kind: 'message',
          priority,
          summary: text.slice(0, SUMMARY_LENGTH),
          payload: { message: text },
          sourceId: scope.sessionId,
          attributes: {
            ...(await workItemAttribute(sessionId, row.orgId, scope.factoryProjectId)),
            ...senderAttributes(scope),
          },
        },
      });
      if (result.delivered === 'skipped') throw unavailable(result);
      await audit({ targetSessionId: sessionId, priority, kind: 'message', delivery: result.delivered });
      return { notificationId: result.notificationId, delivered: result.delivered };
    },
  });

  const reply = createTool({
    id: 'factory_message_origin',
    description:
      'Answer a message another Factory session sent you. Pass `inReplyTo` with the id of that `factory-session` notification (kind `message`); the answer goes back to the session and thread that sent it. Each message can be answered once.',
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
      if (!inReplyTo) throw new Error('Pass inReplyTo with the id of the message you are answering.');
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
      if (overRateLimit(onSenderThread)) throw new Error('Too many messages to that session; wait before answering.');
      const answered = onSenderThread.some(
        record =>
          record.kind === 'reply' &&
          record.attributes?.['in-reply-to'] === inReplyTo &&
          record.attributes?.['from-session'] === scope.sessionId,
      );
      if (answered) throw new Error(`You already answered ${inReplyTo}.`);

      const result = await deliverFactorySessionNotification({
        controller: messaging.controller,
        sessions: deps.sessions,
        target: { sessionId: fromSession, threadId: fromThread },
        notification: {
          kind: 'reply',
          priority: 'high',
          summary: text.slice(0, SUMMARY_LENGTH),
          payload: { message: text },
          sourceId: scope.sessionId,
          attributes: {
            ...senderAttributes(scope),
            'in-reply-to': inReplyTo,
            ...(status ? { status } : {}),
          },
        },
      });
      if (result.delivered === 'skipped') throw unavailable(result);
      await audit({ targetSessionId: fromSession, priority: 'high', kind: 'reply', delivery: result.delivered });
      return { notificationId: result.notificationId, delivered: result.delivered };
    },
  });

  if (scope.kind === 'worker') return { factory_message_origin: reply };
  return { factory_signal_session: signal, factory_message_origin: reply };
}
