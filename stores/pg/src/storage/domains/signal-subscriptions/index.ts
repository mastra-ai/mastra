import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  SignalSubscriptionFenceError,
  SignalSubscriptionsStorage,
  TABLE_SCHEMAS,
  TABLE_SIGNAL_SUBSCRIPTION_COORDINATION,
  TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES,
  TABLE_SIGNAL_SUBSCRIPTIONS,
  createStorageErrorId,
} from '@mastra/core/storage';
import type {
  ClaimSignalSubscriptionDeliveryResult,
  ClaimSignalSubscriptionInput,
  CreateIndexOptions,
  ListSignalSubscriptionDocumentOwnersInput,
  ListSignalSubscriptionDocumentOwnersResult,
  ListSignalSubscriptionsInput,
  ListSignalSubscriptionsResult,
  SignalSubscriptionDelivery,
  SignalSubscriptionDeliveryRef,
  SignalSubscriptionDocumentFence,
  SignalSubscriptionDocumentOwner,
  SignalSubscriptionFilters,
  SignalSubscriptionIdentity,
  SignalSubscriptionOperationKind,
  SignalSubscriptionPatch,
  SignalSubscriptionRecord,
  SignalSubscriptionRowRef,
  UpsertSignalSubscriptionInput,
} from '@mastra/core/storage';

