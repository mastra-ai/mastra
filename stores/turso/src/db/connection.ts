/**
 * Turso connection: statement execution, atomic batches, and interactive
 * transactions.
 *
 * Three engine behaviours drive this design, all verified against
 * `@tursodatabase/database@0.7.2`:
 *
 * 1. `db.batch()` is **not atomic**. Given three statements where the second
 *    violates a constraint, Turso leaves the first one committed
 *    (`["existing", "first"]`) where libSQL rolls back to `["existing"]`.
 *    Callers batch precisely because they need all-or-nothing, so the raw
 *    method is never used here; batches run inside an explicit
 *    `BEGIN IMMEDIATE` … `COMMIT` with rollback on failure.
 *
 * 2. `all()` and `run()` **both execute** the statement. Calling `all()` on an
 *    INSERT performs the insert and returns `[]`, so probing for rows and
 *    falling back to `run()` would write twice. The statement kind decides
 *    which method to call.
 *
 * 3. Transactions are connection-scoped. A `BEGIN` captures every subsequent
 *    write on that connection, so an unrelated autocommit write issued while a
 *    transaction is open would be swept into it and committed or rolled back
 *    with it. All access is therefore serialized through a queue.
 *
 * 4. `PRAGMA busy_timeout` delays failure without preventing it. A writer
 *    contending for a lock held 200ms fails after a 300ms timeout even though
 *    the lock frees at 200ms: it sleeps, then reports "database is locked"
 *    rather than acquiring. Waiting therefore buys nothing, and only
 *    `transactionWithRetry` makes concurrent writers converge.
 */

import { connect } from '@tursodatabase/database';
import { isRetryableTursoError, normalizeTursoError, TursoError } from './errors';
import { fromRow, toBindParams } from './values';
import type { TursoBindParams, TursoRow } from './values';

/** A statement plus its bind parameters. */
export type TursoStatement = { sql: string; params?: TursoBindParams };

/** Result of executing a statement. */
export type TursoResult = {
  rows: TursoRow[];
  /** Rows changed by an INSERT/UPDATE/DELETE. */
  rowsAffected: number;
  /** ROWID of the last inserted row, when the statement was an INSERT. */
  lastInsertRowid?: bigint;
};

/**
 * Transaction locking mode.
 *
 * `immediate` acquires the write lock up front, which is what a
 * read-modify-write needs to avoid upgrade failures mid-transaction.
 * `deferred` starts as a reader and upgrades on first write.
 */
export type TursoTransactionMode = 'deferred' | 'immediate' | 'exclusive';

/** Options for opening a Turso connection. */
export type TursoConnectionOptions = {
  /** Filesystem path to the database, or `:memory:`. */
  path: string;
  /**
   * Milliseconds the engine sleeps on a locked database before failing.
   *
   * Defaults to 0 because in Turso this wait is pure latency: the sleeping
   * connection does not acquire the lock when it frees up, it just fails later.
   * See {@link DEFAULT_BUSY_TIMEOUT_MS}.
   */
  busyTimeoutMs?: number;
};

/**
 * Disabled by default: `busy_timeout` does not do what SQLite users expect here.
 *
 * Measured against `@tursodatabase/database@0.7.2` — with `busy_timeout=300`
 * against a lock held for 200ms, the contended writer still failed with
 * "database is locked" after 301ms, despite the lock being free from 200ms.
 * The timeout only delays the failure; it never retries the acquisition. Left
 * at a SQLite-typical 5000 it turns each conflict into a five-second stall that
 * looks like a hang.
 *
 * Waiting is therefore left to `transactionWithRetry`, which actually re-runs
 * the work.
 */
export const DEFAULT_BUSY_TIMEOUT_MS = 0;

type Database = Awaited<ReturnType<typeof connect>>;

const normalizeStatement = (statement: TursoStatement | string): TursoStatement =>
  typeof statement === 'string' ? { sql: statement } : statement;

/** Leading keywords of statements that yield rows. */
/** Retry budget for transactions that lose a write race. */
const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_INITIAL_BACKOFF_MS = 5;

/**
 * Ceiling on a single backoff. Doubling without a cap turns a generous retry
 * budget into minute-long sleeps, which reads as a hang rather than as
 * contention, so growth stops here and the remaining budget is spent retrying.
 */
const MAX_BACKOFF_MS = 100;

