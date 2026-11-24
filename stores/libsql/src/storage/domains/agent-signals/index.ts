import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AGENT_SIGNALS_TABLE_CONFIGS,
  AgentSignalsStorage,
  createStorageErrorId,
  TABLE_AGENT_SIGNAL_RUNS,
  TABLE_AGENT_SIGNALS,
} from '@mastra/core/storage';
import type {
  AgentSignalClaimArgs,
  AgentSignalScope,
  AgentSignalWriteResult,
  StoredAgentSignal,
  StoredAgentSignalPayload,
  TABLE_NAMES,
} from '@mastra/core/storage';

import { isSingleConnectionDatabase } from '../../../shared/single-connection-client';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { isRemoteClient } from '../../db/client';
import type { SqliteClient as Client, SqliteTransaction, SqliteValue } from '../../db/client';
import { inWriteTransaction } from '../../db/run-fencing';
import { withClientWriteLock } from '../../db/write-lock';

const SIGNALS = `"${TABLE_AGENT_SIGNALS}"`;
const RUNS = `"${TABLE_AGENT_SIGNAL_RUNS}"`;

/** Ids per statement, well under SQLite's bound-parameter limit. */
const ID_BATCH_SIZE = 100;

/** ISO 8601 with milliseconds, on the database clock. */
const DB_NOW_ISO = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

const COLUMNS = `"id", "threadKey", "runId", "scope", "claimedBy", "signal", "createdAt"`;

/** Open runs of the thread other than the claiming one (args: threadKey, runId). */
const OTHER_OPEN_RUNS = `SELECT "runId" FROM ${RUNS} WHERE "threadKey" = ? AND "closedAt" IS NULL AND "runId" <> ?`;

/**
 * What the domain can tell from its own config: a `url` names an in-memory
 * database, and a raw client reports its protocol. `LibSQLStore` sees the whole
 * connection config, including embedded replicas, and passes the value in.
 * Unknown cases fall back to `false`, which only makes senders in other
 * processes forward instead of inserting.
 */
function sharesRowsAcrossProcesses(config: LibSQLDomainConfig): boolean {
  if (config.sharedAcrossProcesses !== undefined) return config.sharedAcrossProcesses;
  if (config.embeddedReplica) return false;
  if ('url' in config) return !isSingleConnectionDatabase({ url: config.url });
  return isRemoteClient(config.client);
}

function chunks(ids: string[]): string[][] {
  const unique = [...new Set(ids)];
  const result: string[][] = [];
  for (let i = 0; i < unique.length; i += ID_BATCH_SIZE) result.push(unique.slice(i, i + ID_BATCH_SIZE));
  return result;
}

const placeholders = (ids: string[]) => ids.map(() => '?').join(', ');

function toStored(row: Record<string, SqliteValue>): StoredAgentSignal {
  return {
    id: String(row.id),
    threadKey: String(row.threadKey),
    runId: row.runId === null ? null : String(row.runId),
    scope: row.scope as AgentSignalScope,
    claimedBy: row.claimedBy === null ? null : String(row.claimedBy),
    signal: JSON.parse(String(row.signal)) as StoredAgentSignalPayload,
    createdAt: new Date(String(row.createdAt)),
  };
}

/**
 * LibSQL implementation of {@link AgentSignalsStorage}.
 *
 * Every method that writes runs in one transaction opened with
 * `BEGIN IMMEDIATE`, which takes the database's write lock before the first
 * read. All writes to the database are therefore serialized, which covers the
 * per-run serialization the contract asks for, including a takeover across
 * every run of the thread. `seq` is assigned inside that transaction as one
 * more than the highest stored value, so it follows commit order.
 */
