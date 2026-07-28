import { randomUUID } from 'node:crypto';

import { createClient } from '@libsql/client';
import type { Client, InValue } from '@libsql/client';
import { FactoryStorage, UniqueViolationError } from '@mastra/core/storage';
import type {
  CollectionColumnSpec,
  CollectionListOptions,
  CollectionSchema,
  CollectionValue,
  CollectionWhere,
  FactoryAuthDatabase,
  FactoryStorageOps,
  MastraCompositeStore,
  RetentionConfig,
} from '@mastra/core/storage';

import { DEFAULT_CONNECTION_TIMEOUT_MS } from './db';
import { LibSQLStore } from './index';

export interface LibSQLFactoryStorageConfig {
  /** libsql url, e.g. `file:./app.db`, `:memory:`, or a remote `libsql://` url. */
  url: string;
  authToken?: string;
  /** Identifier for the wrapped agent-state store. @default 'libsql-factory' */
  id?: string;
  /** Retention config forwarded to the wrapped {@link LibSQLStore}. */
  retention?: RetentionConfig;
}

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const COLUMN_DDL: Record<CollectionColumnSpec['type'], string> = {
  text: 'TEXT',
  bigint: 'INTEGER',
  integer: 'INTEGER',
  boolean: 'INTEGER',
  json: 'TEXT',
  timestamp: 'TEXT',
  'uuid-pk': 'TEXT',
};

function assertIdentifier(kind: string, name: string): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`LibSQLFactoryStorage: invalid ${kind} identifier '${name}'`);
  }
}

function isUniqueViolation(error: unknown): boolean {
  // Only uniqueness conflicts (including PK conflicts) qualify. A bare
  // `SQLITE_CONSTRAINT` match would also swallow NOT NULL/CHECK/FK failures,
  // which must surface as real errors rather than insert-or-recover races.
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('UNIQUE constraint failed') ||
    message.includes('SQLITE_CONSTRAINT_UNIQUE') ||
    message.includes('SQLITE_CONSTRAINT_PRIMARYKEY')
  );
}

function primaryKeyOf(schema: CollectionSchema): string {
  const pks = Object.entries(schema.columns).filter(([, spec]) => spec.type === 'uuid-pk' || spec.primaryKey);
  if (pks.length !== 1) {
    throw new Error(
      `LibSQLFactoryStorage: collection '${schema.name}' must declare exactly one primary key (found ${pks.length})`,
    );
  }
  return pks[0]![0];
}

function assertUpsertConflict(schema: CollectionSchema, conflictKeys: string[], row: Record<string, unknown>): void {
  const keys = new Set(conflictKeys);
  if (keys.size !== conflictKeys.length || conflictKeys.some(key => row[key] === undefined)) {
    throw new Error(
      `LibSQLFactoryStorage: upsert conflict keys for '${schema.name}' must be unique and present in the row`,
    );
  }

  const primaryKey = primaryKeyOf(schema);
  const candidates = [{ columns: [primaryKey] }, ...(schema.uniqueIndexes ?? [])];
  const matches = candidates.some(candidate => {
    if (candidate.columns.length !== keys.size || candidate.columns.some(column => !keys.has(column))) return false;
    if ('whereNotNull' in candidate && candidate.whereNotNull && row[candidate.whereNotNull] == null) return false;
    if ('whereNull' in candidate && candidate.whereNull && row[candidate.whereNull] != null) return false;
    return true;
  });
  if (!matches) {
    throw new Error(
      `LibSQLFactoryStorage: upsert conflict keys [${conflictKeys.join(', ')}] do not match an applicable primary key or unique index on '${schema.name}'`,
    );
  }
}

function serializeDefault(value: string | number | boolean): string {
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

/** Simple FIFO in-process mutex serializing the single-writer paths. */
class Mutex {
  #tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(fn, fn);
    this.#tail = result.catch(() => {});
    return result;
  }
}

type LibSQLExecutor = Pick<Client, 'execute'>;

class LibSQLFactoryStorageOps implements FactoryStorageOps {
  readonly #client: LibSQLExecutor;
  readonly #schemas: Map<string, CollectionSchema>;
  readonly #writeMutex = new Mutex();

