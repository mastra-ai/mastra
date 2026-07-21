import { createHash, randomUUID } from 'node:crypto';

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
import pg from 'pg';
import type { Pool, PoolClient } from 'pg';

import { PostgresStore } from './index';

export type PgFactoryStorageConfig =
  | {
      connectionString: string;
      /** Identifier for the wrapped agent-state store. @default 'pg-factory' */
      id?: string;
      /** Retention config forwarded to the wrapped {@link PostgresStore}. */
      retention?: RetentionConfig;
    }
  | {
      /** Wrap an existing store; its pool is shared for app-table ops. */
      store: PostgresStore;
    };

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PG_UNIQUE_VIOLATION = '23505';

const COLUMN_DDL: Record<CollectionColumnSpec['type'], string> = {
  text: 'TEXT',
  bigint: 'BIGINT',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  json: 'JSONB',
  timestamp: 'TIMESTAMPTZ',
  'uuid-pk': 'UUID',
};

function assertIdentifier(kind: string, name: string): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`PgFactoryStorage: invalid ${kind} identifier '${name}'`);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === PG_UNIQUE_VIOLATION;
}

function primaryKeyOf(schema: CollectionSchema): string {
  const pks = Object.entries(schema.columns).filter(([, spec]) => spec.type === 'uuid-pk' || spec.primaryKey);
  if (pks.length !== 1) {
    throw new Error(
      `PgFactoryStorage: collection '${schema.name}' must declare exactly one primary key (found ${pks.length})`,
    );
  }
  return pks[0]![0];
}

function assertUpsertConflict(schema: CollectionSchema, conflictKeys: string[], row: Record<string, unknown>): void {
  const keys = new Set(conflictKeys);
  if (keys.size !== conflictKeys.length || conflictKeys.some(key => row[key] === undefined)) {
    throw new Error(
      `PgFactoryStorage: upsert conflict keys for '${schema.name}' must be unique and present in the row`,
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
      `PgFactoryStorage: upsert conflict keys [${conflictKeys.join(', ')}] do not match an applicable primary key or unique index on '${schema.name}'`,
    );
  }
}

function serializeDefault(value: string | number | boolean): string {
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  return String(value);
}

/**
 * Hash a lock key into the two signed int4 values `pg_advisory_xact_lock(int4, int4)`
 * expects. Two int4 args keep factory locks in their own namespace, away from
 * single-int8 advisory locks other tooling might take.
 */
