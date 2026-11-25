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
  CreateIndexOptions,
  StoredAgentSignal,
  StoredAgentSignalPayload,
  TABLE_NAMES,
} from '@mastra/core/storage';

import { schemaNamePrefix } from '../../../shared/schema-name';
import type { TxClient } from '../../client';
import {
  PgDB,
  resolvePgConfig,
  generateIndexSQL,
  generateTableSQL,
  getSchemaName as getExportSchemaName,
  getTableName as getExportTableName,
} from '../../db';
import type { PgDomainConfig } from '../../db';
import type { Queryable } from '../../db/run-fencing';
import { toPgJson } from '../../db/sanitize-json';
import { getSchemaName, getTableName } from '../utils';

const SIGNALS_CONFIG = AGENT_SIGNALS_TABLE_CONFIGS[TABLE_AGENT_SIGNALS];
const RUNS_CONFIG = AGENT_SIGNALS_TABLE_CONFIGS[TABLE_AGENT_SIGNAL_RUNS];

/** Database clock as the naive UTC value the `timestamp` columns hold; their `Z` twins take `now()`. */
const NOW_UTC = `(now() AT TIME ZONE 'UTC')`;

const COLUMN_NAMES = ['id', 'threadKey', 'runId', 'scope', 'claimedBy', 'signal', 'createdAtZ'];
const COLUMNS = COLUMN_NAMES.map(name => `"${name}"`).join(', ');
const S_COLUMNS = COLUMN_NAMES.map(name => `s."${name}"`).join(', ');

type Row = {
  id: string;
  threadKey: string;
  runId: string | null;
  scope: AgentSignalScope;
  claimedBy: string | null;
  signal: StoredAgentSignalPayload | string;
  createdAtZ: Date;
};

function toStored(row: Row): StoredAgentSignal {
  return {
    id: row.id,
    threadKey: row.threadKey,
    runId: row.runId,
    scope: row.scope,
    claimedBy: row.claimedBy,
    signal: typeof row.signal === 'string' ? JSON.parse(row.signal) : row.signal,
    createdAt: new Date(row.createdAtZ),
  };
}

/** Run ids sorted the way every multi-marker lock takes them, so two calls cannot deadlock. */
const lockOrder = (runIds: string[]) => [...new Set(runIds)].sort();

/** Whether `seq` of the table named by `$1` is already an identity column. */
const SEQ_IDENTITY_CHECK = `SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass($1) AND attname = 'seq' AND attidentity <> ''`;

/** The `seq` identity, added after `CREATE TABLE` because the shared schema declares a plain column. */
function identitySQL(table: string): string {
  return `ALTER TABLE ${table} ALTER COLUMN "seq" ADD GENERATED ALWAYS AS IDENTITY`;
}

/**
 * PostgreSQL implementation of {@link AgentSignalsStorage}.
 *
 * Serialization comes from row locks on the run markers. `enqueue`, `claim`,
 * `readdress` and `closeRun` lock the markers of the runs they touch; calls
 * that lock several take them sorted by run id. Methods that must read signal
 * rows after taking a marker lock run in a transaction started at READ
 * COMMITTED, so the statements after the lock see every row committed before
 * it was granted.
 *
 * Every call takes its marker locks before any signal row lock, and locks all
 * the signal rows it touches in one statement, in `seq` order. Rows that a
 * later statement of the same transaction touches are already held. Two calls
 * therefore take shared locks in the same order and cannot deadlock, apart
 * from the marker recreation after a concurrent `deleteThread` described at
 * `#lockEnsuredRuns`.
 *
 * The single-statement methods run at the session's isolation level. Under a
 * stricter default they can fail with a serialization error, but cannot return
 * a wrong result.
 *
 * Payloads go through the store's JSON normalization: NUL characters are
 * dropped, lone surrogates are replaced, and `jsonb` does not keep key order.
 *
 * `seq` is an identity column. Its value is assigned before commit, so it
 * orders rows but is never used as a cursor.
 */