const ROW_RETURNING_PREFIX = /^\s*(?:SELECT|WITH|PRAGMA|EXPLAIN)\b/i;
/** `RETURNING` turns an INSERT/UPDATE/DELETE into a row-producing statement. */
const RETURNING_CLAUSE = /\bRETURNING\b/i;

/**
 * Whether a statement produces rows, and so must be run with `all()`.
 *
 * Both driver methods execute the statement, so this decides which one to call
 * rather than trying one and falling back — a fallback would execute writes
 * twice.
 */
function returnsRows(sql: string): boolean {
  return ROW_RETURNING_PREFIX.test(sql) || RETURNING_CLAUSE.test(sql);
}

/**
 * A serialized connection to a Turso database.
 *
 * Every operation runs exclusively: because `BEGIN` binds to the connection
 * rather than to a statement, overlapping work would otherwise be absorbed
 * into an open transaction.
 */
export class TursoConnection {
  readonly #path: string;
  readonly #busyTimeoutMs: number;

  #db: Database | undefined;
  #opening: Promise<Database> | undefined;
  /** Tail of the operation queue; every operation chains onto it. */
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;

  constructor(options: TursoConnectionOptions) {
    this.#path = options.path;
    this.#busyTimeoutMs = options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS;
  }

  get path(): string {
    return this.#path;
  }

  get closed(): boolean {
    return this.#closed;
  }