import { schemaNamePrefix } from '../../../shared/schema-name';
import type { TxClient } from '../../client';
import { PgDB, generateIndexSQL, generateTableSQL, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { buildConstraintName } from '../../db/constraint-utils';
import { toPgJson } from '../../db/sanitize-json';
import { getSchemaName, getTableName } from '../utils';

type Row = Record<string, unknown>;
type Queryable = Pick<TxClient, 'query'>;
type Statement = { sql: string; args: unknown[] };
type DocumentScope = { providerId: string; resourceId: string; threadId: string };

/**
 * Database time in epoch milliseconds. `clock_timestamp()` is the server's
 * wall clock at evaluation, so every replica shares one time authority even
 * inside a transaction that waited on a lock.
 */
const NOW = `(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint`;

const DELIVERY_PRIMARY_KEY = ['subscriptionId', 'deliveryId'];
const COORDINATION_PRIMARY_KEY = ['kind', 'key'];

/** Rewrite `?` placeholders to PostgreSQL's positional `$n`. */
function positional(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function documentKey(scope: DocumentScope): string {
  return JSON.stringify([scope.providerId, scope.resourceId, scope.threadId]);
}

function pageSql(limit: number | undefined, offset: number | undefined): Statement {
  const parts: string[] = [];
  const args: unknown[] = [];
  if (limit !== undefined) {
    parts.push('LIMIT ?');
    args.push(limit);
  }
  if (offset !== undefined) {
    parts.push('OFFSET ?');
    args.push(offset);
  }
  return { sql: parts.join(' '), args };
}

function toNumber(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function toDate(value: unknown): Date | undefined {
  const ms = toNumber(value);
  return ms === undefined ? undefined : new Date(ms);
}

function toJson(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  return (typeof value === 'string' ? JSON.parse(value) : value) as Record<string, unknown>;
}

function toRecord(row: Row): SignalSubscriptionRecord {
  const record: SignalSubscriptionRecord = {
    id: String(row.id),
    agentId: String(row.agentId),
    providerId: String(row.providerId),
    resourceId: String(row.resourceId),
    threadId: String(row.threadId),
    externalResourceId: String(row.externalResourceId),
    metadata: toJson(row.metadata) ?? {},
    deliveryOptions: toJson(row.deliveryOptions) ?? {},
    enabled: row.enabled === true,
    createdAt: new Date(Number(row.createdAt)),
    updatedAt: new Date(Number(row.updatedAt)),
  };
  if (row.operationOwner !== null && row.operationOwner !== undefined) {
    record.operationKind = String(row.operationKind) as SignalSubscriptionOperationKind;
    record.operationOwner = String(row.operationOwner);
    record.operationExpiresAt = toNumber(row.operationExpiresAt);
  }
  if (row.claimOwner !== null && row.claimOwner !== undefined) {
    record.claimOwner = String(row.claimOwner);
    record.claimExpiresAt = toNumber(row.claimExpiresAt);
  }
  const cursor = toJson(row.cursor);
  if (cursor) record.cursor = cursor;
  const lastPolledAt = toDate(row.lastPolledAt);
  if (lastPolledAt) record.lastPolledAt = lastPolledAt;
  const nextPollAt = toDate(row.nextPollAt);
  if (nextPollAt) record.nextPollAt = nextPollAt;
  const lastDeliveredAt = toDate(row.lastDeliveredAt);
  if (lastDeliveredAt) record.lastDeliveredAt = lastDeliveredAt;
  return record;
}

function toOwner(row: Row): SignalSubscriptionDocumentOwner {
  return {
    key: String(row.key),
    agentId: String(row.agentId),
    providerId: String(row.providerId),
    resourceId: String(row.resourceId),
    threadId: String(row.threadId),
    fencingToken: String(row.fencingToken),
    createdAt: new Date(Number(row.createdAt)),
  };
}

function fenceError(identity: SignalSubscriptionIdentity, fence: SignalSubscriptionDocumentFence | undefined) {
  return new SignalSubscriptionFenceError({
    agentId: identity.agentId,
    providerId: identity.providerId,
    resourceId: identity.resourceId,
    threadId: identity.threadId,
    fenceKey: fence?.key ?? '',
  });
}

/**
 * PostgreSQL implementation of {@link SignalSubscriptionsStorage}.
 *
 * Due/expiry decisions use database time and ownership transitions are single
 * guarded statements, so replicas sharing the database coordinate correctly.
 * Mutations that must check a document fence run in a transaction holding a
 * transaction-scoped advisory lock for that document, which also serializes
 * them against document-owner claims and releases.
 */
export class SignalSubscriptionsPG extends SignalSubscriptionsStorage {
  readonly durability = 'persistent' as const;

  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;

  static readonly MANAGED_TABLES = [
    TABLE_SIGNAL_SUBSCRIPTIONS,
    TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES,
    TABLE_SIGNAL_SUBSCRIPTION_COORDINATION,
  ] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, readClient, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
  }

  /**
   * The three unique indexes back the upsert and ledger conflict targets and
   * are always created; the webhook and due-scan indexes are lookup
   * accelerators that `skipDefaultIndexes` may omit.
   */
  static getIndexDefs(schemaName?: string): { unique: CreateIndexOptions[]; lookup: CreateIndexOptions[] } {
    // Schema-prefixed names can exceed Postgres' 63-byte identifier limit;
    // truncate with a collision hash so every index keeps a distinct name.
    const prefix = schemaName && schemaName !== 'public' ? schemaNamePrefix(schemaName) : undefined;
    const name = (baseName: string) => buildConstraintName({ baseName, schemaName: prefix, hashWhenTruncated: true });
    return {
      unique: [
        {
          name: name('mastra_signal_subscriptions_identity_uq'),
          table: TABLE_SIGNAL_SUBSCRIPTIONS,
          columns: ['agentId', 'providerId', 'resourceId', 'threadId', 'externalResourceId'],
          unique: true,
        },
        {
          name: name('mastra_signal_subscription_deliveries_uq'),
          table: TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES,
          columns: ['subscriptionId', 'deliveryId'],
          unique: true,
        },
        {
          name: name('mastra_signal_subscription_coordination_key_uq'),
          table: TABLE_SIGNAL_SUBSCRIPTION_COORDINATION,
          columns: ['kind', 'key'],
          unique: true,
        },
      ],
      lookup: [
        {
          name: name('mastra_signal_subscriptions_webhook_idx'),
          table: TABLE_SIGNAL_SUBSCRIPTIONS,
          columns: ['agentId', 'providerId', 'externalResourceId'],
        },
        {
          name: name('mastra_signal_subscriptions_due_idx'),
          table: TABLE_SIGNAL_SUBSCRIPTIONS,
          columns: ['agentId', 'providerId', 'enabled', 'nextPollAt'],
        },
      ],
    };
  }

  static getExportDDL(schemaName?: string): string[] {
    const { unique, lookup } = SignalSubscriptionsPG.getIndexDefs(schemaName);
    return [
      generateTableSQL({
        tableName: TABLE_SIGNAL_SUBSCRIPTIONS,
        schema: TABLE_SCHEMAS[TABLE_SIGNAL_SUBSCRIPTIONS],
        schemaName,
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES,
        schema: TABLE_SCHEMAS[TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES],
        schemaName,
        compositePrimaryKey: DELIVERY_PRIMARY_KEY,
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_SIGNAL_SUBSCRIPTION_COORDINATION,
        schema: TABLE_SCHEMAS[TABLE_SIGNAL_SUBSCRIPTION_COORDINATION],
        schemaName,
        compositePrimaryKey: COORDINATION_PRIMARY_KEY,
        includeAllConstraints: true,
      }),
      ...[...unique, ...lookup].map(index => generateIndexSQL(index, schemaName)),
    ];
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const { unique, lookup } = SignalSubscriptionsPG.getIndexDefs(this.#schema);
    return [...unique, ...lookup];
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_SIGNAL_SUBSCRIPTIONS,
      schema: TABLE_SCHEMAS[TABLE_SIGNAL_SUBSCRIPTIONS],
    });
    await this.#db.createTable({
      tableName: TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES,
      schema: TABLE_SCHEMAS[TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES],
      compositePrimaryKey: DELIVERY_PRIMARY_KEY,
    });
    await this.#db.createTable({
      tableName: TABLE_SIGNAL_SUBSCRIPTION_COORDINATION,
      schema: TABLE_SCHEMAS[TABLE_SIGNAL_SUBSCRIPTION_COORDINATION],
      compositePrimaryKey: COORDINATION_PRIMARY_KEY,
    });
    const { unique, lookup } = SignalSubscriptionsPG.getIndexDefs(this.#schema);
    for (const index of unique) await this.#db.createIndex(index);
    if (this.#skipDefaultIndexes) return;
    for (const index of lookup) {
      try {
        await this.#db.createIndex(index);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${index.name}:`, error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SQL helpers
  // ---------------------------------------------------------------------------

  #table(name: string): string {
    return getTableName({ indexName: name, schemaName: getSchemaName(this.#schema) });
  }

  get #S() {
    return this.#table(TABLE_SIGNAL_SUBSCRIPTIONS);
  }

  get #D() {
    return this.#table(TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES);
  }

  get #C() {
    return this.#table(TABLE_SIGNAL_SUBSCRIPTION_COORDINATION);
  }

  /** True when `fence` authorizes mutating rows of `identity`'s document. */
  #identityFenceSql(identity: SignalSubscriptionIdentity, fence: SignalSubscriptionDocumentFence | undefined): Statement {
    if (!fence) {
      return {
        sql: `NOT EXISTS (SELECT 1 FROM ${this.#C} o WHERE o."kind" = 'owner' AND o."providerId" = ? AND o."resourceId" = ? AND o."threadId" = ?)`,
        args: [identity.providerId, identity.resourceId, identity.threadId],
      };
    }
    return {
      sql: `EXISTS (SELECT 1 FROM ${this.#C} o WHERE o."kind" = 'owner' AND o."key" = ? AND o."fencingToken" = ? AND o."agentId" = ? AND o."providerId" = ? AND o."resourceId" = ? AND o."threadId" = ?)`,
      args: [fence.key, fence.fencingToken, identity.agentId, identity.providerId, identity.resourceId, identity.threadId],
    };
  }

  /** Same as {@link #identityFenceSql} against the subscription row aliased `row`. */
  #rowFenceSql(fence: SignalSubscriptionDocumentFence | undefined, row: string): Statement {
    if (!fence) {
      return {
        sql: `NOT EXISTS (SELECT 1 FROM ${this.#C} o WHERE o."kind" = 'owner' AND o."providerId" = ${row}."providerId" AND o."resourceId" = ${row}."resourceId" AND o."threadId" = ${row}."threadId")`,
        args: [],
      };
    }
    return {
      sql: `EXISTS (SELECT 1 FROM ${this.#C} o WHERE o."kind" = 'owner' AND o."key" = ? AND o."fencingToken" = ? AND o."agentId" = ${row}."agentId" AND o."providerId" = ${row}."providerId" AND o."resourceId" = ${row}."resourceId" AND o."threadId" = ${row}."threadId")`,
      args: [fence.key, fence.fencingToken],
    };
  }

  #filterSql(filters: SignalSubscriptionFilters, row?: string): Statement {
    const column = (name: string) => (row ? `${row}."${name}"` : `"${name}"`);
    const clauses = [`${column('agentId')} = ?`];
    const args: unknown[] = [filters.agentId];
    for (const key of ['providerId', 'resourceId', 'threadId', 'externalResourceId'] as const) {
      if (filters[key] !== undefined) {
        clauses.push(`${column(key)} = ?`);
        args.push(filters[key]);
      }
    }
    if (filters.enabled !== undefined) {
      clauses.push(`${column('enabled')} = ?`);
      args.push(filters.enabled);
    }
    return { sql: clauses.join(' AND '), args };
  }

  async #run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', `SIGNAL_SUBSCRIPTIONS_${operation}`, 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  #query(sql: string, args: unknown[] = [], client: Queryable = this.#db.client) {
    return client.query(positional(sql), args as never);
  }

  async #rows(sql: string, args: unknown[] = [], client?: Queryable): Promise<Row[]> {
    return (await this.#query(sql, args, client)).rows as Row[];
  }

  async #affected(sql: string, args: unknown[], client?: Queryable): Promise<number> {
    return (await this.#query(sql, args, client)).rowCount ?? 0;
  }

  /**
   * Run `fn` in a transaction holding the advisory locks of `documents`,
   * acquired in a stable order to avoid lock-order deadlocks.
   */
  #withDocuments<T>(documents: DocumentScope[], fn: (tx: TxClient) => Promise<T>): Promise<T> {
    const keys = [...new Set(documents.map(documentKey))].sort();
    return this.#db.client.tx(async tx => {
      for (const key of keys) {
        await this.#query(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [key], tx);
      }
      return fn(tx);
    });
  }

  /**
   * Run a fence-checked mutation of one row. The row's document identity is
   * immutable, so it is read first to take the document lock; the row and
   * fence are then re-checked under that lock before `mutate` runs.
   */
  async #fencedRow<T>(
    ref: SignalSubscriptionRowRef,
    fence: SignalSubscriptionDocumentFence | undefined,
    mutate: (tx: TxClient, row: SignalSubscriptionRecord) => Promise<T>,
  ): Promise<T | null> {
    const [scope] = await this.#rows(
      `SELECT "providerId", "resourceId", "threadId" FROM ${this.#S} WHERE "agentId" = ? AND "id" = ?`,
      [ref.agentId, ref.id],
    );
    if (!scope) return null;
    return this.#withDocuments([scope as DocumentScope], async tx => {
      const [current] = await this.#rows(
        `SELECT * FROM ${this.#S} WHERE "agentId" = ? AND "id" = ? FOR UPDATE`,
        [ref.agentId, ref.id],
        tx,
      );
      if (!current) return null;
      const row = toRecord(current);
      const guard = this.#identityFenceSql(row, fence);
      const [check] = await this.#rows(`SELECT ${guard.sql} AS "ok"`, guard.args, tx);
      if (check?.ok !== true) throw fenceError(row, fence);
      return mutate(tx, row);
    });
  }

  /** Fence check then an insert statement, under the identity's document lock. */
  async #fencedInsert(
    input: SignalSubscriptionIdentity,
    fence: SignalSubscriptionDocumentFence | undefined,
    insert: (tx: TxClient) => Promise<Row[]>,
  ): Promise<Row | null> {
    return this.#withDocuments([input], async tx => {
      const guard = this.#identityFenceSql(input, fence);
      const [check] = await this.#rows(`SELECT ${guard.sql} AS "ok"`, guard.args, tx);
      if (check?.ok !== true) throw fenceError(input, fence);
      const [row] = await insert(tx);
      return row ?? null;
    });
  }

  #insertSql(input: UpsertSignalSubscriptionInput, operation?: { owner: string; ttlMs: number }): Statement {
    return {
      sql: `INSERT INTO ${this.#S} ("id", "agentId", "providerId", "resourceId", "threadId", "externalResourceId", "metadata", "deliveryOptions", "enabled", "operationKind", "operationOwner", "operationExpiresAt", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ${operation ? `${NOW} + ?::bigint` : 'NULL'}, ${NOW}, ${NOW})`,
      args: [
        input.id ?? crypto.randomUUID(),
        input.agentId,
        input.providerId,
        input.resourceId,
        input.threadId,
        input.externalResourceId,
        toPgJson(input.metadata ?? {}),
        toPgJson(input.deliveryOptions ?? {}),
        operation ? false : input.enabled !== false,
        operation ? 'subscribe' : null,
        operation ? operation.owner : null,
        ...(operation ? [operation.ttlMs] : []),
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async isEmpty(): Promise<boolean> {
    return this.#run('IS_EMPTY', async () => {
      const [row] = await this.#rows(
        `SELECT (EXISTS (SELECT 1 FROM ${this.#S}) OR EXISTS (SELECT 1 FROM ${this.#D}) OR EXISTS (SELECT 1 FROM ${this.#C})) AS "any"`,
      );
      return row?.any === false;
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#run('CLEAR_ALL', () =>
      this.#db.client.tx(async tx => {
        await this.#query(`DELETE FROM ${this.#D}`, [], tx);
        await this.#query(`DELETE FROM ${this.#S}`, [], tx);
        await this.#query(`DELETE FROM ${this.#C}`, [], tx);
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  async upsertSubscription(
    input: UpsertSignalSubscriptionInput,
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord> {
    return this.#run('UPSERT', async () => {
      const insert = this.#insertSql(input);
      const row = await this.#fencedInsert(input, fence, tx =>
        this.#rows(
          `${insert.sql}
           ON CONFLICT ("agentId", "providerId", "resourceId", "threadId", "externalResourceId") DO UPDATE SET
             "metadata" = ${this.#S}."metadata" || EXCLUDED."metadata",
             "deliveryOptions" = CASE WHEN ?::boolean THEN EXCLUDED."deliveryOptions" ELSE ${this.#S}."deliveryOptions" END,
             "enabled" = CASE WHEN ?::boolean THEN EXCLUDED."enabled" ELSE ${this.#S}."enabled" END,
             "updatedAt" = ${NOW}
           RETURNING *`,
          [...insert.args, input.deliveryOptions !== undefined, input.enabled !== undefined],
          tx,
        ),
      );
      return toRecord(row!);
    });
  }

  async getSubscriptionById(args: SignalSubscriptionRowRef): Promise<SignalSubscriptionRecord | null> {
    return this.#run('GET_BY_ID', async () => {
      const [row] = await this.#rows(`SELECT * FROM ${this.#S} WHERE "agentId" = ? AND "id" = ?`, [
        args.agentId,
        args.id,
      ]);
      return row ? toRecord(row) : null;
    });
  }

  async getSubscriptionByIdentity(identity: SignalSubscriptionIdentity): Promise<SignalSubscriptionRecord | null> {
    return this.#run('GET_BY_IDENTITY', async () => {
      const [row] = await this.#rows(
        `SELECT * FROM ${this.#S} WHERE "agentId" = ? AND "providerId" = ? AND "resourceId" = ? AND "threadId" = ? AND "externalResourceId" = ?`,
        [identity.agentId, identity.providerId, identity.resourceId, identity.threadId, identity.externalResourceId],
      );
      return row ? toRecord(row) : null;
    });
  }

  async listSubscriptions(args: ListSignalSubscriptionsInput): Promise<ListSignalSubscriptionsResult> {
    return this.#run('LIST', async () => {
      const where = this.#filterSql(args);
      const paging = pageSql(args.limit, args.offset);
      const rows = await this.#rows(
        `WITH filtered AS (SELECT * FROM ${this.#S} WHERE ${where.sql}),
              total AS (SELECT COUNT(*) AS "total" FROM filtered),
              page AS (SELECT * FROM filtered ORDER BY "createdAt" ASC, "id" ASC ${paging.sql})
         SELECT total."total" AS "__total", page.*
         FROM total LEFT JOIN page ON true
         ORDER BY page."createdAt" ASC, page."id" ASC`,
        [...where.args, ...paging.args],
      );
      const total = Number(rows[0]?.__total ?? 0);
      const subscriptions = rows.filter(row => row.id !== null && row.id !== undefined).map(toRecord);
      return { subscriptions, total };
    });
  }

  async listSubscriptionsForResource(args: {
    agentId: string;
    providerId: string;
    externalResourceId: string;
  }): Promise<SignalSubscriptionRecord[]> {
    return (await this.listSubscriptions({ ...args, enabled: true })).subscriptions;
  }

  async countSubscriptions(filters: SignalSubscriptionFilters): Promise<number> {
    return this.#run('COUNT', async () => {
      const where = this.#filterSql(filters);
      const [row] = await this.#rows(`SELECT COUNT(*) AS "count" FROM ${this.#S} WHERE ${where.sql}`, where.args);
      return Number(row?.count ?? 0);
    });
  }

  async updateSubscription(
    args: SignalSubscriptionRowRef & { patch: SignalSubscriptionPatch },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    const { patch } = args;
    if (patch.metadata) {
      sets.push('"metadata" = ?::jsonb');
      values.push(toPgJson(patch.metadata));
    }
    if (patch.deliveryOptions) {
      sets.push('"deliveryOptions" = ?::jsonb');
      values.push(toPgJson(patch.deliveryOptions));
    }
    if (patch.cursor !== undefined) {
      sets.push('"cursor" = ?::jsonb');
      values.push(patch.cursor === null ? null : toPgJson(patch.cursor));
    }
    if (patch.lastPolledAt) {
      sets.push('"lastPolledAt" = ?::bigint');
      values.push(patch.lastPolledAt.getTime());
    }
    if (patch.lastDeliveredAt) {
      sets.push('"lastDeliveredAt" = ?::bigint');
      values.push(patch.lastDeliveredAt.getTime());
    }
    sets.push(`"updatedAt" = ${NOW}`);
    return this.#run('UPDATE', () =>
      this.#fencedRow(args, fence, async (tx, row) => {
        const [updated] = await this.#rows(
          `UPDATE ${this.#S} SET ${sets.join(', ')} WHERE "id" = ? RETURNING *`,
          [...values, row.id],
          tx,
        );
        return toRecord(updated!);
      }),
    );
  }

  async setSubscriptionEnabled(
    args: SignalSubscriptionRowRef & { enabled: boolean },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    return this.#run('SET_ENABLED', () =>
      this.#fencedRow(args, fence, async (tx, row) => {
        const [updated] = await this.#rows(
          `UPDATE ${this.#S} SET "enabled" = ?, "updatedAt" = ${NOW} WHERE "id" = ? RETURNING *`,
          [args.enabled, row.id],
          tx,
        );
        return toRecord(updated!);
      }),
    );
  }

  async deleteSubscription(args: SignalSubscriptionRowRef, fence?: SignalSubscriptionDocumentFence): Promise<boolean> {
    return this.#run('DELETE', async () => {
      const deleted = await this.#fencedRow(args, fence, async (tx, row) => {
        await this.#query(`DELETE FROM ${this.#D} WHERE "subscriptionId" = ?`, [row.id], tx);
        return (await this.#affected(`DELETE FROM ${this.#S} WHERE "id" = ?`, [row.id], tx)) === 1;
      });
      return deleted === true;
    });
  }

  async deleteSubscriptions(
    filters: SignalSubscriptionFilters,
    fences: SignalSubscriptionDocumentFence[] = [],
  ): Promise<number> {
    return this.#run('DELETE_MANY', async () => {
      const where = this.#filterSql(filters, 'r');
      const listDocuments = (client?: Queryable) =>
        this.#rows(
          `SELECT DISTINCT r."providerId", r."resourceId", r."threadId" FROM ${this.#S} r WHERE ${where.sql}`,
          where.args,
          client,
        ) as Promise<DocumentScope[]>;
      // Lock every matched document, then re-read the matches under those
      // locks; if one belongs to a document that appeared since listing,
      // retry with the wider set. Only the rows captured under the locks are
      // deleted.
      let documents = await listDocuments();
      for (;;) {
        const locked = new Set(documents.map(documentKey));
        const result = await this.#withDocuments<{ deleted: number } | { retry: DocumentScope[] }>(documents, async tx => {
          // A matched row is deletable when its document is unowned or one of
          // the supplied fences proves ownership; any other match rejects all.
          const guards = [this.#rowFenceSql(undefined, 'r'), ...fences.map(fence => this.#rowFenceSql(fence, 'r'))];
          const matched = await this.#rows(
            `SELECT r.*, (${guards.map(g => g.sql).join(' OR ')}) AS "__deletable" FROM ${this.#S} r WHERE ${where.sql} FOR UPDATE`,
            [...guards.flatMap(g => g.args), ...where.args],
            tx,
          );
          const unlocked = matched.filter(row => !locked.has(documentKey(row as DocumentScope)));
          if (unlocked.length > 0) return { retry: unlocked as DocumentScope[] };
          const rejected = matched.find(row => row.__deletable !== true);
          if (rejected) throw fenceError(toRecord(rejected), undefined);
          const ids = matched.map(row => String(row.id));
          if (ids.length === 0) return { deleted: 0 };
          await this.#query(`DELETE FROM ${this.#D} WHERE "subscriptionId" = ANY(?::text[])`, [ids], tx);
          return { deleted: await this.#affected(`DELETE FROM ${this.#S} WHERE "id" = ANY(?::text[])`, [ids], tx) };
        });
        if ('deleted' in result) return result.deleted;
        documents = [...documents, ...result.retry];
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Membership operations
  // ---------------------------------------------------------------------------

  async insertSubscribingSubscription(
    input: Omit<UpsertSignalSubscriptionInput, 'enabled'> & { owner: string; ttlMs: number },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    return this.#run('INSERT_SUBSCRIBING', async () => {
      const insert = this.#insertSql(input, { owner: input.owner, ttlMs: input.ttlMs });
      const row = await this.#fencedInsert(input, fence, tx =>
        this.#rows(`${insert.sql} ON CONFLICT DO NOTHING RETURNING *`, insert.args, tx),
      );
      return row ? toRecord(row) : null;
    });
  }

  async beginSubscriptionOperation(
    args: SignalSubscriptionRowRef & { kind: SignalSubscriptionOperationKind; owner: string; ttlMs: number },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    return this.#run('BEGIN_OPERATION', () =>
      this.#fencedRow(args, fence, async (tx, row) => {
        const [updated] = await this.#rows(
          `UPDATE ${this.#S}
           SET "operationKind" = ?, "operationOwner" = ?, "operationExpiresAt" = ${NOW} + ?::bigint, "updatedAt" = ${NOW}
           WHERE "id" = ?
             AND ("operationOwner" IS NULL OR "operationOwner" = ? OR "operationExpiresAt" <= ${NOW})
             AND NOT (?::text = 'subscribe' AND "enabled" = true AND "claimOwner" IS NOT NULL AND "claimExpiresAt" > ${NOW})
           RETURNING *`,
          [args.kind, args.owner, args.ttlMs, row.id, args.owner, args.kind],
          tx,
        );
        return updated ? toRecord(updated) : null;
      }),
    );
  }

  async renewSubscriptionOperation(args: SignalSubscriptionRowRef & { owner: string; ttlMs: number }): Promise<boolean> {
    return this.#run('RENEW_OPERATION', async () => {
      const affected = await this.#affected(
        `UPDATE ${this.#S} SET "operationExpiresAt" = ${NOW} + ?::bigint
         WHERE "agentId" = ? AND "id" = ? AND "operationOwner" = ? AND "operationExpiresAt" > ${NOW}`,
        [args.ttlMs, args.agentId, args.id, args.owner],
      );
      return affected === 1;
    });
  }

  async commitSubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    return this.#run('COMMIT_SUBSCRIBE', () =>
      this.#fencedRow(args, fence, async (tx, row) => {
        const [updated] = await this.#rows(
          `UPDATE ${this.#S}
           SET "enabled" = true, "operationKind" = NULL, "operationOwner" = NULL, "operationExpiresAt" = NULL, "updatedAt" = ${NOW}
           WHERE "id" = ? AND "operationKind" = 'subscribe' AND "operationOwner" = ? AND "operationExpiresAt" > ${NOW}
           RETURNING *`,
          [row.id, args.owner],
          tx,
        );
        return updated ? toRecord(updated) : null;
      }),
    );
  }

  async commitUnsubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean> {
    return this.#run('COMMIT_UNSUBSCRIBE', async () => {
      const committed = await this.#fencedRow(args, fence, async (tx, row) => {
        const deleted = await this.#affected(
          `DELETE FROM ${this.#S}
           WHERE "id" = ? AND "enabled" = false AND "operationKind" = 'unsubscribe' AND "operationOwner" = ?
             AND "operationExpiresAt" > ${NOW}
             AND ("claimOwner" IS NULL OR "claimExpiresAt" <= ${NOW})`,
          [row.id, args.owner],
          tx,
        );
        if (deleted !== 1) return false;
        await this.#query(`DELETE FROM ${this.#D} WHERE "subscriptionId" = ?`, [row.id], tx);
        return true;
      });
      return committed === true;
    });
  }

  async abortSubscriptionOperation(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean> {
    return this.#run('ABORT_OPERATION', async () => {
      const aborted = await this.#fencedRow(
        args,
        fence,
        async (tx, row) =>
          (await this.#affected(
            `UPDATE ${this.#S}
             SET "operationKind" = NULL, "operationOwner" = NULL, "operationExpiresAt" = NULL, "updatedAt" = ${NOW}
             WHERE "id" = ? AND "operationOwner" = ?`,
            [row.id, args.owner],
            tx,
          )) === 1,
      );
      return aborted === true;
    });
  }

  // ---------------------------------------------------------------------------
  // Poll claims
  // ---------------------------------------------------------------------------

  async claimSubscription(args: ClaimSignalSubscriptionInput): Promise<SignalSubscriptionRecord | null> {
    return this.#run('CLAIM', async () => {
      const force = args.force === true;
      const [row] = await this.#rows(
        `UPDATE ${this.#S}
         SET "claimOwner" = ?,
             "claimExpiresAt" = ${NOW} + ?::bigint,
             "nextPollAt" = CASE WHEN ?::boolean OR "claimOwner" IS NULL THEN ${NOW} + ?::bigint ELSE "nextPollAt" END
         WHERE "agentId" = ? AND "id" = ? AND "enabled" = true
           AND ("operationOwner" IS NULL OR "operationExpiresAt" <= ${NOW})
           AND ("claimOwner" IS NULL OR "claimExpiresAt" <= ${NOW})
           AND (?::boolean OR "claimOwner" IS NOT NULL OR "nextPollAt" IS NULL OR "nextPollAt" <= ${NOW})
         RETURNING *`,
        [args.owner, args.ttlMs, force, args.cadenceMs, args.agentId, args.id, force],
      );
      return row ? toRecord(row) : null;
    });
  }

  async renewSubscriptionClaimIfEnabled(
    args: SignalSubscriptionRowRef & { owner: string; ttlMs: number },
  ): Promise<boolean> {
    return this.#run('RENEW_CLAIM', async () => {
      const affected = await this.#affected(
        `UPDATE ${this.#S} SET "claimExpiresAt" = ${NOW} + ?::bigint
         WHERE "agentId" = ? AND "id" = ? AND "enabled" = true AND "claimOwner" = ? AND "claimExpiresAt" > ${NOW}
           AND ("operationOwner" IS NULL OR "operationExpiresAt" <= ${NOW})`,
        [args.ttlMs, args.agentId, args.id, args.owner],
      );
      return affected === 1;
    });
  }

  async validateSubscriptionClaimIfEnabled(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean> {
    return this.#run('VALIDATE_CLAIM', async () => {
      const [row] = await this.#rows(
        `SELECT COUNT(*) AS "count" FROM ${this.#S}
         WHERE "agentId" = ? AND "id" = ? AND "enabled" = true AND "claimOwner" = ? AND "claimExpiresAt" > ${NOW}
           AND ("operationOwner" IS NULL OR "operationExpiresAt" <= ${NOW})`,
        [args.agentId, args.id, args.owner],
      );
      return Number(row?.count) === 1;
    });
  }

  async releaseSubscriptionClaim(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean> {
    return this.#run('RELEASE_CLAIM', async () => {
      const affected = await this.#affected(
        `UPDATE ${this.#S} SET "claimOwner" = NULL, "claimExpiresAt" = NULL WHERE "agentId" = ? AND "id" = ? AND "claimOwner" = ?`,
        [args.agentId, args.id, args.owner],
      );
      return affected === 1;
    });
  }

  // ---------------------------------------------------------------------------
  // Document owners
  // ---------------------------------------------------------------------------

  async claimDocumentOwner(args: {
    key: string;
    agentId: string;
    providerId: string;
    resourceId: string;
    threadId: string;
  }): Promise<SignalSubscriptionDocumentOwner | null> {
    return this.#run('CLAIM_DOCUMENT_OWNER', () =>
      this.#withDocuments([args], async tx => {
        await this.#query(
          `INSERT INTO ${this.#C} ("kind", "key", "agentId", "providerId", "resourceId", "threadId", "fencingToken", "createdAt")
           VALUES ('owner', ?, ?, ?, ?, ?, ?, ${NOW})
           ON CONFLICT ("kind", "key") DO NOTHING`,
          [args.key, args.agentId, args.providerId, args.resourceId, args.threadId, crypto.randomUUID()],
          tx,
        );
        const [row] = await this.#rows(`SELECT * FROM ${this.#C} WHERE "kind" = 'owner' AND "key" = ?`, [args.key], tx);
        if (!row) return null;
        const owner = toOwner(row);
        const same =
          owner.agentId === args.agentId &&
          owner.providerId === args.providerId &&
          owner.resourceId === args.resourceId &&
          owner.threadId === args.threadId;
        return same ? owner : null;
      }),
    );
  }

  async releaseDocumentOwner(args: {
    key: string;
    agentId: string;
    providerId: string;
    fencingToken: string;
  }): Promise<boolean> {
    return this.#run('RELEASE_DOCUMENT_OWNER', async () => {
      const [owner] = await this.#rows(
        `SELECT "providerId", "resourceId", "threadId" FROM ${this.#C} WHERE "kind" = 'owner' AND "key" = ?`,
        [args.key],
      );
      if (!owner) return false;
      return this.#withDocuments([owner as DocumentScope], async tx => {
        const affected = await this.#affected(
          `DELETE FROM ${this.#C} c
           WHERE c."kind" = 'owner' AND c."key" = ? AND c."agentId" = ? AND c."providerId" = ? AND c."fencingToken" = ?
             AND NOT EXISTS (
               SELECT 1 FROM ${this.#S} s
               WHERE s."providerId" = c."providerId" AND s."resourceId" = c."resourceId" AND s."threadId" = c."threadId"
             )`,
          [args.key, args.agentId, args.providerId, args.fencingToken],
          tx,
        );
        return affected === 1;
      });
    });
  }

  async listDocumentOwners(
    args: ListSignalSubscriptionDocumentOwnersInput,
  ): Promise<ListSignalSubscriptionDocumentOwnersResult> {
    return this.#run('LIST_DOCUMENT_OWNERS', async () => {
      const clauses = [`"kind" = 'owner'`];
      const values: unknown[] = [];
      for (const key of ['agentId', 'providerId', 'resourceId', 'threadId'] as const) {
        if (args[key] !== undefined) {
          clauses.push(`"${key}" = ?`);
          values.push(args[key]);
        }
      }
      const paging = pageSql(args.limit, args.offset);
      const rows = await this.#rows(
        `WITH filtered AS (SELECT * FROM ${this.#C} WHERE ${clauses.join(' AND ')}),
              total AS (SELECT COUNT(*) AS "total" FROM filtered),
              page AS (SELECT * FROM filtered ORDER BY "createdAt" ASC, "key" ASC ${paging.sql})
         SELECT total."total" AS "__total", page.*
         FROM total LEFT JOIN page ON true
         ORDER BY page."createdAt" ASC, page."key" ASC`,
        [...values, ...paging.args],
      );
      const total = Number(rows[0]?.__total ?? 0);
      const owners = rows.filter(row => row.key !== null && row.key !== undefined).map(toOwner);
      return { owners, total };
    });
  }

  // ---------------------------------------------------------------------------
  // Coordination locks
  // ---------------------------------------------------------------------------

  async claimCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean> {
    return this.#run('CLAIM_LOCK', async () => {
      const rows = await this.#rows(
        `INSERT INTO ${this.#C} AS c ("kind", "key", "owner", "expiresAt", "createdAt")
         VALUES ('lock', ?, ?, ${NOW} + ?::bigint, ${NOW})
         ON CONFLICT ("kind", "key") DO UPDATE SET "owner" = EXCLUDED."owner", "expiresAt" = EXCLUDED."expiresAt"
         WHERE c."expiresAt" <= ${NOW}
         RETURNING "owner"`,
        [args.key, args.owner, args.ttlMs],
      );
      return rows.length === 1;
    });
  }

  async renewCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean> {
    return this.#run('RENEW_LOCK', async () => {
      const affected = await this.#affected(
        `UPDATE ${this.#C} SET "expiresAt" = ${NOW} + ?::bigint
         WHERE "kind" = 'lock' AND "key" = ? AND "owner" = ? AND "expiresAt" > ${NOW}`,
        [args.ttlMs, args.key, args.owner],
      );
      return affected === 1;
    });
  }

  async releaseCoordinationLock(args: { key: string; owner: string }): Promise<boolean> {
    return this.#run('RELEASE_LOCK', async () => {
      const affected = await this.#affected(
        `DELETE FROM ${this.#C} WHERE "kind" = 'lock' AND "key" = ? AND "owner" = ?`,
        [args.key, args.owner],
      );
      return affected === 1;
    });
  }

  // ---------------------------------------------------------------------------
  // Delivery ledger
  // ---------------------------------------------------------------------------

  async claimDelivery(
    args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number },
  ): Promise<ClaimSignalSubscriptionDeliveryResult> {
    return this.#run('CLAIM_DELIVERY', async () => {
      const claimed = await this.#rows(
        `INSERT INTO ${this.#D} AS d ("subscriptionId", "deliveryId", "status", "owner", "expiresAt", "createdAt")
         VALUES (?, ?, 'pending', ?, ${NOW} + ?::bigint, ${NOW})
         ON CONFLICT ("subscriptionId", "deliveryId") DO UPDATE SET "owner" = EXCLUDED."owner", "expiresAt" = EXCLUDED."expiresAt"
         WHERE d."status" = 'pending' AND d."expiresAt" <= ${NOW}
         RETURNING "owner"`,
        [args.subscriptionId, args.deliveryId, args.owner, args.ttlMs],
      );
      if (claimed.length === 1) return 'claimed';
      const [existing] = await this.#rows(
        `SELECT "status" FROM ${this.#D} WHERE "subscriptionId" = ? AND "deliveryId" = ?`,
        [args.subscriptionId, args.deliveryId],
      );
      return existing?.status === 'delivered' ? 'delivered' : 'in-progress';
    });
  }

  async renewDeliveryClaim(args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number }): Promise<boolean> {
    return this.#run('RENEW_DELIVERY', async () => {
      const affected = await this.#affected(
        `UPDATE ${this.#D} SET "expiresAt" = ${NOW} + ?::bigint
         WHERE "subscriptionId" = ? AND "deliveryId" = ? AND "status" = 'pending' AND "owner" = ? AND "expiresAt" > ${NOW}`,
        [args.ttlMs, args.subscriptionId, args.deliveryId, args.owner],
      );
      return affected === 1;
    });
  }

  async completeDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean> {
    return this.#run('COMPLETE_DELIVERY', async () => {
      const affected = await this.#affected(
        `UPDATE ${this.#D} SET "status" = 'delivered', "owner" = NULL, "expiresAt" = NULL, "deliveredAt" = ${NOW}
         WHERE "subscriptionId" = ? AND "deliveryId" = ? AND "status" = 'pending' AND "owner" = ?`,
        [args.subscriptionId, args.deliveryId, args.owner],
      );
      return affected === 1;
    });
  }

  async releaseDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean> {
    return this.#run('RELEASE_DELIVERY', async () => {
      const affected = await this.#affected(
        `DELETE FROM ${this.#D} WHERE "subscriptionId" = ? AND "deliveryId" = ? AND "status" = 'pending' AND "owner" = ?`,
        [args.subscriptionId, args.deliveryId, args.owner],
      );
      return affected === 1;
    });
  }

  async getDelivery(args: SignalSubscriptionDeliveryRef): Promise<SignalSubscriptionDelivery | null> {
    return this.#run('GET_DELIVERY', async () => {
      const [row] = await this.#rows(`SELECT * FROM ${this.#D} WHERE "subscriptionId" = ? AND "deliveryId" = ?`, [
        args.subscriptionId,
        args.deliveryId,
      ]);
      if (!row) return null;
      const base = {
        subscriptionId: String(row.subscriptionId),
        deliveryId: String(row.deliveryId),
        createdAt: new Date(Number(row.createdAt)),
      };
      if (row.status === 'delivered') {
        return { ...base, status: 'delivered', deliveredAt: new Date(Number(row.deliveredAt)) };
      }
      return { ...base, status: 'pending', owner: String(row.owner), expiresAt: Number(row.expiresAt) };
    });
  }
}
