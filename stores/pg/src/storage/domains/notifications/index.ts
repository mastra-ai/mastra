import { randomUUID } from 'node:crypto';

import { NotificationsStorage, TABLE_NOTIFICATIONS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  CreateNotificationInput,
  ListDueNotificationsInput,
  ListNotificationsInput,
  NotificationPriority,
  NotificationRecord,
  NotificationSignalAttributes,
  NotificationStatus,
  UpdateNotificationInput,
  TABLE_NAMES,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { runPrune, resolveTargets } from '../../retention';
import { getSchemaName, getTableName, parseJsonResilient } from '../utils';

const statusTimestamp = (status: NotificationStatus, now: Date) => {
  if (status === 'delivered') return { deliveredAt: now };
  if (status === 'seen') return { seenAt: now };
  if (status === 'dismissed') return { dismissedAt: now };
  if (status === 'archived') return { archivedAt: now };
  if (status === 'discarded') return { discardedAt: now };
  return {};
};

const parseDate = (value: unknown): Date | undefined => {
  if (value == null) return undefined;
  return value instanceof Date ? value : new Date(String(value));
};

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
    payload: parseJsonResilient(row.payload),
    resourceId: row.resourceId == null ? undefined : String(row.resourceId),
    agentId: row.agentId == null ? undefined : String(row.agentId),
    sourceId: row.sourceId == null ? undefined : String(row.sourceId),
    dedupeKey: row.dedupeKey == null ? undefined : String(row.dedupeKey),
    coalesceKey: row.coalesceKey == null ? undefined : String(row.coalesceKey),
    coalescedCount: Number(row.coalescedCount ?? 1),
    attributes: parseJsonResilient(row.attributes) as NotificationSignalAttributes | undefined,
    createdAt: parseDate(row.createdAt) ?? new Date(),
    updatedAt: parseDate(row.updatedAt) ?? new Date(),
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
    metadata: parseJsonResilient(row.metadata) as Record<string, unknown> | undefined,
  };
}

function addArrayFilter<T extends string>(conditions: string[], args: unknown[], column: string, value?: T | T[]) {
  if (!value) return;
  const values = Array.isArray(value) ? value : [value];
  const start = args.length + 1;
  conditions.push(`"${column}" IN (${values.map((_, index) => `$${start + index}`).join(', ')})`);
  args.push(...values);
}

function normalizeRecordForInsert(record: NotificationRecord): Record<string, unknown> {
  return {
    ...record,
    payload: record.payload ?? null,
    attributes: record.attributes ?? null,
    metadata: record.metadata ?? null,
    resourceId: record.resourceId ?? null,
    agentId: record.agentId ?? null,
    sourceId: record.sourceId ?? null,
    dedupeKey: record.dedupeKey ?? null,
    coalesceKey: record.coalesceKey ?? null,
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
  };
}

