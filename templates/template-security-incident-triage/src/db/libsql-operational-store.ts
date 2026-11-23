import { createClient, type Client, type InStatement, type Transaction } from '@libsql/client';

import { DomainError, toStorageError } from '../domain/errors.js';
import { readStorageConfig, type StorageConfig } from './config.js';
import type { OperationalStore, SqlStatement, StoreTransaction } from './operational-store.js';

import { acquireLocalWrite } from './local-write-coordinator.js';
const localBusyTimeoutMs = 0;
const localRetryAttempts = 8;

export function createLibSqlOperationalStore(config: StorageConfig = readStorageConfig()): OperationalStore {
  return new LibSqlOperationalStore(
    createClient({
      ...config,
      timeout: config.url.startsWith('file:') ? 0 : 5_000,
    }),
    config.url.startsWith('file:') ? config.url : undefined,
  );
}

/**
 * Opens an operational store restricted to read statements and SELECT-like
 * statements.  Local SQLite still needs an existing file before the driver is
 * constructed; callers that handle owned artifacts must perform that
 * filesystem precondition first.
 */
export function createReadOnlyLibSqlOperationalStore(config: StorageConfig): OperationalStore {
  return new LibSqlOperationalStore(
    createClient({
      ...config,
      timeout: config.url.startsWith('file:') ? 0 : 5_000,
    }),
    undefined,
    true,
  );
}

export class LibSqlOperationalStore implements OperationalStore {
  private readOnlyTail: Promise<void> = Promise.resolve();
  private localPragmaReady: Promise<void> | undefined;

  constructor(
    private readonly client: Client,
    private readonly localDatabaseKey?: string,
    private readonly readOnly = false,
  ) {}

  async execute(statement: SqlStatement) {
    return this.withLocalRetry(async () => {
      await this.ensureLocalPragmas();
      assertReadOnlyStatement(statement, this.readOnly);
      if (this.readOnly) return await this.executeReadOnly(statement);
      // Direct writes share the same local queue as transactions. Otherwise
      // SQLite's synchronous busy wait can starve the transaction that needs
      // this event loop to commit (parallel telemetry/evidence writes).
      const releaseLocalWrite =
        this.localDatabaseKey && !isReadOnlySelect(statement.sql)
          ? await acquireLocalWrite(this.localDatabaseKey)
          : undefined;
      try {
        return await this.client.execute(toInStatement(statement));
      } catch (error) {
        throw toStorageError(error);
      } finally {
        releaseLocalWrite?.();
      }
    });
  }

  async transaction<T>(fn: (tx: StoreTransaction) => Promise<T>): Promise<T> {
    await this.ensureLocalPragmas();
    if (this.readOnly) {
      // SQLite's embedded driver cannot run the dashboard's nested snapshot
      // reads through libSQL's `READONLY` transaction spelling.  The observer
      // therefore supplies a statement-fenced read handle instead; it has no
      // transaction primitive capable of writing and callers recheck their
      // frozen semantic precondition before publishing a result.
      const handle: StoreTransaction = {
        execute: statement => this.execute(statement),
        batch: async statements => {
          for (const statement of statements) assertReadOnlyStatement(statement, true);
          const results = [];
          for (const statement of statements) results.push(await this.executeReadOnly(statement));
          return results;
        },
      };
      try {
        return await fn(handle);
      } catch (error) {
        throw toStorageError(error);
      }
    }
    return this.withLocalRetry(() => this.runWriteTransaction(fn));
  }

  close(): void {
    this.client.close();
  }

  private async executeReadOnly(statement: SqlStatement) {
    const previous = this.readOnlyTail;
    let release = () => {};
    const turn = new Promise<void>(resolve => {
      release = resolve;
    });
    this.readOnlyTail = previous.then(() => turn);
    await previous;
    try {
      return await this.client.execute(toInStatement(statement));
    } finally {
      release();
    }
  }

  private ensureLocalPragmas(): Promise<void> {
    if (!this.localDatabaseKey) return Promise.resolve();
    this.localPragmaReady ??= this.client
      .execute(`PRAGMA busy_timeout=${localBusyTimeoutMs}`)
      .then(() => undefined)
      .catch(error => {
        throw toStorageError(error);
      });
    return this.localPragmaReady;
  }