  constructor(client: LibSQLExecutor, schemas: Map<string, CollectionSchema>) {
    this.#client = client;
    this.#schemas = schemas;
  }

  #schema(collection: string): CollectionSchema {
    const schema = this.#schemas.get(collection);
    if (!schema) {
      throw new Error(
        `LibSQLFactoryStorage: unknown collection '${collection}' — register it via ensureCollections() first`,
      );
    }
    return schema;
  }

  #column(schema: CollectionSchema, column: string): CollectionColumnSpec {
    const spec = schema.columns[column];
    if (!spec) {
      throw new Error(`LibSQLFactoryStorage: unknown column '${column}' on collection '${schema.name}'`);
    }
    return spec;
  }

  #serialize(spec: CollectionColumnSpec, value: unknown): InValue {
    if (value === null || value === undefined) return null;
    switch (spec.type) {
      case 'timestamp':
        return value instanceof Date ? value.toISOString() : String(value);
      case 'boolean':
        return value ? 1 : 0;
      case 'json':
        return JSON.stringify(value);
      case 'bigint':
      case 'integer':
        return Number(value);
      default:
        return String(value);
    }
  }

  #deserializeRow<T extends Record<string, unknown>>(schema: CollectionSchema, raw: Record<string, unknown>): T {
    const row: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(schema.columns)) {
      const value = raw[name];
      if (value === null || value === undefined) {
        row[name] = null;
        continue;
      }
      switch (spec.type) {
        case 'timestamp':
          row[name] = new Date(String(value));
          break;
        case 'boolean':
          row[name] = Number(value) === 1;
          break;
        case 'json':
          row[name] = JSON.parse(String(value));
          break;
        case 'bigint':
        case 'integer':
          row[name] = Number(value);
          break;
        default:
          row[name] = String(value);
      }
    }
    return row as T;
  }

  /** Builds `WHERE` SQL (without the keyword). `{}` yields a match-all clause. */
  #buildWhere(schema: CollectionSchema, where: CollectionWhere): { sql: string; args: InValue[] } {
    const clauses: string[] = [];
    const args: InValue[] = [];
    for (const [column, condition] of Object.entries(where)) {
      const spec = this.#column(schema, column);
      if (condition !== null && typeof condition === 'object' && !(condition instanceof Date) && 'in' in condition) {
        if (condition.in.length === 0) {
          clauses.push('1 = 0');
          continue;
        }
        const nonNull = condition.in.filter(value => value !== null);
        const includesNull = nonNull.length !== condition.in.length;
        const inClause = nonNull.length > 0 ? `"${column}" IN (${nonNull.map(() => '?').join(', ')})` : undefined;
        clauses.push(
          inClause && includesNull ? `(${inClause} OR "${column}" IS NULL)` : (inClause ?? `"${column}" IS NULL`),
        );
        args.push(...nonNull.map(value => this.#serialize(spec, value)));
      } else if (condition === null) {
        clauses.push(`"${column}" IS NULL`);
      } else {
        clauses.push(`"${column}" = ?`);
        args.push(this.#serialize(spec, condition));
      }
    }
    return { sql: clauses.length > 0 ? clauses.join(' AND ') : '1 = 1', args };
  }

  /** Keyset condition: rows strictly after `cursor.values` in the `orderBy` order. */
  #buildCursor(
    schema: CollectionSchema,
    orderBy: NonNullable<CollectionListOptions['orderBy']>,
    values: CollectionValue[],
  ): { sql: string; args: InValue[] } {
    if (values.length !== orderBy.length) {
      throw new Error(
        `LibSQLFactoryStorage: cursor has ${values.length} values but orderBy has ${orderBy.length} columns`,
      );
    }
    const branches: string[] = [];
    const args: InValue[] = [];
    for (let i = 0; i < orderBy.length; i++) {
      const parts: string[] = [];
      for (let j = 0; j < i; j++) {
        const [column] = orderBy[j]!;
        parts.push(`"${column}" = ?`);
        args.push(this.#serialize(this.#column(schema, column), values[j]));
      }
      const [column, dir] = orderBy[i]!;
      parts.push(`"${column}" ${dir === 'desc' ? '<' : '>'} ?`);
      args.push(this.#serialize(this.#column(schema, column), values[i]));
      branches.push(`(${parts.join(' AND ')})`);
    }
    return { sql: `(${branches.join(' OR ')})`, args };
  }

  async #select<T extends Record<string, unknown>>(
    collection: string,
    where: CollectionWhere,
    opts?: CollectionListOptions,
  ): Promise<T[]> {
    const schema = this.#schema(collection);
    const filter = this.#buildWhere(schema, where);
    let sql = `SELECT * FROM "${schema.name}" WHERE ${filter.sql}`;
    const args = [...filter.args];

    if (opts?.cursor) {
      if (!opts.orderBy || opts.orderBy.length === 0) {
        throw new Error('LibSQLFactoryStorage: cursor pagination requires orderBy');
      }
      const cursor = this.#buildCursor(schema, opts.orderBy, opts.cursor.values);
      sql += ` AND ${cursor.sql}`;
      args.push(...cursor.args);
    }
    if (opts?.orderBy && opts.orderBy.length > 0) {
      const order = opts.orderBy
        .map(([column, dir]) => {
          this.#column(schema, column);
          return `"${column}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
        })
        .join(', ');
      sql += ` ORDER BY ${order}`;
    }
    if (opts?.limit !== undefined) {
      sql += ` LIMIT ?`;
      args.push(opts.limit);
    }

    const result = await this.#client.execute({ sql, args });
    return result.rows.map(raw => this.#deserializeRow<T>(schema, raw as unknown as Record<string, unknown>));
  }

  async findOne<T extends Record<string, unknown>>(collection: string, where: CollectionWhere): Promise<T | null> {
    const rows = await this.#select<T>(collection, where, { limit: 1 });
    return rows[0] ?? null;
  }

  async findMany<T extends Record<string, unknown>>(
    collection: string,
    where: CollectionWhere,
    opts?: CollectionListOptions,
  ): Promise<T[]> {
    return this.#select<T>(collection, where, opts);
  }

  async insertOne<T extends Record<string, unknown>>(collection: string, row: Partial<T>): Promise<T> {
    const schema = this.#schema(collection);
    const pk = primaryKeyOf(schema);

    const values: Record<string, unknown> = { ...row };
    if (schema.columns[pk]!.type === 'uuid-pk' && values[pk] === undefined) {
      values[pk] = randomUUID();
    }

    const columns = Object.keys(values).filter(column => values[column] !== undefined);
    for (const column of columns) this.#column(schema, column);

    const sql = `INSERT INTO "${schema.name}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${columns
      .map(() => '?')
      .join(', ')})`;
    const args = columns.map(column => this.#serialize(this.#column(schema, column), values[column]));

    try {
      await this.#client.execute({ sql, args });
    } catch (error) {
      if (isUniqueViolation(error)) throw new UniqueViolationError(collection, { cause: error });
      throw error;
    }

    const inserted = await this.findOne<T>(collection, { [pk]: values[pk] as CollectionValue });
    if (!inserted) throw new Error(`LibSQLFactoryStorage: failed to read back inserted row from '${collection}'`);
    return inserted;
  }

  async upsertOne<T extends Record<string, unknown>>(
    collection: string,
    conflictKeys: string[],
    row: Partial<T>,
  ): Promise<T> {
    const schema = this.#schema(collection);
    const pk = primaryKeyOf(schema);
    assertUpsertConflict(schema, conflictKeys, row);
    const keyWhere = Object.fromEntries(conflictKeys.map(key => [key, row[key] as CollectionValue])) as CollectionWhere;

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await this.findOne<T>(collection, keyWhere);
      if (existing) {
        const set = Object.fromEntries(
          Object.entries(row).filter(
            ([column, value]) => value !== undefined && column !== pk && !conflictKeys.includes(column),
          ),
        );
        if (Object.keys(set).length > 0) {
          await this.updateMany(collection, { [pk]: existing[pk] as CollectionValue }, set);
        }
        const updated = await this.findOne<T>(collection, { [pk]: existing[pk] as CollectionValue });
        if (!updated) continue; // deleted concurrently; retry
        return updated;
      }
      try {
        return await this.insertOne<T>(collection, row);
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        lastError = error; // lost an insert race; retry as update
      }
    }
    throw lastError ?? new Error(`LibSQLFactoryStorage: upsert into '${collection}' did not converge`);
  }

  async updateMany(collection: string, where: CollectionWhere, set: Record<string, unknown>): Promise<number> {
    const schema = this.#schema(collection);
    const columns = Object.keys(set).filter(column => set[column] !== undefined);
    if (columns.length === 0) return 0;
    const filter = this.#buildWhere(schema, where);
    const sql = `UPDATE "${schema.name}" SET ${columns.map(c => `"${c}" = ?`).join(', ')} WHERE ${filter.sql}`;
    const args = [...columns.map(column => this.#serialize(this.#column(schema, column), set[column])), ...filter.args];
    const result = await this.#client.execute({ sql, args });
    return result.rowsAffected;
  }

  async deleteMany(collection: string, where: CollectionWhere): Promise<number> {
    const schema = this.#schema(collection);
    const filter = this.#buildWhere(schema, where);
    const result = await this.#client.execute({
      sql: `DELETE FROM "${schema.name}" WHERE ${filter.sql}`,
      args: filter.args,
    });
    return result.rowsAffected;
  }

  async updateAtomic<T extends Record<string, unknown>>(
    collection: string,
    where: CollectionWhere,
    fn: (row: T) => Partial<T> | null | Promise<Partial<T> | null>,
  ): Promise<T | null> {
    const schema = this.#schema(collection);
    const pk = primaryKeyOf(schema);
    // libsql local is single-writer; serializing read-modify-write in process
    // gives the same "no lost updates" guarantee pg gets from FOR UPDATE.
    return this.#writeMutex.run(async () => {
      const row = await this.findOne<T>(collection, where);
      if (!row) return null;
      const patch = await fn(row);
      if (patch === null) return row;
      const pkWhere = { [pk]: row[pk] as CollectionValue } as CollectionWhere;
      await this.updateMany(collection, pkWhere, patch);
      return this.findOne<T>(collection, pkWhere);
    });
  }
}

/**
 * LibSQL/Turso {@link FactoryStorage} backend: one libsql database powering
 * agent state (via a wrapped {@link LibSQLStore}) and app-owned collections
 * (via {@link FactoryStorageOps}), sharing a single client.
 */
export class LibSQLFactoryStorage extends FactoryStorage {
  readonly ops: FactoryStorageOps;

  readonly #client: Client;
  readonly #config: LibSQLFactoryStorageConfig;
  readonly #schemas = new Map<string, CollectionSchema>();
  #mastraStorage?: LibSQLStore;

  constructor(config: LibSQLFactoryStorageConfig) {
    super();
    this.#config = config;
    const isLocalDb = config.url.startsWith('file:') || config.url.includes(':memory:');
    this.#client = createClient({
      url: config.url,
      ...(config.authToken ? { authToken: config.authToken } : {}),
      ...(isLocalDb ? { timeout: DEFAULT_CONNECTION_TIMEOUT_MS } : {}),
    });
    this.ops = new LibSQLFactoryStorageOps(this.#client, this.#schemas);
  }

  getMastraStorage(): MastraCompositeStore {
    this.#mastraStorage ??= new LibSQLStore({
      id: this.#config.id ?? 'libsql-factory',
      client: this.#client,
      ...(this.#config.retention ? { retention: this.#config.retention } : {}),
    });
    return this.#mastraStorage;
  }

  protected async initStorage(): Promise<void> {
    await this.#client.execute('SELECT 1');
  }

  async withTransaction<T>(fn: (ops: FactoryStorageOps) => Promise<T>): Promise<T> {
    if (this.#config.url.includes(':memory:')) return fn(this.ops);
    const transaction = await this.#client.transaction('write');
    try {
      const result = await fn(new LibSQLFactoryStorageOps(transaction, this.#schemas));
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }

  async ensureCollections(schemas: CollectionSchema[]): Promise<void> {
    for (const schema of schemas) {
      await this.#ensureCollection(schema);
      this.#schemas.set(schema.name, schema);
    }
  }

  async close(): Promise<void> {
    this.#client.close();
  }

  authDatabase(): FactoryAuthDatabase {
    return { dialect: 'libsql', client: this.#client };
  }

  #columnDdl(name: string, spec: CollectionColumnSpec): string {
    assertIdentifier('column', name);
    let ddl = `"${name}" ${COLUMN_DDL[spec.type]}`;
    if (spec.type === 'uuid-pk' || spec.primaryKey) ddl += ' PRIMARY KEY';
    if (!spec.nullable && spec.type !== 'uuid-pk' && !spec.primaryKey) ddl += ' NOT NULL';
    if (spec.default !== undefined) ddl += ` DEFAULT ${serializeDefault(spec.default)}`;
    return ddl;
  }

  /**
   * A table created by an older schema may still say NOT NULL on a column the
   * current schema declares nullable — inserts of null then fail on databases
   * that predate the change. SQLite has no `ALTER COLUMN DROP NOT NULL`, so
   * relaxation swaps in a table rebuilt from the current schema (create shadow
   * → copy → drop → rename) atomically.
   */
  async #relaxDriftedNotNulls(schema: CollectionSchema): Promise<void> {
    const info = await this.#client.execute(`PRAGMA table_info("${schema.name}")`);
    const hasDrift = info.rows.some(row => {
      const spec = schema.columns[String(row.name)];
      if (!spec || spec.type === 'uuid-pk' || spec.primaryKey) return false;
      return spec.nullable === true && Number(row.notnull) === 1;
    });
    if (!hasDrift) return;

    // The additive ADD COLUMN pass has already run, so every schema column
    // exists on the old table and can be copied straight across.
    const ddl = Object.entries(schema.columns).map(([name, spec]) => this.#columnDdl(name, spec));
    const shadow = `${schema.name}__nullable_rebuild`;
    const cols = Object.keys(schema.columns)
      .map(name => `"${name}"`)
      .join(', ');
    await this.#client.batch(
      [
        `DROP TABLE IF EXISTS "${shadow}"`,
        `CREATE TABLE "${shadow}" (${ddl.join(', ')})`,
        `INSERT INTO "${shadow}" (${cols}) SELECT ${cols} FROM "${schema.name}"`,
        `DROP TABLE "${schema.name}"`,
        `ALTER TABLE "${shadow}" RENAME TO "${schema.name}"`,
      ],
      'write',
    );
  }

  async #ensureCollection(schema: CollectionSchema): Promise<void> {
    assertIdentifier('collection', schema.name);
    primaryKeyOf(schema); // validates exactly one pk

    const columns = Object.entries(schema.columns).map(([name, spec]) => this.#columnDdl(name, spec));
    await this.#client.execute(`CREATE TABLE IF NOT EXISTS "${schema.name}" (${columns.join(', ')})`);

    // Additive evolution: add any columns missing from an existing table.
    const info = await this.#client.execute(`PRAGMA table_info("${schema.name}")`);
    const existing = new Set(info.rows.map(row => String(row.name)));
    for (const [name, spec] of Object.entries(schema.columns)) {
      if (existing.has(name)) continue;
      await this.#client.execute(`ALTER TABLE "${schema.name}" ADD COLUMN ${this.#columnDdl(name, spec)}`);
    }

    // Relaxing evolution: drop NOT NULL from columns the schema now declares
    // nullable. Runs before index creation — a rebuild drops the old table's
    // indexes, and the loops below recreate them.
    await this.#relaxDriftedNotNulls(schema);

    for (const index of schema.uniqueIndexes ?? []) {
      assertIdentifier('index', index.name);
      index.columns.forEach(column => assertIdentifier('column', column));
      let where = '';
      if (index.whereNotNull) {
        assertIdentifier('column', index.whereNotNull);
        where = ` WHERE "${index.whereNotNull}" IS NOT NULL`;
      } else if (index.whereNull) {
        assertIdentifier('column', index.whereNull);
        where = ` WHERE "${index.whereNull}" IS NULL`;
      }
      await this.#client.execute(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${index.name}" ON "${schema.name}" (${index.columns
          .map(c => `"${c}"`)
          .join(', ')})${where}`,
      );
    }
    for (const index of schema.indexes ?? []) {
      assertIdentifier('index', index.name);
      index.columns.forEach(column => assertIdentifier('column', column));
      await this.#client.execute(
        `CREATE INDEX IF NOT EXISTS "${index.name}" ON "${schema.name}" (${index.columns
          .map(c => `"${c}"`)
          .join(', ')})`,
      );
    }
  }
}
