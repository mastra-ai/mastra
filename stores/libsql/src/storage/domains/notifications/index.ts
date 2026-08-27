import { randomUUID } from 'node:crypto';

import { NotificationsStorage, TABLE_NOTIFICATIONS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  CreateNotificationInput,
  ListDueNotificationsInput,
  ListNotificationsInput,
  NotificationPriority,
  NotificationRecord,
  NotificationSignalAttributes,
  NotificationStatus,
  UpdateNotificationInput,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
} from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client, SqliteInValue as InValue } from '../../db/client';
import { buildSelectColumns } from '../../db/utils';
import { runPrune, resolveTargets } from '../../retention';

const statusTimestamp = (status: NotificationStatus, now: Date) => {
  if (status === 'delivered') return { deliveredAt: now };
  if (status === 'seen') return { seenAt: now };
  if (status === 'dismissed') return { dismissedAt: now };
  if (status === 'archived') return { archivedAt: now };
  if (status === 'discarded') return { discardedAt: now };
  return {};
};

function parseJson<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

function parseDate(value: unknown): Date | undefined {
  return value == null ? undefined : new Date(String(value));
}

const cloneValue = <T>(value: T | undefined): T | undefined =>
  value === undefined ? undefined : structuredClone(value);

function rowToNotification(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    threadId: String(row.threadId),
    source: String(row.source),
    kind: String(row.kind),
    priority: String(row.priority) as NotificationPriority,
    status: String(row.status) as NotificationStatus,
    summary: String(row.summary),
    payload: parseJson(row.payload),
    resourceId: row.resourceId == null ? undefined : String(row.resourceId),
    agentId: row.agentId == null ? undefined : String(row.agentId),
    sourceId: row.sourceId == null ? undefined : String(row.sourceId),
    dedupeKey: row.dedupeKey == null ? undefined : String(row.dedupeKey),
    coalesceKey: row.coalesceKey == null ? undefined : String(row.coalesceKey),
    coalescedCount: Number(row.coalescedCount ?? 1),
    attributes: parseJson<NotificationSignalAttributes>(row.attributes),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
    deliveredAt: parseDate(row.deliveredAt),
    seenAt: parseDate(row.seenAt),
    dismissedAt: parseDate(row.dismissedAt),
    archivedAt: parseDate(row.archivedAt),
    discardedAt: parseDate(row.discardedAt),
    deliverAt: parseDate(row.deliverAt),
    summaryAt: parseDate(row.summaryAt),
    deliveryReason: row.deliveryReason == null ? undefined : String(row.deliveryReason),
    deliveryAttempts: Number(row.deliveryAttempts ?? 0),
    lastDeliveryAttemptAt: parseDate(row.lastDeliveryAttemptAt),
    lastDeliveryError: row.lastDeliveryError == null ? undefined : String(row.lastDeliveryError),
    deliveredSignalId: row.deliveredSignalId == null ? undefined : String(row.deliveredSignalId),
    summarySignalId: row.summarySignalId == null ? undefined : String(row.summarySignalId),
    metadata: parseJson<Record<string, unknown>>(row.metadata),
  };
}

function addArrayFilter<T extends string>(conditions: string[], args: InValue[], column: string, value?: T | T[]) {
  if (!value) return;
  const values = Array.isArray(value) ? value : [value];
  conditions.push(`"${column}" IN (${values.map(() => '?').join(', ')})`);
  args.push(...values);
}

