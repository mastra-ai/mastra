import type {
  SqliteClient,
  SqliteInArgs,
  SqliteInValue,
  SqliteResultSet,
  SqliteStatement,
  SqliteTransaction,
  SqliteTransactionMode,
  SqliteValue,
} from '@mastra/libsql';
import type { Database } from '@tursodatabase/database';

export type TursoExperimentalFeature =
  | 'views'
  | 'strict'
  | 'encryption'
  | 'index_method'
  | 'custom_types'
  | 'autovacuum'
  | 'vacuum'
  | 'triggers'
  | 'attach'
  | 'generated_columns'
  | 'multiprocess_wal'
  | 'without_rowid';

export interface TursoClientConfig {
  path: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  defaultQueryTimeout?: number;
  tracing?: 'info' | 'debug' | 'trace';
  experimental?: TursoExperimentalFeature[];
}

type TransactionDecision = 'commit' | 'rollback';

const ROLLBACK = Symbol('turso-transaction-rollback');

class TursoSqliteError extends Error {
  readonly code: string;
  readonly rawCode?: number;

  constructor(error: Error, code: string) {
    super(error.message, { cause: error });
    this.name = 'TursoSqliteError';
    this.code = code;
    const rawCode = (error as Error & { rawCode?: unknown }).rawCode;
    if (typeof rawCode === 'number') this.rawCode = rawCode;
  }
}

function normalizeError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;

  const message = error.message.toLowerCase();
  if (message.includes('unique constraint')) return new TursoSqliteError(error, 'SQLITE_CONSTRAINT_UNIQUE');
  if (message.includes('primary key constraint')) return new TursoSqliteError(error, 'SQLITE_CONSTRAINT_PRIMARYKEY');
  if (message.includes('not null constraint')) return new TursoSqliteError(error, 'SQLITE_CONSTRAINT_NOTNULL');
  if (message.includes('foreign key constraint')) return new TursoSqliteError(error, 'SQLITE_CONSTRAINT_FOREIGNKEY');
  if (message.includes('check constraint')) return new TursoSqliteError(error, 'SQLITE_CONSTRAINT_CHECK');
  if (message.includes('database is locked') || message.includes('database is busy')) {
    return new TursoSqliteError(error, 'SQLITE_BUSY');
  }
  return error;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class AsyncMutex {
  #tail = Promise.resolve();

  async acquire(): Promise<() => void> {
    const previous = this.#tail;
    const next = deferred<void>();
    this.#tail = previous.then(
      () => next.promise,
      () => next.promise,
    );
    await previous;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      next.resolve();
    };
  }
}

function normalizeInput(value: SqliteInValue): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

function normalizeArgs(args?: SqliteInArgs): unknown[] | Record<string, unknown> | undefined {
  if (!args) return undefined;
  if (Array.isArray(args)) return args.map(normalizeInput);
  return Object.fromEntries(Object.entries(args).map(([key, value]) => [key, normalizeInput(value)]));
}

function normalizeStatement(statement: SqliteStatement) {
  const args = normalizeArgs(statement.args);
  if (!Array.isArray(args) || !statement.sql.toLowerCase().includes('jsonb(?)')) {
    return { sql: statement.sql, ...(args ? { args } : {}) };
  }

  let argumentIndex = 0;
  const normalizedArgs: unknown[] = [];
  const sql = statement.sql.replace(/jsonb\(\?\)|\?/gi, token => {
    const value = args[argumentIndex++];
    if (token.toLowerCase() === 'jsonb(?)' && value === null) return 'NULL';
    normalizedArgs.push(value);
    return token;
  });

  return { sql, args: normalizedArgs };
}

function toNativeStatement(statement: string | SqliteStatement) {
  return typeof statement === 'string' ? statement : normalizeStatement(statement);
}

function normalizeValue(value: unknown): SqliteValue {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : value;
  }
  if (value instanceof Uint8Array) return Uint8Array.from(value).buffer;
  if (value === null || typeof value === 'string' || typeof value === 'number' || value instanceof ArrayBuffer) {
    return value;
  }
  throw new TypeError(`Unsupported Turso result value: ${typeof value}`);
}

function normalizeResult(result: {
  columns: string[];
  columnTypes: string[];
  rows: Array<Record<string, unknown> | unknown[]>;
  rowsAffected: number;
}): SqliteResultSet {
  const rows = result.rows.map(row => {
    if (Array.isArray(row)) {
      return Object.fromEntries(result.columns.map((column, index) => [column, normalizeValue(row[index])]));
    }
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]));
  });

  return {
    columns: result.columns,
    columnTypes: result.columnTypes,
    rows,
    rowsAffected: result.rowsAffected,
  };
}

export class TursoSqliteClient implements SqliteClient {
  readonly protocol = 'turso';

  readonly #mutex = new AsyncMutex();
  readonly #readiness: Promise<Database>;
  #state: 'open' | 'closing' | 'closed' = 'open';
  #closePromise?: Promise<void>;
  #activeRollback?: () => Promise<void>;

