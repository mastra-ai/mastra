import { randomUUID } from 'node:crypto';
import { StorageDomain } from '../storage/domains/base';
import type {
  CreateNotificationInput,
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
  metadata: record.metadata ? { ...record.metadata } : undefined,
});

const statusTimestamp = (status: NotificationStatus, now: Date) => {
  if (status === 'delivered') return { deliveredAt: now };
  if (status === 'seen') return { seenAt: now };
  if (status === 'dismissed') return { dismissedAt: now };
  if (status === 'archived') return { archivedAt: now };
  return {};
};

const valueMatches = <T extends string>(value: T, filter?: T | T[]) => {
  if (!filter) return true;
  return Array.isArray(filter) ? filter.includes(value) : value === filter;
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
        updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
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
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
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
      return Boolean(
        (input.dedupeKey && record.dedupeKey === input.dedupeKey) ||
        (input.coalesceKey && record.coalesceKey === input.coalesceKey),
      );
    });
  }
}
