import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  TABLE_SCHEMAS,
  TABLE_THREAD_STATE,
  ThreadStateStorage,
  createStorageErrorId,
  encodeThreadStateScope,
} from '@mastra/core/storage';
import type {
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
  ThreadStateKey,
  ThreadStateMutation,
} from '@mastra/core/storage';

import type { DbClient, TxClient } from '../../client';
import { PgDB, generateTableSQL, getSchemaName, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { resolveTargets, runPrune } from '../../retention';

type ThreadStateRow = { value: unknown };

/** PostgreSQL implementation of the durable per-resource thread-state domain. */
export class ThreadStatePG extends ThreadStateStorage {
  static readonly MANAGED_TABLES = [TABLE_THREAD_STATE] as const;

  static override readonly retentionTables: RetentionTablesDescriptor = {
    threadState: { table: TABLE_THREAD_STATE, column: 'updatedAtZ', indexed: true },
  };

  readonly #db: PgDB;
  readonly #client: DbClient;
  readonly #schema: string;

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, disableInit, skipDefaultIndexes } = resolvePgConfig(config);
    this.#client = client;
    this.#schema = schemaName || 'public';
    this.#db = new PgDB({ client, readClient, schemaName, disableInit, skipDefaultIndexes });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_THREAD_STATE,
      schema: TABLE_SCHEMAS[TABLE_THREAD_STATE],
      compositePrimaryKey: ['threadId', 'type'],
    });
  }

  static getExportDDL(schemaName?: string): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_THREAD_STATE,
        schema: TABLE_SCHEMAS[TABLE_THREAD_STATE],
        schemaName,
        compositePrimaryKey: ['threadId', 'type'],
        includeAllConstraints: true,
      }),
    ];
  }

  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    if (policies.threadState) {
      try {
        const prefix = this.#schema === 'public' ? '' : `${this.#schema}_`;
        await this.#db.ensureIndex({
          indexName: `${prefix}mastra_thread_state_retention_idx`,
          tableName: TABLE_THREAD_STATE,
          column: 'updatedAtZ',
        });
      } catch (error) {
        if (this.#db.isExternalSchemaMode()) throw error;
        this.logger?.warn?.(`Failed to create retention index for ${TABLE_THREAD_STATE}:`, error);
      }
    }
    const targets = resolveTargets({
      policies,
      descriptor: ThreadStatePG.retentionTables,
      order: ['threadState'],
    });
    return runPrune({ db: this.#db, domain: 'threadState', targets, options });
  }

  async getState<T = unknown>(args: ThreadStateKey): Promise<T | undefined> {
    try {
      const row = await this.#client.oneOrNone<ThreadStateRow>(
        `SELECT "value" FROM ${this.#table()} WHERE "threadId" = $1 AND "type" = $2 LIMIT 1`,
        [encodeThreadStateScope(args), args.type],
      );
      // node-postgres decodes jsonb before returning the row. A JSON string
      // scalar is therefore already the intended JavaScript string and must
      // not be parsed a second time.
      return row === null ? undefined : (row.value as T);
    } catch (error) {
      throw this.#storageError('THREAD_STATE_GET', args, error);
    }
  }

  async setState<T = unknown>(args: ThreadStateKey & { value: T }): Promise<void> {
    try {
      await this.#set(this.#client, args, args.value);
    } catch (error) {
      throw this.#storageError('THREAD_STATE_SET', args, error);
    }
  }

  async deleteState(args: ThreadStateKey): Promise<void> {
    try {
      await this.#client.none(`DELETE FROM ${this.#table()} WHERE "threadId" = $1 AND "type" = $2`, [
        encodeThreadStateScope(args),
        args.type,
      ]);
    } catch (error) {
      throw this.#storageError('THREAD_STATE_DELETE', args, error);
    }
  }

  override async mutateState<T = unknown, TResult = void>(
    args: ThreadStateKey & {
      mutate: (current: T | undefined) => ThreadStateMutation<T, TResult>;
    },
  ): Promise<TResult> {
    try {
      return await this.#client.tx(async tx => {
        const scopedThreadId = encodeThreadStateScope(args);
        const lockIdentity = `${scopedThreadId.length}:${scopedThreadId}${args.type.length}:${args.type}`;
        // A missing row cannot be protected by SELECT FOR UPDATE. A transaction
        // advisory lock serializes both first-writer inserts and later updates
        // across every process using this PostgreSQL database.
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockIdentity]);
        const row = await tx.oneOrNone<ThreadStateRow>(
          `SELECT "value" FROM ${this.#table()} WHERE "threadId" = $1 AND "type" = $2 FOR UPDATE`,
          [scopedThreadId, args.type],
        );
        const mutation = args.mutate(row === null ? undefined : (row.value as T));
        if (mutation.operation === 'set') {
          await this.#set(tx, args, mutation.value);
        } else if (mutation.operation === 'delete') {
          await tx.none(`DELETE FROM ${this.#table()} WHERE "threadId" = $1 AND "type" = $2`, [
            scopedThreadId,
            args.type,
          ]);
        }
        return mutation.result;
      });
    } catch (error) {
      throw this.#storageError('THREAD_STATE_MUTATE', args, error);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    try {
      await this.#db.clearTable({ tableName: TABLE_THREAD_STATE });
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

  async #set<T>(client: Pick<DbClient, 'none'> | Pick<TxClient, 'none'>, args: ThreadStateKey, value: T) {
    await client.none(
      `INSERT INTO ${this.#table()} (
         "threadId", "type", "value", "createdAt", "updatedAt", "createdAtZ", "updatedAtZ"
       )
       VALUES ($1, $2, $3::jsonb, NOW(), NOW(), NOW(), NOW())
       ON CONFLICT ("threadId", "type")
       DO UPDATE SET
         "value" = EXCLUDED."value",
         "updatedAt" = EXCLUDED."updatedAt",
         "updatedAtZ" = EXCLUDED."updatedAtZ"`,
      [encodeThreadStateScope(args), args.type, JSON.stringify(value ?? null)],
    );
  }

  #table(): string {
    return `${getSchemaName(this.#schema)}."${TABLE_THREAD_STATE}"`;
  }

  #storageError(operation: string, args: ThreadStateKey, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('PG', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        // State values can contain model/user data. Only key identity is safe
        // for diagnostics; never attach the current or proposed value.
        details: { resourceId: args.resourceId, threadId: args.threadId, type: args.type },
      },
      error,
    );
  }
}
