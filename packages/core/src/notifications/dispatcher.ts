import type { AgentScopeEntry } from '../agent/scopes';
import type { CreatedAgentSignal } from '../agent/signals';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import type { AgentSignalIfIdleOptions, SendAgentSignalOptions, SendAgentSignalResult } from '../agent/types';
import type { PubSub } from '../events';
import type { Mastra } from '../mastra';
import type { NotificationDeliveryPolicyInput } from './delivery-policy';
import { resolveDeliveryFailureUpdate } from './delivery-policy';
import { readNotificationRoutingRequirement } from './routing';
import { createNotificationSignal, createNotificationSummarySignal, summarizeNotifications } from './signals';
import type { NotificationsStorage } from './storage';
import type { NotificationDeliveryDecision, NotificationDeliveryThreadState, NotificationRecord } from './types';

type NotificationDispatchAgent = {
  id?: string;
  getPubSub?: () => PubSub | undefined;
  sendSignal: (signal: CreatedAgentSignal, target: SendAgentSignalOptions) => SendAgentSignalResult;
  queueSignal?: (signal: CreatedAgentSignal, target: SendAgentSignalOptions) => SendAgentSignalResult;
  resolveNotificationDeliveryDecision?: (
    input: NotificationDeliveryPolicyInput,
  ) => Promise<NotificationDeliveryDecision> | NotificationDeliveryDecision;
};

/**
 * Deferred deliveries happen long after the originating send, so any stream
 * options attached to the original signal are gone. Re-run the agent's
 * delivery policy at delivery time and take the decision's `streamOptions`,
 * so a woken idle thread carries the request context (e.g. model selection)
 * it needs to start a run. Only `streamOptions` and `hold` are honored here —
 * the record's persisted schedule already fixed WHEN and HOW it is delivered.
 * `hold` leaves the record for another process's dispatcher.
 * A throwing policy fails the delivery attempt with its error, counted toward
 * the attempt limit like any other failure. Falling back to a bare wake would
 * start the run without the context the policy failed to build (owner
 * identity, model selection), so it fails anyway, with a less useful error.
 */
async function resolveDeliveryTimeDecision(
  agent: NotificationDispatchAgent,
  input: NotificationDeliveryPolicyInput,
): Promise<{ streamOptions?: AgentSignalIfIdleOptions['streamOptions']; hold: boolean }> {
  const decision = await agent.resolveNotificationDeliveryDecision?.(input);
  return { streamOptions: decision?.streamOptions, hold: decision?.hold === true };
}

/**
 * Build the target for a delayed delivery. A record created by a send that
 * required a claimed owner keeps that requirement, so the retry reaches the
 * owner instead of starting the thread in whichever process happens to run the
 * dispatch (with that process's workspace and stream options).
 */
function delayedDeliveryTarget({
  resourceId,
  threadId,
  streamOptions,
  requireClaimedOwner,
  scopes,
}: {
  resourceId: string;
  threadId: string;
  streamOptions?: AgentSignalIfIdleOptions['streamOptions'];
  requireClaimedOwner: boolean;
  scopes?: AgentScopeEntry[];
}): SendAgentSignalOptions {
  const scoped = scopes?.length ? { scopes } : {};
  if (!streamOptions && !requireClaimedOwner) return { resourceId, threadId, ...scoped };
  return {
    resourceId,
    threadId,
    ...scoped,
    ifIdle: {
      ...(requireClaimedOwner ? { requireClaimedOwner: true } : {}),
      ...(streamOptions ? { streamOptions } : {}),
    },
  };
}

/**
 * A run's scopes are fixed when it starts, so a notification naming other scopes than the
 * run active on its thread can't join that run: it queues to start its own run after it.
 */
async function sendNotificationSignalToAgent(
  agent: NotificationDispatchAgent,
  signal: CreatedAgentSignal,
  target: SendAgentSignalOptions,
): Promise<SendAgentSignalResult> {
  const result = agent.sendSignal(signal, target);
  // A rejection still reaches the caller through `result.accepted`.
  const accepted = await result.accepted.catch(() => undefined);
  if (accepted?.action === 'blocked' && accepted.reason === 'scope-mismatch' && agent.queueSignal) {
    return agent.queueSignal(signal, target);
  }
  return result;
}