export class NotificationsPG extends NotificationsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_NOTIFICATIONS] as const;

  /**
   * Notifications are an append-only event feed that grows unbounded. Single
   * table, anchored on the timezone-aware `createdAtZ` mirror column.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    notifications: { table: TABLE_NOTIFICATIONS, column: 'createdAtZ', indexed: true },
  };

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (NotificationsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_NOTIFICATIONS,
      schema: TABLE_SCHEMAS[TABLE_NOTIFICATIONS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
    await this.ensureRetentionIndexes();
  }

  /**
   * Ensures a btree index exists on each retention anchor column so age-based
   * `prune()` deletes stay fast on large tables.
   */
  private async ensureRetentionIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    const prefix = this.#schema && this.#schema !== 'public' ? `${this.#schema}_` : '';
    for (const [key, entry] of Object.entries(NotificationsPG.retentionTables)) {
      if (!entry.indexed) continue;
      try {
        await this.#db.ensureIndex({
          indexName: `${prefix}mastra_${key}_retention_idx`,
          tableName: entry.table as TABLE_NAMES,
          column: entry.column,
        });
      } catch (error) {
        this.logger?.warn?.(`Failed to create retention index for ${entry.table}:`, error);
      }
    }
  }

  /** Delete notifications older than the `notifications` policy's `maxAge`, batched. */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    const targets = resolveTargets({
      policies,
      descriptor: NotificationsPG.retentionTables,
      order: ['notifications'],
    });
    return runPrune({ db: this.#db, domain: 'notifications', targets, options });
  }

  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}idx_notifications_thread_status_updated`,
        table: TABLE_NOTIFICATIONS,
        columns: ['threadId', 'status', 'updatedAt'],
      },
      {
        name: `${schemaPrefix}idx_notifications_coalescing`,
        table: TABLE_NOTIFICATIONS,
        columns: ['threadId', 'source', 'kind', 'status', 'agentId', 'resourceId', 'dedupeKey', 'coalesceKey'],
      },
      {
        name: `${schemaPrefix}idx_notifications_due`,
        table: TABLE_NOTIFICATIONS,
        columns: ['status', 'deliverAt', 'summaryAt'],
      },
    ];
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    statements.push(
      generateTableSQL({
        tableName: TABLE_NOTIFICATIONS,
        schema: TABLE_SCHEMAS[TABLE_NOTIFICATIONS],
        schemaName,
        includeAllConstraints: true,
      }),
    );

    for (const idx of NotificationsPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return NotificationsPG.getDefaultIndexDefs(schemaPrefix);
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_NOTIFICATIONS });
  }

  private async updateNotificationRow(threadId: string, id: string, data: Record<string, unknown>): Promise<void> {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;

    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_NOTIFICATIONS, schemaName });
    const setColumns = entries.map(([key], index) => `"${parseSqlIdentifier(key, 'column name')}" = $${index + 1}`);
    const values = entries.map(([key, value]) => {
      const columnSchema = TABLE_SCHEMAS[TABLE_NOTIFICATIONS][key];
      if (columnSchema?.type === 'jsonb' && value !== null) return JSON.stringify(value);
      return value;
    });

    await this.#db.client.none(
      `UPDATE ${tableName} SET ${setColumns.join(', ')} WHERE "threadId" = $${values.length + 1} AND "id" = $${values.length + 2}`,
      [...values, threadId, id],
    );
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
      await this.updateNotificationRow(existing.threadId, existing.id, {
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

    await this.#db.insert({ tableName: TABLE_NOTIFICATIONS, record: normalizeRecordForInsert(record) });
    return record;
  }

  async listNotifications(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    const conditions = ['"threadId" = $1'];
    const args: unknown[] = [input.threadId];

    addArrayFilter(conditions, args, 'status', input.status);
    addArrayFilter(conditions, args, 'priority', input.priority);

    if (input.source) {
      args.push(input.source);
      conditions.push(`"source" = $${args.length}`);
    }
    if (input.resourceId) {
      args.push(input.resourceId);
      conditions.push(`"resourceId" = $${args.length}`);
    }
    if (input.agentId) {
      args.push(input.agentId);
      conditions.push(`"agentId" = $${args.length}`);
    }
    if (input.search) {
      const search = `%${input.search.toLowerCase()}%`;
      args.push(search, search);
      conditions.push(`(LOWER("summary") LIKE $${args.length - 1} OR LOWER("kind") LIKE $${args.length})`);
    }

    const limit = input.limit ? ` LIMIT $${args.length + 1}` : '';
    if (input.limit) args.push(input.limit);

    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_NOTIFICATIONS, schemaName });
    const rows = await this.#db.client.manyOrNone(
      `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY "updatedAt" DESC${limit}`,
      args,
    );

    return rows.map(row => rowToNotification(row));
  }

  async listDueNotifications(input: ListDueNotificationsInput): Promise<NotificationRecord[]> {
    const conditions = [
      '"status" = $1',
      '(("deliverAt" IS NOT NULL AND "deliverAt" <= $2) OR ("summaryAt" IS NOT NULL AND "summaryAt" <= $3))',
    ];
    const args: unknown[] = ['pending', input.now, input.now];

    if (input.agentId) {
      args.push(input.agentId);
      conditions.push(`"agentId" = $${args.length}`);
    }
    if (input.resourceId) {
      args.push(input.resourceId);
      conditions.push(`"resourceId" = $${args.length}`);
    }

    const limit = input.limit ? ` LIMIT $${args.length + 1}` : '';
    if (input.limit) args.push(input.limit);

    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_NOTIFICATIONS, schemaName });
    const rows = await this.#db.client.manyOrNone(
      `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY CASE WHEN "deliverAt" IS NULL THEN "summaryAt" WHEN "summaryAt" IS NULL THEN "deliverAt" WHEN "deliverAt" <= "summaryAt" THEN "deliverAt" ELSE "summaryAt" END ASC, "updatedAt" ASC${limit}`,
      args,
    );

    return rows.map(row => rowToNotification(row));
  }

  async getNotification(input: { threadId: string; id: string }): Promise<NotificationRecord | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_NOTIFICATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(
      `SELECT * FROM ${tableName} WHERE "threadId" = $1 AND "id" = $2 LIMIT 1`,
      [input.threadId, input.id],
    );
    return row ? rowToNotification(row) : null;
  }

  async updateNotification(input: UpdateNotificationInput): Promise<NotificationRecord> {
    const existing = await this.getNotification({ threadId: input.threadId, id: input.id });
    if (!existing) {
      throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    }

    const now = new Date();
    await this.updateNotificationRow(input.threadId, input.id, {
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
    });

    const updated = await this.getNotification({ threadId: input.threadId, id: input.id });
    if (!updated) throw new Error(`Notification ${input.id} was not found for thread ${input.threadId}`);
    return updated;
  }

  private async findCoalescable(input: CreateNotificationInput): Promise<NotificationRecord | undefined> {
    if (!input.dedupeKey && !input.coalesceKey) return undefined;

    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_NOTIFICATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(
      `SELECT * FROM ${tableName} WHERE "threadId" = $1 AND "source" = $2 AND "kind" = $3 AND "status" = $4 AND (("agentId" = $5::text) OR ("agentId" IS NULL AND $5::text IS NULL)) AND (("resourceId" = $6::text) OR ("resourceId" IS NULL AND $6::text IS NULL)) AND (($7::text IS NOT NULL AND "dedupeKey" = $7::text) OR ($8::text IS NOT NULL AND "coalesceKey" = $8::text)) ORDER BY "updatedAt" DESC LIMIT 1`,
      [
        input.threadId,
        input.source,
        input.kind,
        'pending',
        input.agentId ?? null,
        input.resourceId ?? null,
        input.dedupeKey ?? null,
        input.coalesceKey ?? null,
      ],
    );

    return row ? rowToNotification(row) : undefined;
  }
}
