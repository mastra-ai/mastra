import { randomUUID } from 'node:crypto';

import { NotificationsStorage, TABLE_NOTIFICATIONS } from '@mastra/core/storage';
import type {
  CreateNotificationInput,
  ListDueNotificationsInput,
  ListNotificationsInput,
  NotificationPriority,
  NotificationRecord,
  NotificationSignalAttributes,
  NotificationStatus,
  UpdateNotificationInput,
} from '@mastra/core/storage';
import type { Collection, Filter, UpdateFilter } from 'mongodb';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

const statusTimestamp = (status: NotificationStatus, now: Date) => {
  if (status === 'delivered') return { deliveredAt: now };
  if (status === 'seen') return { seenAt: now };
  if (status === 'dismissed') return { dismissedAt: now };
  if (status === 'archived') return { archivedAt: now };
  if (status === 'discarded') return { discardedAt: now };
  return {};
};

const cloneDate = (value?: Date) => (value ? new Date(value) : undefined);
const cloneValue = <T>(value: T | undefined): T | undefined =>
  value === undefined ? undefined : structuredClone(value);

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
  payload: cloneValue(record.payload),
  attributes: cloneValue(record.attributes),
  metadata: cloneValue(record.metadata),
});

function rowToNotification(row: Record<string, any>): NotificationRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    source: row.source,
    kind: row.kind,
    priority: row.priority as NotificationPriority,
    status: row.status as NotificationStatus,
    summary: row.summary,
    payload: row.payload ?? undefined,
    resourceId: row.resourceId ?? undefined,
    agentId: row.agentId ?? undefined,
    sourceId: row.sourceId ?? undefined,
    dedupeKey: row.dedupeKey ?? undefined,
    coalesceKey: row.coalesceKey ?? undefined,
    coalescedCount: Number(row.coalescedCount ?? 1),
    attributes: row.attributes as NotificationSignalAttributes | undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    deliveredAt: row.deliveredAt
      ? row.deliveredAt instanceof Date
        ? row.deliveredAt
        : new Date(row.deliveredAt)
      : undefined,
    seenAt: row.seenAt ? (row.seenAt instanceof Date ? row.seenAt : new Date(row.seenAt)) : undefined,
    dismissedAt: row.dismissedAt
      ? row.dismissedAt instanceof Date
        ? row.dismissedAt
        : new Date(row.dismissedAt)
      : undefined,
    archivedAt: row.archivedAt
      ? row.archivedAt instanceof Date
        ? row.archivedAt
        : new Date(row.archivedAt)
      : undefined,
    discardedAt: row.discardedAt
      ? row.discardedAt instanceof Date
        ? row.discardedAt
        : new Date(row.discardedAt)
      : undefined,
    deliverAt: row.deliverAt ? (row.deliverAt instanceof Date ? row.deliverAt : new Date(row.deliverAt)) : undefined,
    summaryAt: row.summaryAt ? (row.summaryAt instanceof Date ? row.summaryAt : new Date(row.summaryAt)) : undefined,
    deliveryReason: row.deliveryReason ?? undefined,
    deliveryAttempts: Number(row.deliveryAttempts ?? 0),
    lastDeliveryAttemptAt: row.lastDeliveryAttemptAt
      ? row.lastDeliveryAttemptAt instanceof Date
        ? row.lastDeliveryAttemptAt
        : new Date(row.lastDeliveryAttemptAt)
      : undefined,
    lastDeliveryError: row.lastDeliveryError ?? undefined,
    deliveredSignalId: row.deliveredSignalId ?? undefined,
    summarySignalId: row.summarySignalId ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function recordToDocument(record: NotificationRecord): Record<string, unknown> {
  return {
    ...record,
    payload: record.payload ?? null,
    resourceId: record.resourceId ?? null,
    agentId: record.agentId ?? null,
    sourceId: record.sourceId ?? null,
    dedupeKey: record.dedupeKey ?? null,
    coalesceKey: record.coalesceKey ?? null,
    attributes: record.attributes ?? null,
    deliveredAt: record.deliveredAt ?? null,
    seenAt: record.seenAt ?? null,
    dismissedAt: record.dismissedAt ?? null,
    archivedAt: record.archivedAt ?? null,
    discardedAt: record.discardedAt ?? null,
    deliverAt: record.deliverAt ?? null,
    summaryAt: record.summaryAt ?? null,
    deliveryReason: record.deliveryReason ?? null,
    lastDeliveryAttemptAt: record.lastDeliveryAttemptAt ?? null,
    lastDeliveryError: record.lastDeliveryError ?? null,
    deliveredSignalId: record.deliveredSignalId ?? null,
    summarySignalId: record.summarySignalId ?? null,
    metadata: record.metadata ?? null,
  };
}

