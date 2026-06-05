import type { CreatedAgentSignal } from '../agent/signals';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import type { SendAgentSignalOptions } from '../agent/types';
import type { PubSub } from '../events';
import type { Mastra } from '../mastra';
import { createNotificationSignal, createNotificationSummarySignal, summarizeNotifications } from './signals';
import type { NotificationsStorage } from './storage';
import type { NotificationRecord } from './types';

type NotificationDispatchAgent = {
  id?: string;
  getPubSub?: () => PubSub | undefined;
  sendSignal: (
    signal: CreatedAgentSignal,
    target: SendAgentSignalOptions,
  ) => {
    accepted: boolean;
    runId: string;
    signal: CreatedAgentSignal;
    persisted?: Promise<void>;
  };
};

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

const individualDeliveryPriority: Record<NotificationRecord['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const compareIndividualDeliveryPriority = (a: NotificationRecord, b: NotificationRecord): number =>
  individualDeliveryPriority[a.priority] - individualDeliveryPriority[b.priority] ||
  a.createdAt.getTime() - b.createdAt.getTime();

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
    deliveryAttempts: (record.deliveryAttempts ?? 0) + 1,
    lastDeliveryAttemptAt: now,
    lastDeliveryError: errorMessage(error),
  });
}

async function sendNotificationRecord({
  mastra,
  storage,
  record,
  now,
}: {
  mastra: Mastra;
  storage: NotificationsStorage;
  record: NotificationRecord;
  now: Date;
}): Promise<{ record: NotificationRecord; signal: CreatedAgentSignal } | null> {
  const current = await storage.getNotification({ threadId: record.threadId, id: record.id });
  if (!current || current.status !== 'pending' || current.deliveredSignalId) return null;
  if (!current.agentId) throw new Error(`Notification ${current.id} is missing agentId`);
  if (!current.resourceId) throw new Error(`Notification ${current.id} is missing resourceId`);

  const agent = (await mastra.getAgentById(current.agentId as never)) as NotificationDispatchAgent;
  if (current.priority === 'high' && current.summarySignalId) {
    const threadState = agentThreadStreamRuntime.getThreadState(
      { resourceId: current.resourceId, threadId: current.threadId },
      agent.getPubSub?.(),
    );
    if (threadState === 'active') return null;
  }

  const signal = createNotificationSignal({
    ...current,
    status: 'delivered',
    deliveredAt: now,
    lastDeliveryAttemptAt: now,
  });
  const target: SendAgentSignalOptions = { resourceId: current.resourceId, threadId: current.threadId };
  const result = agent.sendSignal(signal, target);
  await result.persisted;
  if (!result.accepted) {
    throw new Error(`Notification ${current.id} signal was rejected`);
  }
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

  const agent = await mastra.getAgentById(first.agentId as never);
  const summary = summarizeNotifications(records);
  const signal = createNotificationSummarySignal(summary);
  const target: SendAgentSignalOptions = records.every(record => record.priority === 'low')
    ? { resourceId: first.resourceId, threadId: first.threadId, ifIdle: { behavior: 'persist' } }
    : { resourceId: first.resourceId, threadId: first.threadId };
  const result = (agent as NotificationDispatchAgent).sendSignal(signal, target);
  await result.persisted;
  if (!result.accepted) {
    throw new Error(`Notification summary for thread ${first.threadId} was rejected`);
  }

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
  const summaryGroups = new Map<string, NotificationRecord[]>();
  const individual: NotificationRecord[] = [];

  for (const record of due) {
    if (isSummaryDue(record, now)) {
      const key = groupKey(record);
      if (!key) {
        const error = new Error(
          `Notification ${record.id} cannot be summarized without agentId, resourceId, and threadId`,
        );
        await recordDeliveryFailure({ storage, record, now, error });
        failed.push({ record, error: error.message });
        continue;
      }
      const group = summaryGroups.get(key) ?? [];
      group.push(record);
      summaryGroups.set(key, group);
    } else {
      individual.push(record);
    }
  }

  for (const records of summaryGroups.values()) {
    try {
      const result = await sendNotificationSummary({ mastra, storage, records, now });
      delivered.push(...result.records);
      signals.push(result.signal);
    } catch (error) {
      for (const record of records) {
        await recordDeliveryFailure({ storage, record, now, error });
        failed.push({ record, error: errorMessage(error) });
      }
    }
  }

  individual.sort(compareIndividualDeliveryPriority);

  for (const record of individual) {
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
