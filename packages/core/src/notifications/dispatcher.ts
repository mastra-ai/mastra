import type { CreatedAgentSignal } from '../agent/signals';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import type { AgentSignalIfIdleOptions, SendAgentSignalOptions, SendAgentSignalResult } from '../agent/types';
import type { PubSub } from '../events';
import type { Mastra } from '../mastra';
import type { NotificationDeliveryPolicyInput } from './delivery-policy';
import { resolveDeliveryFailureUpdate } from './delivery-policy';
import { createNotificationSignal, createNotificationSummarySignal, summarizeNotifications } from './signals';
import type { NotificationsStorage } from './storage';
import type { NotificationDeliveryDecision, NotificationDeliveryThreadState, NotificationRecord } from './types';

type NotificationDispatchAgent = {
  id?: string;
  getPubSub?: () => PubSub | undefined;
  sendSignal: (signal: CreatedAgentSignal, target: SendAgentSignalOptions) => SendAgentSignalResult;
  resolveNotificationDeliveryDecision?: (
    input: NotificationDeliveryPolicyInput,
  ) => Promise<NotificationDeliveryDecision> | NotificationDeliveryDecision;
};

/**
 * Deferred deliveries happen long after the originating send, so any stream
 * options attached to the original signal are gone. Re-run the agent's
 * delivery policy at delivery time and take the decision's `streamOptions`,
 * so a woken idle thread carries the request context (e.g. model selection)
 * it needs to start a run. Only `streamOptions` is honored here — the
 * record's persisted schedule already fixed WHEN and HOW it is delivered.
 * Best-effort: a throwing policy must not turn into a permanent delivery
 * failure, so fall back to a bare wake.
 */
async function resolveIfIdleStreamOptions(
  mastra: Mastra,
  agent: NotificationDispatchAgent,
  input: NotificationDeliveryPolicyInput,
): Promise<AgentSignalIfIdleOptions['streamOptions']> {
  try {
    const decision = await agent.resolveNotificationDeliveryDecision?.(input);
    return decision?.streamOptions;
  } catch (error) {
    mastra
      .getLogger()
      ?.warn(
        `Notification delivery policy failed for thread ${input.record.threadId}; delivering with a bare wake: ${errorMessage(error)}`,
      );
    return undefined;
  }
}

export type DispatchDueNotificationsInput = {
  mastra: Mastra;
  storage: NotificationsStorage;
  now?: Date;
  limit?: number;
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
  const streamOptions = await resolveIfIdleStreamOptions(mastra, agent, { record: current, threadState, now });
  const target: SendAgentSignalOptions = {
    resourceId: current.resourceId,
    threadId: current.threadId,
    ...(streamOptions ? { ifIdle: { streamOptions } } : {}),
  };
  const result = agent.sendSignal(signal, target);
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
}): Promise<{ records: NotificationRecord[]; signal: CreatedAgentSignal }> {
  const first = records[0];
  if (!first?.agentId) throw new Error('Notification summary is missing agentId');
  if (!first.resourceId) throw new Error('Notification summary is missing resourceId');

  const agent = (await mastra.getAgentById(first.agentId as never)) as NotificationDispatchAgent;
  const summary = summarizeNotifications(records);
  const signal = createNotificationSummarySignal(summary);
  // The all-low-priority batch persists without waking, so it never starts a
  // run and needs no stream options.
  const allLowPriority = records.every(record => record.priority === 'low');
  const streamOptions = allLowPriority
    ? undefined
    : await resolveIfIdleStreamOptions(mastra, agent, {
        record: first,
        threadState: agentThreadStreamRuntime.getThreadState(
          { resourceId: first.resourceId, threadId: first.threadId },
          agent.getPubSub?.(),
        ),
        now,
      });
  const target: SendAgentSignalOptions = allLowPriority
    ? { resourceId: first.resourceId, threadId: first.threadId, ifIdle: { behavior: 'persist' } }
    : {
        resourceId: first.resourceId,
        threadId: first.threadId,
        ...(streamOptions ? { ifIdle: { streamOptions } } : {}),
      };
  const result = agent.sendSignal(signal, target);
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
}: DispatchDueNotificationsInput): Promise<DispatchDueNotificationsResult> {
  const due = await storage.listDueNotifications({ now, limit });
  const delivered: NotificationRecord[] = [];
  const failed: Array<{ record: NotificationRecord; error: string }> = [];
  const signals: CreatedAgentSignal[] = [];
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

  return { delivered, failed, signals };
}
