import { randomUUID } from 'node:crypto';
import { StorageDomain } from '../storage/domains/base';
import type {
  CreateNotificationInput,
  ListDueNotificationsInput,
  ListNotificationsInput,
  NotificationRecord,
  NotificationStatus,
  UpdateNotificationInput,
} from './types';

export abstract class NotificationsStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'NOTIFICATIONS' });
  }

  abstract createNotification(input: CreateNotificationInput): Promise<NotificationRecord>;
  abstract listNotifications(input: ListNotificationsInput): Promise<NotificationRecord[]>;
  abstract listDueNotifications(input: ListDueNotificationsInput): Promise<NotificationRecord[]>;
  abstract getNotification(input: { threadId: string; id: string }): Promise<NotificationRecord | null>;
  abstract updateNotification(input: UpdateNotificationInput): Promise<NotificationRecord>;
}

const cloneDate = (value?: Date) => (value ? new Date(value) : undefined);

const cloneRecord = (record: NotificationRecord): NotificationRecord => ({
  ...record,
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
  deliveredAt: cloneDate(record.deliveredAt),
  seenAt: cloneDate(record.seenAt),
  dismissedAt: cloneDate(record.dismissedAt),
  archivedAt: cloneDate(record.archivedAt),
  discardedAt: cloneDate(record.discardedAt),
  deliverAt: cloneDate(record.deliverAt),
  summaryAt: cloneDate(record.summaryAt),
  lastDeliveryAttemptAt: cloneDate(record.lastDeliveryAttemptAt),
  attributes: record.attributes ? { ...record.attributes } : undefined,
  metadata: record.metadata ? { ...record.metadata } : undefined,
});

const statusTimestamp = (status: NotificationStatus, now: Date) => {
  if (status === 'delivered') return { deliveredAt: now };
  if (status === 'seen') return { seenAt: now };
  if (status === 'dismissed') return { dismissedAt: now };
  if (status === 'archived') return { archivedAt: now };
  if (status === 'discarded') return { discardedAt: now };
  return {};
};

const valueMatches = <T extends string>(value: T, filter?: T | T[]) => {
  if (!filter) return true;
  return Array.isArray(filter) ? filter.includes(value) : value === filter;
};

const dueTime = (record: NotificationRecord): number => {
  const deliverAt = record.deliverAt?.getTime();
  const summaryAt = record.summaryAt?.getTime();
  if (deliverAt !== undefined && summaryAt !== undefined) return Math.min(deliverAt, summaryAt);
  return deliverAt ?? summaryAt ?? Number.POSITIVE_INFINITY;
};

export class InMemoryNotificationsStorage extends NotificationsStorage {
  #notifications = new Map<string, NotificationRecord>();

  async createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    const existing = this.findCoalescable(input);
    if (existing) {
      const now = new Date();
      const next: NotificationRecord = {
        ...existing,
        summary: input.summary,
        payload: input.payload ?? existing.payload,
        priority: input.priority ?? existing.priority,
        attributes: input.attributes ? { ...existing.attributes, ...input.attributes } : existing.attributes,
        updatedAt: now,
        deliverAt: input.deliverAt ?? existing.deliverAt,
        summaryAt: input.summaryAt ?? existing.summaryAt,
        deliveryReason: input.deliveryReason ?? existing.deliveryReason,
        coalescedCount: (existing.coalescedCount ?? 1) + 1,
        metadata: input.metadata ? { ...existing.metadata, ...input.metadata } : existing.metadata,
      };
      this.#notifications.set(existing.id, next);
      return cloneRecord(next);
    }