  constructor(config: TursoClientConfig) {
    this.#readiness = this.#connect(config);
    void this.#readiness.catch(() => undefined);
  }

  get closed(): boolean {
    return this.#state !== 'open';
  }

  async execute(statement: string | SqliteStatement): Promise<SqliteResultSet> {
    return this.#runExclusive(async db => normalizeResult((await db.batch([toNativeStatement(statement)]))[0]!));
  }

  async batch(statements: Array<string | SqliteStatement>, mode?: SqliteTransactionMode): Promise<SqliteResultSet[]> {
    return this.#runExclusive(async db => {
      const results = await db.batch(statements.map(toNativeStatement), mode);
      return results.map(normalizeResult);
    });
  }

  async transaction(mode: SqliteTransactionMode = 'write'): Promise<SqliteTransaction> {
    this.#assertOpen();
    const release = await this.#mutex.acquire();

    try {
      this.#assertOpen();
      const db = await this.#readiness;
      this.#assertOpen();
      const entered = deferred<void>();
      const decision = deferred<TransactionDecision>();
      let transactionClosed = false;
      let operationTail = Promise.resolve();
      let completion: Promise<void> | undefined;
      let runner!: Promise<void>;

      const execute = (statement: string | SqliteStatement): Promise<SqliteResultSet> => {
        if (transactionClosed) return Promise.reject(new Error('Turso transaction is closed.'));
        const operation = operationTail.then(async () => {
          try {
            return normalizeResult((await db.batch([toNativeStatement(statement)]))[0]!);
          } catch (error) {
            throw normalizeError(error);
          }
        });
        operationTail = operation.then(
          () => undefined,
          () => undefined,
        );
        return operation;
      };

      const finish = (outcome: TransactionDecision): Promise<void> => {
        if (completion) return completion;
        transactionClosed = true;
        completion = (async () => {
          await operationTail;
          decision.resolve(outcome);
          try {
            await runner;
          } catch (error) {
            if (outcome !== 'rollback' || error !== ROLLBACK) throw error;
          }
        })();
        return completion;
      };

      const transaction: SqliteTransaction = {
        execute,
        commit: () => finish('commit'),
        rollback: () => finish('rollback'),
        get closed() {
          return transactionClosed;
        },
      };

      const rollback = () => finish('rollback');
      this.#activeRollback = rollback;

      const nativeTransaction = db.transaction(async () => {
        entered.resolve();
        if ((await decision.promise) === 'rollback') throw ROLLBACK;
      });
      const nativeRunner = mode === 'write' ? nativeTransaction.immediate() : nativeTransaction.deferred();
      runner = nativeRunner.catch(error => {
        throw normalizeError(error);
      });
      runner.then(
        () => {
          if (this.#activeRollback === rollback) this.#activeRollback = undefined;
          release();
        },
        error => {
          entered.reject(error);
          if (this.#activeRollback === rollback) this.#activeRollback = undefined;
          release();
        },
      );

      await entered.promise;
      if (this.#state !== 'open') {
        await rollback();
        throw new Error('Turso client is closed.');
      }
      return transaction;
    } catch (error) {
      release();
      throw error;
    }
  }

  close(): Promise<void> {
    this.#closePromise ??= this.#close();
    return this.#closePromise;
  }

  async #connect(config: TursoClientConfig): Promise<Database> {
    const { connect } = await import('@tursodatabase/database');
    const db = await connect(config.path, {
      ...(config.readonly === undefined ? {} : { readonly: config.readonly }),
      ...(config.fileMustExist === undefined ? {} : { fileMustExist: config.fileMustExist }),
      ...(config.timeout === undefined ? {} : { timeout: config.timeout }),
      ...(config.defaultQueryTimeout === undefined ? {} : { defaultQueryTimeout: config.defaultQueryTimeout }),
      ...(config.tracing === undefined ? {} : { tracing: config.tracing }),
      ...(config.experimental === undefined ? {} : { experimental: config.experimental }),
    });
    db.defaultSafeIntegers(true);
    return db;
  }

  async #runExclusive<T>(operation: (db: Database) => Promise<T>): Promise<T> {
    this.#assertOpen();
    const release = await this.#mutex.acquire();
    try {
      this.#assertOpen();
      const db = await this.#readiness;
      this.#assertOpen();
      try {
        return await operation(db);
      } catch (error) {
        throw normalizeError(error);
      }
    } finally {
      release();
    }
  }

  async #close(): Promise<void> {
    if (this.#state === 'closed') return;
    this.#state = 'closing';
    await this.#activeRollback?.();

    const release = await this.#mutex.acquire();
    try {
      const db = await this.#readiness;
      await db.close();
    } finally {
      this.#state = 'closed';
      release();
    }
  }

  #assertOpen(): void {
    if (this.#state !== 'open') throw new Error('Turso client is closed.');
  }
}