  private async withLocalRetry<T>(operation: () => Promise<T>): Promise<T> {
    const attempts = this.localDatabaseKey ? localRetryAttempts : 1;
    let lastError: DomainError | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const storageError = toStorageError(error);
        if (!storageError.retryable || attempt === attempts) throw storageError;
        lastError = storageError;
        await delay(localRetryDelayMs(attempt));
      }
    }
    throw lastError ?? new DomainError('STORAGE_UNAVAILABLE');
  }

  private async runWriteTransaction<T>(fn: (tx: StoreTransaction) => Promise<T>): Promise<T> {
    const releaseLocalWrite = this.localDatabaseKey ? await acquireLocalWrite(this.localDatabaseKey) : undefined;
    let transaction: Transaction | undefined;
    try {
      transaction = await this.client.transaction('write');
      const activeTransaction = transaction;
      const handle: StoreTransaction = {
        execute: statement => {
          assertReadOnlyStatement(statement, this.readOnly);
          return activeTransaction.execute(toInStatement(statement));
        },
        batch: statements => {
          for (const statement of statements) assertReadOnlyStatement(statement, this.readOnly);
          return activeTransaction.batch(statements.map(toInStatement));
        },
      };
      const value = await fn(handle);
      await transaction.commit();
      return value;
    } catch (error) {
      if (transaction && !transaction.closed) {
        try {
          await transaction.rollback();
        } catch {
          // The original error remains authoritative and is always redacted.
        }
      }
      throw toStorageError(error);
    } finally {
      transaction?.close();
      releaseLocalWrite?.();
    }
  }
}

function localRetryDelayMs(attempt: number): number {
  const cap = Math.min(25 * 2 ** (attempt - 1), 500);
  return Math.floor(cap / 2 + Math.random() * (cap / 2));
}

function delay(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function assertReadOnlyStatement(statement: SqlStatement, readOnly: boolean): void {
  if (!readOnly) return;
  if (!isReadOnlySelect(statement.sql)) throw new Error('DEMO_READ_ONLY_STATEMENT_DENIED');
}

/**
 * This is intentionally a small, conservative SQL lexer rather than a
 * first-token regex. The observer only needs SELECT statements, so rejecting
 * a harmless-looking query is preferable to accepting a writable SQLite CTE
 * (for example `WITH x AS (SELECT 1) DELETE ...`). Comments, quoted values,
 * and quoted identifiers are skipped before the allowlist is applied, and a
 * semicolon is always denied: this boundary never needs a multi-statement
 * payload.
 */
function isReadOnlySelect(sql: string): boolean {
  const tokens = lexSql(sql);
  if (!tokens.length || tokens.some(token => token.value === ';')) return false;

  const words = tokens.filter((token): token is Readonly<{ value: string; depth: number }> =>
    /^[A-Z][A-Z0-9_$]*$/u.test(token.value),
  );
  const first = words[0]?.value;
  if (first !== 'SELECT' && first !== 'WITH') return false;

  // A SELECT can contain arbitrary expressions, but no executable SQL
  // command. Treat all statement/control words as denied at every nesting
  // depth so that writable CTE bodies and `RETURNING` tricks cannot escape a
  // top-level SELECT/CTE check.
  const forbidden = new Set([
    'ALTER',
    'ANALYZE',
    'ATTACH',
    'BEGIN',
    'COMMIT',
    'CREATE',
    'DELETE',
    'DETACH',
    'DROP',
    'END',
    'INSERT',
    'PRAGMA',
    'REINDEX',
    'RELEASE',
    'REPLACE',
    'ROLLBACK',
    'SAVEPOINT',
    'UPDATE',
    'VACUUM',
  ]);
  if (words.some(token => forbidden.has(token.value))) return false;

  if (first === 'SELECT') return true;

  // A WITH is readable only when its outer statement is SELECT. A top-level
  // SELECT inside a parenthesized CTE deliberately does not satisfy this.
  return words.some(token => token.depth === 0 && token.value === 'SELECT');
}

type SqlToken = Readonly<{ value: string; depth: number }>;

function lexSql(sql: string): readonly SqlToken[] {
  const tokens: SqlToken[] = [];
  let depth = 0;
  for (let index = 0; index < sql.length;) {
    const char = sql[index]!;
    const next = sql[index + 1];
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', index + 2);
      index = end === -1 ? sql.length : end + 1;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', index + 2);
      if (end === -1) return [];
      index = end + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === '`' || char === '[') {
      const closing = char === '[' ? ']' : char;
      index = skipQuotedSql(sql, index, closing);
      if (index === -1) return [];
      continue;
    }
    if (char === '(') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === ')') {
      if (depth === 0) return [];
      depth -= 1;
      index += 1;
      continue;
    }
    if (char === ';') {
      tokens.push({ value: ';', depth });
      index += 1;
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      let end = index + 1;
      while (end < sql.length && /[A-Za-z0-9_$]/u.test(sql[end]!)) end += 1;
      tokens.push({ value: sql.slice(index, end).toUpperCase(), depth });
      index = end;
      continue;
    }
    index += 1;
  }
  return depth === 0 ? tokens : [];
}

function skipQuotedSql(sql: string, start: number, closing: string): number {
  for (let index = start + 1; index < sql.length; index += 1) {
    if (sql[index] !== closing) continue;
    // SQL escapes quote characters by doubling them (`''`, `""`, ```` and
    // `]]`). Do not accidentally expose a keyword embedded in a literal.
    if (sql[index + 1] === closing) {
      index += 1;
      continue;
    }
    return index + 1;
  }
  return -1;
}

function toInStatement(statement: SqlStatement): InStatement {
  return {
    sql: statement.sql,
    ...(statement.args ? { args: statement.args } : {}),
  } as InStatement;
}