  /**
   * Opens the database on first use.
   *
   * `defaultSafeIntegers(true)` is mandatory, not a preference: without it the
   * engine truncates integers above 2^53 on read (`9007199254740993` comes
   * back as `…992`) even though they are stored correctly, silently corrupting
   * large IDs and timestamps.
   */
  async #open(): Promise<Database> {
    if (this.#db) return this.#db;
    if (this.#opening) return this.#opening;

    this.#opening = (async () => {
      try {
        const db = await connect(this.#path);
        db.defaultSafeIntegers(true);
        if (this.#busyTimeoutMs > 0) await db.exec(`PRAGMA busy_timeout = ${this.#busyTimeoutMs}`);
        this.#db = db;
        return db;
      } catch (error) {
        // Let a later call retry rather than caching a failed connect.
        this.#opening = undefined;
        throw normalizeTursoError(error, `Failed to open Turso database at ${this.#path}`);
      }
    })();

    return this.#opening;
  }

  /** Runs `fn` once all previously queued operations have settled. */
  #enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(fn, fn);
    // Tail that never rejects, so one failure cannot wedge the queue.
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new TursoError(`Turso connection to ${this.#path} is closed.`, 'SQLITE_MISUSE');
    }
  }

  async #run(db: Database, statement: TursoStatement): Promise<TursoResult> {
    const { sql, params } = statement;
    try {
      // Typed as `Promise<Statement>` but currently returned synchronously.
      // Awaiting is correct either way.
      const prepared = await db.prepare(sql);
      const bound = toBindParams(params);

      if (returnsRows(sql)) {
        const rows = (bound === undefined ? await prepared.all() : await prepared.all(bound)) as Record<
          string,
          unknown
        >[];
        return { rows: rows.map(fromRow), rowsAffected: 0 };
      }

      const info = (bound === undefined ? await prepared.run() : await prepared.run(bound)) as {
        changes?: number | bigint;
        lastInsertRowid?: number | bigint;
      };

      return {
        rows: [],
        rowsAffected: Number(info?.changes ?? 0),
        ...(info?.lastInsertRowid === undefined ? {} : { lastInsertRowid: BigInt(info.lastInsertRowid) }),
      };
    } catch (error) {
      throw normalizeTursoError(error, `Failed to execute SQL: ${sql}`);
    }
  }

  /** Executes a single statement. */
  async execute(statement: TursoStatement | string): Promise<TursoResult> {
    // Admission is decided here, not inside the queued callback: work accepted
    // before `close()` must still complete, since `close()` drains the queue.
    this.#assertOpen();
    const normalized = normalizeStatement(statement);
    return this.#enqueue(async () => {
      const db = await this.#open();
      return this.#run(db, normalized);
    });
  }

  /**
   * Executes statements atomically.
   *
   * Wraps them in an explicit transaction rather than calling `db.batch()`,
   * which leaves earlier statements committed when a later one fails.
   */
  async batch(
    statements: (TursoStatement | string)[],
    mode: TursoTransactionMode = 'immediate',
  ): Promise<TursoResult[]> {
    this.#assertOpen();
    const normalized = statements.map(normalizeStatement);
    if (normalized.length === 0) return [];

    return this.#enqueue(async () => {
      const db = await this.#open();
      return this.#withTransaction(db, mode, async () => {
        const results: TursoResult[] = [];
        for (const statement of normalized) {
          results.push(await this.#run(db, statement));
        }
        return results;
      });
    });
  }

  /**
   * Runs `fn` inside an interactive transaction, committing on return and
   * rolling back if it throws.
   *
   * The whole transaction occupies one queue slot, so no unrelated write can
   * land inside it.
   */
  async transaction<T>(
    fn: (tx: TursoTransactionContext) => Promise<T>,
    mode: TursoTransactionMode = 'immediate',
  ): Promise<T> {
    this.#assertOpen();
    return this.#enqueue(async () => {
      const db = await this.#open();
      return this.#withTransaction(db, mode, () =>
        fn({ execute: statement => this.#run(db, normalizeStatement(statement)) }),
      );
    });
  }

  /**
   * Runs a transaction, replaying it from the start when it loses a write race.
   *
   * Turso fails contended writers immediately rather than blocking, so any
   * read-modify-write against a table other connections touch needs this.
   * `fn` is re-invoked on each attempt, so it must re-read anything it depends
   * on — replaying the write alone would apply it to a stale snapshot and lose
   * the concurrent update.
   *
   * Retries are safe here precisely because the conflicting transaction was
   * rolled back whole: a lost race writes nothing.
   */
  async transactionWithRetry<T>(
    fn: (tx: TursoTransactionContext) => Promise<T>,
    options: { mode?: TursoTransactionMode; maxRetries?: number; initialBackoffMs?: number } = {},
  ): Promise<T> {
    const {
      mode = 'immediate',
      maxRetries = DEFAULT_MAX_RETRIES,
      initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
    } = options;

    let attempt = 0;
    for (;;) {
      try {
        return await this.transaction(fn, mode);
      } catch (error) {
        // Give up on real failures, and on contention we have stopped waiting
        // out, so the caller sees the engine's error rather than a hang.
        if (attempt >= maxRetries || !isRetryableTursoError(error)) throw error;

        // Full jitter: contended writers that back off in lockstep would just
        // collide again on the next attempt.
        const ceiling = Math.min(initialBackoffMs * 2 ** attempt, MAX_BACKOFF_MS);
        await new Promise(resolve => setTimeout(resolve, Math.random() * ceiling));
        attempt++;
      }
    }
  }

  /**
   * Brackets `fn` with BEGIN/COMMIT, rolling back on failure.
   *
   * Must only be called from inside a queue slot; it issues raw transaction
   * control on the shared connection.
   */
  async #withTransaction<T>(db: Database, mode: TursoTransactionMode, fn: () => Promise<T>): Promise<T> {
    const begin = `BEGIN ${mode.toUpperCase()}`;
    try {
      await db.exec(begin);
    } catch (error) {
      throw normalizeTursoError(error, `Failed to begin Turso transaction (${mode})`);
    }

    let result: T;
    try {
      result = await fn();
    } catch (error) {
      try {
        await db.exec('ROLLBACK');
      } catch (rollbackError) {
        // Surface the original failure; the rollback error is only context.
        const cause = normalizeTursoError(rollbackError).message;
        throw normalizeTursoError(error, `Transaction failed and rollback also failed (${cause})`);
      }
      throw normalizeTursoError(error);
    }

    try {
      await db.exec('COMMIT');
    } catch (error) {
      throw normalizeTursoError(error, 'Failed to commit Turso transaction');
    }

    return result;
  }

  /** Closes the connection. Safe to call more than once. */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;

    // Drain in-flight work so nothing executes against a closed handle.
    await this.#queue.catch(() => undefined);

    const db = this.#db;
    this.#db = undefined;
    this.#opening = undefined;
    if (!db) return;

    try {
      await db.close();
    } catch (error) {
      throw normalizeTursoError(error, 'Failed to close Turso database');
    }
  }
}

/** Handle for issuing statements inside {@link TursoConnection.transaction}. */
export type TursoTransactionContext = {
  execute(statement: TursoStatement | string): Promise<TursoResult>;
};
