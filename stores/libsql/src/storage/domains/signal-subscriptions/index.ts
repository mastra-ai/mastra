import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  SIGNAL_SUBSCRIPTION_COORDINATION_SCHEMA,
  SIGNAL_SUBSCRIPTION_DELIVERIES_SCHEMA,
  SIGNAL_SUBSCRIPTIONS_SCHEMA,
  SignalSubscriptionFenceError,
  SignalSubscriptionsStorage,
  TABLE_SIGNAL_SUBSCRIPTION_COORDINATION,
  TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES,
  TABLE_SIGNAL_SUBSCRIPTIONS,
  createStorageErrorId,
} from '@mastra/core/storage';
import type {
  ClaimSignalSubscriptionDeliveryResult,
  ClaimSignalSubscriptionInput,
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

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client, SqliteInValue as InValue, SqliteResultSet, SqliteValue } from '../../db/client';
import { withClientWriteLock } from '../../db/write-lock';

const S = `"${TABLE_SIGNAL_SUBSCRIPTIONS}"`;
const D = `"${TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES}"`;
const C = `"${TABLE_SIGNAL_SUBSCRIPTION_COORDINATION}"`;

/**
 * Database time in epoch milliseconds. `CURRENT_TIMESTAMP` is whole-second, so
 * derive milliseconds from `julianday('now')`. A remote libSQL server evaluates
 * this on the server; a local file evaluates it in each calling process.
 */
const NOW = `CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`;

const SUBSCRIPTION_COLUMNS = Object.keys(SIGNAL_SUBSCRIPTIONS_SCHEMA);

const INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "mastra_signal_subscriptions_identity_uq" ON ${S} ("agentId", "providerId", "resourceId", "threadId", "externalResourceId")`,
  `CREATE INDEX IF NOT EXISTS "mastra_signal_subscriptions_webhook_idx" ON ${S} ("agentId", "providerId", "externalResourceId")`,
  `CREATE INDEX IF NOT EXISTS "mastra_signal_subscriptions_due_idx" ON ${S} ("agentId", "providerId", "enabled", "nextPollAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "mastra_signal_subscription_deliveries_uq" ON ${D} ("subscriptionId", "deliveryId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "mastra_signal_subscription_coordination_key_uq" ON ${C} ("kind", "key")`,
];

/**
 * True when `fence` authorizes mutating the subscription row referenced by
 * `row`: the row's document is unowned and no fence was supplied, or the fence
 * matches the document owner and the row's agent.
 */
function rowFenceSql(
  fence: SignalSubscriptionDocumentFence | undefined,
  row: string = S,
): { sql: string; args: InValue[] } {
  if (!fence) {
    return {
      sql: `NOT EXISTS (SELECT 1 FROM ${C} o WHERE o."kind" = 'owner' AND o."providerId" = ${row}."providerId" AND o."resourceId" = ${row}."resourceId" AND o."threadId" = ${row}."threadId")`,
      args: [],
    };
  }
  return {
    sql: `EXISTS (SELECT 1 FROM ${C} o WHERE o."kind" = 'owner' AND o."key" = ? AND o."fencingToken" = ? AND o."agentId" = ${row}."agentId" AND o."providerId" = ${row}."providerId" AND o."resourceId" = ${row}."resourceId" AND o."threadId" = ${row}."threadId")`,
    args: [fence.key, fence.fencingToken],
  };
}

/** Shallow JSON object merge: keys of `patch` replace keys of `base`. */
function mergeJsonSql(base: string, patch: string): string {
  const value = `CASE type WHEN 'true' THEN json('true') WHEN 'false' THEN json('false') WHEN 'null' THEN json('null') WHEN 'object' THEN json(value) WHEN 'array' THEN json(value) ELSE value END`;
  return `(SELECT json_group_object(key, ${value}) FROM (SELECT key, value, type FROM json_each(${base}) WHERE key NOT IN (SELECT key FROM json_each(${patch})) UNION ALL SELECT key, value, type FROM json_each(${patch})))`;
}

/** Same check as {@link rowFenceSql}, against a not-yet-existing identity. */
function identityFenceSql(
  identity: SignalSubscriptionIdentity,
  fence: SignalSubscriptionDocumentFence | undefined,
): { sql: string; args: InValue[] } {
  if (!fence) {
    return {
      sql: `NOT EXISTS (SELECT 1 FROM ${C} o WHERE o."kind" = 'owner' AND o."providerId" = ? AND o."resourceId" = ? AND o."threadId" = ?)`,
      args: [identity.providerId, identity.resourceId, identity.threadId],
    };
  }
  return {
    sql: `EXISTS (SELECT 1 FROM ${C} o WHERE o."kind" = 'owner' AND o."key" = ? AND o."fencingToken" = ? AND o."agentId" = ? AND o."providerId" = ? AND o."resourceId" = ? AND o."threadId" = ?)`,
    args: [
      fence.key,
      fence.fencingToken,
      identity.agentId,
      identity.providerId,
      identity.resourceId,
      identity.threadId,
    ],
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

function filterSql(filters: SignalSubscriptionFilters, row?: string): { sql: string; args: InValue[] } {
  const column = (name: string) => (row ? `${row}."${name}"` : `"${name}"`);
  const clauses = [`${column('agentId')} = ?`];
  const args: InValue[] = [filters.agentId];
  for (const key of ['providerId', 'resourceId', 'threadId', 'externalResourceId'] as const) {
    if (filters[key] !== undefined) {
      clauses.push(`${column(key)} = ?`);
      args.push(filters[key]);
    }
  }
  if (filters.enabled !== undefined) {
    clauses.push(`${column('enabled')} = ?`);
    args.push(filters.enabled ? 1 : 0);
  }
  return { sql: clauses.join(' AND '), args };
}

function pageSql(limit: number | undefined, offset: number | undefined): { sql: string; args: InValue[] } {
  if (limit !== undefined) {
    return offset !== undefined
      ? { sql: 'LIMIT ? OFFSET ?', args: [limit, offset] }
      : { sql: 'LIMIT ?', args: [limit] };
  }
  // SQLite rejects OFFSET without LIMIT; -1 means "no limit".
  return offset !== undefined ? { sql: 'LIMIT -1 OFFSET ?', args: [offset] } : { sql: '', args: [] };
}

function parseJson(value: SqliteValue | undefined): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(String(value)) as Record<string, unknown>;
}

function toNumber(value: SqliteValue | undefined): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function toDate(value: SqliteValue | undefined): Date | undefined {
  const ms = toNumber(value);
  return ms === undefined ? undefined : new Date(ms);
}

function toRecord(row: Record<string, SqliteValue>): SignalSubscriptionRecord {
  const record: SignalSubscriptionRecord = {
    id: String(row.id),
    agentId: String(row.agentId),
    providerId: String(row.providerId),
    resourceId: String(row.resourceId),
    threadId: String(row.threadId),
    externalResourceId: String(row.externalResourceId),
    metadata: parseJson(row.metadata) ?? {},
    deliveryOptions: parseJson(row.deliveryOptions) ?? {},
    enabled: Number(row.enabled) === 1,
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
  const cursor = parseJson(row.cursor);
  if (cursor) record.cursor = cursor;
  const lastPolledAt = toDate(row.lastPolledAt);
  if (lastPolledAt) record.lastPolledAt = lastPolledAt;
  const nextPollAt = toDate(row.nextPollAt);
  if (nextPollAt) record.nextPollAt = nextPollAt;
  const lastDeliveredAt = toDate(row.lastDeliveredAt);
  if (lastDeliveredAt) record.lastDeliveredAt = lastDeliveredAt;
  return record;
}

function toOwner(row: Record<string, SqliteValue>): SignalSubscriptionDocumentOwner {
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

/**
 * LibSQL implementation of {@link SignalSubscriptionsStorage}.
 *
 * Every due/expiry decision uses database time and every ownership transition
 * is one guarded statement, so replicas sharing the database coordinate
 * correctly. Fence-checked mutations run as one atomic write batch.
 */
export class SignalSubscriptionsLibSQL extends SignalSubscriptionsStorage {
  readonly durability = 'persistent' as const;

  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SIGNAL_SUBSCRIPTIONS, schema: SIGNAL_SUBSCRIPTIONS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_SIGNAL_SUBSCRIPTION_DELIVERIES,
      schema: SIGNAL_SUBSCRIPTION_DELIVERIES_SCHEMA,
      compositePrimaryKey: ['subscriptionId', 'deliveryId'],
    });
    await this.#db.createTable({
      tableName: TABLE_SIGNAL_SUBSCRIPTION_COORDINATION,
      schema: SIGNAL_SUBSCRIPTION_COORDINATION_SCHEMA,
      compositePrimaryKey: ['kind', 'key'],
    });
    for (const statement of INDEXES) {
      await this.#client.execute(statement);
    }
  }

  // ---------------------------------------------------------------------------
  // Execution helpers
  // ---------------------------------------------------------------------------

  async #run<T>(operation: string, fn: () => Promise<T>, details?: Record<string, string>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', `SIGNAL_SUBSCRIPTIONS_${operation}`, 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details,
        },
        error,
      );
    }
  }

  #read(sql: string, args: InValue[] = []) {
    return this.#client.execute({ sql, args });
  }

  #write(sql: string, args: InValue[], description: string) {
    return this.#db.executeWriteOperationWithRetry(
      () => withClientWriteLock(this.#client, () => this.#client.execute({ sql, args })),
      description,
    );
  }

  /**
   * Run statements atomically as one write batch. The local client executes a
   * batch without yielding to the event loop, so no write lock is held across
   * awaits (which could deadlock two clients sharing a file in one process).
   */
  #batch(statements: Array<{ sql: string; args: InValue[] }>, description: string) {
    return this.#db.executeWriteOperationWithRetry(
      () => withClientWriteLock(this.#client, () => this.#client.batch(statements, 'write')),
      description,
    );
  }

  /** Statement reading a row together with whether `fence` authorizes mutating it. */
  #fenceProbe(ref: SignalSubscriptionRowRef, fence: SignalSubscriptionDocumentFence | undefined) {
    const fenceSql = rowFenceSql(fence);
    return {
      sql: `SELECT *, ${fenceSql.sql} AS "fenceOk" FROM ${S} WHERE "agentId" = ? AND "providerId" = ? AND "id" = ?`,
      args: [...fenceSql.args, ref.agentId, ref.providerId, ref.id],
    };
  }

  /**
   * Run a guarded mutation of one row. The probe and mutation run in one
   * atomic batch; the mutation repeats the fence in its `WHERE`, so it is a
   * no-op whenever the probe reports a rejected fence.
   */
  async #fencedMutation(
    ref: SignalSubscriptionRowRef,
    fence: SignalSubscriptionDocumentFence | undefined,
    mutation: (fence: { sql: string; args: InValue[] }) => Array<{ sql: string; args: InValue[] }>,
    description: string,
  ): Promise<{ row: SignalSubscriptionRecord; results: SqliteResultSet[] } | null> {
    const [probe, ...results] = await this.#batch(
      [this.#fenceProbe(ref, fence), ...mutation(rowFenceSql(fence))],
      description,
    );
    const probed = probe!.rows[0];
    if (!probed) return null;
    const row = toRecord(probed);
    if (Number(probed.fenceOk) !== 1) throw fenceError(row, fence);
    return { row, results };
  }

  #returned(result: SqliteResultSet | undefined): SignalSubscriptionRecord | null {
    const row = result?.rows[0];
    return row ? toRecord(row) : null;
  }

  async #getRow(ref: SignalSubscriptionRowRef): Promise<SignalSubscriptionRecord | null> {
    const result = await this.#read(`SELECT * FROM ${S} WHERE "agentId" = ? AND "providerId" = ? AND "id" = ?`, [
      ref.agentId,
      ref.providerId,
      ref.id,
    ]);
    const row = result.rows[0];
    return row ? toRecord(row) : null;
  }

  /** `INSERT ... SELECT ... WHERE <identity fence>` for a new row. */
  #insertSql(
    input: UpsertSignalSubscriptionInput,
    fence: SignalSubscriptionDocumentFence | undefined,
    operation?: { owner: string; ttlMs: number },
  ): { sql: string; args: InValue[] } {
    const fenceSql = identityFenceSql(input, fence);
    return {
      sql: `INSERT INTO ${S} ("id", "agentId", "providerId", "resourceId", "threadId", "externalResourceId", "metadata", "deliveryOptions", "enabled", "operationKind", "operationOwner", "operationExpiresAt", "createdAt", "updatedAt")
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${operation ? `${NOW} + ?` : 'NULL'}, ${NOW}, ${NOW}
            WHERE ${fenceSql.sql}`,
      args: [
        input.id ?? crypto.randomUUID(),
        input.agentId,
        input.providerId,
        input.resourceId,
        input.threadId,
        input.externalResourceId,
        JSON.stringify(input.metadata ?? {}),
        JSON.stringify(input.deliveryOptions ?? {}),
        operation ? 0 : input.enabled === false ? 0 : 1,
        operation ? 'subscribe' : null,
        operation ? operation.owner : null,
        ...(operation ? [operation.ttlMs] : []),
        ...fenceSql.args,
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async isEmpty(): Promise<boolean> {
    return this.#run('IS_EMPTY', async () => {
      const result = await this.#read(
        `SELECT (EXISTS (SELECT 1 FROM ${S}) OR EXISTS (SELECT 1 FROM ${D}) OR EXISTS (SELECT 1 FROM ${C})) AS "any"`,
      );
      return Number(result.rows[0]?.any) === 0;
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#run('CLEAR_ALL', () =>
      this.#batch(
        [
          { sql: `DELETE FROM ${D}`, args: [] },
          { sql: `DELETE FROM ${S}`, args: [] },
          { sql: `DELETE FROM ${C}`, args: [] },
        ],
        'clear signal subscriptions',
      ),
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
      const fenceSql = identityFenceSql(input, fence);
      const insert = this.#insertSql(input, fence);
      const [check, upsert] = await this.#batch(
        [
          { sql: `SELECT ${fenceSql.sql} AS "ok"`, args: fenceSql.args },
          {
            sql: `${insert.sql}
                  ON CONFLICT ("agentId", "providerId", "resourceId", "threadId", "externalResourceId") DO UPDATE SET
                    "metadata" = ${mergeJsonSql(`${S}."metadata"`, 'excluded."metadata"')},
                    "deliveryOptions" = CASE WHEN ? THEN excluded."deliveryOptions" ELSE ${S}."deliveryOptions" END,
                    "enabled" = CASE WHEN ? THEN excluded."enabled" ELSE ${S}."enabled" END,
                    "updatedAt" = ${NOW}
                  RETURNING *`,
            args: [...insert.args, input.deliveryOptions ? 1 : 0, input.enabled !== undefined ? 1 : 0],
          },
        ],
        'upsert signal subscription',
      );
      const row = upsert!.rows[0];
      if (Number(check!.rows[0]?.ok) !== 1 || !row) throw fenceError(input, fence);
      return toRecord(row);
    });
  }

  async getSubscriptionById(args: SignalSubscriptionRowRef): Promise<SignalSubscriptionRecord | null> {
    return this.#run('GET_BY_ID', () => this.#getRow(args));
  }

  async getSubscriptionByIdentity(identity: SignalSubscriptionIdentity): Promise<SignalSubscriptionRecord | null> {
    return this.#run('GET_BY_IDENTITY', async () => {
      const result = await this.#read(
        `SELECT * FROM ${S} WHERE "agentId" = ? AND "providerId" = ? AND "resourceId" = ? AND "threadId" = ? AND "externalResourceId" = ?`,
        [identity.agentId, identity.providerId, identity.resourceId, identity.threadId, identity.externalResourceId],
      );
      const row = result.rows[0];
      return row ? toRecord(row) : null;
    });
  }

  async listSubscriptions(args: ListSignalSubscriptionsInput): Promise<ListSignalSubscriptionsResult> {
    return this.#run('LIST', async () => {
      const where = filterSql(args);
      const paging = pageSql(args.limit, args.offset);
      const columns = SUBSCRIPTION_COLUMNS.map(c => `page."${c}" AS "${c}"`).join(', ');
      const result = await this.#read(
        `WITH filtered AS (SELECT * FROM ${S} WHERE ${where.sql}),
              total AS (SELECT COUNT(*) AS "total" FROM filtered),
              page AS (SELECT * FROM filtered ORDER BY "createdAt" ASC, "id" ASC ${paging.sql})
         SELECT total."total" AS "__total", ${columns}
         FROM total LEFT JOIN page ON 1 = 1
         ORDER BY page."createdAt" ASC, page."id" ASC`,
        [...where.args, ...paging.args],
      );
      const total = Number(result.rows[0]?.__total ?? 0);
      const subscriptions = result.rows.filter(row => row.id !== null && row.id !== undefined).map(toRecord);
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
      const where = filterSql(filters);
      const result = await this.#read(`SELECT COUNT(*) AS "count" FROM ${S} WHERE ${where.sql}`, where.args);
      return Number(result.rows[0]?.count ?? 0);
    });
  }

  async updateSubscription(
    args: SignalSubscriptionRowRef & { patch: SignalSubscriptionPatch },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    const sets: string[] = [];
    const values: InValue[] = [];
    const { patch } = args;
    if (patch.metadata) {
      sets.push('"metadata" = ?');
      values.push(JSON.stringify(patch.metadata));
    }
    if (patch.deliveryOptions) {
      sets.push('"deliveryOptions" = ?');
      values.push(JSON.stringify(patch.deliveryOptions));
    }
    if (patch.cursor !== undefined) {
      sets.push('"cursor" = ?');
      values.push(patch.cursor === null ? null : JSON.stringify(patch.cursor));
    }
    if (patch.lastPolledAt) {
      sets.push('"lastPolledAt" = ?');
      values.push(patch.lastPolledAt.getTime());
    }
    if (patch.lastDeliveredAt) {
      sets.push('"lastDeliveredAt" = ?');
      values.push(patch.lastDeliveredAt.getTime());
    }
    sets.push(`"updatedAt" = ${NOW}`);
    return this.#run('UPDATE', async () => {
      const outcome = await this.#fencedMutation(
        args,
        fence,
        guard => [
          {
            sql: `UPDATE ${S} SET ${sets.join(', ')} WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql} RETURNING *`,
            args: [...values, args.agentId, args.providerId, args.id, ...guard.args],
          },
        ],
        'update signal subscription',
      );
      return outcome ? this.#returned(outcome.results[0]) : null;
    });
  }

  async setSubscriptionEnabled(
    args: SignalSubscriptionRowRef & { enabled: boolean },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    return this.#run('SET_ENABLED', async () => {
      const outcome = await this.#fencedMutation(
        args,
        fence,
        guard => [
          {
            sql: `UPDATE ${S} SET "enabled" = ?, "updatedAt" = ${NOW} WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql} RETURNING *`,
            args: [args.enabled ? 1 : 0, args.agentId, args.providerId, args.id, ...guard.args],
          },
        ],
        'set signal subscription enabled',
      );
      return outcome ? this.#returned(outcome.results[0]) : null;
    });
  }

  async deleteSubscription(args: SignalSubscriptionRowRef, fence?: SignalSubscriptionDocumentFence): Promise<boolean> {
    return this.#run('DELETE', async () => {
      const outcome = await this.#fencedMutation(
        args,
        fence,
        guard => [
          {
            sql: `DELETE FROM ${D} WHERE "subscriptionId" IN (SELECT "id" FROM ${S} WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql})`,
            args: [args.agentId, args.providerId, args.id, ...guard.args],
          },
          {
            sql: `DELETE FROM ${S} WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql}`,
            args: [args.agentId, args.providerId, args.id, ...guard.args],
          },
        ],
        'delete signal subscription',
      );
      return outcome?.results[1]?.rowsAffected === 1;
    });
  }

  async deleteSubscriptions(
    filters: SignalSubscriptionFilters,
    fences: SignalSubscriptionDocumentFence[] = [],
  ): Promise<number> {
    return this.#run('DELETE_MANY', async () => {
      // A matched row is deletable when its document is unowned or one of the
      // supplied fences proves ownership of it. Any undeletable match rejects
      // the whole delete.
      const guards = [rowFenceSql(undefined, 'r'), ...fences.map(fence => rowFenceSql(fence, 'r'))];
      const where = filterSql(filters, 'r');
      const rejected = {
        sql: `SELECT r.* FROM ${S} r WHERE ${where.sql} AND NOT (${guards.map(g => g.sql).join(' OR ')}) LIMIT 1`,
        args: [...where.args, ...guards.flatMap(g => g.args)],
      };
      const [probe, , deleted] = await this.#batch(
        [
          rejected,
          {
            sql: `DELETE FROM ${D} WHERE "subscriptionId" IN (SELECT r."id" FROM ${S} r WHERE ${where.sql}) AND NOT EXISTS (${rejected.sql})`,
            args: [...where.args, ...rejected.args],
          },
          {
            sql: `DELETE FROM ${S} WHERE "id" IN (SELECT r."id" FROM ${S} r WHERE ${where.sql}) AND NOT EXISTS (${rejected.sql})`,
            args: [...where.args, ...rejected.args],
          },
        ],
        'delete signal subscriptions',
      );
      const row = probe!.rows[0];
      if (row) throw fenceError(toRecord(row), undefined);
      return deleted!.rowsAffected;
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
      const fenceSql = identityFenceSql(input, fence);
      const insert = this.#insertSql(input, fence, { owner: input.owner, ttlMs: input.ttlMs });
      const [check, inserted] = await this.#batch(
        [
          { sql: `SELECT ${fenceSql.sql} AS "ok"`, args: fenceSql.args },
          {
            sql: `${insert.sql} ON CONFLICT ("agentId", "providerId", "resourceId", "threadId", "externalResourceId") DO NOTHING RETURNING *`,
            args: insert.args,
          },
        ],
        'insert subscribing signal subscription',
      );
      if (Number(check!.rows[0]?.ok) !== 1) throw fenceError(input, fence);
      return this.#returned(inserted);
    });
  }

  async beginSubscriptionOperation(
    args: SignalSubscriptionRowRef & { kind: SignalSubscriptionOperationKind; owner: string; ttlMs: number },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    return this.#run('BEGIN_OPERATION', async () => {
      const outcome = await this.#fencedMutation(
        args,
        fence,
        guard => [
          {
            sql: `UPDATE ${S}
                  SET "operationKind" = ?, "operationOwner" = ?, "operationExpiresAt" = ${NOW} + ?, "updatedAt" = ${NOW}
                  WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql}
                    AND ("operationOwner" IS NULL OR "operationOwner" = ? OR "operationExpiresAt" <= ${NOW})
                    AND NOT (? = 'subscribe' AND "enabled" = 1 AND "claimOwner" IS NOT NULL AND "claimExpiresAt" > ${NOW})
                  RETURNING *`,
            args: [
              args.kind,
              args.owner,
              args.ttlMs,
              args.agentId,
              args.providerId,
              args.id,
              ...guard.args,
              args.owner,
              args.kind,
            ],
          },
        ],
        'begin signal subscription operation',
      );
      return outcome ? this.#returned(outcome.results[0]) : null;
    });
  }

  async renewSubscriptionOperation(
    args: SignalSubscriptionRowRef & { owner: string; ttlMs: number },
  ): Promise<boolean> {
    return this.#run('RENEW_OPERATION', async () => {
      const result = await this.#write(
        `UPDATE ${S} SET "operationExpiresAt" = ${NOW} + ?
         WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND "operationOwner" = ? AND "operationExpiresAt" > ${NOW}`,
        [args.ttlMs, args.agentId, args.providerId, args.id, args.owner],
        'renew signal subscription operation',
      );
      return result.rowsAffected === 1;
    });
  }

  async commitSubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    return this.#run('COMMIT_SUBSCRIBE', async () => {
      const outcome = await this.#fencedMutation(
        args,
        fence,
        guard => [
          {
            sql: `UPDATE ${S}
                  SET "enabled" = 1, "operationKind" = NULL, "operationOwner" = NULL, "operationExpiresAt" = NULL, "updatedAt" = ${NOW}
                  WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql}
                    AND "operationKind" = 'subscribe' AND "operationOwner" = ? AND "operationExpiresAt" > ${NOW}
                  RETURNING *`,
            args: [args.agentId, args.providerId, args.id, ...guard.args, args.owner],
          },
        ],
        'commit signal subscription subscribe',
      );
      return outcome ? this.#returned(outcome.results[0]) : null;
    });
  }

  async commitUnsubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean> {
    return this.#run('COMMIT_UNSUBSCRIBE', async () => {
      const outcome = await this.#fencedMutation(
        args,
        fence,
        guard => {
          const committable = {
            sql: `SELECT "id" FROM ${S}
                  WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql}
                    AND "enabled" = 0 AND "operationKind" = 'unsubscribe' AND "operationOwner" = ?
                    AND "operationExpiresAt" > ${NOW}
                    AND ("claimOwner" IS NULL OR "claimExpiresAt" <= ${NOW})`,
            args: [args.agentId, args.providerId, args.id, ...guard.args, args.owner],
          };
          // Row first: each statement re-reads the clock, so deliveries are
          // only removed once the row delete has actually committed.
          return [
            { sql: `DELETE FROM ${S} WHERE "id" IN (${committable.sql})`, args: committable.args },
            {
              sql: `DELETE FROM ${D} WHERE "subscriptionId" = ? AND NOT EXISTS (SELECT 1 FROM ${S} WHERE "id" = ?)`,
              args: [args.id, args.id],
            },
          ];
        },
        'commit signal subscription unsubscribe',
      );
      return outcome?.results[0]?.rowsAffected === 1;
    });
  }

  async abortSubscriptionOperation(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean> {
    return this.#run('ABORT_OPERATION', async () => {
      const outcome = await this.#fencedMutation(
        args,
        fence,
        guard => [
          {
            sql: `UPDATE ${S}
                  SET "operationKind" = NULL, "operationOwner" = NULL, "operationExpiresAt" = NULL, "updatedAt" = ${NOW}
                  WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND ${guard.sql} AND "operationOwner" = ?`,
            args: [args.agentId, args.providerId, args.id, ...guard.args, args.owner],
          },
        ],
        'abort signal subscription operation',
      );
      return outcome?.results[0]?.rowsAffected === 1;
    });
  }

  // ---------------------------------------------------------------------------
  // Poll claims
  // ---------------------------------------------------------------------------

  async claimSubscription(args: ClaimSignalSubscriptionInput): Promise<SignalSubscriptionRecord | null> {
    return this.#run('CLAIM', async () => {
      const force = args.force ? 1 : 0;
      const result = await this.#write(
        `UPDATE ${S}
         SET "claimOwner" = ?,
             "claimExpiresAt" = ${NOW} + ?,
             "nextPollAt" = CASE WHEN ? = 1 OR "claimOwner" IS NULL THEN ${NOW} + ? ELSE "nextPollAt" END
         WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND "enabled" = 1
           AND ("operationOwner" IS NULL OR "operationExpiresAt" <= ${NOW})
           AND ("claimOwner" IS NULL OR "claimExpiresAt" <= ${NOW})
           AND (? = 1 OR "claimOwner" IS NOT NULL OR "nextPollAt" IS NULL OR "nextPollAt" <= ${NOW})
         RETURNING *`,
        [args.owner, args.ttlMs, force, args.cadenceMs, args.agentId, args.providerId, args.id, force],
        'claim signal subscription',
      );
      const row = result.rows[0];
      return row ? toRecord(row) : null;
    });
  }

  async renewSubscriptionClaimIfEnabled(
    args: SignalSubscriptionRowRef & { owner: string; ttlMs: number },
  ): Promise<boolean> {
    return this.#run('RENEW_CLAIM', async () => {
      const result = await this.#write(
        `UPDATE ${S} SET "claimExpiresAt" = ${NOW} + ?
         WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND "enabled" = 1 AND "claimOwner" = ? AND "claimExpiresAt" > ${NOW}
           AND ("operationOwner" IS NULL OR "operationExpiresAt" <= ${NOW})`,
        [args.ttlMs, args.agentId, args.providerId, args.id, args.owner],
        'renew signal subscription claim',
      );
      return result.rowsAffected === 1;
    });
  }

  async validateSubscriptionClaimIfEnabled(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean> {
    return this.#run('VALIDATE_CLAIM', async () => {
      const result = await this.#read(
        `SELECT COUNT(*) AS "count" FROM ${S}
         WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND "enabled" = 1 AND "claimOwner" = ? AND "claimExpiresAt" > ${NOW}
           AND ("operationOwner" IS NULL OR "operationExpiresAt" <= ${NOW})`,
        [args.agentId, args.providerId, args.id, args.owner],
      );
      return Number(result.rows[0]?.count) === 1;
    });
  }

  async releaseSubscriptionClaim(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean> {
    return this.#run('RELEASE_CLAIM', async () => {
      const result = await this.#write(
        `UPDATE ${S} SET "claimOwner" = NULL, "claimExpiresAt" = NULL WHERE "agentId" = ? AND "providerId" = ? AND "id" = ? AND "claimOwner" = ?`,
        [args.agentId, args.providerId, args.id, args.owner],
        'release signal subscription claim',
      );
      return result.rowsAffected === 1;
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
    return this.#run('CLAIM_DOCUMENT_OWNER', async () => {
      const [, claimed] = await this.#batch(
        [
          {
            sql: `INSERT INTO ${C} ("kind", "key", "agentId", "providerId", "resourceId", "threadId", "fencingToken", "createdAt")
         SELECT 'owner', ?, ?, ?, ?, ?, ?, ${NOW}
         WHERE NOT EXISTS (
           SELECT 1 FROM ${C} o
           WHERE o."kind" = 'owner' AND o."providerId" = ? AND o."resourceId" = ? AND o."threadId" = ?
         )
         ON CONFLICT ("kind", "key") DO NOTHING`,
            args: [
              args.key,
              args.agentId,
              args.providerId,
              args.resourceId,
              args.threadId,
              crypto.randomUUID(),
              args.providerId,
              args.resourceId,
              args.threadId,
            ],
          },
          { sql: `SELECT * FROM ${C} WHERE "kind" = 'owner' AND "key" = ?`, args: [args.key] },
        ],
        'claim signal subscription document owner',
      );
      const row = claimed?.rows[0];
      if (!row) return null;
      const owner = toOwner(row);
      const same =
        owner.agentId === args.agentId &&
        owner.providerId === args.providerId &&
        owner.resourceId === args.resourceId &&
        owner.threadId === args.threadId;
      return same ? owner : null;
    });
  }

  async releaseDocumentOwner(args: {
    key: string;
    agentId: string;
    providerId: string;
    fencingToken: string;
  }): Promise<boolean> {
    return this.#run('RELEASE_DOCUMENT_OWNER', async () => {
      const result = await this.#write(
        `DELETE FROM ${C}
         WHERE "kind" = 'owner' AND "key" = ? AND "agentId" = ? AND "providerId" = ? AND "fencingToken" = ?
           AND NOT EXISTS (
             SELECT 1 FROM ${S} s
             WHERE s."providerId" = ${C}."providerId" AND s."resourceId" = ${C}."resourceId" AND s."threadId" = ${C}."threadId"
           )`,
        [args.key, args.agentId, args.providerId, args.fencingToken],
        'release signal subscription document owner',
      );
      return result.rowsAffected === 1;
    });
  }

  async listDocumentOwners(
    args: ListSignalSubscriptionDocumentOwnersInput,
  ): Promise<ListSignalSubscriptionDocumentOwnersResult> {
    return this.#run('LIST_DOCUMENT_OWNERS', async () => {
      const clauses = [`"kind" = 'owner'`];
      const values: InValue[] = [];
      for (const key of ['agentId', 'providerId', 'resourceId', 'threadId'] as const) {
        if (args[key] !== undefined) {
          clauses.push(`"${key}" = ?`);
          values.push(args[key]);
        }
      }
      const paging = pageSql(args.limit, args.offset);
      const result = await this.#read(
        `WITH filtered AS (SELECT * FROM ${C} WHERE ${clauses.join(' AND ')}),
              total AS (SELECT COUNT(*) AS "total" FROM filtered),
              page AS (SELECT * FROM filtered ORDER BY "createdAt" ASC, "key" ASC ${paging.sql})
         SELECT total."total" AS "__total", page."key" AS "key", page."agentId" AS "agentId",
                page."providerId" AS "providerId", page."resourceId" AS "resourceId", page."threadId" AS "threadId",
                page."fencingToken" AS "fencingToken", page."createdAt" AS "createdAt"
         FROM total LEFT JOIN page ON 1 = 1
         ORDER BY page."createdAt" ASC, page."key" ASC`,
        [...values, ...paging.args],
      );
      const total = Number(result.rows[0]?.__total ?? 0);
      const owners = result.rows.filter(row => row.key !== null && row.key !== undefined).map(toOwner);
      return { owners, total };
    });
  }

  // ---------------------------------------------------------------------------
  // Coordination locks
  // ---------------------------------------------------------------------------

  async claimCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean> {
    return this.#run('CLAIM_LOCK', async () => {
      const result = await this.#write(
        `INSERT INTO ${C} ("kind", "key", "owner", "expiresAt", "createdAt")
         VALUES ('lock', ?, ?, ${NOW} + ?, ${NOW})
         ON CONFLICT ("kind", "key") DO UPDATE SET "owner" = excluded."owner", "expiresAt" = excluded."expiresAt"
         WHERE ${C}."expiresAt" <= ${NOW}
         RETURNING "owner"`,
        [args.key, args.owner, args.ttlMs],
        'claim signal subscription coordination lock',
      );
      return result.rows.length === 1;
    });
  }

  async renewCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean> {
    return this.#run('RENEW_LOCK', async () => {
      const result = await this.#write(
        `UPDATE ${C} SET "expiresAt" = ${NOW} + ?
         WHERE "kind" = 'lock' AND "key" = ? AND "owner" = ? AND "expiresAt" > ${NOW}`,
        [args.ttlMs, args.key, args.owner],
        'renew signal subscription coordination lock',
      );
      return result.rowsAffected === 1;
    });
  }

  async releaseCoordinationLock(args: { key: string; owner: string }): Promise<boolean> {
    return this.#run('RELEASE_LOCK', async () => {
      const result = await this.#write(
        `DELETE FROM ${C} WHERE "kind" = 'lock' AND "key" = ? AND "owner" = ?`,
        [args.key, args.owner],
        'release signal subscription coordination lock',
      );
      return result.rowsAffected === 1;
    });
  }

  // ---------------------------------------------------------------------------
  // Delivery ledger
  // ---------------------------------------------------------------------------

  async claimDelivery(
    args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number },
  ): Promise<ClaimSignalSubscriptionDeliveryResult> {
    return this.#run('CLAIM_DELIVERY', async () => {
      // One atomic batch, so the status read and the existence check see the
      // same state as the claim attempt.
      const [claimed, state] = await this.#batch(
        [
          {
            sql: `INSERT INTO ${D} ("subscriptionId", "deliveryId", "status", "owner", "expiresAt", "createdAt")
                  SELECT ?, ?, 'pending', ?, ${NOW} + ?, ${NOW}
                  WHERE EXISTS (SELECT 1 FROM ${S} WHERE "id" = ?)
                  ON CONFLICT ("subscriptionId", "deliveryId") DO UPDATE SET "owner" = excluded."owner", "expiresAt" = excluded."expiresAt"
                  WHERE ${D}."status" = 'pending' AND ${D}."expiresAt" <= ${NOW}
                  RETURNING "owner"`,
            args: [args.subscriptionId, args.deliveryId, args.owner, args.ttlMs, args.subscriptionId],
          },
          {
            sql: `SELECT EXISTS (SELECT 1 FROM ${S} WHERE "id" = ?) AS "subscriptionExists",
                         (SELECT "status" FROM ${D} WHERE "subscriptionId" = ? AND "deliveryId" = ?) AS "status"`,
            args: [args.subscriptionId, args.subscriptionId, args.deliveryId],
          },
        ],
        'claim signal subscription delivery',
      );
      if (claimed?.rows.length === 1) return 'claimed';
      const row = state?.rows[0];
      if (Number(row?.subscriptionExists) !== 1) return 'missing';
      return row?.status === 'delivered' ? 'delivered' : 'in-progress';
    });
  }

  async renewDeliveryClaim(args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number }): Promise<boolean> {
    return this.#run('RENEW_DELIVERY', async () => {
      const result = await this.#write(
        `UPDATE ${D} SET "expiresAt" = ${NOW} + ?
         WHERE "subscriptionId" = ? AND "deliveryId" = ? AND "status" = 'pending' AND "owner" = ? AND "expiresAt" > ${NOW}`,
        [args.ttlMs, args.subscriptionId, args.deliveryId, args.owner],
        'renew signal subscription delivery',
      );
      return result.rowsAffected === 1;
    });
  }

  async completeDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean> {
    return this.#run('COMPLETE_DELIVERY', async () => {
      const result = await this.#write(
        `UPDATE ${D} SET "status" = 'delivered', "owner" = NULL, "expiresAt" = NULL, "deliveredAt" = ${NOW}
         WHERE "subscriptionId" = ? AND "deliveryId" = ? AND "status" = 'pending' AND "owner" = ?`,
        [args.subscriptionId, args.deliveryId, args.owner],
        'complete signal subscription delivery',
      );
      return result.rowsAffected === 1;
    });
  }

  async releaseDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean> {
    return this.#run('RELEASE_DELIVERY', async () => {
      const result = await this.#write(
        `DELETE FROM ${D} WHERE "subscriptionId" = ? AND "deliveryId" = ? AND "status" = 'pending' AND "owner" = ?`,
        [args.subscriptionId, args.deliveryId, args.owner],
        'release signal subscription delivery',
      );
      return result.rowsAffected === 1;
    });
  }

  async getDelivery(args: SignalSubscriptionDeliveryRef): Promise<SignalSubscriptionDelivery | null> {
    return this.#run('GET_DELIVERY', async () => {
      const result = await this.#read(`SELECT * FROM ${D} WHERE "subscriptionId" = ? AND "deliveryId" = ?`, [
        args.subscriptionId,
        args.deliveryId,
      ]);
      const row = result.rows[0];
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
