import type { Client } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ThreadStateStorage,
  createStorageErrorId,
  TABLE_THREAD_STATE,
  THREAD_STATE_SCHEMA,
} from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { createExecuteWriteOperationWithRetry } from '../../db/utils';
import { withClientWriteLock } from '../../db/write-lock';

/**
 * LibSQL implementation of {@link ThreadStateStorage}.
 *
 * Stores per-thread, per-type state in `mastra_thread_state`, keyed by the
 * composite primary key `(threadId, type)`. The `value` column holds the JSON
 * payload (e.g. the task list for `type = 'task'`).
 */
export class ThreadStateLibSQL extends ThreadStateStorage {
  #db: LibSQLDB;
  #client: Client;
  private readonly executeWithRetry: <T>(operationFn: () => Promise<T>, operationDescription: string) => Promise<T>;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    const maxRetries = config.maxRetries ?? 5;
    const initialBackoffMs = config.initialBackoffMs ?? 100;

    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries, initialBackoffMs });
    this.executeWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries,
      initialBackoffMs,
    });

    // Set PRAGMA settings to help with database locks
    // Note: This is async but we can't await in constructor, so we'll handle it as a fire-and-forget
    this.setupPragmaSettings().catch(err =>
      this.logger.warn('LibSQL ThreadState: Failed to setup PRAGMA settings.', err),
    );
  }

  private async setupPragmaSettings() {
    try {
      // Set busy timeout to wait longer before returning busy errors
      await this.#client.execute('PRAGMA busy_timeout = 10000;');
      this.logger.debug('LibSQL ThreadState: PRAGMA busy_timeout=10000 set.');

      // Enable WAL mode for better concurrency (if supported)
      try {
        await this.#client.execute('PRAGMA journal_mode = WAL;');
        this.logger.debug('LibSQL ThreadState: PRAGMA journal_mode=WAL set.');
      } catch {
        this.logger.debug('LibSQL ThreadState: WAL mode not supported, using default journal mode.');
      }

      // Set synchronous mode for better durability vs performance trade-off
      try {
        await this.#client.execute('PRAGMA synchronous = NORMAL;');
        this.logger.debug('LibSQL ThreadState: PRAGMA synchronous=NORMAL set.');
      } catch {
        this.logger.debug('LibSQL ThreadState: Failed to set synchronous mode.');
      }
    } catch (err) {
      this.logger.warn('LibSQL ThreadState: Failed to set PRAGMA settings.', err);
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_THREAD_STATE,
      schema: THREAD_STATE_SCHEMA,
      compositePrimaryKey: ['threadId', 'type'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    try {
      await this.#db.deleteData({ tableName: TABLE_THREAD_STATE });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'THREAD_STATE_CLEAR_ALL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getState<T = unknown>({ threadId, type }: { threadId: string; type: string }): Promise<T | undefined> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT "value" FROM "${TABLE_THREAD_STATE}" WHERE "threadId" = ? AND "type" = ? LIMIT 1`,
        args: [threadId, type],
      });
      const raw = result.rows?.[0]?.value;
      if (raw === undefined || raw === null) return undefined;
      return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'THREAD_STATE_GET', 'FAILED'),
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
      await this.executeWithRetry(
        () =>
          withClientWriteLock(this.#client, () =>
            this.#client.execute({
              sql: `INSERT INTO "${TABLE_THREAD_STATE}" ("threadId", "type", "value", "createdAt", "updatedAt")
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT ("threadId", "type")
                    DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"`,
              args: [threadId, type, serialized, now, now],
            }),
          ),
        'setState',
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'THREAD_STATE_SET', 'FAILED'),
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
      await this.executeWithRetry(
        () =>
          withClientWriteLock(this.#client, () =>
            this.#client.execute({
              sql: `DELETE FROM "${TABLE_THREAD_STATE}" WHERE "threadId" = ? AND "type" = ?`,
              args: [threadId, type],
            }),
          ),
        'deleteState',
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'THREAD_STATE_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId, type },
        },
        error,
      );
    }
  }
}
