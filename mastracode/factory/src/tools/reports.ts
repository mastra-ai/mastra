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

import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_SESSION_NOTIFICATION_SOURCE } from './deliver.js';
import type { FactoryDeliveryResult, FactoryDeliveryTarget } from './deliver.js';
import { workItemNumber } from './read-tools.js';

export type FactoryReportStatus = 'progress' | 'blocked' | 'done' | 'failed';

/** How each report status travels. Final reports never coalesce, so a later report can't overwrite them. */
export const FACTORY_REPORT_FORMS: Record<
  FactoryReportStatus | 'report',
  { kind: string; priority: NotificationPriority; coalesce: boolean }
> = {
  failed: { kind: 'failed', priority: 'urgent', coalesce: false },
  blocked: { kind: 'blocked', priority: 'urgent', coalesce: false },
  done: { kind: 'done', priority: 'high', coalesce: false },
  progress: { kind: 'progress', priority: 'low', coalesce: true },
  // Not `message`: only messages can be answered, so a report can't start a reply loop.
  report: { kind: 'report', priority: 'high', coalesce: false },
};

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
    agentOnly = false,
  }: {
    senderSessionId: string;
    recipientThreadId: string;
    since: Date;
    kinds: readonly string[];
    /** Ignore reports Factory sent on the session's behalf (the backstop). */
    agentOnly?: boolean;
  },
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
      !(agentOnly && record.attributes?.backstop === 'true') &&
      // A reply carrying a final status counts like the report itself.
      (kinds.includes(record.kind) ||
        (record.kind === 'reply' &&
          typeof record.attributes?.status === 'string' &&
          kinds.includes(record.attributes.status))) &&
      record.createdAt >= since
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether the newest report `senderSessionId` put on the recipient thread is
 * already this exact `failed` backstop. A session stuck failing the same way
 * (a run that dies before the model, restarted over and over) then reports
 * once, not once per attempt; any other report in between resets it.
 */
