/**
 * Reports from sessions doing the work back to whoever follows it: a side
 * session's origin, or every subscriber of a work item. The agent reports with
 * `factory_message_origin`; when a run ends without one, the run-end backstop
 * sends it, so each run produces exactly one final report per recipient.
 */

import type {
  NotificationPriority,
  NotificationsStorage,
  SendNotificationSignalInput,
} from '@mastra/core/notifications';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_SESSION_NOTIFICATION_SOURCE } from './deliver.js';
import type { FactoryDeliveryResult, FactoryDeliveryTarget } from './deliver.js';
import { workItemNumber } from './read-tools.js';

export type FactoryReportStatus = 'progress' | 'blocked' | 'done' | 'failed';

/** How each report status travels. Final reports never coalesce, so a later report can't overwrite them. */
export const FACTORY_REPORT_FORMS: Record<
  FactoryReportStatus | 'message',
  { kind: string; priority: NotificationPriority; coalesce: boolean }
> = {
  failed: { kind: 'failed', priority: 'urgent', coalesce: false },
  blocked: { kind: 'blocked', priority: 'urgent', coalesce: false },
  done: { kind: 'done', priority: 'high', coalesce: false },
  progress: { kind: 'progress', priority: 'low', coalesce: true },
  message: { kind: 'message', priority: 'high', coalesce: false },
};

const SUMMARY_LENGTH = 200;
/** How many recent `factory-session` notifications on a recipient thread the final-report check reads. */
const FINAL_REPORT_SCAN = 100;

export interface FactoryReportSender {
  sessionId: string;
  threadId: string;
  userId: string;
}

export type FactoryReportDeliver = (
  target: FactoryDeliveryTarget,
  notification: Omit<SendNotificationSignalInput, 'source'>,
  options?: { onlyIfLive?: boolean },
) => Promise<FactoryDeliveryResult>;

export interface FactoryReporting {
  deliver: FactoryReportDeliver;
  notifications: Pick<NotificationsStorage, 'listNotifications'>;
}

/**
 * Whether `senderSessionId` already put a report of one of `kinds` on the
 * recipient thread since `since`. Reads the durable notifications store, so it
 * holds across restarts. `listNotifications` has no time filter: records come
 * newest-updated first, and the scan stops at the first one last updated
 * before `since` (nothing after it can have been created later).
 */
export async function hasFinalReport(
  notifications: FactoryReporting['notifications'],
  {
    senderSessionId,
    recipientThreadId,
    since,
    kinds,
  }: { senderSessionId: string; recipientThreadId: string; since: Date; kinds: readonly string[] },
): Promise<boolean> {
  const records = await notifications.listNotifications({
    threadId: recipientThreadId,
    source: FACTORY_SESSION_NOTIFICATION_SOURCE,
    limit: FINAL_REPORT_SCAN,
  });
  for (const record of records) {
    if (record.updatedAt < since) break;
    if (
      record.attributes?.['from-session'] === senderSessionId &&
      kinds.includes(record.kind) &&
      record.createdAt >= since
    ) {
      return true;
    }
  }
  return false;
}

export function reportNotification({
  sender,
  status,
  message,
  attributes = {},
}: {
  sender: FactoryReportSender;
  status?: FactoryReportStatus;
  message: string;
  attributes?: Record<string, string>;
}): Omit<SendNotificationSignalInput, 'source'> {
  const form = FACTORY_REPORT_FORMS[status ?? 'message'];
  return {
    kind: form.kind,
    priority: form.priority,
    summary: message.slice(0, SUMMARY_LENGTH),
    payload: { message },
    sourceId: sender.sessionId,
    ...(form.coalesce ? { coalesceKey: `factory-session:${sender.sessionId}:${form.kind}` } : {}),
    attributes: {
      ...attributes,
      ...(status ? { status } : {}),
      // Last, so nothing above can claim another sender.
      'from-session': sender.sessionId,
      'from-thread': sender.threadId,
      'from-user': sender.userId,
    },
  };
}

/** Everyone following a work item, except the session doing the reporting. */
export async function workItemReportRecipients(
  workItems: Pick<WorkItemsStorage, 'listWorkItemSubscribers'>,
  { orgId, workItemId, senderSessionId }: { orgId: string; workItemId: string; senderSessionId: string },
): Promise<FactoryDeliveryTarget[]> {
  const subscribers = await workItems.listWorkItemSubscribers({ orgId, workItemId });
  return subscribers
    .filter(subscriber => subscriber.sessionId !== senderSessionId)
    .map(subscriber => ({ sessionId: subscriber.sessionId, threadId: subscriber.threadId }));
}

/** Attributes that say which item and role a worker's report is about. */
export async function workItemReportAttributes(
  workItems: Pick<WorkItemsStorage, 'getForProject'>,
  {
    orgId,
    factoryProjectId,
    workItemId,
    role,
  }: { orgId: string; factoryProjectId: string; workItemId: string; role: string },
): Promise<{ label: string; attributes: Record<string, string> }> {
  const item = await workItems.getForProject(orgId, factoryProjectId, workItemId);
  const number = item ? workItemNumber(item) : null;
  const label = number === null ? (item ? `"${item.title}"` : workItemId) : `#${number}`;
  return { label, attributes: { 'work-item': number === null ? workItemId : `#${number}`, role } };
}

export type FactoryRunOutcome =
  | { status: 'done' }
  | { status: 'failed'; reason: string; failureCode?: string }
  | { status: 'blocked'; toolName?: string };