export function hashAdvisoryLockKey(key: string): [number, number] {
  const digest = createHash('sha256').update(key).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

class PgFactoryStorageOps implements FactoryStorageOps {
  readonly #pool: Pool;
  readonly #schemas: Map<string, CollectionSchema>;

  constructor(pool: Pool, schemas: Map<string, CollectionSchema>) {
    this.#pool = pool;
    this.#schemas = schemas;
  }

  #schema(collection: string): CollectionSchema {
    const schema = this.#schemas.get(collection);
    if (!schema) {
      throw new Error(
        `PgFactoryStorage: unknown collection '${collection}' — register it via ensureCollections() first`,
      );
    }
    return schema;
  }

  #column(schema: CollectionSchema, column: string): CollectionColumnSpec {
    const spec = schema.columns[column];
    if (!spec) {
      throw new Error(`PgFactoryStorage: unknown column '${column}' on collection '${schema.name}'`);
    }
    return spec;
  }

  #serialize(spec: CollectionColumnSpec, value: unknown): unknown {
    if (value === null || value === undefined) return null;
    switch (spec.type) {
      case 'timestamp':
        return value instanceof Date ? value : new Date(String(value));
      case 'boolean':
        return Boolean(value);
      case 'json':
        // Explicit stringify: node-pg would otherwise turn JS arrays into pg arrays.
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
          row[name] = value instanceof Date ? value : new Date(String(value));
          break;
        case 'boolean':
          row[name] = Boolean(value);
          break;
        case 'json':
          row[name] = typeof value === 'string' ? JSON.parse(value) : value;
          break;
        case 'bigint':
        case 'integer':
          row[name] = Number(value); // node-pg returns BIGINT as string
          break;
        default:
          row[name] = String(value);
      }
    }
    return row as T;
  }

  /** Builds `WHERE` SQL (without the keyword). `{}` yields a match-all clause. */
  #buildWhere(
    schema: CollectionSchema,
    where: CollectionWhere,
    startIndex = 1,
  ): { sql: string; args: unknown[]; nextIndex: number } {
    const clauses: string[] = [];
    const args: unknown[] = [];
    let index = startIndex;
    for (const [column, condition] of Object.entries(where)) {
      const spec = this.#column(schema, column);
      if (condition !== null && typeof condition === 'object' && !(condition instanceof Date) && 'in' in condition) {
        if (condition.in.length === 0) {
          clauses.push('FALSE');
          continue;
        }
        const nonNull = condition.in.filter(value => value !== null);
        const includesNull = nonNull.length !== condition.in.length;
        const inClause =
          nonNull.length > 0 ? `"${column}" IN (${nonNull.map(() => `$${index++}`).join(', ')})` : undefined;
        clauses.push(
          inClause && includesNull ? `(${inClause} OR "${column}" IS NULL)` : (inClause ?? `"${column}" IS NULL`),
        );
        args.push(...nonNull.map(value => this.#serialize(spec, value)));
      } else if (condition === null) {
        clauses.push(`"${column}" IS NULL`);
      } else {
        clauses.push(`"${column}" = $${index++}`);
        args.push(this.#serialize(spec, condition));
      }
    }
    return { sql: clauses.length > 0 ? clauses.join(' AND ') : 'TRUE', args, nextIndex: index };
  }

  /** Keyset condition: rows strictly after `cursor.values` in the `orderBy` order. */
  #buildCursor(
    schema: CollectionSchema,
    orderBy: NonNullable<CollectionListOptions['orderBy']>,
    values: CollectionValue[],
    startIndex: number,
  ): { sql: string; args: unknown[]; nextIndex: number } {
    if (values.length !== orderBy.length) {
      throw new Error(`PgFactoryStorage: cursor has ${values.length} values but orderBy has ${orderBy.length} columns`);
    }
    const branches: string[] = [];
    const args: unknown[] = [];
    let index = startIndex;
    for (let i = 0; i < orderBy.length; i++) {
      const parts: string[] = [];
      for (let j = 0; j < i; j++) {
        const [column] = orderBy[j]!;
        parts.push(`"${column}" = $${index++}`);
        args.push(this.#serialize(this.#column(schema, column), values[j]));
      }
      const [column, dir] = orderBy[i]!;
      parts.push(`"${column}" ${dir === 'desc' ? '<' : '>'} $${index++}`);
      args.push(this.#serialize(this.#column(schema, column), values[i]));
      branches.push(`(${parts.join(' AND ')})`);
    }
    return { sql: `(${branches.join(' OR ')})`, args, nextIndex: index };
  }

  #buildSelect(
    schema: CollectionSchema,
    where: CollectionWhere,
    opts?: CollectionListOptions,
    forUpdate = false,
  ): { sql: string; args: unknown[] } {
    const filter = this.#buildWhere(schema, where);
    let sql = `SELECT * FROM "${schema.name}" WHERE ${filter.sql}`;
    const args = [...filter.args];
    let index = filter.nextIndex;

    if (opts?.cursor) {
      if (!opts.orderBy || opts.orderBy.length === 0) {
        throw new Error('PgFactoryStorage: cursor pagination requires orderBy');
      }
      const cursor = this.#buildCursor(schema, opts.orderBy, opts.cursor.values, index);
      sql += ` AND ${cursor.sql}`;
      args.push(...cursor.args);
      index = cursor.nextIndex;
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
      sql += ` LIMIT $${index++}`;
      args.push(opts.limit);
    }
    if (forUpdate) sql += ' FOR UPDATE';
    return { sql, args };
  }

  async #select<T extends Record<string, unknown>>(
    queryable: Queryable,
    collection: string,
    where: CollectionWhere,
    opts?: CollectionListOptions,
    forUpdate = false,
  ): Promise<T[]> {
    const schema = this.#schema(collection);
    const { sql, args } = this.#buildSelect(schema, where, opts, forUpdate);
    const result = await queryable.query(sql, args);
    return result.rows.map((raw: Record<string, unknown>) => this.#deserializeRow<T>(schema, raw));
  }

  async findOne<T extends Record<string, unknown>>(collection: string, where: CollectionWhere): Promise<T | null> {
    const rows = await this.#select<T>(this.#pool, collection, where, { limit: 1 });
    return rows[0] ?? null;
  }

  async findMany<T extends Record<string, unknown>>(
    collection: string,
    where: CollectionWhere,
    opts?: CollectionListOptions,
  ): Promise<T[]> {
    return this.#select<T>(this.#pool, collection, where, opts);
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
      .map((_, i) => `$${i + 1}`)
      .join(', ')}) RETURNING *`;
    const args = columns.map(column => this.#serialize(this.#column(schema, column), values[column]));

    try {
      const result = await this.#pool.query(sql, args);
      return this.#deserializeRow<T>(schema, result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (isUniqueViolation(error)) throw new UniqueViolationError(collection, { cause: error });
      throw error;
    }
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
    throw lastError ?? new Error(`PgFactoryStorage: upsert into '${collection}' did not converge`);
  }

  async updateMany(collection: string, where: CollectionWhere, set: Record<string, unknown>): Promise<number> {
    return this.#updateMany(this.#pool, collection, where, set);
  }

  async #updateMany(
    queryable: Queryable,
    collection: string,
    where: CollectionWhere,
    set: Record<string, unknown>,
  ): Promise<number> {
    const schema = this.#schema(collection);
    const columns = Object.keys(set).filter(column => set[column] !== undefined);
    if (columns.length === 0) return 0;
    const assignments = columns.map((column, i) => `"${column}" = $${i + 1}`).join(', ');
    const filter = this.#buildWhere(schema, where, columns.length + 1);
    const args = [...columns.map(column => this.#serialize(this.#column(schema, column), set[column])), ...filter.args];
    const result = await queryable.query(`UPDATE "${schema.name}" SET ${assignments} WHERE ${filter.sql}`, args);
    return result.rowCount ?? 0;
  }

  async deleteMany(collection: string, where: CollectionWhere): Promise<number> {
    const schema = this.#schema(collection);
    const filter = this.#buildWhere(schema, where);
    const result = await this.#pool.query(`DELETE FROM "${schema.name}" WHERE ${filter.sql}`, filter.args);
    return result.rowCount ?? 0;
  }

  async updateAtomic<T extends Record<string, unknown>>(
    collection: string,
    where: CollectionWhere,
    fn: (row: T) => Partial<T> | null | Promise<Partial<T> | null>,
  ): Promise<T | null> {
    const schema = this.#schema(collection);
    const pk = primaryKeyOf(schema);
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      try {
        const rows = await this.#select<T>(client, collection, where, { limit: 1 }, true);
        const row = rows[0];
        if (!row) {
          await client.query('COMMIT');
          return null;
        }
        const patch = await fn(row);
        let result: T | null = row;
        if (patch !== null) {
          const pkWhere = { [pk]: row[pk] as CollectionValue } as CollectionWhere;
          await this.#updateMany(client, collection, pkWhere, patch);
          const updated = await this.#select<T>(client, collection, pkWhere, { limit: 1 });
          result = updated[0] ?? null;
        }
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } finally {
      client.release();
    }
  }
}

/**
 * PostgreSQL {@link FactoryStorage} backend: one database powering agent state
 * (via a wrapped {@link PostgresStore}) and app-owned collections (via
 * {@link FactoryStorageOps}), sharing a single pool.
 *
 * Provides `withDistributedLock` (transaction-scoped advisory locks) for
 * cross-replica serialization and `authDatabase()` exposing the shared pool.
 */
export class PgFactoryStorage extends FactoryStorage {
  readonly ops: FactoryStorageOps;

  readonly #pool: Pool;
  readonly #ownsPool: boolean;
  readonly #config: PgFactoryStorageConfig;
  readonly #schemas = new Map<string, CollectionSchema>();
  #mastraStorage?: PostgresStore;

  constructor(config: PgFactoryStorageConfig) {
    super();
    this.#config = config;
    if ('store' in config) {
      this.#pool = config.store.pool;
      this.#ownsPool = false;
      this.#mastraStorage = config.store;
    } else {
      this.#pool = new pg.Pool({ connectionString: config.connectionString });
      this.#ownsPool = true;
    }
    this.ops = new PgFactoryStorageOps(this.#pool, this.#schemas);
  }

  getMastraStorage(): MastraCompositeStore {
    if (!this.#mastraStorage) {
      const config = this.#config as Extract<PgFactoryStorageConfig, { connectionString: string }>;
      this.#mastraStorage = new PostgresStore({
        id: config.id ?? 'pg-factory',
        pool: this.#pool,
        ...(config.retention ? { retention: config.retention } : {}),
      });
    }
    return this.#mastraStorage;
  }

  protected async initStorage(): Promise<void> {
    await this.#pool.query('SELECT 1');
  }

  async ensureCollections(schemas: CollectionSchema[]): Promise<void> {
    for (const schema of schemas) {
      await this.#ensureCollection(schema);
      this.#schemas.set(schema.name, schema);
    }
  }

  async close(): Promise<void> {
    if (this.#ownsPool) {
      await this.#pool.end();
    } else {
      await this.#mastraStorage?.close();
    }
  }

  authDatabase(): FactoryAuthDatabase {
    return { dialect: 'postgres', pool: this.#pool };
  }

  /**
   * Run `fn` while holding a Postgres transaction-scoped advisory lock for
   * `key`, serializing callers across replicas. The lock releases when the
   * transaction ends (commit, rollback, or connection loss), so a crashed
   * replica can never hold it forever.
   */
  async withDistributedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const [k1, k2] = hashAdvisoryLockKey(key);
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      // Blocks until no other transaction holds this advisory key.
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [k1, k2]);
      try {
        const result = await fn();
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } finally {
      client.release();
    }
  }

  #columnDdl(name: string, spec: CollectionColumnSpec): string {
    assertIdentifier('column', name);
    let ddl = `"${name}" ${COLUMN_DDL[spec.type]}`;
    if (spec.type === 'uuid-pk' || spec.primaryKey) ddl += ' PRIMARY KEY';
    if (!spec.nullable && spec.type !== 'uuid-pk' && !spec.primaryKey) ddl += ' NOT NULL';
    if (spec.default !== undefined) ddl += ` DEFAULT ${serializeDefault(spec.default)}`;
    return ddl;
  }

  async #ensureCollection(schema: CollectionSchema): Promise<void> {
    assertIdentifier('collection', schema.name);
    primaryKeyOf(schema); // validates exactly one pk

    const columns = Object.entries(schema.columns).map(([name, spec]) => this.#columnDdl(name, spec));
    await this.#pool.query(`CREATE TABLE IF NOT EXISTS "${schema.name}" (${columns.join(', ')})`);

    // Additive evolution: add any columns missing from an existing table.
    for (const [name, spec] of Object.entries(schema.columns)) {
      await this.#pool.query(`ALTER TABLE "${schema.name}" ADD COLUMN IF NOT EXISTS ${this.#columnDdl(name, spec)}`);
    }

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
      await this.#pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${index.name}" ON "${schema.name}" (${index.columns
          .map(c => `"${c}"`)
          .join(', ')})${where}`,
      );
    }
    for (const index of schema.indexes ?? []) {
      assertIdentifier('index', index.name);
      index.columns.forEach(column => assertIdentifier('column', column));
      await this.#pool.query(
        `CREATE INDEX IF NOT EXISTS "${index.name}" ON "${schema.name}" (${index.columns
          .map(c => `"${c}"`)
          .join(', ')})`,
      );
    }
  }
}