export class NotificationsMongoDB extends NotificationsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_NOTIFICATIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (NotificationsMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(): Promise<Collection<Record<string, any>>> {
    return this.#connector.getCollection(TABLE_NOTIFICATIONS);
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_NOTIFICATIONS, keys: { threadId: 1, id: 1 }, options: { unique: true } },
      { collection: TABLE_NOTIFICATIONS, keys: { threadId: 1, status: 1, updatedAt: -1 } },
      {
        collection: TABLE_NOTIFICATIONS,
        keys: { threadId: 1, source: 1, kind: 1, status: 1, agentId: 1, resourceId: 1, dedupeKey: 1, coalesceKey: 1 },
      },
      { collection: TABLE_NOTIFICATIONS, keys: { status: 1, deliverAt: 1, summaryAt: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.#connector.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.#connector.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteMany({});
  }

  async createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    const existing = await this.findCoalescable(input);
    const collection = await this.getCollection();

    if (existing) {
      const now = new Date();
      const attributes = input.attributes
        ? { ...cloneValue(existing.attributes), ...cloneValue(input.attributes) }
        : cloneValue(existing.attributes);
      const metadata = input.metadata
        ? { ...cloneValue(existing.metadata), ...cloneValue(input.metadata) }
        : cloneValue(existing.metadata);
      await collection.updateOne(
        { threadId: existing.threadId, id: existing.id },
        {
          $set: {
            summary: input.summary,
            payload: cloneValue(input.payload ?? existing.payload) ?? null,
            priority: input.priority ?? existing.priority,
            attributes: attributes ?? null,
            updatedAt: now,
            deliverAt: input.deliverAt ?? existing.deliverAt ?? null,
            summaryAt: input.summaryAt ?? existing.summaryAt ?? null,
            deliveryReason: input.deliveryReason ?? existing.deliveryReason ?? null,
            metadata: metadata ?? null,
          },
          $inc: { coalescedCount: 1 },
        },
      );
      const updated = await this.getNotification({ threadId: existing.threadId, id: existing.id });
      if (!updated) throw new Error(`Notification ${existing.id} was not found for thread ${existing.threadId}`);
      return updated;
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
      payload: cloneValue(input.payload),
      resourceId: input.resourceId,
      agentId: input.agentId,
      sourceId: input.sourceId,
      dedupeKey: input.dedupeKey,
      coalesceKey: input.coalesceKey,
      coalescedCount: 1,
      attributes: cloneValue(input.attributes),
      createdAt: now,
      updatedAt: now,
      deliverAt: input.deliverAt,
      summaryAt: input.summaryAt,
      deliveryReason: input.deliveryReason,
      deliveryAttempts: 0,
      metadata: cloneValue(input.metadata),
    };

    await collection.insertOne(recordToDocument(record));
    return cloneRecord(record);
  }

  async listNotifications(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    const filter: Filter<Record<string, any>> = { threadId: input.threadId };
    if (input.status) filter.status = Array.isArray(input.status) ? { $in: input.status } : input.status;
    if (input.priority) filter.priority = Array.isArray(input.priority) ? { $in: input.priority } : input.priority;
    if (input.source) filter.source = input.source;
    if (input.resourceId) filter.resourceId = input.resourceId;
    if (input.agentId) filter.agentId = input.agentId;
    if (input.search) {
      const search = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ summary: { $regex: search, $options: 'i' } }, { kind: { $regex: search, $options: 'i' } }];
    }

    const collection = await this.getCollection();
    const cursor = collection.find(filter).sort({ updatedAt: -1 });
    if (input.limit) cursor.limit(input.limit);
    const rows = await cursor.toArray();
    return rows.map(row => rowToNotification(row));
  }

  async listDueNotifications(input: ListDueNotificationsInput): Promise<NotificationRecord[]> {
    const filter: Filter<Record<string, any>> = {
      status: 'pending',
      $or: [{ deliverAt: { $ne: null, $lte: input.now } }, { summaryAt: { $ne: null, $lte: input.now } }],
    };
    if (input.agentId) filter.agentId = input.agentId;
    if (input.resourceId) filter.resourceId = input.resourceId;

    const collection = await this.getCollection();
    const rows = await collection.find(filter).sort({ updatedAt: 1 }).toArray();
    const due = rows
      .map(row => rowToNotification(row))
      .sort((a, b) => dueTime(a) - dueTime(b) || a.updatedAt.getTime() - b.updatedAt.getTime());
    return due.slice(0, input.limit ?? due.length).map(cloneRecord);
  }

  async getNotification(input: { threadId: string; id: string }): Promise<NotificationRecord | null> {
    const collection = await this.getCollection();
    const row = await collection.findOne({ threadId: input.threadId, id: input.id });
    return row ? rowToNotification(row) : null;
  }

  async updateNotification(input: UpdateNotificationInput): Promise<NotificationRecord> {
    const existing = await this.getNotification({ threadId: input.threadId, id: input.id });
    if (!existing) {
      throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    }

    const now = new Date();
    const set: Record<string, unknown> = {
      ...(input.status ? { status: input.status, ...statusTimestamp(input.status, now) } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.payload !== undefined ? { payload: cloneValue(input.payload) } : {}),
      ...(input.attributes !== undefined ? { attributes: cloneValue(input.attributes) } : {}),
      ...(input.metadata !== undefined ? { metadata: cloneValue(input.metadata) } : {}),
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

    const collection = await this.getCollection();
    await collection.updateOne({ threadId: input.threadId, id: input.id }, { $set: set } as UpdateFilter<
      Record<string, any>
    >);

    const updated = await this.getNotification({ threadId: input.threadId, id: input.id });
    if (!updated) throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    return updated;
  }

  private async findCoalescable(input: CreateNotificationInput): Promise<NotificationRecord | undefined> {
    if (!input.dedupeKey && !input.coalesceKey) return undefined;
    const collection = await this.getCollection();
    const row = await collection.findOne(
      {
        threadId: input.threadId,
        source: input.source,
        kind: input.kind,
        status: 'pending',
        agentId: input.agentId ?? null,
        resourceId: input.resourceId ?? null,
        $or: [
          ...(input.dedupeKey ? [{ dedupeKey: input.dedupeKey }] : []),
          ...(input.coalesceKey ? [{ coalesceKey: input.coalesceKey }] : []),
        ],
      },
      { sort: { updatedAt: -1 } },
    );
    return row ? rowToNotification(row) : undefined;
  }
}

const dueTime = (record: NotificationRecord): number => {
  const deliverAt = record.deliverAt?.getTime();
  const summaryAt = record.summaryAt?.getTime();
  if (deliverAt !== undefined && summaryAt !== undefined) return Math.min(deliverAt, summaryAt);
  return deliverAt ?? summaryAt ?? Number.POSITIVE_INFINITY;
};