export class AgentSignalsLibSQL extends AgentSignalsStorage {
  #db: LibSQLDB;
  #client: Client;
  #sharedAcrossProcesses: boolean;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#sharedAcrossProcesses = sharesRowsAcrossProcesses(config);
    this.#db = new LibSQLDB({
      client,
      maxRetries: config.maxRetries,
      initialBackoffMs: config.initialBackoffMs,
      getLogger: () => this.logger,
    });
  }

  override get sharedAcrossProcesses(): boolean {
    return this.#sharedAcrossProcesses;
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_AGENT_SIGNALS as TABLE_NAMES,
      schema: AGENT_SIGNALS_TABLE_CONFIGS[TABLE_AGENT_SIGNALS].columns,
    });
    await this.#db.createTable({
      tableName: TABLE_AGENT_SIGNAL_RUNS as TABLE_NAMES,
      schema: AGENT_SIGNALS_TABLE_CONFIGS[TABLE_AGENT_SIGNAL_RUNS].columns,
      compositePrimaryKey: AGENT_SIGNALS_TABLE_CONFIGS[TABLE_AGENT_SIGNAL_RUNS].compositePrimaryKey,
    });
    await withClientWriteLock(this.#client, () =>
      this.#client.batch(
        [
          `CREATE INDEX IF NOT EXISTS idx_agent_signals_thread_run_scope ON ${SIGNALS} ("threadKey", "runId", "scope")`,
          // Backs the next `seq`, which is one more than the highest.
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_signals_seq ON ${SIGNALS} ("seq")`,
          // Backs a takeover's lookup of the thread's other open runs.
          `CREATE INDEX IF NOT EXISTS idx_agent_signal_runs_open ON ${RUNS} ("threadKey") WHERE "closedAt" IS NULL`,
        ].map(sql => ({ sql, args: [] })),
        'write',
      ),
    );
  }

  /** Runs `fn` in a write transaction; a lock error reruns the whole transaction. */
  #write<T>(
    operation: string,
    fn: (tx: SqliteTransaction) => Promise<T>,
    details?: Record<string, string>,
  ): Promise<T> {
    return this.#db
      .executeWriteOperationWithRetry(() => inWriteTransaction(this.#client, fn), `agentSignals ${operation}`)
      .catch(error => {
        throw this.#error(operation, error, details);
      });
  }

  #error(operation: string, error: unknown, details?: Record<string, string>): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('LIBSQL', `AGENT_SIGNALS_${operation}`, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details,
      },
      error,
    );
  }

  async #isClosed(tx: SqliteTransaction, threadKey: string, runId: string): Promise<boolean> {
    const { rows } = await tx.execute({
      sql: `SELECT "closedAt" FROM ${RUNS} WHERE "threadKey" = ? AND "runId" = ?`,
      args: [threadKey, runId],
    });
    return rows[0] !== undefined && rows[0].closedAt !== null;
  }

  async #markOpen(tx: SqliteTransaction, threadKey: string, runId: string): Promise<void> {
    await tx.execute({
      sql: `INSERT INTO ${RUNS} ("threadKey", "runId", "closedAt") VALUES (?, ?, NULL)
        ON CONFLICT ("threadKey", "runId") DO NOTHING`,
      args: [threadKey, runId],
    });
  }

  async #markClosed(tx: SqliteTransaction, threadKey: string, runId: string): Promise<void> {
    await tx.execute({
      sql: `INSERT INTO ${RUNS} ("threadKey", "runId", "closedAt") VALUES (?, ?, ${DB_NOW_ISO})
        ON CONFLICT ("threadKey", "runId") DO UPDATE SET "closedAt" = COALESCE(${RUNS}."closedAt", excluded."closedAt")`,
      args: [threadKey, runId],
    });
  }

  async enqueue(row: {
    id: string;
    threadKey: string;
    runId: string | null;
    scope: AgentSignalScope;
    signal: StoredAgentSignalPayload;
  }): Promise<AgentSignalWriteResult> {
    const { id, threadKey, runId, scope, signal } = row;
    const serialized = JSON.stringify(signal);
    return this.#write(
      'ENQUEUE',
      async tx => {
        if (runId !== null) {
          if (await this.#isClosed(tx, threadKey, runId)) return 'run-closed';
          await this.#markOpen(tx, threadKey, runId);
        }
        await tx.execute({
          sql: `INSERT INTO ${SIGNALS} ("id", "threadKey", "runId", "scope", "claimedBy", "signal", "seq", "createdAt")
            VALUES (?, ?, ?, ?, NULL, ?, COALESCE((SELECT MAX("seq") FROM ${SIGNALS}), 0) + 1, ${DB_NOW_ISO})
            ON CONFLICT ("id") DO NOTHING`,
          args: [id, threadKey, runId, scope, serialized],
        });
        return 'accepted';
      },
      { threadKey },
    );
  }

  async claim({ threadKey, runId, scope, leftovers }: AgentSignalClaimArgs): Promise<StoredAgentSignal[]> {
    return this.#write(
      'CLAIM',
      async tx => {
        if (await this.#isClosed(tx, threadKey, runId)) return [];
        await this.#markOpen(tx, threadKey, runId);

        if (leftovers) {
          await tx.execute({
            sql: `DELETE FROM ${SIGNALS} WHERE "threadKey" = ? AND "claimedBy" IS NOT NULL
              AND "runId" IN (${OTHER_OPEN_RUNS})`,
            args: [threadKey, threadKey, runId],
          });
          await tx.execute({
            sql: `UPDATE ${SIGNALS} SET "runId" = ?, "scope" = 'pre-run'
              WHERE "threadKey" = ? AND "claimedBy" IS NULL AND ("runId" IS NULL OR "runId" IN (${OTHER_OPEN_RUNS}))`,
            args: [runId, threadKey, threadKey, runId],
          });
          await tx.execute({
            sql: `UPDATE ${RUNS} SET "closedAt" = ${DB_NOW_ISO} WHERE "threadKey" = ? AND "closedAt" IS NULL AND "runId" <> ?`,
            args: [threadKey, runId],
          });
        }

        await tx.execute({
          sql: `UPDATE ${SIGNALS} SET "claimedBy" = ?
            WHERE "threadKey" = ? AND "runId" = ? AND "scope" = ? AND "claimedBy" IS NULL`,
          args: [runId, threadKey, runId, scope],
        });
        const { rows } = await tx.execute({
          sql: `SELECT ${COLUMNS} FROM ${SIGNALS}
            WHERE "threadKey" = ? AND "runId" = ? AND "scope" = ? AND "claimedBy" = ? ORDER BY "seq"`,
          args: [threadKey, runId, scope, runId],
        });
        return rows.map(toStored);
      },
      { threadKey, runId },
    );
  }

  async delete({ ids }: { ids: string[] }): Promise<void> {
    if (ids.length === 0) return;
    await this.#write('DELETE', async tx => {
      for (const batch of chunks(ids)) {
        await tx.execute({ sql: `DELETE FROM ${SIGNALS} WHERE "id" IN (${placeholders(batch)})`, args: batch });
      }
    });
  }

  async closeRun({
    threadKey,
    runId,
    consumedIds,
  }: {
    threadKey: string;
    runId: string;
    consumedIds: string[];
  }): Promise<void> {
    await this.#write(
      'CLOSE_RUN',
      async tx => {
        for (const batch of chunks(consumedIds)) {
          await tx.execute({
            sql: `DELETE FROM ${SIGNALS} WHERE "threadKey" = ? AND "runId" = ? AND "id" IN (${placeholders(batch)})`,
            args: [threadKey, runId, ...batch],
          });
        }
        await tx.execute({
          sql: `UPDATE ${SIGNALS} SET "runId" = NULL, "claimedBy" = NULL WHERE "threadKey" = ? AND "runId" = ?`,
          args: [threadKey, runId],
        });
        await this.#markClosed(tx, threadKey, runId);
      },
      { threadKey, runId },
    );
  }

  async cancel({ threadKey, ids }: { threadKey: string; ids: string[] }): Promise<string[]> {
    if (ids.length === 0) return [];
    return this.#write(
      'CANCEL',
      async tx => {
        const cancelled: string[] = [];
        for (const batch of chunks(ids)) {
          const { rows } = await tx.execute({
            sql: `DELETE FROM ${SIGNALS}
              WHERE "threadKey" = ? AND "claimedBy" IS NULL AND "id" IN (${placeholders(batch)}) RETURNING "id"`,
            args: [threadKey, ...batch],
          });
          for (const row of rows) cancelled.push(String(row.id));
        }
        return cancelled;
      },
      { threadKey },
    );
  }

  async readdress({
    threadKey,
    fromRunId,
    toRunId,
  }: {
    threadKey: string;
    fromRunId: string;
    toRunId: string;
  }): Promise<AgentSignalWriteResult> {
    return this.#write(
      'READDRESS',
      async tx => {
        const targetClosed = await this.#isClosed(tx, threadKey, toRunId);
        if (fromRunId === toRunId) return targetClosed ? 'run-closed' : 'accepted';
        if (targetClosed) {
          await tx.execute({
            sql: `DELETE FROM ${SIGNALS} WHERE "threadKey" = ? AND "runId" = ? AND "claimedBy" IS NULL`,
            args: [threadKey, fromRunId],
          });
        } else {
          await this.#markOpen(tx, threadKey, toRunId);
          await tx.execute({
            sql: `UPDATE ${SIGNALS} SET "runId" = ? WHERE "threadKey" = ? AND "runId" = ? AND "claimedBy" IS NULL`,
            args: [toRunId, threadKey, fromRunId],
          });
        }
        await this.#markClosed(tx, threadKey, fromRunId);
        return targetClosed ? 'run-closed' : 'accepted';
      },
      { threadKey, fromRunId, toRunId },
    );
  }

  async listPending({ threadKey, runId }: { threadKey: string; runId?: string | null }): Promise<StoredAgentSignal[]> {
    const filter = runId === undefined ? '' : runId === null ? 'AND "runId" IS NULL' : 'AND "runId" = ?';
    try {
      const { rows } = await this.#client.execute({
        sql: `SELECT ${COLUMNS} FROM ${SIGNALS} WHERE "threadKey" = ? AND "claimedBy" IS NULL ${filter} ORDER BY "seq"`,
        args: typeof runId === 'string' ? [threadKey, runId] : [threadKey],
      });
      return rows.map(toStored);
    } catch (error) {
      throw this.#error('LIST_PENDING', error, { threadKey });
    }
  }

  async deleteThread({ threadKey }: { threadKey: string }): Promise<void> {
    await this.#write(
      'DELETE_THREAD',
      async tx => {
        await tx.execute({ sql: `DELETE FROM ${SIGNALS} WHERE "threadKey" = ?`, args: [threadKey] });
        await tx.execute({ sql: `DELETE FROM ${RUNS} WHERE "threadKey" = ?`, args: [threadKey] });
      },
      { threadKey },
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#write('CLEAR_ALL', async tx => {
      await tx.execute(`DELETE FROM ${SIGNALS}`);
      await tx.execute(`DELETE FROM ${RUNS}`);
    });
  }
}