export class NotificationsLibSQL extends NotificationsStorage {
  /** The notification feed grows unbounded. Single table, anchored on `createdAt`. */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    notifications: { table: TABLE_NOTIFICATIONS, column: 'createdAt', indexed: true },
  };

  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_NOTIFICATIONS,
      schema: TABLE_SCHEMAS[TABLE_NOTIFICATIONS],
    });

    await this.#client.batch(
      [
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_notifications_thread_status_updated ON "${TABLE_NOTIFICATIONS}" ("threadId", "status", "updatedAt")`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_notifications_coalescing ON "${TABLE_NOTIFICATIONS}" ("threadId", "source", "kind", "status", "agentId", "resourceId", "dedupeKey", "coalesceKey")`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_notifications_due ON "${TABLE_NOTIFICATIONS}" ("status", "deliverAt", "summaryAt")`,
          args: [],
        },
      ],
      'write',
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_NOTIFICATIONS });
  }

  /** Delete notifications older than the `notifications` policy's `maxAge`, batched. */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    const targets = resolveTargets({
      policies,
      descriptor: NotificationsLibSQL.retentionTables,
      order: ['notifications'],
    });
    return runPrune({ db: this.#db, domain: 'notifications', targets, options, logger: this.logger });
  }

  async createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    const existing = await this.findCoalescable(input);
    if (existing) {
      const now = new Date();
      const attributes = input.attributes
        ? { ...cloneValue(existing.attributes), ...cloneValue(input.attributes) }
        : cloneValue(existing.attributes);
      const metadata = input.metadata
        ? { ...cloneValue(existing.metadata), ...cloneValue(input.metadata) }
        : cloneValue(existing.metadata);
      await this.#db.update({
        tableName: TABLE_NOTIFICATIONS,
        keys: { threadId: existing.threadId, id: existing.id },
        data: {
          summary: input.summary,
          payload: cloneValue(input.payload ?? existing.payload) ?? null,
          priority: input.priority ?? existing.priority,
          attributes: attributes ?? null,
          updatedAt: now,
          deliverAt: input.deliverAt ?? existing.deliverAt ?? null,
          summaryAt: input.summaryAt ?? existing.summaryAt ?? null,
          deliveryReason: input.deliveryReason ?? existing.deliveryReason ?? null,
          coalescedCount: (existing.coalescedCount ?? 1) + 1,
          metadata: metadata ?? null,
        },
      });
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

    await this.#db.insert({
      tableName: TABLE_NOTIFICATIONS,
      record: {
        ...record,
        payload: record.payload ?? null,
        attributes: record.attributes ?? null,
        metadata: record.metadata ?? null,
        resourceId: record.resourceId ?? null,
        agentId: record.agentId ?? null,
        sourceId: record.sourceId ?? null,
        dedupeKey: record.dedupeKey ?? null,
        coalesceKey: record.coalesceKey ?? null,
        deliverAt: record.deliverAt ?? null,
        summaryAt: record.summaryAt ?? null,
        deliveryReason: record.deliveryReason ?? null,
        deliveryAttempts: record.deliveryAttempts ?? 0,
      },
    });

    return record;
  }

  async listNotifications(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    const conditions = ['"threadId" = ?'];
    const args: InValue[] = [input.threadId];

    addArrayFilter(conditions, args, 'status', input.status);
    addArrayFilter(conditions, args, 'priority', input.priority);

    if (input.source) {
      conditions.push('"source" = ?');
      args.push(input.source);
    }
    if (input.resourceId) {
      conditions.push('"resourceId" = ?');
      args.push(input.resourceId);
    }
    if (input.agentId) {
      conditions.push('"agentId" = ?');
      args.push(input.agentId);
    }
    if (input.search) {
      conditions.push('(LOWER("summary") LIKE ? OR LOWER("kind") LIKE ?)');
      const search = `%${input.search.toLowerCase()}%`;
      args.push(search, search);
    }

    const limit = input.limit ? ' LIMIT ?' : '';
    if (input.limit) args.push(input.limit);

    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_NOTIFICATIONS)} FROM "${TABLE_NOTIFICATIONS}" WHERE ${conditions.join(' AND ')} ORDER BY "updatedAt" DESC${limit}`,
      args,
    });

    return (result.rows ?? []).map(row => rowToNotification(row as Record<string, unknown>));
  }

  async listDueNotifications(input: ListDueNotificationsInput): Promise<NotificationRecord[]> {
    const now = input.now.toISOString();
    const conditions = [
      '"status" = ?',
      '(("deliverAt" IS NOT NULL AND "deliverAt" <= ?) OR ("summaryAt" IS NOT NULL AND "summaryAt" <= ?))',
    ];
    const args: InValue[] = ['pending', now, now];

    if (input.agentId) {
      conditions.push('"agentId" = ?');
      args.push(input.agentId);
    }
    if (input.resourceId) {
      conditions.push('"resourceId" = ?');
      args.push(input.resourceId);
    }

    const limit = input.limit ? ' LIMIT ?' : '';
    if (input.limit) args.push(input.limit);

    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_NOTIFICATIONS)} FROM "${TABLE_NOTIFICATIONS}" WHERE ${conditions.join(' AND ')} ORDER BY CASE WHEN "deliverAt" IS NULL THEN "summaryAt" WHEN "summaryAt" IS NULL THEN "deliverAt" WHEN "deliverAt" <= "summaryAt" THEN "deliverAt" ELSE "summaryAt" END ASC, "updatedAt" ASC${limit}`,
      args,
    });

    return (result.rows ?? []).map(row => rowToNotification(row as Record<string, unknown>));
  }

  async getNotification(input: { threadId: string; id: string }): Promise<NotificationRecord | null> {
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_NOTIFICATIONS)} FROM "${TABLE_NOTIFICATIONS}" WHERE "threadId" = ? AND "id" = ? LIMIT 1`,
      args: [input.threadId, input.id],
    });
    const row = result.rows?.[0];
    return row ? rowToNotification(row as Record<string, unknown>) : null;
  }

  async updateNotification(input: UpdateNotificationInput): Promise<NotificationRecord> {
    const existing = await this.getNotification({ threadId: input.threadId, id: input.id });
    if (!existing) {
      throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    }

    const now = new Date();
    await this.#db.update({
      tableName: TABLE_NOTIFICATIONS,
      keys: { threadId: input.threadId, id: input.id },
      data: {
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
      },
    });

    const updated = await this.getNotification({ threadId: input.threadId, id: input.id });
    if (!updated) throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    return updated;
  }

  private async findCoalescable(input: CreateNotificationInput): Promise<NotificationRecord | undefined> {
    if (!input.dedupeKey && !input.coalesceKey) return undefined;

    const agentId = input.agentId ?? null;
    const resourceId = input.resourceId ?? null;
    const dedupeKey = input.dedupeKey ?? null;
    const coalesceKey = input.coalesceKey ?? null;

    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_NOTIFICATIONS)} FROM "${TABLE_NOTIFICATIONS}" WHERE "threadId" = ? AND "source" = ? AND "kind" = ? AND "status" = ? AND (("agentId" = ?) OR ("agentId" IS NULL AND ? IS NULL)) AND (("resourceId" = ?) OR ("resourceId" IS NULL AND ? IS NULL)) AND ((? IS NOT NULL AND "dedupeKey" = ?) OR (? IS NOT NULL AND "coalesceKey" = ?)) ORDER BY "updatedAt" DESC LIMIT 1`,
      args: [
        input.threadId,
        input.source,
        input.kind,
        'pending',
        agentId,
        agentId,
        resourceId,
        resourceId,
        dedupeKey,
        dedupeKey,
        coalesceKey,
        coalesceKey,
      ],
    });

    const row = result.rows?.[0];
    return row ? rowToNotification(row as Record<string, unknown>) : undefined;
  }
}
