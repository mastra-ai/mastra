import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ThreadStateStorage, createStorageErrorId, TABLE_THREAD_STATE, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
  TABLE_NAMES,
} from '@mastra/core/storage';

import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { runPrune, resolveTargets } from '../../retention';
import { getSchemaName, getTableName } from '../utils';

const COMPOSITE_PRIMARY_KEY = ['threadId', 'type'];

/**
 * PostgreSQL implementation of {@link ThreadStateStorage}.
 *
 * Stores per-thread, per-type state in `mastra_thread_state`, keyed by the
 * composite primary key `(threadId, type)`. The `value` column is `jsonb`, so
 * payloads (the task list for `type = 'task'`, the goal objective for
 * `type = 'goal'`) come back already parsed.
 */
export class ThreadStatePG extends ThreadStateStorage {
  #db: PgDB;
  #schema: string;

  static readonly MANAGED_TABLES = [TABLE_THREAD_STATE] as const;

  /**
   * `thread_state` grows as a side effect of thread activity (one row per
   * thread per state type). It anchors on `updatedAtZ` (last activity), so
   * state for a thread that is still being written to is not pruned by
   * creation age.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    threadState: { table: TABLE_THREAD_STATE, column: 'updatedAtZ', indexed: true },
  };

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
  }

  static getExportDDL(schemaName?: string): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_THREAD_STATE,
        schema: TABLE_SCHEMAS[TABLE_THREAD_STATE],
        schemaName,
        compositePrimaryKey: COMPOSITE_PRIMARY_KEY,
        includeAllConstraints: true,
      }),
    ];
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_THREAD_STATE,
      schema: TABLE_SCHEMAS[TABLE_THREAD_STATE],
      compositePrimaryKey: COMPOSITE_PRIMARY_KEY,
    });
  }

  get #table(): string {
    return getTableName({ indexName: TABLE_THREAD_STATE, schemaName: getSchemaName(this.#schema) });
  }

  /**
   * Create the retention index on demand, mirroring the other PG domains: only
   * deployments that configure retention pay for the extra index. Best-effort —
   * a failure here leaves pruning correct, just slower.
   */
  async #ensureRetentionIndexes(policies: Record<string, TableRetentionPolicy>): Promise<void> {
    const prefix = this.#schema && this.#schema !== 'public' ? `${this.#schema}_` : '';
    for (const [key, entry] of Object.entries(ThreadStatePG.retentionTables)) {
      if (!entry.indexed || !policies[key]) continue;
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

  /** Delete thread state older than the `threadState` policy's `maxAge`, batched. */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    await this.#ensureRetentionIndexes(policies);
    const targets = resolveTargets({
      policies,
      descriptor: ThreadStatePG.retentionTables,
      order: ['threadState'],
    });
    return runPrune({ db: this.#db, domain: 'threadState', targets, options });
  }

  async dangerouslyClearAll(): Promise<void> {
    try {
      await this.#db.client.none(`DELETE FROM ${this.#table}`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'THREAD_STATE_CLEAR_ALL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getState<T = unknown>({ threadId, type }: { threadId: string; type: string }): Promise<T | undefined> {
    try {
      const row = await this.#db.client.oneOrNone<{ value: unknown }>(
        `SELECT "value" FROM ${this.#table} WHERE "threadId" = $1 AND "type" = $2 LIMIT 1`,
        [threadId, type],
      );
      if (!row || row.value === null || row.value === undefined) return undefined;
      // jsonb comes back parsed; a string column (or a driver that hands back
      // raw text) still needs a parse.
      return (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) as T;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'THREAD_STATE_GET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, type },
        },
        error,
      );
    }
  }

  async setState<T = unknown>({ threadId, type, value }: { threadId: string; type: string; value: T }): Promise<void> {
    const now = new Date().toISOString();
    const serialized = JSON.stringify(value ?? null);
    try {
      // Single-statement upsert: concurrent writers to the same slot resolve on
      // the primary key rather than racing a read-then-write. `createdAt` is
      // left untouched on conflict so it keeps meaning "first written".
      await this.#db.client.none(
        `INSERT INTO ${this.#table} ("threadId", "type", "value", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
         VALUES ($1, $2, $3::jsonb, $4::timestamp, $5::timestamptz, $4::timestamp, $5::timestamptz)
         ON CONFLICT ("threadId", "type")
         DO UPDATE SET "value" = EXCLUDED."value",
                       "updatedAt" = EXCLUDED."updatedAt",
                       "updatedAtZ" = EXCLUDED."updatedAtZ"`,
        // `now` is bound twice because the naive and timezone-aware mirror
        // columns deduce different parameter types from a shared placeholder.
        [threadId, type, serialized, now, now],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'THREAD_STATE_SET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, type },
        },
        error,
      );
    }
  }

  async deleteState({ threadId, type }: { threadId: string; type: string }): Promise<void> {
    try {
      await this.#db.client.none(`DELETE FROM ${this.#table} WHERE "threadId" = $1 AND "type" = $2`, [threadId, type]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'THREAD_STATE_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, type },
        },
        error,
      );
    }
  }
}