export class AgentSignalsPG extends AgentSignalsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_AGENT_SIGNALS, TABLE_AGENT_SIGNAL_RUNS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, readClient, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (AgentSignalsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}idx_agent_signals_run_scope`,
        table: TABLE_AGENT_SIGNALS,
        columns: ['threadKey', 'runId', 'scope'],
      },
      {
        // Backs a takeover's lookup of the thread's open runs.
        name: `${schemaPrefix}idx_agent_signal_runs_open`,
        table: TABLE_AGENT_SIGNAL_RUNS,
        columns: ['threadKey'],
        where: '"closedAt" IS NULL',
      },
    ];
  }

  static getExportDDL(schemaName?: string): string[] {
    const parsedSchema = schemaName ? schemaNamePrefix(schemaName) : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';
    // Qualified with the same helpers `generateTableSQL` uses, so it names the table the `CREATE TABLE`
    // above it creates, `"public"` included.
    const table = getExportTableName({ indexName: TABLE_AGENT_SIGNALS, schemaName: getExportSchemaName(schemaName) });
    return [
      generateTableSQL({
        tableName: TABLE_AGENT_SIGNALS as TABLE_NAMES,
        schema: SIGNALS_CONFIG.columns,
        schemaName,
        includeAllConstraints: true,
      }),
      `DO $$ BEGIN
  IF NOT EXISTS (${SEQ_IDENTITY_CHECK.replace('$1', `'${table}'`)}) THEN
    ${identitySQL(table)};
  END IF;