/** The scopes every record of a summary names, or none when they differ. */
function sharedScopes(records: NotificationRecord[]): AgentScopeEntry[] | undefined {
  const scopes = records.map(record => readNotificationRoutingRequirement(record.metadata)?.scopes);
  const key = JSON.stringify(scopes[0] ?? null);
  return scopes.every(entry => JSON.stringify(entry ?? null) === key) ? scopes[0] : undefined;
}

export type DispatchDueNotificationsInput = {
  mastra: Mastra;
  storage: NotificationsStorage;
  now?: Date;
  limit?: number;
  /** Only dispatch notifications for this resource's threads. */
  resourceId?: string;
};

export type DispatchDueNotificationsResult = {
  delivered: NotificationRecord[];
  failed: Array<{ record: NotificationRecord; error: string }>;
  signals: CreatedAgentSignal[];
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const isSummaryDue = (record: NotificationRecord, now: Date): boolean =>
  Boolean(record.summaryAt && record.summaryAt.getTime() <= now.getTime());

const deliveryPriority: Record<NotificationRecord['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type DueDispatchGroup = {
  key: string;
  agentId: string;
  resourceId: string;
  threadId: string;
  summaryRecords: NotificationRecord[];
  individualRecords: NotificationRecord[];
};

type DueDispatchItem =
  | { type: 'summary'; records: NotificationRecord[]; priority: NotificationRecord['priority']; createdAt: Date }
  | { type: 'individual'; record: NotificationRecord; priority: NotificationRecord['priority']; createdAt: Date };

const compareDueDispatchItems = (a: DueDispatchItem, b: DueDispatchItem): number =>
  deliveryPriority[a.priority] - deliveryPriority[b.priority] || a.createdAt.getTime() - b.createdAt.getTime();

const getHighestPriority = (records: NotificationRecord[]): NotificationRecord['priority'] =>
  records.reduce<NotificationRecord['priority']>(
    (highest, record) => (deliveryPriority[record.priority] < deliveryPriority[highest] ? record.priority : highest),
    'low',
  );

const getEarliestCreatedAt = (records: NotificationRecord[]): Date =>
  records.reduce(
    (earliest, record) => (record.createdAt.getTime() < earliest.getTime() ? record.createdAt : earliest),
    records[0]!.createdAt,
  );

const groupKey = (record: NotificationRecord): string | undefined => {
  if (!record.agentId || !record.resourceId || !record.threadId) return undefined;
  return [record.agentId, record.resourceId, record.threadId].join('\0');
};

async function recordDeliveryFailure({
  storage,
  record,
  now,
  error,
}: {
  storage: NotificationsStorage;
  record: NotificationRecord;
  now: Date;
  error: unknown;
}) {
  await storage.updateNotification({
    id: record.id,
    threadId: record.threadId,
    ...resolveDeliveryFailureUpdate(record),
    lastDeliveryAttemptAt: now,
    lastDeliveryError: errorMessage(error),
  });
}

async function sendNotificationRecord({
  mastra,
  storage,
  record,
  now,
  batchThreadState,
}: {
  mastra: Mastra;
  storage: NotificationsStorage;
  record: NotificationRecord;
  now: Date;
  batchThreadState?: NotificationDeliveryThreadState;
}): Promise<{ record: NotificationRecord; signal: CreatedAgentSignal } | null> {
  const current = await storage.getNotification({ threadId: record.threadId, id: record.id });
  if (!current || current.status !== 'pending' || current.deliveredSignalId) return null;
  if (!current.agentId) throw new Error(`Notification ${current.id} is missing agentId`);
  if (!current.resourceId) throw new Error(`Notification ${current.id} is missing resourceId`);

  const agent = (await mastra.getAgentById(current.agentId as never)) as NotificationDispatchAgent;
  const threadState =
    batchThreadState ??
    agentThreadStreamRuntime.getThreadState(
      { resourceId: current.resourceId, threadId: current.threadId },
      agent.getPubSub?.(),
    );
  if (current.priority === 'high' && current.summarySignalId && threadState === 'active') return null;

  const signal = createNotificationSignal({
    ...current,
    status: 'delivered',
    deliveredAt: now,
    lastDeliveryAttemptAt: now,
  });
  const { streamOptions, hold } = await resolveDeliveryTimeDecision(agent, {
    record: current,
    threadState,
    now,
  });
  if (hold) return null;
  const routing = readNotificationRoutingRequirement(current.metadata);
  const target = delayedDeliveryTarget({
    resourceId: current.resourceId,
    threadId: current.threadId,
    streamOptions,
    requireClaimedOwner: routing?.requireClaimedOwner === true,
    scopes: routing?.scopes,
  });
  const result = await sendNotificationSignalToAgent(agent, signal, target);
  // `accepted` rejects when the signal could not be routed/started (e.g. a
  // misconfigured agent). Let that propagate so the caller records the
  // notification as a failed delivery.
  await result.accepted;
  await result.persisted;
  const updated = await storage.updateNotification({
    id: current.id,
    threadId: current.threadId,
    status: 'delivered',
    deliveredSignalId: result.signal.id,
    lastDeliveryAttemptAt: now,
  });
  return { record: updated, signal: result.signal };
}

async function sendNotificationSummary({
  mastra,
  storage,
  records,
  now,
}: {
  mastra: Mastra;
  storage: NotificationsStorage;
  records: NotificationRecord[];
  now: Date;
}): Promise<{ records: NotificationRecord[]; signal: CreatedAgentSignal } | null> {
  const first = records[0];
  if (!first?.agentId) throw new Error('Notification summary is missing agentId');
  if (!first.resourceId) throw new Error('Notification summary is missing resourceId');

  const agent = (await mastra.getAgentById(first.agentId as never)) as NotificationDispatchAgent;
  const decision = await resolveDeliveryTimeDecision(agent, {
    record: first,
    threadState: agentThreadStreamRuntime.getThreadState(
      { resourceId: first.resourceId, threadId: first.threadId },
      agent.getPubSub?.(),
    ),
    now,
  });
  if (decision.hold) return null;
  // The all-low-priority batch persists without waking, so it never starts a
  // run. It still needs the policy's request context: resolving the agent's
  // memory to write the summary can depend on who the thread belongs to.
  const allLowPriority = records.every(record => record.priority === 'low');
  const requireClaimedOwner = records.some(
    record => readNotificationRoutingRequirement(record.metadata)?.requireClaimedOwner === true,
  );
  const summary = summarizeNotifications(records);
  const signal = createNotificationSummarySignal(summary);
  const persistRequestContext = decision.streamOptions?.requestContext;
  const target: SendAgentSignalOptions = allLowPriority
    ? {
        resourceId: first.resourceId,
        threadId: first.threadId,
        ifIdle: {
          behavior: 'persist',
          ...(persistRequestContext ? { streamOptions: { requestContext: persistRequestContext } } : {}),
        },
      }
    : delayedDeliveryTarget({
        resourceId: first.resourceId,
        threadId: first.threadId,
        streamOptions: decision.streamOptions,
        requireClaimedOwner,
        scopes: sharedScopes(records),
      });
  const result = await sendNotificationSignalToAgent(agent, signal, target);
  // `accepted` rejects when the signal could not be routed/started; let it
  // propagate so the caller records the notifications as failed deliveries.
  await result.accepted;
  await result.persisted;

  const updatedRecords: NotificationRecord[] = [];
  for (const record of records) {
    updatedRecords.push(
      await storage.updateNotification({
        id: record.id,
        threadId: record.threadId,
        summaryAt: null,
        summarySignalId: result.signal.id,
        lastDeliveryAttemptAt: now,
      }),
    );
  }
  return { records: updatedRecords, signal: result.signal };
}

async function getBatchThreadState({
  mastra,
  group,
}: {
  mastra: Mastra;
  group: DueDispatchGroup;
}): Promise<NotificationDeliveryThreadState> {
  const agent = (await mastra.getAgentById(group.agentId as never)) as NotificationDispatchAgent;
  return agentThreadStreamRuntime.getThreadState(
    { resourceId: group.resourceId, threadId: group.threadId },
    agent.getPubSub?.(),
  );
}

export async function dispatchDueNotifications({
  mastra,
  storage,
  now = new Date(),
  limit = 100,
  resourceId,
}: DispatchDueNotificationsInput): Promise<DispatchDueNotificationsResult> {
  const result: DispatchDueNotificationsResult = { delivered: [], failed: [], signals: [] };
  // A record this pass leaves pending (held for another process's dispatcher,
  // or waiting on its thread's active run) keeps its place at the head of the
  // due list. Read past those, so they never crowd out records this pass can
  // deliver: `limit` bounds the records a pass delivers or fails, not the ones
  // it leaves.
  const seen = new Set<string>();
  // Notification ids are unique per thread, not across threads.
  const key = (record: NotificationRecord) => `${record.threadId}\0${record.id}`;
  const acted = () => result.delivered.length + result.failed.length;
  let left = 0;
  while (acted() < limit) {
    const actedBefore = acted();
    const pageSize = left + limit - actedBefore;
    const page = await storage.listDueNotifications({ now, limit: pageSize, ...(resourceId ? { resourceId } : {}) });
    const due = page.filter(record => !seen.has(key(record)));
    for (const record of due) seen.add(key(record));
    await dispatchRecords({ mastra, storage, now, due, result });
    const leftThisPage = due.length - (acted() - actedBefore);
    left += leftThisPage;
    // The due list ran out, or nothing was left ahead of the records still unread.
    if (page.length < pageSize || leftThisPage === 0) break;
  }
  return result;
}

async function dispatchRecords({
  mastra,
  storage,
  now,
  due,
  result: { delivered, failed, signals },
}: {
  mastra: Mastra;
  storage: NotificationsStorage;
  now: Date;
  due: NotificationRecord[];
  result: DispatchDueNotificationsResult;
}): Promise<void> {
  const groups = new Map<string, DueDispatchGroup>();
  const ungroupedIndividual: NotificationRecord[] = [];

  for (const record of due) {
    const key = groupKey(record);
    if (!key) {
      if (isSummaryDue(record, now)) {
        const error = new Error(
          `Notification ${record.id} cannot be summarized without agentId, resourceId, and threadId`,
        );
        await recordDeliveryFailure({ storage, record, now, error });
        failed.push({ record, error: error.message });
      } else {
        ungroupedIndividual.push(record);
      }
      continue;
    }

    const group = groups.get(key) ?? {
      key,
      agentId: record.agentId!,
      resourceId: record.resourceId!,
      threadId: record.threadId,
      summaryRecords: [],
      individualRecords: [],
    };
    if (isSummaryDue(record, now)) {
      group.summaryRecords.push(record);
    } else {
      group.individualRecords.push(record);
    }
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const records = [...group.summaryRecords, ...group.individualRecords];
    let batchThreadState: NotificationDeliveryThreadState;
    try {
      batchThreadState = await getBatchThreadState({ mastra, group });
    } catch (error) {
      for (const record of records) {
        await recordDeliveryFailure({ storage, record, now, error });
        failed.push({ record, error: errorMessage(error) });
      }
      continue;
    }

    const items: DueDispatchItem[] = group.individualRecords.map(record => ({
      type: 'individual',
      record,
      priority: record.priority,
      createdAt: record.createdAt,
    }));
    if (group.summaryRecords.length > 0) {
      items.push({
        type: 'summary',
        records: group.summaryRecords,
        priority: getHighestPriority(group.summaryRecords),
        createdAt: getEarliestCreatedAt(group.summaryRecords),
      });
    }
    items.sort(compareDueDispatchItems);

    for (const item of items) {
      if (item.type === 'summary') {
        try {
          const result = await sendNotificationSummary({ mastra, storage, records: item.records, now });
          if (!result) continue;
          delivered.push(...result.records);
          signals.push(result.signal);
        } catch (error) {
          for (const record of item.records) {
            await recordDeliveryFailure({ storage, record, now, error });
            failed.push({ record, error: errorMessage(error) });
          }
        }
        continue;
      }

      try {
        const result = await sendNotificationRecord({ mastra, storage, record: item.record, now, batchThreadState });
        if (!result) continue;
        delivered.push(result.record);
        signals.push(result.signal);
      } catch (error) {
        await recordDeliveryFailure({ storage, record: item.record, now, error });
        failed.push({ record: item.record, error: errorMessage(error) });
      }
    }
  }

  ungroupedIndividual.sort((a, b) =>
    compareDueDispatchItems(
      { type: 'individual', record: a, priority: a.priority, createdAt: a.createdAt },
      { type: 'individual', record: b, priority: b.priority, createdAt: b.createdAt },
    ),
  );
  for (const record of ungroupedIndividual) {
    try {
      const result = await sendNotificationRecord({ mastra, storage, record, now });
      if (!result) continue;
      delivered.push(result.record);
      signals.push(result.signal);
    } catch (error) {
      await recordDeliveryFailure({ storage, record, now, error });
      failed.push({ record, error: errorMessage(error) });
    }
  }
}