export async function repeatsLastFailure(
  notifications: FactoryReporting['notifications'],
  {
    senderSessionId,
    recipientThreadId,
    summary,
  }: { senderSessionId: string; recipientThreadId: string; summary: string },
): Promise<boolean> {
  const records = await notifications.listNotifications({
    threadId: recipientThreadId,
    source: FACTORY_SESSION_NOTIFICATION_SOURCE,
    limit: FINAL_REPORT_SCAN,
  });
  // Storage orders by `updatedAt`, which moves when a report is read; the
  // newest report is the one created last.
  const last = records
    .filter(record => record.attributes?.['from-session'] === senderSessionId)
    .reduce<(typeof records)[number] | undefined>(
      (newest, record) => (!newest || record.createdAt > newest.createdAt ? record : newest),
      undefined,
    );
  return last?.kind === 'failed' && last.attributes?.backstop === 'true' && last.summary === summary;
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
  const form = FACTORY_REPORT_FORMS[status ?? 'report'];
  return {
    kind: form.kind,
    priority: form.priority,
    // The whole text: a notification's summary is all the recipient's agent ever sees, even
    // through notification_inbox (which hides payloads), so a cut-off report loses its verdict.
    summary: message,
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

/** How reports name an item: `#n`, else its quoted title, else its id. */
async function workItemReference(
  workItems: Pick<WorkItemsStorage, 'getForProject'>,
  { orgId, factoryProjectId, workItemId }: { orgId: string; factoryProjectId: string; workItemId: string },
): Promise<{ label: string; ref: string }> {
  const item = await workItems.getForProject(orgId, factoryProjectId, workItemId);
  const number = item ? workItemNumber(item) : null;
  if (number !== null) return { label: `#${number}`, ref: `#${number}` };
  return { label: item ? `"${item.title}"` : workItemId, ref: workItemId };
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
  const { label, ref } = await workItemReference(workItems, { orgId, factoryProjectId, workItemId });
  return { label, attributes: { 'work-item': ref, role } };
}

export type FactoryRunOutcome =
  | { status: 'done' }
  | { status: 'failed'; reason: string; failureCode?: string }
  | { status: 'blocked'; toolName?: string; approval?: boolean };

/** `waiting`: the session is waiting for an answer, so a later run owes the final report. */
export interface FactoryRunEndResult {
  waiting: boolean;
  deliveries?: FactoryDeliveryResult[];
}

/**
 * The run-end backstop: send `outcome` to each recipient that hasn't had a
 * final report from this sender since the run started. An agent's own `done`
 * or `failed` report wins. A run that completes after the agent's own
 * `blocked` sends nothing: the agent ended its turn to wait for an answer, and
 * its `done` comes from a later run. A `failed` backstop still goes out after an
 * earlier `blocked`.
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
): Promise<FactoryRunEndResult> {
  const kinds = outcome.status === 'blocked' ? ['blocked'] : ['done', 'failed'];
  const message =
    outcome.status === 'done'
      ? `${subject} finished.`
      : outcome.status === 'failed'
        ? `${subject} failed${outcome.failureCode ? ` (${outcome.failureCode})` : ''}: ${outcome.reason}`
        : outcome.approval
          ? `${subject} is waiting for someone to approve ${outcome.toolName ?? 'a tool call'} in that session.`
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
      ...(outcome.status === 'blocked' && outcome.approval ? { 'waiting-for': 'approval' } : {}),
    },
  });
  const report = (recipient: FactoryDeliveryTarget, reportKinds: string[], agentOnly = false) =>
    hasFinalReport(reporting.notifications, {
      senderSessionId: sender.sessionId,
      recipientThreadId: recipient.threadId,
      since,
      kinds: reportKinds,
      agentOnly,
    });
  let waiting = outcome.status === 'blocked';
  const deliveries: FactoryDeliveryResult[] = [];
  for (const recipient of recipients) {
    // Only the agent's own reports count: an earlier run's backstop lands after this
    // run's window opened. A reply already told that follower how a finished run went.
    if (await report(recipient, outcome.status === 'done' ? [...kinds, 'reply'] : kinds, true)) continue;
    // Only the agent's own `blocked` means it ended its turn to wait; a backstop `blocked` from a parked run doesn't.
    if (outcome.status === 'done' && (await report(recipient, ['blocked'], true))) {
      waiting = true;
      continue;
    }
    if (
      outcome.status === 'failed' &&
      (await repeatsLastFailure(reporting.notifications, {
        senderSessionId: sender.sessionId,
        recipientThreadId: recipient.threadId,
        summary: message,
      }))
    ) {
      continue;
    }
    deliveries.push(await reporting.deliver(recipient, notification));
  }
  return { waiting, deliveries };
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

export type FactoryRunEndReporter = (input: FactoryRunEndInput) => Promise<FactoryRunEndResult>;

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
      if (!resolved) return { waiting: false };
      const recipients = await workItemReportRecipients(workItems, {
        orgId: input.orgId,
        workItemId: input.workItemId,
        senderSessionId: input.sender.sessionId,
      });
      if (recipients.length === 0) return { waiting: false };
      const { label, attributes } = await workItemReportAttributes(workItems, input);
      return await sendRunEndReport(resolved, {
        sender: input.sender,
        recipients,
        since: input.since,
        outcome: input.outcome,
        subject: `The ${input.role} session for ${label}`,
        attributes,
      });
    } catch (error) {
      console.warn('[Factory reports] Unable to send the run-end report.', error);
      return { waiting: false };
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
    const { label, ref } = await workItemReference(workItems, change);
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
        'work-item': ref,
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

/** Reports one run end of a session; the thread is the one the run used. */
export type FactorySessionRunEndReporter = (input: {
  sessionId: string;
  threadId: string | null;
  outcome: FactoryRunOutcome;
  since: Date;
}) => Promise<void>;

/** A tool call a session's run is holding until someone approves or declines it. */
export interface FactoryApprovalRequest {
  sessionId: string;
  threadId: string | null;
  toolName: string;
  toolCallId: string;
  args: unknown;
}

export type FactoryApprovalNotifier = (request: FactoryApprovalRequest) => Promise<void>;

interface SessionReportDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<
    WorkItemsStorage,
    'findActiveRunBindingForSession' | 'findRunBindingBySession' | 'listWorkItemSubscribers' | 'getForProject'
  >;
  reporting: () => Promise<FactoryReporting | null>;
}

/** How much of a gated call's arguments an approval notice quotes. */
const APPROVAL_ARGS_LENGTH = 3000;

/**
 * Who hears from a session: a work session (one with an active run binding)
 * reports to its item's followers, a side session to the session that started
 * it. Any other session (a person's own) has nobody to tell.
 */
async function sessionAudience(
  { sessions, workItems }: Omit<SessionReportDependencies, 'reporting'>,
  sessionId: string,
  threadId: string | null,
  /** When the run started: a binding revoked since then (the run moved its card to a finished stage) still counts. */
  since?: Date,
): Promise<
  | {
      kind: 'work-item';
      binding: NonNullable<Awaited<ReturnType<WorkItemsStorage['findActiveRunBindingForSession']>>>;
      sender: FactoryReportSender;
    }
  | {
      kind: 'origin';
      sender: FactoryReportSender;
      recipient: FactoryDeliveryTarget;
      subject: string;
      /** Set while the origin has muted this side session's reports (approval notices still go through). */
      mutedAt: Date | null;
    }
  | null
> {
  const row = await sessions.getBySessionId(sessionId);
  if (!row?.factoryProjectId) return null;
  let binding = await workItems.findActiveRunBindingForSession({
    orgId: row.orgId,
    factoryProjectId: row.factoryProjectId,
    sessionId: row.sessionId,
  });
  if (!binding && since && threadId) {
    const latest = await workItems.findRunBindingBySession({
      factoryProjectId: row.factoryProjectId,
      threadId,
      resourceId: row.sessionId,
      sessionId: row.sessionId,
    });
    if (latest?.orgId === row.orgId && latest.revokedAt && latest.revokedAt >= since) binding = latest;
  }
  if (binding) {
    return {
      kind: 'work-item',
      binding,
      sender: { sessionId: row.sessionId, threadId: binding.threadId, userId: row.userId },
    };
  }
  if (!row.originSessionId || !row.originThreadId || !threadId) return null;
  return {
    kind: 'origin',
    sender: { sessionId: row.sessionId, threadId, userId: row.userId },
    recipient: { sessionId: row.originSessionId, threadId: row.originThreadId },
    subject: `The side session "${row.title ?? row.sessionId}"`,
    mutedAt: row.originMutedAt ?? null,
  };
}

/** Reports each run end of a work or side session to whoever follows it. */
export function createSessionRunEndReporter(deps: SessionReportDependencies): FactorySessionRunEndReporter {
  const workItemRunEnd = createWorkItemRunEndReporter(deps);
  return async ({ sessionId, threadId, outcome, since }) => {
    const audience = await sessionAudience(deps, sessionId, threadId, since);
    if (!audience) return;
    if (audience.kind === 'work-item') {
      const { binding, sender } = audience;
      await workItemRunEnd({
        orgId: binding.orgId,
        factoryProjectId: binding.factoryProjectId,
        workItemId: binding.workItemId,
        role: binding.role,
        sender,
        since,
        outcome,
      });
      return;
    }
    // A muted origin still hears when the session is blocked: nothing else would tell it the session is waiting.
    if (audience.mutedAt && outcome.status !== 'blocked') return;
    const resolved = await deps.reporting();
    if (!resolved) return;
    await sendRunEndReport(resolved, {
      sender: audience.sender,
      recipients: [audience.recipient],
      since,
      outcome,
      subject: audience.subject,
    });
  };
}

/**
 * Tells whoever follows a session, urgently, the moment its run holds a tool
 * call for approval. The run stays open on the gate, so no run end would say
 * so; the notice names the session and call so a follower can answer it with
 * `factory_answer_approval`.
 */
export function createSessionApprovalNotifier(deps: SessionReportDependencies): FactoryApprovalNotifier {
  return async ({ sessionId, threadId, toolName, toolCallId, args }) => {
    const audience = await sessionAudience(deps, sessionId, threadId);
    if (!audience) return;
    const resolved = await deps.reporting();
    if (!resolved) return;
    let subject: string;
    let recipients: FactoryDeliveryTarget[];
    let attributes: Record<string, string> = {};
    if (audience.kind === 'work-item') {
      const { binding } = audience;
      recipients = await workItemReportRecipients(deps.workItems, {
        orgId: binding.orgId,
        workItemId: binding.workItemId,
        senderSessionId: audience.sender.sessionId,
      });
      const named = await workItemReportAttributes(deps.workItems, binding);
      subject = `The ${binding.role} session for ${named.label}`;
      attributes = named.attributes;
    } else {
      recipients = [audience.recipient];
      subject = audience.subject;
    }
    if (recipients.length === 0) return;
    const argsText = JSON.stringify(args ?? {}) ?? '{}';
    const quoted = argsText.length > APPROVAL_ARGS_LENGTH ? `${argsText.slice(0, APPROVAL_ARGS_LENGTH)}…` : argsText;
    const message = [
      `${subject} is waiting for approval to run ${toolName} with ${quoted}.`,
      `Answer it with factory_answer_approval (sessionId "${audience.sender.sessionId}", toolCallId "${toolCallId}"), or open that session to approve or decline it there.`,
    ].join(' ');
    const notification = {
      ...reportNotification({
        sender: audience.sender,
        message,
        attributes: { ...attributes, 'waiting-for': 'approval', 'tool-name': toolName, 'tool-call-id': toolCallId },
      }),
      kind: 'approval',
      priority: 'urgent' as const,
      // One notice per held call, even if the gate is announced again.
      dedupeKey: `factory-approval:${toolCallId}`,
    };
    for (const recipient of recipients) await resolved.deliver(recipient, notification);
  };
}