/**
 * The run-end backstop: send `outcome` to each recipient that hasn't had a
 * final report from this sender since the run started. An agent's own `done`
 * or `failed` report wins; its own `blocked` only suppresses a `blocked`
 * backstop, because it may have kept going and finished.
 */
export async function sendRunEndReport(
  reporting: FactoryReporting,
  {
    sender,
    recipients,
    since,
    outcome,
    subject,
    attributes = {},
  }: {
    sender: FactoryReportSender;
    recipients: FactoryDeliveryTarget[];
    since: Date;
    outcome: FactoryRunOutcome;
    /** Who finished, e.g. "The work session for #12". */
    subject: string;
    attributes?: Record<string, string>;
  },
): Promise<FactoryDeliveryResult[]> {
  const kinds = outcome.status === 'blocked' ? ['blocked'] : ['done', 'failed'];
  const message =
    outcome.status === 'done'
      ? `${subject} finished.`
      : outcome.status === 'failed'
        ? `${subject} failed${outcome.failureCode ? ` (${outcome.failureCode})` : ''}: ${outcome.reason}`
        : `${subject} is waiting${outcome.toolName ? ` on ${outcome.toolName}` : ''} and needs an answer.`;
  const notification = reportNotification({
    sender,
    status: outcome.status,
    message,
    attributes: {
      ...attributes,
      backstop: 'true',
      ...(outcome.status === 'failed' && outcome.failureCode ? { 'failure-code': outcome.failureCode } : {}),
      ...(outcome.status === 'blocked' && outcome.toolName ? { 'parked-tool': outcome.toolName } : {}),
    },
  });
  const results: FactoryDeliveryResult[] = [];
  for (const recipient of recipients) {
    if (
      await hasFinalReport(reporting.notifications, {
        senderSessionId: sender.sessionId,
        recipientThreadId: recipient.threadId,
        since,
        kinds,
      })
    ) {
      continue;
    }
    results.push(await reporting.deliver(recipient, notification));
  }
  return results;
}

export interface FactoryRunEndInput {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  role: string;
  sender: FactoryReportSender;
  since: Date;
  outcome: FactoryRunOutcome;
}

export type FactoryRunEndReporter = (input: FactoryRunEndInput) => Promise<void>;

/** The backstop for a work-item run: reports to the item's subscribers. Failures are logged, never thrown. */
export function createWorkItemRunEndReporter({
  workItems,
  reporting,
}: {
  workItems: Pick<WorkItemsStorage, 'listWorkItemSubscribers' | 'getForProject'>;
  /** Resolved per report: the controller exists only once the mount is up. */
  reporting: () => Promise<FactoryReporting | null>;
}): FactoryRunEndReporter {
  return async input => {
    try {
      const resolved = await reporting();
      if (!resolved) return;
      const recipients = await workItemReportRecipients(workItems, {
        orgId: input.orgId,
        workItemId: input.workItemId,
        senderSessionId: input.sender.sessionId,
      });
      if (recipients.length === 0) return;
      const { label, attributes } = await workItemReportAttributes(workItems, input);
      await sendRunEndReport(resolved, {
        sender: input.sender,
        recipients,
        since: input.since,
        outcome: input.outcome,
        subject: `The ${input.role} session for ${label}`,
        attributes,
      });
    } catch (error) {
      console.warn('[Factory reports] Unable to send the run-end report.', error);
    }
  };
}

export interface FactoryStageChange {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  fromStage: string | undefined;
  toStage: string;
}

/**
 * Tells a work item's subscribers it moved, at `low` priority. Only sessions
 * already live hear it: a stage change never brings a session online; an
 * offline subscriber sees the stage in its state signal on its next turn.
 */
export function createStageChangeNotifier({
  workItems,
  reporting,
}: {
  workItems: Pick<WorkItemsStorage, 'listWorkItemSubscribers' | 'getForProject'>;
  reporting: () => Promise<FactoryReporting | null>;
}): (change: FactoryStageChange) => Promise<void> {
  return async change => {
    const subscribers = await workItems.listWorkItemSubscribers({
      orgId: change.orgId,
      workItemId: change.workItemId,
    });
    if (subscribers.length === 0) return;
    const resolved = await reporting();
    if (!resolved) return;
    const item = await workItems.getForProject(change.orgId, change.factoryProjectId, change.workItemId);
    const number = item ? workItemNumber(item) : null;
    const label = number === null ? (item ? `"${item.title}"` : change.workItemId) : `#${number}`;
    const summary = change.fromStage
      ? `${label} moved from ${change.fromStage} to ${change.toStage}.`
      : `${label} moved to ${change.toStage}.`;
    const notification: Omit<SendNotificationSignalInput, 'source'> = {
      kind: 'stage',
      priority: 'low',
      summary,
      payload: { message: summary },
      sourceId: change.workItemId,
      coalesceKey: `factory-stage:${change.workItemId}`,
      attributes: {
        'work-item': number === null ? change.workItemId : `#${number}`,
        ...(change.fromStage ? { 'from-stage': change.fromStage } : {}),
        'to-stage': change.toStage,
      },
    };
    for (const subscriber of subscribers) {
      try {
        await resolved.deliver({ sessionId: subscriber.sessionId, threadId: subscriber.threadId }, notification, {
          onlyIfLive: true,
        });
      } catch (error) {
        console.warn(`[Factory reports] Unable to tell ${subscriber.sessionId} that ${label} moved.`, error);
      }
    }
  };
}