    const now = input.createdAt ?? new Date();
    const record: NotificationRecord = {
      id: input.id ?? randomUUID(),
      threadId: input.threadId,
      source: input.source,
      kind: input.kind,
      priority: input.priority ?? 'medium',
      status: 'pending',
      summary: input.summary,
      payload: input.payload,
      resourceId: input.resourceId,
      agentId: input.agentId,
      sourceId: input.sourceId,
      dedupeKey: input.dedupeKey,
      coalesceKey: input.coalesceKey,
      coalescedCount: 1,
      attributes: input.attributes ? { ...input.attributes } : undefined,
      createdAt: now,
      updatedAt: now,
      deliverAt: input.deliverAt,
      summaryAt: input.summaryAt,
      deliveryReason: input.deliveryReason,
      deliveryAttempts: 0,
      metadata: input.metadata ? { ...input.metadata } : undefined,
    };
    this.#notifications.set(record.id, record);
    return cloneRecord(record);
  }

  async listNotifications(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    const search = input.search?.toLowerCase();
    const results = [...this.#notifications.values()]
      .filter(record => record.threadId === input.threadId)
      .filter(record => valueMatches(record.status, input.status))
      .filter(record => valueMatches(record.priority, input.priority))
      .filter(record => !input.source || record.source === input.source)
      .filter(record => !input.resourceId || record.resourceId === input.resourceId)
      .filter(record => !input.agentId || record.agentId === input.agentId)
      .filter(
        record =>
          !search || record.summary.toLowerCase().includes(search) || record.kind.toLowerCase().includes(search),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return results.slice(0, input.limit ?? results.length).map(cloneRecord);
  }

  async listDueNotifications(input: ListDueNotificationsInput): Promise<NotificationRecord[]> {
    const now = input.now.getTime();
    const results = [...this.#notifications.values()]
      .filter(record => record.status === 'pending')
      .filter(record => !input.agentId || record.agentId === input.agentId)
      .filter(record => !input.resourceId || record.resourceId === input.resourceId)
      .filter(record => dueTime(record) <= now)
      .sort((a, b) => dueTime(a) - dueTime(b) || a.updatedAt.getTime() - b.updatedAt.getTime());
    return results.slice(0, input.limit ?? results.length).map(cloneRecord);
  }

  async getNotification(input: { threadId: string; id: string }): Promise<NotificationRecord | null> {
    const record = this.#notifications.get(input.id);
    if (!record || record.threadId !== input.threadId) return null;
    return cloneRecord(record);
  }

  async updateNotification(input: UpdateNotificationInput): Promise<NotificationRecord> {
    const existing = this.#notifications.get(input.id);
    if (!existing || existing.threadId !== input.threadId) {
      throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    }
    const now = new Date();
    const next: NotificationRecord = {
      ...existing,
      ...(input.status ? { status: input.status, ...statusTimestamp(input.status, now) } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.deliverAt !== undefined ? { deliverAt: input.deliverAt } : {}),
      ...(input.summaryAt !== undefined ? { summaryAt: input.summaryAt } : {}),
      ...(input.deliveryReason !== undefined ? { deliveryReason: input.deliveryReason } : {}),
      ...(input.deliveryAttempts !== undefined ? { deliveryAttempts: input.deliveryAttempts } : {}),
      ...(input.lastDeliveryAttemptAt !== undefined ? { lastDeliveryAttemptAt: input.lastDeliveryAttemptAt } : {}),
      ...(input.lastDeliveryError !== undefined ? { lastDeliveryError: input.lastDeliveryError } : {}),
      ...(input.deliveredSignalId !== undefined ? { deliveredSignalId: input.deliveredSignalId } : {}),
      ...(input.summarySignalId !== undefined ? { summarySignalId: input.summarySignalId } : {}),
      updatedAt: now,
    };
    this.#notifications.set(next.id, next);
    return cloneRecord(next);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#notifications.clear();
  }

  private findCoalescable(input: CreateNotificationInput): NotificationRecord | undefined {
    if (!input.dedupeKey && !input.coalesceKey) return undefined;
    return [...this.#notifications.values()].find(record => {
      if (record.threadId !== input.threadId || record.source !== input.source || record.status !== 'pending')
        return false;
      if (record.agentId !== input.agentId || record.resourceId !== input.resourceId) return false;
      return Boolean(
        (input.dedupeKey && record.dedupeKey === input.dedupeKey) ||
        (input.coalesceKey && record.coalesceKey === input.coalesceKey),
      );
    });
  }
}