END $$;`,
      generateTableSQL({
        tableName: TABLE_AGENT_SIGNAL_RUNS as TABLE_NAMES,
        schema: RUNS_CONFIG.columns,
        schemaName,
        compositePrimaryKey: RUNS_CONFIG.compositePrimaryKey,
        includeAllConstraints: true,
      }),
      ...AgentSignalsPG.getDefaultIndexDefs(schemaPrefix).map(idx => generateIndexSQL(idx, schemaName)),
    ];
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${schemaNamePrefix(this.#schema)}_` : '';
    return AgentSignalsPG.getDefaultIndexDefs(schemaPrefix);
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_AGENT_SIGNALS as TABLE_NAMES, schema: SIGNALS_CONFIG.columns });
    await this.#ensureSeqIdentity();
    await this.#db.createTable({
      tableName: TABLE_AGENT_SIGNAL_RUNS as TABLE_NAMES,
      schema: RUNS_CONFIG.columns,
      compositePrimaryKey: RUNS_CONFIG.compositePrimaryKey,
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async #hasSeqIdentity(): Promise<boolean> {
    const row = await this.#db.client.oneOrNone<{ exists: boolean }>(
      `SELECT EXISTS (${SEQ_IDENTITY_CHECK}) AS exists`,
      [this.#signals],
    );
    return !!row?.exists;
  }

  /**
   * Checked before altering, so a converged schema needs no DDL privilege. A
   * concurrent init can add the identity between the check and the alter;
   * the second check accepts that.
   */
  async #ensureSeqIdentity(): Promise<void> {
    if (await this.#hasSeqIdentity()) return;
    try {
      await this.#db.client.none(identitySQL(this.#signals));
    } catch (error) {
      if (await this.#hasSeqIdentity()) return;
      throw this.#error('INIT', error);
    }
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

  get #signals(): string {
    return getTableName({ indexName: TABLE_AGENT_SIGNALS, schemaName: getSchemaName(this.#schema) });
  }

  get #runs(): string {
    return getTableName({ indexName: TABLE_AGENT_SIGNAL_RUNS, schemaName: getSchemaName(this.#schema) });
  }

  #error(operation: string, error: unknown, details?: Record<string, string>): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('PG', `AGENT_SIGNALS_${operation}`, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details,
      },
      error,
    );
  }

  async #run<T>(operation: string, details: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.#error(operation, error, details);
    }
  }

  /**
   * Creates the run's marker if it is missing and locks it until the end of the
   * transaction. `DO UPDATE` rather than `DO NOTHING` so the statement both
   * waits for and returns the latest committed marker.
   */
  #lockRun(threadKey: string, runId: string, closing: boolean): string {
    const closedAt = closing ? NOW_UTC : 'NULL';
    const closedAtZ = closing ? 'now()' : 'NULL';
    return `INSERT INTO ${this.#runs} AS r ("threadKey", "runId", "closedAt", "closedAtZ")
      VALUES (${threadKey}, ${runId}, ${closedAt}, ${closedAtZ})
      ON CONFLICT ("threadKey", "runId") DO UPDATE SET ${
        closing
          ? `"closedAt" = COALESCE(r."closedAt", EXCLUDED."closedAt"), "closedAtZ" = COALESCE(r."closedAtZ", EXCLUDED."closedAtZ")`
          : `"threadKey" = r."threadKey"`
      }
      RETURNING r."closedAt" IS NOT NULL AS closed`;
  }

  /**
   * Creates missing markers open, committed on their own so a later lock never waits on an
   * uncommitted insert. Its own READ COMMITTED transaction, because under a stricter session level
   * a conflict with a marker updated meanwhile is a serialization error rather than a no-op.
   */
  async #ensureRuns(threadKey: string, runIds: string[]): Promise<void> {
    const ordered = lockOrder(runIds);
    await this.#tx(t =>
      t.none(
        `INSERT INTO ${this.#runs} ("threadKey", "runId", "closedAt", "closedAtZ")
       SELECT $1, id, NULL, NULL FROM unnest($2::text[]) WITH ORDINALITY AS ids(id, n) ORDER BY n
       ON CONFLICT ("threadKey", "runId") DO NOTHING`,
        [threadKey, ordered],
      ),
    );
  }

  /** Locks existing markers in run id order and returns whether each is closed. */
  async #lockRuns(t: Queryable, threadKey: string, where: string, args: unknown[]): Promise<Map<string, boolean>> {
    const rows = await t.manyOrNone<{ runId: string; closed: boolean }>(
      `SELECT "runId", "closedAt" IS NOT NULL AS closed FROM ${this.#runs}
       WHERE "threadKey" = $1 AND (${where}) ORDER BY "runId" FOR UPDATE`,
      [threadKey, ...args],
    );
    return new Map(rows.map(row => [row.runId, row.closed]));
  }

  /** Each statement after a lock wait must see what committed before the lock was granted. */
  async #tx<T>(fn: (t: TxClient) => Promise<T>): Promise<T> {
    return this.#db.client.tx(fn, { isolationLevel: 'read committed' });
  }

  /**
   * Locks markers an earlier `#ensureRuns` created, creating again (open) any that a concurrent
   * `deleteThread` removed in between. A marker created here is new to every other transaction,
   * so taking it after the sorted ones does not reorder locks anyone else waits on, unless another
   * call recreates the same marker at the same moment.
   */
  async #lockEnsuredRuns(
    t: Queryable,
    threadKey: string,
    where: string,
    args: unknown[],
    expected: string[],
  ): Promise<Map<string, boolean>> {
    const locked = await this.#lockRuns(t, threadKey, where, args);
    for (const runId of lockOrder(expected)) {
      if (locked.has(runId)) continue;
      const { closed } = await t.one<{ closed: boolean }>(this.#lockRun('$1', '$2', false), [threadKey, runId]);
      locked.set(runId, closed);
    }
    return locked;
  }

  async enqueue(row: {
    id: string;
    threadKey: string;
    runId: string | null;
    scope: AgentSignalScope;
    signal: StoredAgentSignalPayload;
  }): Promise<AgentSignalWriteResult> {
    const { id, threadKey, runId, scope, signal } = row;
    const insert = `INSERT INTO ${this.#signals} ("id", "threadKey", "runId", "scope", "claimedBy", "signal", "createdAt", "createdAtZ")`;
    return this.#run('ENQUEUE', { threadKey }, async () => {
      if (runId === null) {
        await this.#db.client.none(
          `${insert} VALUES ($1, $2, NULL, $3, NULL, $4::jsonb, ${NOW_UTC}, now()) ON CONFLICT ("id") DO NOTHING`,
          [id, threadKey, scope, toPgJson(signal)],
        );
        return 'accepted';
      }
      // One statement: the marker upsert waits for the run's lock and returns its latest state, and the
      // insert depends on nothing else.
      const result = await this.#db.client.one<{ closed: boolean }>(
        `WITH run AS (${this.#lockRun('$2', '$3', false)}),
         inserted AS (
           ${insert}
           SELECT $1, $2, $3, $4, NULL, $5::jsonb, ${NOW_UTC}, now() FROM run WHERE NOT run.closed
           ON CONFLICT ("id") DO NOTHING
         )
         SELECT closed FROM run`,
        [id, threadKey, runId, scope, toPgJson(signal)],
      );
      return result.closed ? 'run-closed' : 'accepted';
    });
  }

  /** Marks the run's unclaimed rows of `scope` claimed and returns every row of `scope` it has claimed. */
  async #claimRows(t: Queryable, threadKey: string, runId: string, scope: AgentSignalScope): Promise<Row[]> {
    return t.manyOrNone<Row>(
      `WITH locked AS (
         SELECT "id" FROM ${this.#signals}
         WHERE "threadKey" = $1 AND "runId" = $2 AND "scope" = $3 AND "claimedBy" IS NULL
         ORDER BY "seq" FOR UPDATE
       ), claimed AS (
         UPDATE ${this.#signals} s SET "claimedBy" = $2 FROM locked WHERE s."id" = locked."id"
         RETURNING s."seq", ${S_COLUMNS}
       )
       SELECT * FROM (
         SELECT "seq", ${COLUMNS} FROM ${this.#signals}
         WHERE "threadKey" = $1 AND "runId" = $2 AND "scope" = $3 AND "claimedBy" = $2
         UNION ALL
         SELECT * FROM claimed
       ) rows ORDER BY "seq"`,
      [threadKey, runId, scope],
    );
  }

  async claim({ threadKey, runId, scope, leftovers }: AgentSignalClaimArgs): Promise<StoredAgentSignal[]> {
    return this.#run('CLAIM', { threadKey, runId }, async () => {
      if (!leftovers) {
        const rows = await this.#tx(async t => {
          const { closed } = await t.one<{ closed: boolean }>(this.#lockRun('$1', '$2', false), [threadKey, runId]);
          return closed ? [] : this.#claimRows(t, threadKey, runId, scope);
        });
        return rows.map(toStored);
      }

      await this.#ensureRuns(threadKey, [runId]);
      const rows = await this.#tx(async t => {
        // The claiming run and every open run of the thread, locked together in run id order.
        const locked = await this.#lockEnsuredRuns(
          t,
          threadKey,
          `"runId" = $2 OR "closedAt" IS NULL`,
          [runId],
          [runId],
        );
        if (locked.get(runId)) return [];
        const others = [...locked.keys()].filter(id => id !== runId);

        // Runs that open after the lock above are not locked, so only the locked runs and the
        // leftovers are touched. The claimer's own unclaimed `pre-run` rows are locked in the same
        // pass, so the claim below waits for no row this transaction does not already hold.
        await t.none(
          `WITH locked AS (
             SELECT "id", "runId", "claimedBy" FROM ${this.#signals}
             WHERE "threadKey" = $1 AND (
               "runId" IS NULL OR "runId" = ANY($3::text[])
               OR ("runId" = $2 AND "scope" = 'pre-run' AND "claimedBy" IS NULL)
             )
             ORDER BY "seq" FOR UPDATE
           ), dropped AS (
             DELETE FROM ${this.#signals} s USING locked
             WHERE s."id" = locked."id" AND locked."claimedBy" IS NOT NULL
           ), moved AS (
             UPDATE ${this.#signals} s SET "runId" = $2, "scope" = 'pre-run' FROM locked
             WHERE s."id" = locked."id" AND locked."claimedBy" IS NULL AND locked."runId" IS DISTINCT FROM $2
           )
           UPDATE ${this.#runs} SET "closedAt" = ${NOW_UTC}, "closedAtZ" = now()
           WHERE "threadKey" = $1 AND "runId" = ANY($3::text[])`,
          [threadKey, runId, others],
        );
        return this.#claimRows(t, threadKey, runId, scope);
      });
      return rows.map(toStored);
    });
  }

  async delete({ ids }: { ids: string[] }): Promise<void> {
    if (ids.length === 0) return;
    await this.#run('DELETE', {}, () =>
      this.#db.client.none(
        `WITH locked AS (
           SELECT "id" FROM ${this.#signals} WHERE "id" = ANY($1::text[]) ORDER BY "seq" FOR UPDATE
         )
         DELETE FROM ${this.#signals} s USING locked WHERE s."id" = locked."id"`,
        [ids],
      ),
    );
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
    await this.#run('CLOSE_RUN', { threadKey, runId }, () =>
      this.#tx(async t => {
        await t.one(this.#lockRun('$1', '$2', true), [threadKey, runId]);
        await t.none(
          `WITH locked AS (
             SELECT "id" FROM ${this.#signals} WHERE "threadKey" = $1 AND "runId" = $2 ORDER BY "seq" FOR UPDATE
           ), consumed AS (
             DELETE FROM ${this.#signals} s USING locked
             WHERE s."id" = locked."id" AND locked."id" = ANY($3::text[])
           )
           UPDATE ${this.#signals} s SET "runId" = NULL, "claimedBy" = NULL FROM locked
           WHERE s."id" = locked."id" AND NOT (locked."id" = ANY($3::text[]))`,
          [threadKey, runId, consumedIds],
        );
      }),
    );
  }

  async cancel({ threadKey, ids }: { threadKey: string; ids: string[] }): Promise<string[]> {
    if (ids.length === 0) return [];
    return this.#run('CANCEL', { threadKey }, async () => {
      // `FOR UPDATE` rechecks `claimedBy` on the latest version, so a row claimed while this waited is kept.
      const rows = await this.#db.client.manyOrNone<{ id: string }>(
        `WITH locked AS (
           SELECT "id" FROM ${this.#signals}
           WHERE "threadKey" = $1 AND "claimedBy" IS NULL AND "id" = ANY($2::text[])
           ORDER BY "seq" FOR UPDATE
         )
         DELETE FROM ${this.#signals} s USING locked WHERE s."id" = locked."id" RETURNING s."id"`,
        [threadKey, ids],
      );
      return rows.map(row => row.id);
    });
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
    return this.#run('READDRESS', { threadKey, fromRunId, toRunId }, async () => {
      if (fromRunId === toRunId) {
        const row = await this.#db.client.oneOrNone<{ closed: boolean }>(
          `SELECT "closedAt" IS NOT NULL AS closed FROM ${this.#runs} WHERE "threadKey" = $1 AND "runId" = $2`,
          [threadKey, toRunId],
        );
        return row?.closed ? 'run-closed' : 'accepted';
      }

      await this.#ensureRuns(threadKey, [fromRunId, toRunId]);
      return this.#tx(async t => {
        const locked = await this.#lockEnsuredRuns(
          t,
          threadKey,
          `"runId" = ANY($2::text[])`,
          [[fromRunId, toRunId]],
          [fromRunId, toRunId],
        );
        const targetClosed = locked.get(toRunId) === true;
        await t.none(
          `WITH locked AS (
             SELECT "id" FROM ${this.#signals}
             WHERE "threadKey" = $1 AND "runId" = $2 AND "claimedBy" IS NULL
             ORDER BY "seq" FOR UPDATE
           ), dropped AS (
             DELETE FROM ${this.#signals} s USING locked WHERE s."id" = locked."id" AND $4::boolean
           ), moved AS (
             UPDATE ${this.#signals} s SET "runId" = $3 FROM locked WHERE s."id" = locked."id" AND NOT $4::boolean
           )
           UPDATE ${this.#runs} SET "closedAt" = COALESCE("closedAt", ${NOW_UTC}), "closedAtZ" = COALESCE("closedAtZ", now())
           WHERE "threadKey" = $1 AND "runId" = $2`,
          [threadKey, fromRunId, toRunId, targetClosed],
        );
        return targetClosed ? 'run-closed' : 'accepted';
      });
    });
  }

  async listPending({ threadKey, runId }: { threadKey: string; runId?: string | null }): Promise<StoredAgentSignal[]> {
    const filter = runId === undefined ? '' : runId === null ? 'AND "runId" IS NULL' : 'AND "runId" = $2';
    return this.#run('LIST_PENDING', { threadKey }, async () => {
      const rows = await this.#db.client.manyOrNone<Row>(
        `SELECT ${COLUMNS} FROM ${this.#signals} WHERE "threadKey" = $1 AND "claimedBy" IS NULL ${filter} ORDER BY "seq"`,
        typeof runId === 'string' ? [threadKey, runId] : [threadKey],
      );
      return rows.map(toStored);
    });
  }

  async deleteThread({ threadKey }: { threadKey: string }): Promise<void> {
    await this.#run('DELETE_THREAD', { threadKey }, () =>
      this.#tx(async t => {
        // Markers first, in run id order, then rows in `seq` order, as every other writer takes them.
        // Only the locked markers are deleted: one created after the lock belongs to a run that
        // starts after the deletion, and waiting for it could close a lock cycle.
        const locked = await this.#lockRuns(t, threadKey, 'TRUE', []);
        await t.none(
          `WITH locked AS (
             SELECT "id" FROM ${this.#signals} WHERE "threadKey" = $1 ORDER BY "seq" FOR UPDATE
           ), rows AS (
             DELETE FROM ${this.#signals} s USING locked WHERE s."id" = locked."id"
           )
           DELETE FROM ${this.#runs} WHERE "threadKey" = $1 AND "runId" = ANY($2::text[])`,
          [threadKey, [...locked.keys()]],
        );
      }),
    );
  }

  /** Takes markers, then rows, in the same orders as the other writers. Meant for tests, not for use alongside other calls. */
  async dangerouslyClearAll(): Promise<void> {
    await this.#run('CLEAR_ALL', {}, () =>
      this.#tx(async t => {
        await t.none(`SELECT 1 FROM ${this.#runs} ORDER BY "threadKey", "runId" FOR UPDATE`);
        await t.none(
          `WITH locked AS (SELECT "id" FROM ${this.#signals} ORDER BY "seq" FOR UPDATE)
           DELETE FROM ${this.#signals} s USING locked WHERE s."id" = locked."id"`,
        );
        await t.none(`DELETE FROM ${this.#runs}`);
      }),
    );
  }
}
