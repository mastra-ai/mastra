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

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
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
      await this.#client.execute(`DELETE FROM "${TABLE_THREAD_STATE}"`);
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
      await this.#client.execute({
        sql: `INSERT INTO "${TABLE_THREAD_STATE}" ("threadId", "type", "value", "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT ("threadId", "type")
              DO UPDATE SET "value" = excluded."value", "updatedAt" = excluded."updatedAt"`,
        args: [threadId, type, serialized, now, now],
      });
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
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_THREAD_STATE}" WHERE "threadId" = ? AND "type" = ?`,
        args: [threadId, type],
      });
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
